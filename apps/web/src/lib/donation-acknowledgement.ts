import "server-only";

import { sendDonationThankYouEmail } from "@just-us/auth/lib/email";
import {
	getDonationForAcknowledgement,
	markDonationAcknowledgementFailed,
	markDonationAcknowledgementSent,
	reserveDonationAcknowledgement,
} from "@just-us/db/donations";
import { env } from "@just-us/env/server";

/**
 * The donor's acknowledgement: one email per successful donation, carrying the
 * confirmation and the plaintiff's thank-you note.
 *
 * Called from both paths that can move a donation to `succeeded` — the Stripe
 * webhook and the read-time reconciliation in `donation-sync` — because either can
 * be the one that gets there first, and a donor whose acknowledgement depended on
 * which one won would sometimes get nothing.
 *
 * **Exactly once is the reservation's job, not this function's.**
 * `reserveDonationAcknowledgement` inserts a row keyed uniquely on the donation
 * before anything is sent; whoever loses that insert returns here having done
 * nothing. That is what holds when Stripe redelivers `checkout.session.completed`
 * hours later, and when a page render reconciles the same session concurrently.
 *
 * Nothing here throws. In the webhook a thrown error would return 500 and make
 * Stripe redeliver a *payment* event over a mail failure — re-running the ledger
 * write for the sake of an email. On a page render it would replace the donor's
 * receipt with an error screen. A failed send is recorded on the row and left for
 * a human; the money and the totals are already correct either way.
 */
export async function sendDonationAcknowledgement(
	donationId: string,
): Promise<{ sent: boolean }> {
	try {
		const donation = await getDonationForAcknowledgement(donationId);
		// Not succeeded, or gone. Nothing to thank anyone for.
		if (!donation) return { sent: false };

		const to = donation.donorEmail?.trim();
		if (!to) {
			// A guest checkout that produced no address. Recorded as `skipped` rather
			// than left absent, so an unacknowledged donation is visibly a donation we
			// had nowhere to write to — not one we forgot.
			await reserveDonationAcknowledgement({
				donationId,
				recipientEmail: null,
				status: "skipped",
				reason: "no_donor_email",
			});
			return { sent: false };
		}

		const reserved = await reserveDonationAcknowledgement({
			donationId,
			recipientEmail: to,
			status: "sent",
		});
		// Someone else holds this donation's send. Theirs to make, not ours.
		if (!reserved) return { sent: false };

		try {
			await sendDonationThankYouEmail({
				to,
				url: new URL(
					`/cases/${donation.case.id}`,
					env.BETTER_AUTH_URL,
				).toString(),
				caseTitle: donation.case.title,
				amountLabel: formatAmount(donation.amountCents),
				donorName: donation.donorName,
				thankYouNote: donation.case.thankYouNote,
				plaintiffName: donation.case.owner.name,
			});
			await markDonationAcknowledgementSent(donationId);
			return { sent: true };
		} catch (error) {
			console.error("[donation:acknowledge:send]", donationId, error);
			await markDonationAcknowledgementFailed(donationId);
			return { sent: false };
		}
	} catch (error) {
		console.error("[donation:acknowledge]", donationId, error);
		return { sent: false };
	}
}

function formatAmount(cents: number) {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
	}).format(cents / 100);
}
