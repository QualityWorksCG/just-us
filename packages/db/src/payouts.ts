import type { PayoutRecipient } from "../prisma/generated/client";
import prisma from "./index";

/**
 * Payout-account reads and writes (donations).
 *
 * The capability columns here are a **cache of Stripe's view**, so everything
 * that writes them takes them from a Stripe payload — never from a form. See
 * `syncPayoutAccount`.
 */

/**
 * The case page best suited to standing as this plaintiff's "business website"
 * during Stripe onboarding, or null if they have none published.
 *
 * Stripe requires a business URL and states that placeholder sites are not
 * supported — it wants a page showing the actual activity. The platform homepage
 * does not: it says nothing about *this* person. Their own public case page does,
 * with a story, a funding goal, and a named attorney, which is exactly what a
 * reviewer is looking for.
 *
 * Prefers a `live` case, then the most recently published one. Cases not yet
 * public (`draft`, `seeking`) are excluded — linking a reviewer to a page they
 * cannot load is worse than linking the platform.
 */
export async function publicCaseIdForOwner(
	ownerId: string,
): Promise<string | null> {
	const k = await prisma.case.findFirst({
		where: { ownerId, status: "live", deletedAt: null },
		orderBy: { publishedAt: "desc" },
		select: { id: true },
	});
	return k?.id ?? null;
}

/** A user's payout account, or null if they have not started onboarding. */
export async function getPayoutAccount(userId: string) {
	return prisma.payoutAccount.findUnique({ where: { userId } });
}

/** Look up by Stripe id — how the requirements webhook finds its row. */
export async function getPayoutAccountByStripeId(stripeAccountId: string) {
	return prisma.payoutAccount.findUnique({ where: { stripeAccountId } });
}

/**
 * Record a Stripe account against a user, or update the capabilities of one
 * already recorded.
 *
 * Upsert on `userId` rather than insert, because onboarding is resumable: someone
 * who abandons the hosted flow and comes back must land on the same Stripe
 * account, not a second one. `stripeAccountId` is only written on create — a
 * user's account id never changes, and quietly repointing it would orphan the
 * money already sent to the old one.
 */
