import { applyAccountUpdate } from "@just-us/db/payouts";
import { env } from "@just-us/env/server";
import { isPaymentsConfigured, stripe } from "@just-us/payments";
import { fetchAccountStatus } from "@just-us/payments/connect";

/**
 * Connected-account status webhook — what flips a recipient's donation gate on.
 *
 * Accounts v2 delivers these as **thin events**, which carry only an id and a
 * pointer to the object that changed, not the object itself. That suits us: we
 * ignore the payload's contents entirely and re-read the account from Stripe. The
 * stored capability flags therefore always reflect a fresh Stripe response rather
 * than whatever a possibly out-of-order event body claimed.
 *
 * Verified with `webhooks.signature.verifyHeaderAsync` rather than
 * `constructEventAsync`: the signature scheme is identical, but `constructEvent`
 * types its result as a v1 `Stripe.Event`, which a thin event is not. Verifying and
 * then parsing against the real shape avoids asserting a type that isn't true.
 *
 * Locally these arrive via a *different* CLI invocation from the v1 events:
 *
 *   stripe listen --thin-events 'v2.core.account[requirements].updated,\
 *     v2.core.account[configuration.recipient].capability_status_updated' \
 *     --forward-thin-to localhost:3001/api/stripe/connect-webhook
 */
export const runtime = "nodejs";

/** The subset of a v2 thin event this route needs. */
type ThinEvent = {
	id?: string;
	type?: string;
	related_object?: { id?: string; type?: string };
};

/** Events that can change whether an account may receive transfers. */
const HANDLED = new Set([
	"v2.core.account[requirements].updated",
	"v2.core.account[configuration.recipient].capability_status_updated",
]);

export async function POST(request: Request): Promise<Response> {
	const secret = env.STRIPE_CONNECT_WEBHOOK_SECRET;
	if (!isPaymentsConfigured() || !secret) {
		return new Response("Stripe is not configured.", { status: 500 });
	}

	const signature = request.headers.get("stripe-signature");
	if (!signature) return new Response("Missing signature.", { status: 400 });

	const raw = await request.text();
	// The SDK types `webhooks.signature` as nullable (it is absent on runtimes
	// without a crypto provider). Refuse rather than assert: an unverifiable
	// request must never be acted on.
	const verifier = stripe().webhooks.signature;
	if (!verifier) {
		return new Response("Signature verification unavailable.", { status: 500 });
	}
	try {
		await verifier.verifyHeaderAsync(raw, signature, secret);
	} catch (error) {
		return new Response(
			`Signature verification failed: ${error instanceof Error ? error.message : "unknown"}`,
			{ status: 400 },
		);
	}

	let event: ThinEvent;
	try {
		event = JSON.parse(raw) as ThinEvent;
	} catch {
		return new Response("Malformed payload.", { status: 400 });
	}

	if (!event.type || !HANDLED.has(event.type)) {
		// Acknowledge everything else, or Stripe retries it indefinitely.
		return Response.json({ received: true, handled: false });
	}

	const accountId = event.related_object?.id;
	if (!accountId) return Response.json({ received: true, handled: false });

	try {
		// Re-read rather than trust the event. Two deliveries out of order would
		// otherwise be able to write a stale capability state over a newer one.
		const status = await fetchAccountStatus(accountId);
		const updated = await applyAccountUpdate({
			stripeAccountId: status.stripeAccountId,
			detailsSubmitted: status.detailsSubmitted,
			transfersEnabled: status.transfersEnabled,
			payoutsEnabled: status.payoutsEnabled,
		});
		// No row is normal, not an error: the platform's own account and Stripe's
		// sample accounts emit these too, and neither belongs to a JustUs user.
		return Response.json({ received: true, handled: updated !== null });
	} catch (error) {
		console.error("[stripe:connect-webhook]", event.type, accountId, error);
		return new Response("Handler failed.", { status: 500 });
	}
}
