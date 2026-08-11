import type { CaseStatus } from "../prisma/generated/enums";
import { designatedAttorneyWhere } from "./cases";
import prisma from "./index";

/**
 * Payout-account reads and writes (donations).
 *
 * Donations pay the **operating account of the firm representing the case**, and there
 * is **one Stripe account per case**: an attorney onboards separately for each case
 * they represent, so no two cases share a balance or a bank destination. The attorney
 * onboards it; the plaintiff binds their case to it; the attorney moves the money into
 * trust under their own bar's rules. Nothing here routes money to a plaintiff.
 *
 * Everything is therefore keyed on a **case**, not a person. `userId` is who holds the
 * account, and is no longer unique.
 *
 * The capability columns are a **cache of Stripe's view**, so everything that writes
 * them takes them from a Stripe payload — never from a form. See `syncPayoutAccount`.
 */

/**
 * Candidate pages for the "business website" Stripe asks for when onboarding the
 * account for one case.
 *
 * Stripe requires a business URL and states that placeholder sites are not supported
 * — it wants a page evidencing the actual activity. Three sources, best first, and
 * the caller turns whichever exists into a URL:
 *
 *  - `firmWebsiteUrl` — the firm's own site. For a law firm this is a real business
 *    website with a real address and named practitioners, which is exactly what a
 *    reviewer wants and better than anything we could host.
 *  - `caseId` — **this** case's public page, when it is live: the story, the goal and
 *    the attorney's own name on it. Since the account exists for one case, that page
 *    is the most direct evidence of what the account is for.
 *
 *    Rarely available now, and the `live` condition is load-bearing rather than
 *    incidental: onboarding usually happens while the case is `pending_payout`,
 *    precisely so it is not public yet, and handing Stripe's reviewer a URL that
 *    404s is worse than offering nothing. A case reaches this branch only by the
 *    routes that reach onboarding after publication — a change of counsel, or an
 *    account re-opened on a case already raising.
 *  - `profileId` — their public JustUs directory profile, which only resolves for a
 *    bar-verified listed attorney. Linking a reviewer to a page that 404s is worse
 *    than linking the platform, so this is only offered when it will load.
 */
export async function attorneyBusinessUrlSources(input: {
	userId: string;
	caseId: string;
}): Promise<{
	firmWebsiteUrl: string | null;
	profileId: string | null;
	caseId: string | null;
}> {
	const [profile, kase] = await Promise.all([
		prisma.attorneyProfile.findUnique({
			where: { userId: input.userId },
			select: { id: true, websiteUrl: true, verificationStatus: true },
		}),
		prisma.case.findFirst({
			where: { id: input.caseId, status: "live", deletedAt: null },
			select: { id: true },
		}),
	]);
	return {
		firmWebsiteUrl: profile?.websiteUrl?.trim() || null,
		// Matches what `/attorneys/[id]` will actually serve — see getDirectoryAttorney.
		profileId: profile?.verificationStatus === "verified" ? profile.id : null,
		caseId: kase?.id ?? null,
	};
}

/**
 * The account opened for one case, or null if onboarding has not started for it.
 *
 * Keyed on the case rather than the holder: an attorney with three cases has three
 * accounts, and "their account" is not a question with one answer.
 */
export async function getPayoutAccountForCase(caseId: string) {
	return prisma.payoutAccount.findUnique({ where: { caseId } });
}

/**
 * How many live cases are held up by this attorney not finishing an account.
 *
 * Per-case onboarding moved the blocking step onto someone who has no reason to look
 * for it, and multiplied it: a plaintiff can publish, tell their donors, and be stuck
 * because their attorney completed setup for a *different* case and assumed they were
 * done. The attorney's home screen is where that has to surface.
 *
 * Only counts what **they** can act on — a case whose own account can already receive
 * is excluded even if the plaintiff has not pressed bind yet, because that step is the
 * plaintiff's and nagging an attorney about it would be noise they cannot clear.
 *
 * `live` **and** `pending_payout`. The second is now the more urgent of the two and
 * the reason this count exists at all: a `pending_payout` case is not merely unable to
 * take donations, it is not public — nobody can see it, share it or give to it until
 * this attorney finishes. A `live` case at least raises the moment they do.
 *
 * `draft` and `seeking` stay out: neither is waiting on anyone's bank details.
 */
