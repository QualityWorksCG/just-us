import "server-only";

import {
	listPendingDonationsForCase,
	markDonationSucceeded,
} from "@just-us/db/donations";
import { isPaymentsConfigured, stripe } from "@just-us/payments";
import { sendDonationAcknowledgement } from "./donation-acknowledgement";
import { notifyDonation } from "./notify";

/**
 * Catching a donation up with Stripe on read.
 *
 * The webhook remains the primary path and the only *authority* on a donation's
 * outcome — but it is not the only thing that can ask Stripe. Relying on it alone
 * means a case's totals are wrong for as long as a delivery is late, lost, or (in
 * every local environment without `stripe listen`) never sent at all: the money has
 * moved, Stripe's dashboard says so, and the progress bar the whole page is built
 * around still reads zero.
 *
 * So the pages that display those totals re-check any still-pending donation
 * against Stripe before rendering. Two properties make that safe rather than
 * duplicative:
 *
 *  - **Stripe is asked, the donor is not.** Nothing here trusts a query parameter.
 *    A session is retrieved from Stripe and only `payment_status === "paid"` counts,
 *    so a forged `?donated=1&session_id=…` proves nothing and moves nothing.
 *  - **It is the same idempotent write the webhook makes.** `markDonationSucceeded`
 *    guards on `status: "pending"` inside its transaction, so this racing the real
 *    webhook is a no-op for whichever arrives second — never a double count.
 *
 * Failures are swallowed on purpose: a Stripe outage should leave a case page
 * rendering slightly stale numbers, not error it out entirely.
 */

/** Rows younger than this are skipped — the donor may still be paying. */
const MIN_AGE_MS = 3_000;
/** And older than this are left to the webhook / a real reconciliation job. */
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Reconcile one donation by its Checkout Session id.
 *
 * Used on the donor's return from Stripe, where the session id is known exactly.
 * Returns whether the donation is now settled, which is what lets the page say
 * "your gift is in" instead of guessing from totals that may not have moved yet.
 */
export async function syncDonationBySession(
	stripeCheckoutSessionId: string,
): Promise<{ settled: boolean }> {
	if (!isPaymentsConfigured()) return { settled: false };
	try {
		// The charge is expanded through the PaymentIntent so this path picks up the
		// receipt URL from the retrieve it was already making, rather than adding a
		// second Stripe read per pending row.
		const session = await stripe().checkout.sessions.retrieve(
			stripeCheckoutSessionId,
			{ expand: ["payment_intent.latest_charge"] },
		);
		if (session.payment_status !== "paid") return { settled: false };

		const intent =
			typeof session.payment_intent === "string" ? null : session.payment_intent;
		const charge =
			intent && typeof intent.latest_charge !== "string"
				? intent.latest_charge
				: null;

		const { applied, donationId } = await markDonationSucceeded({
			stripeCheckoutSessionId: session.id,
			stripePaymentIntentId:
				typeof session.payment_intent === "string"
					? session.payment_intent
					: (session.payment_intent?.id ?? null),
			donorEmail:
				session.customer_details?.email ?? session.customer_email ?? null,
			donorName: session.customer_details?.name ?? null,
			stripeReceiptUrl: charge?.receipt_url ?? null,
		});
		// This path is the *only* one that runs where no webhook is forwarding — every
		// local environment, and any deployment during a delivery outage — so the
		// acknowledgement has to hang off it too, not off the webhook alone. Sending
		// twice is not the risk: the reservation inside decides, and only one of the
		// two paths can hold it.
		if (applied && donationId) {
			await sendDonationAcknowledgement(donationId);
			// In-app donation notification for the donor (the email receipt is the
			// line above). Both are once-only, so redelivery never doubles either.
			await notifyDonation(donationId).catch(() => {});
		}
		// Settled either way: `applied: false` here means the webhook got there first,
		// which is still a paid donation now folded into the case.
		return { settled: true };
	} catch (error) {
		console.error("[donation:sync]", stripeCheckoutSessionId, error);
		return { settled: false };
	}
}

/**
 * Reconcile the case's outstanding pending donations, bounded.
 *
 * Called when a case's funding numbers are about to be shown — the public case page
 * and the owner's manage page. Capped at a handful of rows in a narrow age window
 * so a page render never turns into an unbounded fan-out of Stripe reads.
 */
export async function syncPendingDonationsForCase(
	caseId: string,
): Promise<{ applied: number }> {
	if (!isPaymentsConfigured()) return { applied: 0 };
	let applied = 0;
	try {
		const pending = await listPendingDonationsForCase({
			caseId,
			limit: 5,
			olderThanMs: MIN_AGE_MS,
			newerThanMs: MAX_AGE_MS,
		});
		for (const donation of pending) {
			const result = await syncDonationBySession(
				donation.stripeCheckoutSessionId,
			);
			if (result.settled) applied += 1;
		}
	} catch (error) {
		console.error("[donation:sync:case]", caseId, error);
	}
	return { applied };
}
