"use server";

import {
	attorneyBusinessUrlSources,
	attorneyRepresentedCase,
	bindCasePayout,
	getCasePayoutOptions,
	getPayoutAccountForCase,
	goLiveCase,
	syncPayoutAccount,
} from "@just-us/db/payouts";
import { env } from "@just-us/env/server";
import { isPaymentsConfigured } from "@just-us/payments";
import {
	createExpressDashboardLink,
	createOnboardingLink,
	createPayoutAccount,
	fetchAccountStatus,
} from "@just-us/payments/connect";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireRole } from "@/lib/auth-server";
import { notifyStatusChange } from "@/lib/notify";

/**
 * Everything a single case's donation payout needs, from both sides of it.
 *
 * The two sides are deliberately here together, because they are two halves of one
 * case-scoped decision and the screens that call them are the two views of the same
 * case:
 *
 *  - **The attorney** opens and finishes the Stripe account for *this* case
 *    (`startPayoutOnboarding`, `refreshPayoutStatus`, `openPayoutDashboard`). Each
 *    case a firm represents gets its own account, so an attorney fully onboarded on
 *    two matters has done nothing for a third.
 *  - **The plaintiff** decides when their case opens for donations
 *    (`goLiveAction`, `bindCasePayoutAction`). What they cannot do is choose the
 *    destination — that is derived from the case's own attorney link.
 *
 * These actions used to live under `/settings`, where payouts were one per person.
 * Per-case accounts made that screen a list of other people's cases; they now sit on
 * the case itself, which is also where Stripe returns the holder to.
 *
 * Because the case id arrives from the client, **every attorney action re-derives
 * representation from the case row** (`attorneyRepresentedCase`) before touching
 * Stripe. Without that check an attorney could attach an account to a stranger's case
 * and be paid that plaintiff's donations the moment they opened donations.
 *
 * Every capability flag stored along the way comes from a Stripe response, never from
 * the caller. Someone who could assert their own `transfersEnabled` would open
 * donations against an account that cannot receive them.
 */

type ActionResult<T> = ({ ok: true } & T) | { ok: false; error: string };

const NOT_CONFIGURED =
	"Donations aren't set up on this environment yet. Please try again later.";
const NOT_YOUR_CASE =
	"That case isn't one you represent, so there's no payout account to set up for it.";

const caseInput = z.object({ caseId: z.string().min(1) });

/**
 * Pull this case's payout account status straight from Stripe into our cache.
 *
 * The whole `transfersEnabled` gate is a cache of Stripe's view, and until now it
 * was only ever refreshed by the account.updated webhook or the attorney pressing
 * "Check again" on their own screen. Neither is guaranteed: a dev environment
 * without a webhook, or an attorney who enabled payouts and never came back, left
 * the plaintiff's page permanently reading "waiting on your attorney" with no way
 * to move it. This lets the plaintiff force a fresh read of the firm's account for
 * *their own* case.
 *
 * It stays safe because the values written come from `fetchAccountStatus` —
 * Stripe's truth — never from the caller, exactly as the webhook does. Callers
 * must have already authorised (the case owner); this only reads and syncs.
 * Best-effort: if Stripe is unreachable the cache is left as-is and the caller
 * reports whatever we last knew rather than failing the whole flow.
 */
async function pullCaseAccountFromStripe(caseId: string): Promise<void> {
	if (!isPaymentsConfigured()) return;
	const account = await getPayoutAccountForCase(caseId);
	if (!account) return;
	try {
		const status = await fetchAccountStatus(account.stripeAccountId);
		await syncPayoutAccount({ userId: account.userId, caseId, ...status });
	} catch {
		// Leave the cached capabilities untouched — the caller renders what we have.
	}
}

/** Human wording for each refusal `bindCasePayout` can return. */
const REASONS: Record<string, string> = {
	case_not_found: "That case couldn't be found.",
	already_live:
		"This case is already raising with a recipient set, so it's locked. Donors were shown who receives their money before they gave.",
	no_attorney:
		"No attorney is linked to this case yet. Donations go to your attorney's firm, so one has to be on JustUs with the email address on your case before this case can accept them.",
	attorney_no_account:
		"Your attorney hasn't set up their firm's payout account yet. They do it on the case itself, in their own JustUs account. We've nothing to route donations to until they have.",
};