export async function attorneyPayoutReadiness(input: {
	userId: string;
	email: string;
}): Promise<{
	/** Cases of theirs with no account started at all. */
	unstartedCases: number;
	/** Cases whose account exists but cannot yet receive. */
	unfinishedCases: number;
	/** Of the unfinished, how many are simply awaiting Stripe rather than them. */
	inReviewCases: number;
	waitingCases: number;
	/**
	 * Of the waiting, how many are `pending_payout` — held back from the public
	 * entirely, not merely unable to take money. The sharpest thing the nudge can
	 * say, because it is the plaintiff's whole campaign that has not started.
	 */
	blockedCases: number;
}> {
	const cases = await prisma.case.findMany({
		where: {
			status: { in: ["pending_payout", "live"] },
			deletedAt: null,
			// Both routes an attorney can be on a case — see `representingAttorney`.
			// The email route carries its own conditions (`designatedAttorneyWhere`);
			// its status allow-list intersects with the one above rather than widening
			// it, so a `closed` case still can't be counted as work outstanding.
			OR: [
				{ match: { attorneyId: input.userId } },
				designatedAttorneyWhere(input.email),
			],
		},
		select: {
			status: true,
			payoutAccountForCase: {
				select: {
					userId: true,
					detailsSubmitted: true,
					transfersEnabled: true,
				},
			},
		},
	});

	let unstartedCases = 0;
	let unfinishedCases = 0;
	let inReviewCases = 0;
	let blockedCases = 0;
	for (const k of cases) {
		const account =
			k.payoutAccountForCase?.userId === input.userId
				? k.payoutAccountForCase
				: null;
		if (!account) {
			unstartedCases += 1;
		} else if (!account.transfersEnabled) {
			unfinishedCases += 1;
			if (account.detailsSubmitted) inReviewCases += 1;
		} else {
			// Can already receive — not waiting on this attorney for anything.
			continue;
		}
		if (k.status === "pending_payout") blockedCases += 1;
	}
	return {
		unstartedCases,
		unfinishedCases,
		inReviewCases,
		waitingCases: unstartedCases + unfinishedCases,
		blockedCases,
	};
}

/** Look up by Stripe id — how the requirements webhook finds its row. */
export async function getPayoutAccountByStripeId(stripeAccountId: string) {
	return prisma.payoutAccount.findUnique({ where: { stripeAccountId } });
}

/**
 * Record the Stripe account opened for a case, or update the capabilities of the one
 * already recorded.
 *
 * Upsert on `caseId` rather than insert, because onboarding is resumable: an attorney
 * who abandons the hosted flow and comes back must land on the same Stripe account for
 * that case, not a second one. `stripeAccountId` and `userId` are only written on
 * create — an account's id never changes, and quietly repointing either would orphan
 * money already sent to the old one, or hand one firm's account to another.
 */
export async function syncPayoutAccount(input: {
	userId: string;
	/** The case this account exists for. */
	caseId: string;
	stripeAccountId: string;
	detailsSubmitted: boolean;
	transfersEnabled: boolean;
	payoutsEnabled: boolean;
}) {
	const capabilities = {
		detailsSubmitted: input.detailsSubmitted,
		transfersEnabled: input.transfersEnabled,
		payoutsEnabled: input.payoutsEnabled,
		syncedAt: new Date(),
	};
	const account = await prisma.payoutAccount.upsert({
		where: { caseId: input.caseId },
		create: {
			userId: input.userId,
			caseId: input.caseId,
			stripeAccountId: input.stripeAccountId,
			...capabilities,
		},
		update: capabilities,
	});
	// An account that can now receive settles a live case that never got bound. See
	// `bindReadyLiveCase` — without this the attorney finishes setup, their panel
	// reads "Active", and the case still refuses every donation.
	if (input.transfersEnabled) await bindReadyLiveCase(input.caseId);
	return account;
}

