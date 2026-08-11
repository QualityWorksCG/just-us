import {
	markDonationFailed,
	markDonationRefunded,
	markDonationSucceeded,
} from "@just-us/db/donations";
import { env } from "@just-us/env/server";
import { isPaymentsConfigured, type Stripe, stripe } from "@just-us/payments";
import { sendDonationAcknowledgement } from "@/lib/donation-acknowledgement";
import { notifyDonation } from "@/lib/notify";

/**
 * The donation ledger webhook.
 *
 * This is the only thing that moves a donation to `succeeded` and the only thing
 * that changes `Case.raisedCents`. The success redirect deliberately does not:
 * a donor who closes the tab still paid, and a donor who forges a `?donated=1`
 * has not.
 *
 * Runs on the Node runtime and reads the **raw** body — signature verification is
 * over the exact bytes Stripe sent, so any parsing or re-serialising first breaks
 * it.
 *
 * Every handler here is idempotent, because Stripe redelivers. The guards live in
 * `@just-us/db/donations` as status-conditional updates rather than
 * read-then-write, so two concurrent deliveries cannot both pass.
 */
export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
	if (!isPaymentsConfigured() || !env.STRIPE_WEBHOOK_SECRET) {
		// 500, not 200: an unconfigured environment silently discarding real events
		// is exactly the failure that shows up weeks later as missing money.
		return new Response("Stripe is not configured.", { status: 500 });
	}

	const signature = request.headers.get("stripe-signature");
	if (!signature) return new Response("Missing signature.", { status: 400 });

	const raw = await request.text();

	let event: Stripe.Event;
	try {
		event = await stripe().webhooks.constructEventAsync(
			raw,
			signature,
			env.STRIPE_WEBHOOK_SECRET,
		);
	} catch (error) {
		// An unverifiable payload is not from Stripe. Never act on it.
		return new Response(
			`Signature verification failed: ${error instanceof Error ? error.message : "unknown"}`,
			{ status: 400 },
		);
	}

	try {
		switch (event.type) {
			case "checkout.session.completed": {
				const session = event.data.object;
				// `payment_status` guards the one gap in Checkout: a session can complete
				// while payment is still processing, and only `paid` means money moved.
				if (session.payment_status !== "paid") break;
				const { applied, donationId } = await markDonationSucceeded({
					stripeCheckoutSessionId: session.id,
					stripePaymentIntentId: idOf(session.payment_intent),
					// For a guest this is the *only* identity we get, and it arrives here
					// rather than at checkout creation — it is what makes their donation
					// countable as a distinct donor and claimable against an account later.
					donorEmail:
						session.customer_details?.email ?? session.customer_email ?? null,
					donorName: session.customer_details?.name ?? null,
				});
				// The acknowledgement rides on the same transition the totals do, so a
				// redelivery that changes nothing also mails nothing. It never throws —
				// a mail failure must not turn into a 500 and make Stripe redeliver a
				// payment event.
				if (applied && donationId) {
					await sendDonationAcknowledgement(donationId);
					await notifyDonation(donationId).catch(() => {});
				}
				break;
			}

			case "checkout.session.async_payment_failed":
			case "checkout.session.expired": {
				// The donor abandoned it or a delayed method failed. Nothing was counted,
				// so this only tidies the pending row.
				const session = event.data.object;
				const paymentIntentId = idOf(session.payment_intent);
				if (paymentIntentId) await markDonationFailed(paymentIntentId);
				break;
			}

			case "payment_intent.payment_failed": {
				await markDonationFailed(event.data.object.id);
				break;
			}

			case "charge.refunded": {
				const paymentIntentId = idOf(event.data.object.payment_intent);
				if (paymentIntentId) await markDonationRefunded(paymentIntentId);
				break;
			}

			case "charge.dispute.created": {
				// Treated as a reversal on arrival rather than on resolution: the money is
				// already withdrawn, and showing it as still raised would overstate the
				// case's progress to every donor who looks.
				const paymentIntentId = idOf(event.data.object.payment_intent);
				if (paymentIntentId) await markDonationRefunded(paymentIntentId);
				break;
			}

			default:
				// Unhandled types are acknowledged, not errored — Stripe would otherwise
				// retry them forever.
				break;
		}
	} catch (error) {
		// A 500 tells Stripe to retry, which is what we want for a transient database
		// failure: the alternative is a paid donation that never lands.
		console.error("[stripe:webhook]", event.type, error);
		return new Response("Handler failed.", { status: 500 });
	}

	return Response.json({ received: true });
}

/** Stripe gives either an id or an expanded object; we only ever want the id. */
function idOf(
	value: string | { id: string } | null | undefined,
): string | null {
	if (!value) return null;
	return typeof value === "string" ? value : value.id;
}
