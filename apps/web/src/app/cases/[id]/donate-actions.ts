"use server";

import { getPublicCase } from "@just-us/db/cases";
import { createPendingDonation } from "@just-us/db/donations";
import { resolvePayoutDestination } from "@just-us/db/payouts";
import {
	isPaymentsConfigured,
	validateDonationAmount,
} from "@just-us/payments";
import { appOrigin, createDonationCheckout } from "@just-us/payments/checkout";
import { z } from "zod";

import { getSession } from "@/lib/auth-server";

/**
 * Starting a donation (donations, step 6b).
 *
 * **No account required.** Giving is public: requiring a sign-in turns a moment of
 * generosity into a signup form, and most people abandon it. A signed-in donor gets
 * their donation attributed immediately; a guest's is recorded against the email
 * Stripe collects, and attaches to an account if they later make one with that
 * address (see `claimGuestDonations`).
 *
 * The amount arrives from the browser as the **gift to the case**; the platform
 * fee is added on top when Checkout is built. **Every** rule about the gift is
 * enforced here: the floor, the ceiling (gift + fee), and that it is whole
 * cents. A client-side check is a courtesy to honest donors, not a control.
 *
 * Not `requireRole` — that redirects, and a redirect out of a fetch from the
 * donate button reads as a silent failure. Every refusal below is returned so the
 * button can say what happened.
 */

const inputSchema = z.object({
	caseId: z.string().min(1),
	amountCents: z.number().int().positive(),
});

export type DonateResult =
	| { ok: true; url: string }
	| { ok: false; error: string };

/** Why a case can't take money right now, in words a donor can act on. */
const DESTINATION_REASONS: Record<string, string> = {
	not_live: "This case isn't raising right now.",
	unbound:
		"This case hasn't finished setting up where donations go. It can't accept them yet.",
	transfers_disabled:
		"The receiving law firm's payout setup is still being verified, so this case can't accept donations yet. Please check back shortly.",
};

export async function startDonation(
	input: z.input<typeof inputSchema>,
): Promise<DonateResult> {
	if (!isPaymentsConfigured()) {
		return { ok: false, error: "Donations aren't available right now." };
	}

	const parsed = inputSchema.safeParse(input);
	if (!parsed.success) return { ok: false, error: "That amount isn't valid." };
	const { caseId, amountCents } = parsed.data;

	// A session is welcome but not required. Any role may give — a plaintiff or
	// attorney backing someone else's case is a real thing to want to do, and
	// refusing it on role grounds would be arbitrary. An unverified account is fine
	// too: they are paying us, not accessing anything.
	const session = await getSession();
	const donor = session?.user ?? null;

	const amount = validateDonationAmount(amountCents);
	if (!amount.ok) return { ok: false, error: amount.message };

	const kase = await getPublicCase(caseId);
	if (!kase) return { ok: false, error: "This case isn't available." };

	// Self-dealing guard: an owner funding their own case would inflate the public
	// progress bar with their own money and pay a fee for the privilege. Only
	// enforceable for a signed-in donor — a guest is anonymous by design, so this is
	// a guard against the obvious mistake, not a security control.
	if (donor && kase.ownerId === donor.id) {
		return { ok: false, error: "You can't donate to your own case." };
	}

	const destination = await resolvePayoutDestination(caseId);
	if (!destination.ok) {
		return {
			ok: false,
			error:
				DESTINATION_REASONS[destination.reason] ??
				"This case can't accept donations yet.",
		};
	}

	const origin = appOrigin();
	// A signed-in donor returns to the in-app case view so they stay in the app
	// (sidebar, their thank-you, their session); a guest returns to the public
	// page. `/discover/[id]` is donor-only, so only route donors there.
	const donorRole = (donor as { role?: string } | null)?.role;
	const returnBase =
		donorRole === "donor" ? `/discover/${caseId}` : `/cases/${caseId}`;
	try {
		const checkout = await createDonationCheckout({
			caseId,
			caseTitle: kase.title,
			donorId: donor?.id ?? null,
			donorEmail: donor?.email ?? null,
			amountCents,
			destinationAccountId: destination.stripeAccountId,
			// `{CHECKOUT_SESSION_ID}` is substituted by Stripe on redirect. The case
			// page needs it because the webhook that folds the gift into the case
			// totals lands out-of-band: without knowing *which* donation just
			// happened, the page can only show stale totals and hope. Left literal —
			// encoding the braces would send Stripe's placeholder through unexpanded.
			successUrl: `${origin}${returnBase}?donated=1&session_id={CHECKOUT_SESSION_ID}`,
			cancelUrl: `${origin}${returnBase}`,
		});

		// Recorded before the donor reaches Stripe, so a completed payment always has
		// a row to land on rather than the webhook having to invent one.
		await createPendingDonation({
			donorId: donor?.id ?? null,
			caseId,
			amountCents: checkout.amountCents,
			feeCents: checkout.feeCents,
			netCents: checkout.netCents,
			stripeCheckoutSessionId: checkout.sessionId,
			stripeAccountId: destination.stripeAccountId,
			// Null for a guest; the webhook fills it from what Checkout collected.
			donorEmail: donor?.email ?? null,
		});

		return { ok: true, url: checkout.url };
	} catch (error) {
		return {
			ok: false,
			error:
				error instanceof Error && error.message
					? error.message
					: "Couldn't start the donation. Please try again.",
		};
	}
}