/**
 * Apply a requirements webhook to whichever user holds that Stripe account.
 *
 * Under Accounts v2 the event is `v2.core.account[requirements].updated`, not v1's
 * `account.updated`.
 *
 * Keyed on `stripeAccountId` because the webhook knows the account, not the user.
 * Returns null when no row matches, which is normal rather than exceptional: the
 * platform's own account and Stripe's sample accounts both emit these events, and
 * neither belongs to a JustUs user.
 */
export async function applyAccountUpdate(input: {
	stripeAccountId: string;
	detailsSubmitted: boolean;
	transfersEnabled: boolean;
	payoutsEnabled: boolean;
}) {
	const existing = await prisma.payoutAccount.findUnique({
		where: { stripeAccountId: input.stripeAccountId },
		select: { id: true },
	});
	if (!existing) return null;
	const account = await prisma.payoutAccount.update({
		where: { id: existing.id },
		data: {
			detailsSubmitted: input.detailsSubmitted,
			transfersEnabled: input.transfersEnabled,
			payoutsEnabled: input.payoutsEnabled,
			syncedAt: new Date(),
		},
	});
	// The moment Stripe clears an account is the moment its live case can finally
	// take money — the webhook is the only thing watching, so it does the binding.
	// `caseId` is nullable for accounts opened before payouts were per-case; those
	// belong to no case and have nothing to bind.
	if (account.transfersEnabled && account.caseId) {
		await bindReadyLiveCase(account.caseId);
	}
	return account;
}

/**
 * The destination a case's donations go to, resolved for the charge path.
 *
 * Reads the **bound** account (`Case.payoutAccountId`) rather than deriving one at
 * charge time, so nothing that happens to a case later — a re-match, a change of
 * attorney — can redirect money mid-campaign. Returns a reason rather than
 * throwing, because every failure here is a legitimate state the donate button has
 * to explain: nothing bound yet, or a recipient partway through onboarding.
 */
export type PayoutDestination =
	| {
			ok: true;
			stripeAccountId: string;
			/** The account holder — the attorney who onboarded the firm's account. */
			holderName: string;
			/** Their firm, when they gave one at sign-up. The name money is paid to. */
			holderFirm: string | null;
	  }
	| { ok: false; reason: "not_live" | "unbound" | "transfers_disabled" };

export async function resolvePayoutDestination(
	caseId: string,
): Promise<PayoutDestination> {
	const accountSelect = {
		id: true,
		stripeAccountId: true,
		transfersEnabled: true,
		user: { select: { name: true, firmName: true } },
	} as const;

	const k = await prisma.case.findFirst({
		where: { id: caseId, deletedAt: null },
		select: {
			id: true,
			status: true,
			payoutAccountId: true,
			// The bound destination (the frozen recipient).
			payoutAccount: { select: accountSelect },
			// The account the attorney opened *for this case*, whether or not the case
			// has been bound to it yet.
			payoutAccountForCase: { select: accountSelect },
		},
	});
	if (!k || k.status !== "live") return { ok: false, reason: "not_live" };

	let account = k.payoutAccount;

	// Self-heal a live case that was never bound. Binding normally happens at
	// go-live; a case that reached `live` without it (seeded/imported, or a missed
	// bind after the attorney finished onboarding) is stranded — the firm can
	// receive, but donors are told it "can't accept donations yet". If the case's
	// own attorney account is ready, bind to it now. Safe: an unbound case has taken
	// no donations, so there is no prior recipient disclosure to preserve.
	if (!k.payoutAccountId && k.payoutAccountForCase?.transfersEnabled) {
		await prisma.case.updateMany({
			where: { id: k.id, payoutAccountId: null },
			data: {
				payoutAccountId: k.payoutAccountForCase.id,
				payoutRecipient: "attorney",
			},
		});
		account = k.payoutAccountForCase;
	}

	if (!account) return { ok: false, reason: "unbound" };
	if (!account.transfersEnabled) {
		return { ok: false, reason: "transfers_disabled" };
	}
	return {
		ok: true,
		stripeAccountId: account.stripeAccountId,
		holderName: account.user.name,
		holderFirm: account.user.firmName?.trim() || null,
	};
}

