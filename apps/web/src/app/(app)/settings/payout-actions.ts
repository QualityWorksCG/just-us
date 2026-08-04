"use server";

import {
	getPayoutAccount,
	publicCaseIdForOwner,
	syncPayoutAccount,
} from "@just-us/db/payouts";
import { env } from "@just-us/env/server";
import { isPaymentsConfigured } from "@just-us/payments";
import {
	createExpressDashboardLink,
	createOnboardingLink,
	createPayoutAccount,
	fetchAccountStatus,
	type RecipientKind,
} from "@just-us/payments/connect";
import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth-server";

/**
 * Payout-account onboarding (donations).
 *
 * Only plaintiffs and attorneys reach these: either can be the recipient a case
 * pays out to (see `Case.payoutRecipient`), and nobody else ever receives donated
 * money. The role also decides `entity_type` and which public page Stripe is shown
 * as the holder's website — see `createPayoutAccount` and `businessUrlFor`.
 *
 * Every capability flag stored along the way comes from a Stripe response, never
 * from the caller. Someone who could assert their own `transfersEnabled` could open
 * donations against an account that cannot receive them.
 */

type ActionResult<T> = ({ ok: true } & T) | { ok: false; error: string };

const NOT_CONFIGURED =
	"Donations aren't set up on this environment yet. Please try again later.";

/** Where Stripe sends the user back to. Absolute, as Account Links require. */
function settingsUrl(path = "/settings") {
	return new URL(path, env.BETTER_AUTH_URL).toString();
}

/**
 * The public page Stripe is shown as this holder's "business website".
 *
 * Attorneys get their directory profile. Plaintiffs get their own live case page —
 * the page that actually evidences what the money is for. Neither is invented: both
 * are real, loadable pages, which is what Stripe's "no placeholder sites" rule is
 * about.
 */
async function businessUrlFor(role: string, userId: string): Promise<string> {
	if (role === "attorney") {
		return new URL(`/attorneys/${userId}`, env.BETTER_AUTH_URL).toString();
	}
	const caseId = await publicCaseIdForOwner(userId);
	return caseId
		? new URL(`/cases/${caseId}`, env.BETTER_AUTH_URL).toString()
		: env.BETTER_AUTH_URL;
}

/**
 * Begin or resume hosted onboarding, returning the URL to send the browser to.
 *
 * Account Links are single-use and expire, so one is minted per click rather than
 * stored. If the user already has an account we reuse it — a second Stripe
 * account for the same person would split their money across two balances and
 * strand whatever was already sent to the first.
 */
export async function startPayoutOnboarding(): Promise<
	ActionResult<{ url: string }>
> {
	const { session, role } = await requireRole("plaintiff", "attorney");
	if (!isPaymentsConfigured()) return { ok: false, error: NOT_CONFIGURED };

	try {
		const existing = await getPayoutAccount(session.user.id);
		let stripeAccountId = existing?.stripeAccountId;

		if (!stripeAccountId) {
			const created = await createPayoutAccount({
				email: session.user.email,
				displayName: session.user.name,
				recipientKind: role as RecipientKind,
				// Stripe requires a business URL and rejects placeholder sites — it wants
				// a page showing the holder's actual activity. An attorney has their
				// directory profile. A plaintiff has their public case page, which shows
				// the story, the goal, and the attorney: far more reviewable than the
				// platform homepage, which says nothing about *this* person. Falls back
				// to the platform only when they have nothing public yet.
				businessUrl: await businessUrlFor(role, session.user.id),
			});
			// Persist immediately, before the redirect. If we minted the account and
			// only recorded it on return, a user who closed the tab mid-onboarding
			// would come back with no row and be handed a brand-new account.
			await syncPayoutAccount({ userId: session.user.id, ...created });
			stripeAccountId = created.stripeAccountId;
		}

		const url = await createOnboardingLink({
			stripeAccountId,
			// Back to the route that mints a fresh link, not to a dead expired one.
			refreshUrl: settingsUrl("/settings?payout=refresh"),
			returnUrl: settingsUrl("/settings?payout=return"),
		});
		revalidatePath("/settings");
		return { ok: true, url };
	} catch (error) {
		return { ok: false, error: stripeMessage(error) };
	}
}

/**
 * Re-read the account from Stripe and store what it says.
 *
 * Called when the user lands back on the return URL, because **arriving there
 * does not mean they finished** — Stripe sends them to it whether they completed
 * the flow or abandoned it. The requirements thin-event webhook covers this too;
 * this exists so the screen is correct the instant they return rather than
 * whenever the event lands.
 */
export async function refreshPayoutStatus(): Promise<
	ActionResult<{
		detailsSubmitted: boolean;
		transfersEnabled: boolean;
		payoutsEnabled: boolean;
	}>
> {
	const { session } = await requireRole("plaintiff", "attorney");
	if (!isPaymentsConfigured()) return { ok: false, error: NOT_CONFIGURED };

	const existing = await getPayoutAccount(session.user.id);
	if (!existing) {
		return { ok: false, error: "You haven't started payout setup yet." };
	}
	try {
		const status = await fetchAccountStatus(existing.stripeAccountId);
		await syncPayoutAccount({ userId: session.user.id, ...status });
		revalidatePath("/settings");
		return {
			ok: true,
			detailsSubmitted: status.detailsSubmitted,
			transfersEnabled: status.transfersEnabled,
			payoutsEnabled: status.payoutsEnabled,
		};
	} catch (error) {
		return { ok: false, error: stripeMessage(error) };
	}
}

/**
 * A link into the user's own Stripe Express dashboard, where they see their
 * payouts. Stripe rejects this before onboarding completes, so it is gated on the
 * stored `detailsSubmitted` to avoid handing back a raw Stripe error.
 */
export async function openPayoutDashboard(): Promise<
	ActionResult<{ url: string }>
> {
	const { session } = await requireRole("plaintiff", "attorney");
	if (!isPaymentsConfigured()) return { ok: false, error: NOT_CONFIGURED };

	const existing = await getPayoutAccount(session.user.id);
	if (!existing?.detailsSubmitted) {
		return { ok: false, error: "Finish payout setup first." };
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