export async function bindCasePayoutAction(
	input: z.input<typeof caseInput>,
): Promise<{ ok: true; recipientName: string } | { ok: false; error: string }> {
	const { session } = await requireRole("plaintiff");
	const parsed = caseInput.safeParse(input);
	if (!parsed.success) return { ok: false, error: "That case isn't valid." };

	const result = await bindCasePayout({
		caseId: parsed.data.caseId,
		// Taken from the session, never from the form — otherwise a caller could
		// bind someone else's case by passing their id.
		ownerId: session.user.id,
	});

	if (!result.ok) {
		return {
			ok: false,
			error:
				REASONS[result.reason] ?? "Couldn't set up donations for this case.",
		};
	}

	revalidatePath(`/my-cases/${parsed.data.caseId}`);
	// Named back to the caller so the confirmation says who was bound rather than a
	// bare "saved" — this is the moment the destination becomes irreversible.
	return { ok: true, recipientName: result.firmName ?? result.attorneyName };
}

/** Human wording for each refusal `goLiveCase` can return. */
const GO_LIVE_REASONS: Record<string, string> = {
	case_not_found: "That case couldn't be found.",
	already_live: "This case is already live.",
	not_pending:
		"This case isn't ready to publish. Finish it in the case wizard first.",
	no_attorney: REASONS.no_attorney,
	attorney_no_account: REASONS.attorney_no_account,
	transfers_disabled:
		"Your attorney's payout account for this case can't receive donations yet. Stripe is still verifying their firm's details. Your case goes live as soon as that clears.",
};

/**
 * Take a finished case public. The plaintiff's own act, and the last step.
 *
 * Nothing here decides *whether* the case may go live — `goLiveCase` re-derives the
 * recipient and re-checks that Stripe can transfer to it, from the case row rather
 * than from anything the client sent. This action supplies the owner id from the
 * session and turns each refusal into something the plaintiff can act on, which for
 * every reason but `case_not_found` means naming what is being waited on.
 */
export async function goLiveAction(
	input: z.input<typeof caseInput>,
): Promise<{ ok: true; recipientName: string } | { ok: false; error: string }> {
	const { session } = await requireRole("plaintiff");
	const parsed = caseInput.safeParse(input);
	if (!parsed.success) return { ok: false, error: "That case isn't valid." };

	// Confirm the case is the caller's before touching Stripe, then pull the firm's
	// live account status so the go-live check below reads Stripe's truth now rather
	// than whatever the last webhook happened to leave cached.
	const owned = await getCasePayoutOptions(parsed.data.caseId, session.user.id);
	if (!owned) return { ok: false, error: "That case couldn't be found." };
	await pullCaseAccountFromStripe(parsed.data.caseId);

	const result = await goLiveCase({
		caseId: parsed.data.caseId,
		// From the session, never the form — otherwise a caller could publish
		// someone else's case by passing its id.
		ownerId: session.user.id,
	});

	if (!result.ok) {
		return {
			ok: false,
			error: GO_LIVE_REASONS[result.reason] ?? "Couldn't publish this case.",
		};
	}

	// Now live: tell the plaintiff and every backer/follower (in-app + email).
	await notifyStatusChange(parsed.data.caseId, "live").catch(() => {});
	// The case is public from this moment, so everything that lists or renders it
	// publicly is now stale, not just the owner's own view.
	revalidatePath(`/my-cases/${parsed.data.caseId}`);
	revalidatePath(`/cases/${parsed.data.caseId}`);
	revalidatePath("/my-cases");
	revalidatePath("/discover");
	revalidatePath("/cases");
	revalidatePath("/home");
	// The marketing landing features live cases — surface the newly live one.
	revalidatePath("/");
	return { ok: true, recipientName: result.firmName ?? result.attorneyName };
}

export type CheckAndGoLiveResult =
	| { ok: true; live: true; recipientName: string }
	| {
			ok: true;
			live: false;
			/** The firm's account exists but can't receive yet. */
			hasAccount: boolean;
			/** Details are in with Stripe and under review (vs. onboarding unfinished). */
			detailsSubmitted: boolean;
			reason: "no_attorney" | "attorney_no_account" | "transfers_disabled";
	  }
	| { ok: false; error: string };