/**
 * Everything the payout screens and the bind path need about an attorney.
 *
 * No account is selected through the *attorney* any more. Accounts are per case, so
 * "this attorney's account" is not a question with one answer — the case's own account
 * comes from `payoutAccountForCase` on the case row instead.
 */
const ATTORNEY_SELECT = {
	id: true,
	name: true,
	email: true,
	firmName: true,
	barNumber: true,
} as const;

/** The case columns `representingAttorney` resolves from. */
const REPRESENTING_SELECT = {
	id: true,
	status: true,
	payoutAccountId: true,
	attorneyEmail: true,
	// The account opened for *this* case. `userId` comes back so the caller can refuse
	// an account opened by a different firm for a case that has since changed counsel.
	payoutAccountForCase: {
		select: {
			id: true,
			userId: true,
			detailsSubmitted: true,
			transfersEnabled: true,
		},
	},
	// Read from the match rather than the case's own `attorneyName` text: the wizard's
	// copy is what the plaintiff typed, this is the account money will reach.
	match: { select: { attorney: { select: ATTORNEY_SELECT } } },
} as const;

type RepresentingAttorney = {
	id: string;
	name: string;
	email: string;
	firmName: string | null;
	barNumber: string | null;
};

/** The account opened for a case, but only if the representing attorney holds it. */
type CaseAccount = {
	id: string;
	userId: string;
	detailsSubmitted: boolean;
	transfersEnabled: boolean;
} | null;

function accountHeldBy(account: CaseAccount, attorneyId: string): CaseAccount {
	return account && account.userId === attorneyId ? account : null;
}

/**
 * The user whose firm account a case pays out to, and how that link was made.
 *
 * Two routes reach an attorney, and both have to be able to fund — a plaintiff who
 * brought their own attorney is not a second-class case:
 *
 *  - **`match`** — an accepted expression of interest. Authoritative: both sides
 *    agreed, on the record, and it names a `User` directly.
 *  - **`invited_email`** — the case has no `Match` (the bring-your-own path writes
 *    only `attorneyEmail`), so the attorney the plaintiff *designated* is looked up by
 *    that address. It resolves only to a registered `attorney` account, so an address
 *    belonging to nobody, or to a donor, is no link at all. This is what makes "your
 *    attorney signs up and links their firm's account" work without a separate
 *    invitation record.
 *
 * The email route is a designation by the plaintiff, so `via` comes back with the
 * attorney: the bind screen names the firm and the address before the plaintiff
 * confirms, because a mistyped address is the one way this points at the wrong firm.
 */
async function representingAttorney(k: {
	status: CaseStatus;
	attorneyEmail: string | null;
	match: { attorney: RepresentingAttorney } | null;
}): Promise<{
	attorney: RepresentingAttorney;
	via: "match" | "invited_email";
} | null> {
	if (k.match) return { attorney: k.match.attorney, via: "match" };
	// A case that is still `draft` or `seeking` has not been committed to anybody.
	// Since the invitation flow a `seeking` case can carry the typed address while
	// the attorney it names has yet to answer, and resolving them here would name a
	// firm on the plaintiff's payout screen that has agreed to nothing.
	if (k.status === "draft" || k.status === "seeking") return null;
	const email = k.attorneyEmail?.trim();
	if (!email) return null;
	const attorney = await prisma.user.findFirst({
		// Role-gated on purpose: only an attorney account can hold the firm's payout
		// account, and resolving to any other role would let a plaintiff route their
		// own case's money to an ordinary account by typing the right address.
		where: { email: { equals: email, mode: "insensitive" }, role: "attorney" },
		select: ATTORNEY_SELECT,
	});
	return attorney ? { attorney, via: "invited_email" } : null;
}

/**
 * The case an attorney is entitled to open a payout account for, or null.
 *
 * **The authorization check for onboarding.** Onboarding is now per case, so the case
 * id arrives from the client, and without this an attorney could attach a Stripe
 * account to a stranger's case — then be bound to it the moment that plaintiff opened
 * donations, and receive their money. Representation is re-derived here from the case
 * row rather than trusted from the request.
 *
 * Returns the title as well, because the account's display name and Stripe metadata are
 * built from it and the caller should not have to re-read the case to get it.
 */