export async function syncPayoutAccount(input: {
	userId: string;
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
	return prisma.payoutAccount.upsert({
		where: { userId: input.userId },
		create: {
			userId: input.userId,
			stripeAccountId: input.stripeAccountId,
			...capabilities,
		},
		update: capabilities,
	});
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
	return prisma.payoutAccount.update({
		where: { id: existing.id },
		data: {
			detailsSubmitted: input.detailsSubmitted,
			transfersEnabled: input.transfersEnabled,
			payoutsEnabled: input.payoutsEnabled,
			syncedAt: new Date(),
		},
	});
}

/**
 * The destination a case's donations go to, resolved for the charge path.
 *
 * Reads the **bound** account (`Case.payoutAccountId`), never the matched
 * attorney's, so re-matching a case cannot redirect money mid-campaign. Returns a
 * reason rather than throwing, because every failure here is a legitimate state
 * the donate button has to explain: no recipient chosen yet, or a recipient
 * partway through onboarding.
 */
export type PayoutDestination =
	| {
			ok: true;
			stripeAccountId: string;
			recipient: PayoutRecipient;
			holderName: string;
	  }
	| { ok: false; reason: "not_live" | "unbound" | "transfers_disabled" };

export async function resolvePayoutDestination(
	caseId: string,
): Promise<PayoutDestination> {
	const k = await prisma.case.findFirst({
		where: { id: caseId, deletedAt: null },
		select: {
			status: true,
			payoutRecipient: true,
			payoutAccount: {
				select: {
					stripeAccountId: true,
					transfersEnabled: true,
					user: { select: { name: true } },
				},
			},
		},
	});
	if (!k || k.status !== "live") return { ok: false, reason: "not_live" };
	if (!k.payoutAccount || !k.payoutRecipient) {
		return { ok: false, reason: "unbound" };
	}
	if (!k.payoutAccount.transfersEnabled) {
		return { ok: false, reason: "transfers_disabled" };
	}
	return {
		ok: true,
		stripeAccountId: k.payoutAccount.stripeAccountId,
		recipient: k.payoutRecipient,
		holderName: k.payoutAccount.user.name,
	};
}

/**
 * Bind a case to a payout destination.
 *
 * Refuses unless the account belongs to the party named by `recipient` — the
 * plaintiff must be the case owner, the attorney must be the one matched to it.
 * Without that check a caller could point any case at any account, which is the
 * one mistake in this file that would move real money to the wrong person.
 *
 * Idempotent and re-runnable while a case is not yet live; rebinding a `live`
 * case is refused, because donors have already been shown a recipient.
 */
export type BindResult =
	| { ok: true }
	| {
			ok: false;
			// No "wrong holder" case: ownership is enforced by *deriving* whose
			// account to look up, so a mismatched one is unreachable rather than
			// rejected.
			reason:
				| "case_not_found"
				| "already_live"
				| "no_account"
				| "no_attorney_matched";
	  };

/**
 * Everything the payout step of a case needs to render: which recipients are
 * actually available, and why one isn't.
 *
 * Availability is per side and depends on that side having onboarded — so this
 * reports the onboarding state of both candidates rather than just listing two
 * radio buttons the plaintiff might not be able to use. `null` for the attorney
 * side means no attorney is matched yet, which is different from matched but not
 * onboarded.
 */
export async function getCasePayoutOptions(caseId: string, ownerId: string) {
	const k = await prisma.case.findFirst({
		where: { id: caseId, ownerId, deletedAt: null },
		select: {
			id: true,
			status: true,
			payoutRecipient: true,
			payoutAccountId: true,
			owner: {
				select: {
					name: true,
					payoutAccount: {
						select: { detailsSubmitted: true, transfersEnabled: true },
					},
				},
			},
			match: {
				select: {
					attorney: {
						select: {
							name: true,
							payoutAccount: {
								select: { detailsSubmitted: true, transfersEnabled: true },
							},
						},
					},
				},
			},
		},
	});
	if (!k) return null;

	const side = (
		holder: {
			name: string;
			payoutAccount: {
				detailsSubmitted: boolean;
				transfersEnabled: boolean;
			} | null;
		} | null,
	) =>
		holder
			? {
					name: holder.name,
					hasAccount: !!holder.payoutAccount,
					detailsSubmitted: holder.payoutAccount?.detailsSubmitted ?? false,
					transfersEnabled: holder.payoutAccount?.transfersEnabled ?? false,
				}
			: null;

	return {
		status: k.status,
		recipient: k.payoutRecipient,
		bound: !!k.payoutAccountId,
		plaintiff: side(k.owner),
		attorney: side(k.match?.attorney ?? null),
	};
}

export async function bindCasePayout(input: {
	caseId: string;
	/** The case owner, as known to the caller — guards against binding others' cases. */
	ownerId: string;
	recipient: PayoutRecipient;
}): Promise<BindResult> {
	const k = await prisma.case.findFirst({
		where: { id: input.caseId, ownerId: input.ownerId, deletedAt: null },
		select: {
			id: true,
			status: true,
			payoutAccountId: true,
			match: { select: { attorneyId: true } },
		},
	});
	if (!k) return { ok: false, reason: "case_not_found" };
	// The invariant is "don't move the destination after donors were shown one" —
	// not "never touch a live case". A live case with nothing bound has shown no
	// donor a recipient (the donate panel reads "not accepting donations yet"), so
	// binding it for the first time is safe. Only *re*-binding a bound live case is
	// refused. Guarding on status alone would have stranded every case that went
	// live before payouts existed: unbindable, and therefore permanently unable to
	// accept donations.
	if (k.status === "live" && k.payoutAccountId) {
		return { ok: false, reason: "already_live" };
	}

	// Whose account may this case point at?
	let holderId: string;
	if (input.recipient === "plaintiff") {
		holderId = input.ownerId;
	} else {
		if (!k.match?.attorneyId)
			return { ok: false, reason: "no_attorney_matched" };
		holderId = k.match.attorneyId;
	}

	const account = await prisma.payoutAccount.findUnique({
		where: { userId: holderId },
		select: { id: true },
	});
	if (!account) return { ok: false, reason: "no_account" };

	await prisma.case.update({
		where: { id: k.id },
		data: { payoutRecipient: input.recipient, payoutAccountId: account.id },
	});
	return { ok: true };
}