/**
 * The plaintiff's "Check & publish" — one action that re-checks Stripe and, if the
 * firm's account can now receive, takes the case live.
 *
 * This is the fix for the stuck-on-"waiting" gap. Refreshing the page only re-read
 * a cache the webhook may never have updated; this pulls the firm's live status
 * from Stripe first, then runs the same `goLiveCase` gate against the fresh value.
 * When it still can't publish, it reports *where the firm's setup actually stands
 * now* so the panel updates rather than repeating a stale "waiting on attorney".
 */
export async function checkAndGoLiveAction(
	input: z.input<typeof caseInput>,
): Promise<CheckAndGoLiveResult> {
	const { session } = await requireRole("plaintiff");
	const parsed = caseInput.safeParse(input);
	if (!parsed.success) return { ok: false, error: "That case isn't valid." };
	const { caseId } = parsed.data;

	// Ownership guard, and it also scopes the Stripe pull below to the owner's case.
	const owned = await getCasePayoutOptions(caseId, session.user.id);
	if (!owned) return { ok: false, error: "That case couldn't be found." };

	await pullCaseAccountFromStripe(caseId);

	const result = await goLiveCase({ caseId, ownerId: session.user.id });
	if (result.ok) {
		await notifyStatusChange(caseId, "live").catch(() => {});
		revalidatePath(`/my-cases/${caseId}`);
		revalidatePath(`/cases/${caseId}`);
		revalidatePath("/my-cases");
		revalidatePath("/discover");
		revalidatePath("/cases");
		revalidatePath("/home");
		revalidatePath("/");
		return {
			ok: true,
			live: true,
			recipientName: result.firmName ?? result.attorneyName,
		};
	}

	// Couldn't publish. The reasons that aren't about the firm's readiness are real
	// errors; the rest are a "still waiting" outcome, reported with the now-fresh
	// state of the firm's account so the caller can update what it shows.
	if (result.reason === "case_not_found") {
		return { ok: false, error: GO_LIVE_REASONS.case_not_found };
	}
	if (result.reason === "already_live") {
		revalidatePath(`/my-cases/${caseId}`);
		const firm = owned.attorney;
		return {
			ok: true,
			live: true,
			recipientName: firm?.firmName ?? firm?.name ?? "your attorney's firm",
		};
	}
	if (result.reason === "not_pending") {
		return { ok: false, error: GO_LIVE_REASONS.not_pending };
	}

	// no_attorney | attorney_no_account | transfers_disabled — re-read the refreshed
	// readiness so the panel reflects Stripe's current answer.
	const fresh = await getCasePayoutOptions(caseId, session.user.id);
	const a = fresh?.attorney;
	revalidatePath(`/my-cases/${caseId}`);
	return {
		ok: true,
		live: false,
		hasAccount: !!a?.hasAccount,
		detailsSubmitted: !!a?.detailsSubmitted,
		reason: result.reason,
	};
}

/**
 * The plaintiff's "Check again" — pull the firm's account from Stripe, then return
 * the refreshed readiness.
 *
 * The read-only version of `checkAndGoLiveAction`: it does not publish, only
 * updates our cache from Stripe's truth and reports where the firm's setup now
 * stands. This is what the case wizard's payout step calls, so pressing "Check
 * again" reflects an attorney who just enabled payouts instead of re-reading a
 * cache no webhook touched.
 */
export async function refreshCasePayoutAction(
	input: z.input<typeof caseInput>,
): Promise<
	| {
			ok: true;
			payout: NonNullable<Awaited<ReturnType<typeof getCasePayoutOptions>>>;
	  }
	| { ok: false; error: string }