export async function attorneyRepresentedCase(input: {
	userId: string;
	email: string;
	caseId: string;
}): Promise<{ id: string; title: string; status: string } | null> {
	const k = await prisma.case.findFirst({
		where: {
			id: input.caseId,
			deletedAt: null,
			OR: [
				{ match: { attorneyId: input.userId } },
				// A typed address alone is not authority to open a Stripe account against
				// someone's case — see `designatedAttorneyWhere`. An attorney invited to a
				// `seeking` case reaches this only after confirming, which writes the
				// match the branch above reads.
				designatedAttorneyWhere(input.email),
			],
		},
		select: { id: true, title: true, status: true },
	});
	return k;
}

/**
 * What the payout step of a case needs to render: whether the destination is bound,
 * and how far the representing firm's Stripe onboarding has got.
 *
 * There is no recipient *choice* to report. Donations pay the firm representing the
 * case, so this is a readiness check on one account — but unlike the previous model
 * that account belongs to someone other than the person reading the screen, and the
 * plaintiff can do nothing but wait on it. That is why the attorney's name, firm and
 * contact email come back too: the plaintiff's only available action is to chase
 * them, and a screen that says "not ready" without saying *who* is not ready leaves
 * them stuck.
 *
 * The account reported is the one opened **for this case**, not any other the attorney
 * holds. With per-case onboarding, an attorney who is fully set up on two other matters
 * has done nothing for this one — reporting their readiness in general would tell the
 * plaintiff their case is ready to fund when it cannot take a dollar.
 *
 * `attorney` is null when nobody is linked yet — a `draft`/`seeking` case, or one
 * whose designated attorney has not registered. `designatedEmail` is returned
 * alongside so that state can name the address being waited on.
 */
export async function getCasePayoutOptions(caseId: string, ownerId: string) {
	const k = await prisma.case.findFirst({
		where: { id: caseId, ownerId, deletedAt: null },
		select: REPRESENTING_SELECT,
	});
	if (!k) return null;

	const representing = await representingAttorney(k);
	const attorney = representing?.attorney;
	const account = attorney
		? accountHeldBy(k.payoutAccountForCase, attorney.id)
		: null;
	return {
		status: k.status,
		bound: !!k.payoutAccountId,
		designatedEmail: k.attorneyEmail?.trim() || null,
		attorney: attorney
			? {
					name: attorney.name,
					email: attorney.email,
					firmName: attorney.firmName?.trim() || null,
					// Surfaced, not enforced: bar standing gates the directory badge, not the
					// money. A case whose attorney is mid-verification can still fund.
					barNumber: attorney.barNumber?.trim() || null,
					via: representing.via,
					hasAccount: !!account,
					detailsSubmitted: account?.detailsSubmitted ?? false,
					transfersEnabled: account?.transfersEnabled ?? false,
				}
			: null,
	};
}

/**
 * Bind a case to its payout destination.
 *
 * The destination is **the account opened for this case**, and it must be held by the
 * attorney the case's own match or designated email resolves to. Both halves of that
 * are derived from the case row rather than passed in, so there is no input a caller
 * could vary to point a case at an arbitrary account. That is the one mistake in this
 * file that would move real money to the wrong person, and the reason neither the
 * account id nor the attorney id is a parameter.
 *
 * Checking the holder is not redundant with `caseId` being unique. A case that changes
 * counsel keeps the previous firm's account row until the new firm opens theirs, and
 * binding in that window would send the new attorney's client's money to the firm that
 * left.
 *
 * The plaintiff is still the one who calls this: they own the case and they decide
 * when it opens for donations. What they cannot do is choose the destination.
 *
 * Idempotent and re-runnable while a case is not yet live; rebinding a `live` case is
 * refused, because donors have already been shown who receives.
 */
