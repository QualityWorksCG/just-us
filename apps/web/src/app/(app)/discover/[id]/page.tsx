import { getViewableCase } from "@just-us/db/cases";
import {
	countCaseDonations,
	donorSupportForCase,
	getDonationForCheckoutSession,
	listCaseBackers,
} from "@just-us/db/donations";
import {
	getFollowUpdatesSeenAt,
	isCaseFollowing,
	markCaseUpdatesSeenByFollower,
} from "@just-us/db/follows";
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
import type { Route } from "next";
import { notFound } from "next/navigation";

import { PublicCaseView } from "@/components/cases/public-case-view";
import { DonationReceipt } from "@/components/donation-receipt";
import { requireRole } from "@/lib/auth-server";
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
 * A live case as a signed-in donor sees it, inside the dashboard shell.
 *
 * The same case as the public `/cases/[id]` page — one component, so the two
 * can't drift. It exists as its own route because the public page has no
 * sidebar: linking a signed-in donor there dropped them out of the app with the
 * marketing header hidden and nothing to navigate back with.
 *
 * A static segment, so it sits alongside `/discover` rather than under a
 * catch-all, and does its own RBAC — this is the donor's browse flow.
 */

/**
 * Where "back" returns to. A donor opens a case from Discover, Saved, or the
 * saved strip on their dashboard, and the card says which — so back goes to the
 * list they actually came from instead of always dropping them on Discover.
 * Anything unrecognised (a pasted link, an old bookmark) falls back to Discover.
 */
const BACK_TO: Record<string, { href: Route; label: string }> = {
	discover: { href: "/discover" as Route, label: "Back to discover" },
	saved: { href: "/saved" as Route, label: "Back to saved" },
	home: { href: "/home" as Route, label: "Back to dashboard" },
};

export default async function InAppCasePage({
	params,
	searchParams,
}: {
	params: Promise<{ id: string }>;
	searchParams: Promise<{
		from?: string;
		donated?: string;
		session_id?: string;
	}>;
}) {
	const { session } = await requireRole("donor");
	const [{ id }, sp] = await Promise.all([params, searchParams]);
	const { from } = sp;

	// Just returned from Stripe: settle this donation (and any other still-pending
	// on the case) before rendering, so the thank-you and the totals are truthful
	// even if the webhook is late — the same reconciliation the public page does.
	const returningSessionId =
		sp.donated === "1" && sp.session_id ? sp.session_id : null;
	if (returningSessionId) await syncDonationBySession(returningSessionId);
	await syncPendingDonationsForCase(id);

	// The same predicate the public page uses: a case that isn't live 404s here
	// too, even for a donor holding the link.
	const c = await getViewableCase(id);
	if (!c) notFound();

	const justDonated = returningSessionId
		? await getDonationForCheckoutSession({
				stripeCheckoutSessionId: returningSessionId,
				caseId: c.id,
			})
		: null;

	// Read the follower's last-seen time BEFORE marking, so updates newer than the
	// previous visit still highlight now; then clear this case from their bell.
	const [initialSaved, initialFollowing, followSeenAt] = await Promise.all([
		isCaseSaved(session.user.id, id),
		isCaseFollowing(session.user.id, id),
		getFollowUpdatesSeenAt(session.user.id, id),
	]);
	await markCaseUpdatesSeenByFollower(session.user.id, id);
	// A donor is never the case's own team, so they can always follow.
	const canFollow = session.user.id !== c.ownerId;
	const back = BACK_TO[from ?? ""] ?? BACK_TO.discover;

	// Donating from inside the app resolves exactly as it does on the public page:
	// from this case's *bound* payout account, server-side. A donor browsing here
	// must not be offered a donate button the public page would refuse, or refused
	// one it would offer — same case, same answer.
	const owner = c.owner?.name ?? "A plaintiff";
	const ownerFirst = owner.split(" ")[0];
	// Bind a live case whose firm's account has since cleared, before the gate below
	// is read — otherwise a donor browsing in-app is refused by a case that is in
	// fact ready. No-ops unless the case is live and unbound.
	await bindReadyLiveCase(c.id);
	const [destination, mySupport, backers, donationCount] = await Promise.all([
		resolvePayoutDestination(c.id),
		donorSupportForCase({
			caseId: c.id,
			donorId: session.user.id,
			donorEmail: session.user.emailVerified ? session.user.email : null,
		}),
		listCaseBackers(c.id),
		countCaseDonations(c.id),
	]);
	const BLOCKED: Record<string, string> = {
		not_live: "This case isn't raising right now.",
		unbound:
			"This case is still setting up where donations go, so it can't accept them yet.",
		transfers_disabled:
			"The receiving law firm's payout setup is still being verified. Donations open as soon as it clears.",
	};
	// Same per-case disclosure the public page makes — see the note there.
	const firmLabel =
		destination.ok && (destination.holderFirm ?? destination.holderName)
			? (destination.holderFirm ?? destination.holderName)
			: (c.attorneyFirm ?? c.attorneyName ?? null);
	const fundsNote =
		c.payoutRecipient === "attorney"
			? firmLabel
				? `Funds go to ${firmLabel} — the law firm representing ${ownerFirst}, not to ${ownerFirst} and never to JustUs.`
				: `Funds go to the law firm representing ${ownerFirst} — never to JustUs.`
			: c.payoutRecipient === "plaintiff"
				? `Funds go to ${ownerFirst}'s account — ${ownerFirst} pays the attorney directly.`
				: "Funds go to the recipient this case designates — never to JustUs.";

	return (
		// Full-bleed, like the other app screens: the shell's content column already
		// supplies the gutters.
		<div className="w-full">
			{returningSessionId && (
				<div className="mb-5">
					<DonationReceipt
						settled={justDonated?.status === "succeeded"}
						amountLabel={
							justDonated ? exactMoney(justDonated.amountCents) : null
						}
					/>
				</div>
			)}
			<PublicCaseView
				c={c}
				donate={{
					presetsCents: donationPresets(),
					minCents: minDonationCents(),
					feeBps: platformFeeBps(),
					alreadyBacked: mySupport.count > 0,
					canDonate: destination.ok,
					closed: c.status === "closed",
					blockedReason: destination.ok
						? null
						: c.status === "closed"
							? "This case has closed. Thank you to everyone who backed it."
							: (BLOCKED[destination.reason] ?? null),
				}}
				fundsNote={fundsNote}
				backers={backers}
				donationCount={donationCount}
				backHref={back.href}
				backLabel={back.label}
				// The shell's header bar is this page's h1.
				headingLevel="h2"
				canSave
				initialSaved={initialSaved}
				canFollow={canFollow}
				initialFollowing={initialFollowing}
				updatesHref={`/discover/${id}/updates` as Route}
				updatesHighlightSince={followSeenAt}
			/>
		</div>
	);
}