> {
	const { session } = await requireRole("plaintiff");
	const parsed = caseInput.safeParse(input);
	if (!parsed.success) return { ok: false, error: "That case isn't valid." };
	const { caseId } = parsed.data;

	// Ownership guard, which also scopes the Stripe pull to the caller's own case.
	const before = await getCasePayoutOptions(caseId, session.user.id);
	if (!before) return { ok: false, error: "Couldn't find that case." };

	await pullCaseAccountFromStripe(caseId);
	const payout = await getCasePayoutOptions(caseId, session.user.id);
	if (!payout) return { ok: false, error: "Couldn't find that case." };
	revalidatePath(`/my-cases/${caseId}`);
	return { ok: true, payout };
}

/**
 * Where Stripe sends the holder back to: the case they were setting up, which is
 * where the panel they left from lives. Absolute, as Account Links require.
 */
function caseUrl(caseId: string, params: Record<string, string>) {
	const url = new URL(`/my-cases/${caseId}`, env.BETTER_AUTH_URL);
	for (const [key, value] of Object.entries(params)) {
		url.searchParams.set(key, value);
	}
	return url.toString();
}

/**
 * The page Stripe is shown as this account's "business website".
 *
 * Best available, in order: the firm's own site, this case's public page, the
 * attorney's directory profile, then the platform. Nothing is invented and nothing that
 * would 404 is offered — see `attorneyBusinessUrlSources`, where the ordering is
 * justified.
 */
async function businessUrlFor(input: {
	userId: string;
	caseId: string;
}): Promise<string> {
	const sources = await attorneyBusinessUrlSources(input);
	// Profile URLs are attorney-entered free text, so "smithlaw.com" is as likely as
	// a full URL. Stripe rejects the bare host, and an unusable value here means the
	// hosted flow asks them for a business website instead — the exact step this
	// exists to spare them.
	if (sources.firmWebsiteUrl) {
		return /^https?:\/\//i.test(sources.firmWebsiteUrl)
			? sources.firmWebsiteUrl
			: `https://${sources.firmWebsiteUrl}`;
	}
	const path = sources.caseId
		? `/cases/${sources.caseId}`
		: sources.profileId
			? `/attorneys/${sources.profileId}`
			: null;
	return path
		? new URL(path, env.BETTER_AUTH_URL).toString()
		: env.BETTER_AUTH_URL;
}

/**
 * Begin or resume hosted onboarding for one case, returning the URL to send the
 * browser to.
 *
 * Account Links are single-use and expire, so one is minted per click rather than
 * stored. If this case already has an account we reuse it — a second Stripe account for
 * the same case would split that case's money across two balances and strand whatever
 * was already sent to the first.
 */
export async function startPayoutOnboarding(
	input: z.input<typeof caseInput>,
): Promise<ActionResult<{ url: string }>> {
	const { session } = await requireRole("attorney");
	if (!isPaymentsConfigured()) return { ok: false, error: NOT_CONFIGURED };
	const parsed = caseInput.safeParse(input);
	if (!parsed.success) return { ok: false, error: "That case isn't valid." };
	const { caseId } = parsed.data;

	const kase = await attorneyRepresentedCase({
		userId: session.user.id,
		email: session.user.email,
		caseId,
	});
	if (!kase) return { ok: false, error: NOT_YOUR_CASE };

	try {
		const existing = await getPayoutAccountForCase(caseId);
		// An account exists for this case but someone else opened it: the case changed
		// counsel. Refused rather than reused — handing this attorney a Stripe flow for
		// the previous firm's account would point their client's money at that firm.
		if (existing && existing.userId !== session.user.id) {
			return {
				ok: false,
				error:
					"This case already has a payout account opened by another firm. It has to be released before a new one can be set up. Contact support.",
			};
		}
		let stripeAccountId = existing?.stripeAccountId;

		if (!stripeAccountId) {
			const created = await createPayoutAccount({
				email: session.user.email,
				// The firm's name when sign-up captured one: it is the name that ends up
				// against the money in Stripe, on the case page, and on donor receipts.
				// Their own name is the fallback, not the default.
				displayName: session.user.firmName?.trim() || session.user.name,
				caseId: kase.id,
				caseTitle: kase.title,
				// Stripe requires a business URL and rejects placeholder sites — it wants
				// a page showing the holder's actual activity. A law firm's own site is
				// exactly that, and better than anything we could host on their behalf.
				businessUrl: await businessUrlFor({
					userId: session.user.id,
					caseId,
				}),
			});
			// Persist immediately, before the redirect. If we minted the account and
			// only recorded it on return, an attorney who closed the tab mid-onboarding
			// would come back with no row and be handed a brand-new account.
			await syncPayoutAccount({
				userId: session.user.id,
				caseId,
				...created,
			});
			stripeAccountId = created.stripeAccountId;
		}

		const url = await createOnboardingLink({
			stripeAccountId,
			// Back to the route that mints a fresh link, not to a dead expired one.
			refreshUrl: caseUrl(caseId, { payout: "refresh" }),
			returnUrl: caseUrl(caseId, { payout: "return" }),
		});
		revalidatePath(`/my-cases/${caseId}`);
		return { ok: true, url };
	} catch (error) {
		return { ok: false, error: stripeMessage(error) };
	}
}