export type BindResult =
	| { ok: true; firmName: string | null; attorneyName: string }
	| {
			ok: false;
			reason:
				| "case_not_found"
				| "already_live"
				| "no_attorney"
				| "attorney_no_account";
	  };

/**
 * The destination a bind would write, derived entirely from the case row.
 *
 * Shared by `bindCasePayout` and `goLiveCase` so there is exactly one place that
 * decides whose account a case's money goes to. Neither the account id nor the
 * attorney id is a parameter anywhere in that chain — that is the whole point.
 */
async function resolveBindTarget(caseId: string, ownerId: string) {
	const k = await prisma.case.findFirst({
		where: { id: caseId, ownerId, deletedAt: null },
		select: REPRESENTING_SELECT,
	});
	if (!k) return { ok: false as const, reason: "case_not_found" as const, k };

	// Nobody linked means no firm to pay. Reported separately from "the firm hasn't
	// onboarded" because they are different problems with different fixes: get your
	// attorney onto the platform, versus wait on the one who is already here.
	const representing = await representingAttorney(k);
	if (!representing) {
		return { ok: false as const, reason: "no_attorney" as const, k };
	}
	const { attorney } = representing;
	// This case's own account, and only if the representing attorney holds it.
	const account = accountHeldBy(k.payoutAccountForCase, attorney.id);
	if (!account) {
		return { ok: false as const, reason: "attorney_no_account" as const, k };
	}
	return { ok: true as const, k, attorney, account };
}

export async function bindCasePayout(input: {
	caseId: string;
	/** The case owner, as known to the caller — guards against binding others' cases. */
	ownerId: string;
}): Promise<BindResult> {
	const target = await resolveBindTarget(input.caseId, input.ownerId);
	if (!target.ok && target.reason === "case_not_found") {
		return { ok: false, reason: "case_not_found" };
	}
	// The invariant is "don't move the destination after donors were shown one" —
	// not "never touch a live case". A live case with nothing bound has shown no
	// donor a recipient (the donate panel reads "not accepting donations yet"), so
	// binding it for the first time is safe. Only *re*-binding a bound live case is
	// refused. Guarding on status alone would have stranded every case that went
	// live before payouts existed: unbindable, and therefore permanently unable to
	// accept donations.
	if (target.k.status === "live" && target.k.payoutAccountId) {
		return { ok: false, reason: "already_live" };
	}
	if (!target.ok) return { ok: false, reason: target.reason };
	const { k, attorney, account } = target;

	// `attorney` is the only value a bind writes. The column is what the donor-facing
	// disclosure reads from — a case must be able to *state* who receives, not have it
	// inferred at render time — and existing `plaintiff` rows keep that value so their
	// already-delivered disclosure stays true. See `PayoutRecipient`.
	await prisma.case.update({
		where: { id: k.id },
		data: { payoutRecipient: "attorney", payoutAccountId: account.id },
	});
	return {
		ok: true,
		firmName: attorney.firmName?.trim() || null,
		attorneyName: attorney.name,
	};
}

/**
 * Bind a **live but unbound** case to the account that is now able to receive.
 *
 * A live case with no `payoutAccountId` refuses every donation (`resolvePayoutDestination`
 * returns `unbound`), and until now the only cure was the plaintiff pressing "Send
 * donations to …" on their own payout panel. That left a state nobody could read their
 * way out of: the attorney's panel says "Active", the case says "not accepting donations
 * yet", and neither screen names the one click that joins them. Cases published before
 * per-case payouts existed are all in exactly that state.
 *
 * Safe, because it takes no decision away from anyone:
 *
 *  - **Live only.** Publishing is the plaintiff's press and always stays theirs — for a
 *    `pending_payout` case, binding *is* publishing (see `goLiveCase`), so this must
 *    never touch one. A live case has already been published: its owner has decided it
 *    is open, and this only makes that true.
 *  - **Unbound only.** The invariant is "don't move the destination after donors were
 *    shown one". An unbound case has shown no donor a recipient, which is the same
 *    reasoning `bindCasePayout` already relies on.
 *  - **No choice to make.** The destination is derived from the case's own attorney
 *    link, exactly as in `resolveBindTarget` — neither an account nor an attorney is a
 *    parameter here, so there is no input that could point a case at another firm.
 *
 * Idempotent, and returns whether it bound so callers can log or refresh. The status and
 * null-account guards are repeated in the `updateMany` so two concurrent calls cannot
 * both write.
 */
