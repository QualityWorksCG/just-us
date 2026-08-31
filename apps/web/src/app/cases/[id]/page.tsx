import type { Role } from "@just-us/auth";
import { getViewableCase } from "@just-us/db/cases";
import {
	countCaseDonations,
	donorSupportForCase,
	getDonationForCheckoutSession,
	listCaseBackers,
} from "@just-us/db/donations";
import { isCaseFollowing } from "@just-us/db/follows";
import {
	bindReadyLiveCase,
	resolvePayoutDestination,
} from "@just-us/db/payouts";
import { isCaseSaved } from "@just-us/db/saves";
import {
	donationPresets,
	minDonationCents,
	platformFeeBps,
} from "@just-us/payments";
import type { Metadata, Route } from "next";
import { notFound } from "next/navigation";

import { PublicCaseView } from "@/components/cases/public-case-view";
import { DonationReceipt } from "@/components/donation-receipt";
import { getSession } from "@/lib/auth-server";
import {
	syncDonationBySession,
	syncPendingDonationsForCase,
} from "@/lib/donation-sync";

function exactMoney(cents: number) {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
	}).format(cents / 100);
}

/**
 * The public case page — what a share link opens.
 *
 * The case itself is `PublicCaseView`, shared with the in-app `/discover/[id]`
 * screen. This route owns what is specific to being a public page: the metadata
 * for search and link previews, and the standalone page chrome (a centred column,
 * since there's no sidebar to sit beside).
 */
export async function generateMetadata({
	params,
}: {
	params: Promise<{ id: string }>;
}): Promise<Metadata> {
	const { id } = await params;
	const c = await getViewableCase(id);
	if (!c) return { title: "Case not found" };
	return {
		title: `${c.title} · JustUs Financial`,
		description: c.summary || c.story.slice(0, 155),
	};
}

export default async function PublicCasePage({
	params,
	searchParams,
}: {
	params: Promise<{ id: string }>;
	/** Set by Stripe's return URL after a payment — see `donate-actions.ts`. */
	searchParams: Promise<{ donated?: string; session_id?: string }>;
}) {
	const { id } = await params;
	const sp = await searchParams;

	// Reconcile *before* the case is read, so the totals below are the ones after
	// any paid-but-unapplied donation lands rather than one render behind it. The
	// donor's own session id is reconciled first and exactly; the sweep then covers
	// donations by anyone else that a late or undelivered webhook left pending.
	const returningSessionId =
		sp.donated === "1" && sp.session_id ? sp.session_id : null;
	if (returningSessionId) await syncDonationBySession(returningSessionId);
	await syncPendingDonationsForCase(id);
	// Same idea for the destination: a live case whose firm's account has since
	// cleared is bound here rather than waiting for its plaintiff to press a button
	// they were never told about. No-ops unless the case is live and unbound.
	await bindReadyLiveCase(id);

	const c = await getViewableCase(id);
	if (!c) notFound();

	const owner = c.owner?.name ?? "A plaintiff";
	const ownerFirst = owner.split(" ")[0];
	// Can this case actually take money right now? Resolved server-side from the
	// case's *bound* payout account, so the button state and the charge path agree
	// rather than each deciding for itself.
	const destination = await resolvePayoutDestination(c.id);
	const [backers, donationCount] = await Promise.all([
		listCaseBackers(c.id),
		countCaseDonations(c.id),
	]);
	const BLOCKED: Record<string, string> = {
		not_live: "This case isn't accepting donations right now.",
		unbound:
			"This case is still setting up where donations go, so it can't accept them yet.",
		transfers_disabled:
			"The receiving law firm's payout setup is still being verified. Donations open as soon as it clears.",
	};

	// Who this case's donations are paid to, read from the case's own
	// `payoutRecipient` rather than asserted globally — terms §4 commits to stating it
	// *per case*, and cases bound before the move to firm accounts still pay the
	// plaintiff. Telling their donors otherwise would make a disclosure those donors
	// already acted on retroactively false. Null means nothing is designated yet, and
	// the note must claim nobody rather than promise on a case that cannot receive.
	const firmLabel =
		destination.ok && (destination.holderFirm ?? destination.holderName)
			? (destination.holderFirm ?? destination.holderName)
			: (c.attorneyFirm ?? c.attorneyName ?? null);
	const fundsNote =
		c.payoutRecipient === "attorney"
			? firmLabel
				? `Funds go to ${firmLabel}, the law firm representing ${ownerFirst}, not to ${ownerFirst} and never to JustUs.`
				: `Funds go to the law firm representing ${ownerFirst}, never to JustUs.`
			: c.payoutRecipient === "plaintiff"
				? `Funds go to ${ownerFirst}'s account. ${ownerFirst} pays the attorney directly.`
				: "Funds go to the recipient this case designates, never to JustUs.";

	// Who's already given, and whether the person reading is one of them. The email
	// is only offered as a match key when it is *verified*, for the same reason
	// `claimGuestDonations` insists on one: anyone can type another person's address
	// into Checkout, and an unverified match would report a stranger's giving back.
	const session = await getSession();
	const viewer = session?.user ?? null;
	const [mySupport, myDonation] = await Promise.all([
		viewer
			? donorSupportForCase({
					caseId: c.id,
					donorId: viewer.id,
					donorEmail: viewer.emailVerified ? viewer.email : null,
				})
			: Promise.resolve({ totalCents: 0, count: 0 }),
		returningSessionId
			? getDonationForCheckoutSession({
					stripeCheckoutSessionId: returningSessionId,
					caseId: c.id,
				})
			: Promise.resolve(null),
	]);
	const iBackedThis = mySupport.count > 0;

	// Saving is a donor action; following is open to any signed-in user who is not
	// on the case's own team. Both reuse the session read above.
	const role = (session?.user as { role?: Role } | undefined)?.role;
	const canSave = role === "donor" && !!viewer;
	const canFollow = !!viewer && viewer.id !== c.ownerId;
	const [initialSaved, initialFollowing] = await Promise.all([
		canSave && viewer ? isCaseSaved(viewer.id, c.id) : Promise.resolve(false),
		viewer ? isCaseFollowing(viewer.id, c.id) : Promise.resolve(false),
	]);

	return (
		<main className="h-full overflow-y-auto bg-paper">
			<div className="mx-auto max-w-[1100px] px-6 pt-5 pb-12 sm:pt-6">
				{/* Just paid. Confirms the gift and keeps refreshing this render until the
				    donation settles, so the totals below catch up without a manual reload. */}
				{returningSessionId && (
					<DonationReceipt
						settled={myDonation?.status === "succeeded"}
						amountLabel={myDonation ? exactMoney(myDonation.amountCents) : null}
					/>
				)}
				<PublicCaseView
					c={c}
					donate={{
						presetsCents: donationPresets(),
						minCents: minDonationCents(),
						feeBps: platformFeeBps(),
						alreadyBacked: iBackedThis,
						canDonate: destination.ok,
						closed: c.status === "closed",
						blockedReason: destination.ok
							? null
							: c.status === "closed"
								? "This case has closed. Thank you to everyone who supported it."
								: (BLOCKED[destination.reason] ?? null),
					}}
					fundsNote={fundsNote}
					backers={backers}
					donationCount={donationCount}
					backHref={"/cases" as Route}
					backLabel="Back to cases"
					canSave={canSave}
					initialSaved={initialSaved}
					canFollow={canFollow}
					initialFollowing={initialFollowing}
					updatesHref={`/cases/${c.id}/updates` as Route}
				/>
			</div>
		</main>
	);
}
