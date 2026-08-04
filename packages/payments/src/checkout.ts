/**
 * Donation Checkout. **Server-only.**
 *
 * A donation is a Connect **destination charge**: JustUs creates the charge as
 * merchant of record, the full amount transfers to the recipient's connected
 * account, and `application_fee_amount` comes back to us.
 *
 * `on_behalf_of` is deliberately **not** set. Setting it would make the connected
 * account the merchant of record and move Stripe's processing fee onto them,
 * turning the published "$100 in → $95 to the recipient" into ~$92.10. It is also
 * why the connected account carries the `recipient` configuration rather than
 * `merchant` — see `./connect`.
 */
import { env } from "@just-us/env/server";

import { donationBreakdown, stripe } from "./index";

export type DonationCheckout = {
	sessionId: string;
	url: string;
	amountCents: number;
	feeCents: number;
	netCents: number;
};

/**
 * Create a hosted Checkout Session for one donation.
 *
 * The amount must already have been validated (`validateDonationAmount`) — this
 * builds the session and does not second-guess the caller's policy. The fee is
 * computed here rather than passed in, so what Stripe is told and what the
 * donation row stores come from the same function.
 *
 * `metadata` is written on both the session and the payment intent. The session
 * carries it for `checkout.session.completed`; the payment intent carries it
 * because refunds and disputes arrive as charge events that never see the session.
 */
export async function createDonationCheckout(input: {
	caseId: string;
	caseTitle: string;
	/** Null for a guest — giving does not require an account. */
	donorId: string | null;
	/**
	 * Prefills Checkout for a signed-in donor. Null for a guest, in which case
	 * Checkout collects it: `customer_creation` below makes Stripe require an email,
	 * so a guest donation always ends up with a receipt address and the one
	 * identifier that lets them claim it against an account later.
	 */
	donorEmail: string | null;
	amountCents: number;
	/** The case's bound destination — never resolved from the matched attorney. */
	destinationAccountId: string;
	/** Absolute URLs; Stripe rejects relative ones. */
	successUrl: string;
	cancelUrl: string;
}): Promise<DonationCheckout> {
	const { amountCents, feeCents, netCents } = donationBreakdown(
		input.amountCents,
	);
	const metadata = {
		caseId: input.caseId,
		// Empty string rather than omitted: Stripe metadata values must be strings,
		// and "" reads unambiguously as "no account" on the webhook side.
		donorId: input.donorId ?? "",
		feeCents: String(feeCents),
	};

	const session = await stripe().checkout.sessions.create({
		mode: "payment",
		// Prefill when we know it; otherwise Checkout asks. Creating a Stripe customer
		// for guests is what guarantees an email comes back on the session, which is
		// the guest's only identity and their route to claiming the gift later.
		...(input.donorEmail
			? { customer_email: input.donorEmail }
			: { customer_creation: "always" as const }),
		line_items: [
			{
				quantity: 1,
				price_data: {
					currency: "usd",
					unit_amount: amountCents,
					product_data: {
						name: `Donation — ${input.caseTitle}`,
						// Donations are gifts with no return (terms §3). Saying so on the
						// payment screen itself means the donor cannot miss it.
						description:
							"A gift toward this case's legal fee. No financial return, and no share of any settlement.",
					},
				},
			},
		],
		payment_intent_data: {
			application_fee_amount: feeCents,
			transfer_data: { destination: input.destinationAccountId },
			metadata,
		},
		metadata,
		success_url: input.successUrl,
		cancel_url: input.cancelUrl,
	});

	if (!session.url) {
		// Stripe only omits `url` for non-hosted modes, which this is not. Failing
		// loudly beats redirecting the donor to "undefined".
		throw new Error("Stripe did not return a Checkout URL.");
	}

	return {
		sessionId: session.id,
		url: session.url,
		amountCents,
		feeCents,
		netCents,
	};
}

/** The app's public origin, for Checkout's absolute return URLs. */
export function appOrigin(): string {
	return env.BETTER_AUTH_URL;
}