/**
 * Re-read one case's account from Stripe and store what it says.
 *
 * Called when the attorney lands back on the return URL, because **arriving there does
 * not mean they finished** — Stripe sends them to it whether they completed the flow or
 * abandoned it. The requirements thin-event webhook covers this too; this exists so the
 * screen is correct the instant they return rather than whenever the event lands.
 */
export async function refreshPayoutStatus(
	input: z.input<typeof caseInput>,
): Promise<
	ActionResult<{
		caseId: string;
		detailsSubmitted: boolean;
		transfersEnabled: boolean;
		payoutsEnabled: boolean;
	}>
> {
	const { session } = await requireRole("attorney");
	if (!isPaymentsConfigured()) return { ok: false, error: NOT_CONFIGURED };
	const parsed = caseInput.safeParse(input);
	if (!parsed.success) return { ok: false, error: "That case isn't valid." };
	const { caseId } = parsed.data;

	const existing = await getPayoutAccountForCase(caseId);
	// Ownership of the row is the check here: it is stricter than representation, and
	// it is the only thing that matters for reading a Stripe account's status.
	if (!existing || existing.userId !== session.user.id) {
		return {
			ok: false,
			error: "You haven't started payout setup for that case yet.",
		};
	}
	try {
		const status = await fetchAccountStatus(existing.stripeAccountId);
		await syncPayoutAccount({ userId: session.user.id, caseId, ...status });
		revalidatePath(`/my-cases/${caseId}`);
		return {
			ok: true,
			caseId,
			detailsSubmitted: status.detailsSubmitted,
			transfersEnabled: status.transfersEnabled,
			payoutsEnabled: status.payoutsEnabled,
		};
	} catch (error) {
		return { ok: false, error: stripeMessage(error) };
	}
}

/**
 * A link into the Express dashboard for one case's account, where the holder sees that
 * case's payouts. Stripe rejects this before onboarding completes, so it is gated on
 * the stored `detailsSubmitted` to avoid handing back a raw Stripe error.
 */
export async function openPayoutDashboard(
	input: z.input<typeof caseInput>,
): Promise<ActionResult<{ url: string }>> {
	const { session } = await requireRole("attorney");
	if (!isPaymentsConfigured()) return { ok: false, error: NOT_CONFIGURED };
	const parsed = caseInput.safeParse(input);
	if (!parsed.success) return { ok: false, error: "That case isn't valid." };

	const existing = await getPayoutAccountForCase(parsed.data.caseId);
	if (!existing || existing.userId !== session.user.id) {
		return {
			ok: false,
			error: "You haven't started payout setup for that case yet.",
		};
	}
	if (!existing.detailsSubmitted) {
		return { ok: false, error: "Finish payout setup for this case first." };
	}
	try {
		return {
			ok: true,
			url: await createExpressDashboardLink(existing.stripeAccountId),
		};
	} catch (error) {
		return { ok: false, error: stripeMessage(error) };
	}
}

/**
 * Stripe's own message is usually the useful one ("this account cannot be
 * created because…"), so it is passed through rather than replaced with a generic
 * string. Nothing here is secret: these are configuration and validation errors
 * about the caller's own account.
 */
function stripeMessage(error: unknown): string {
	if (error instanceof Error && error.message) return error.message;
	return "Couldn't reach our payment processor. Please try again.";
}