export async function bindReadyLiveCase(caseId: string): Promise<boolean> {
	const k = await prisma.case.findFirst({
		where: {
			id: caseId,
			status: "live",
			payoutAccountId: null,
			deletedAt: null,
		},
		select: REPRESENTING_SELECT,
	});
	if (!k) return false;

	const representing = await representingAttorney(k);
	if (!representing) return false;
	const account = accountHeldBy(
		k.payoutAccountForCase,
		representing.attorney.id,
	);
	// `transfersEnabled` and nothing weaker: it is Stripe's own answer to "may this
	// account receive", cached by the webhook. Binding on a submitted-but-unverified
	// account would open a donate button whose charge then fails.
	if (!account?.transfersEnabled) return false;

	const res = await prisma.case.updateMany({
		where: { id: k.id, status: "live", payoutAccountId: null },
		data: { payoutRecipient: "attorney", payoutAccountId: account.id },
	});
	return res.count > 0;
}

/**
 * Take a committed case public — the `pending_payout` → `live` transition.
 *
 * Binding and publishing are one act here, deliberately. A case reaches the
 * public exactly when it can take a donation, so the destination is written in
 * the same statement that makes the page visible; there is no interval in which
 * a live case has no recipient. It is still the plaintiff who calls this: they
 * own the case and they decide when it opens. What they cannot do — here as in
 * `bindCasePayout` — is choose where the money goes.
 *
 * `transfersEnabled` is the gate, not `detailsSubmitted`. An attorney can finish
 * Stripe's hosted flow and still be held for review, and a case published on the
 * strength of a submitted form would be public and unable to receive, which is
 * the exact failure this whole state exists to prevent. It is also a cache of
 * Stripe's view, written only by the webhook (see `syncPayoutAccount`), never by
 * anything the attorney or plaintiff can assert.
 *
 * Safe to call speculatively: the publish action runs it immediately after
 * `publishCase`, so a case whose firm is already set up never visibly sits in
 * `pending_payout`. Every refusal is a real state the caller renders as "waiting
 * on your attorney", not an error.
 *
 * The status guard lives in the `where`, so two concurrent calls cannot both
 * publish — the second matches nothing and reports the case as already live.
 */
export type GoLiveResult =
	| { ok: true; firmName: string | null; attorneyName: string }
	| {
			ok: false;
			reason:
				| "case_not_found"
				| "already_live"
				| "not_pending"
				| "no_attorney"
				| "attorney_no_account"
				| "transfers_disabled";
	  };

export async function goLiveCase(input: {
	caseId: string;
	ownerId: string;
}): Promise<GoLiveResult> {
	const target = await resolveBindTarget(input.caseId, input.ownerId);
	if (!target.ok && target.reason === "case_not_found") {
		return { ok: false, reason: "case_not_found" };
	}
	if (target.k.status === "live") return { ok: false, reason: "already_live" };
	if (target.k.status !== "pending_payout") {
		return { ok: false, reason: "not_pending" };
	}
	if (!target.ok) return { ok: false, reason: target.reason };
	const { k, attorney, account } = target;
	if (!account.transfersEnabled) {
		return { ok: false, reason: "transfers_disabled" };
	}

	const res = await prisma.case.updateMany({
		where: { id: k.id, ownerId: input.ownerId, status: "pending_payout" },
		data: {
			status: "live",
			payoutRecipient: "attorney",
			payoutAccountId: account.id,
			// Re-stamped, because this is the moment the case reached the public and
			// `publishedAt` is what the directory's "newest" sort reads. A case that
			// waited a week on its firm is new to donors today, not a week old.
			publishedAt: new Date(),
		},
	});
	if (res.count === 0) return { ok: false, reason: "already_live" };
	return {
		ok: true,
		firmName: attorney.firmName?.trim() || null,
		attorneyName: attorney.name,
	};
}
