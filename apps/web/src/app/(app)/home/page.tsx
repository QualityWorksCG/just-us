import type { Role } from "@just-us/auth";
import { listAdmissions } from "@just-us/db/admissions";
import { getAttorneyProfile } from "@just-us/db/attorney-profile";
import { pendingInvitationsForEmail } from "@just-us/db/case-invitations";
import { listUpdatesForBacker } from "@just-us/db/case-updates";
import { listOwnedCases } from "@just-us/db/cases";
import { donorStats, listBackedCases } from "@just-us/db/donations";
import { listMessageConversations } from "@just-us/db/messages";
import { attorneyPayoutReadiness } from "@just-us/db/payouts";
import {
	interestCounts,
	listAttorneyCases,
	listMyInterests,
	listSeekingQueue,
	queueCategories,
	queueStates,
} from "@just-us/db/representation";
import { interestCountsByCase } from "@just-us/db/requests";
import { countSavedCases, listSavedCases } from "@just-us/db/saves";

import { AdminOverview } from "@/components/dashboard/admin-overview";
import { AttorneyInvitations } from "@/components/dashboard/attorney-invitations";
import { toDonorCase } from "@/components/dashboard/donor-case";
import { DonorDashboard } from "@/components/dashboard/donor-dashboard";
import { MatchedCasesPanel } from "@/components/dashboard/matched-cases-panel";
import { PayoutNudge } from "@/components/dashboard/payout-nudge";
import {
	type CaseSummary,
	PlaintiffDashboard,
} from "@/components/dashboard/plaintiff-dashboard";
import { ScreenPlaceholder } from "@/components/dashboard/screen-placeholder";
import {
	readQueueParams,
	SeekingQueue,
	toQueueSort,
} from "@/components/dashboard/seeking-queue";
import { requireOnboarded } from "@/lib/auth-server";
import { getRoleNav } from "@/lib/dashboard-nav";

export default async function DashboardHome({
	searchParams,
}: {
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
	const session = await requireOnboarded();
	const role = ((session.user as { role?: Role }).role ?? "donor") as Role;

	if (role === "plaintiff") {
		const [owned, interests, conversations] = await Promise.all([
			listOwnedCases(session.user.id),
			// Expressions of interest surface here, per case (JUS-25).
			interestCountsByCase(session.user.id),
			listMessageConversations(session.user.id),
		]);
		const conversationByAttorney = new Map(
			conversations.map((conversation) => [
				conversation.otherUser.id,
				conversation.conversationId,
			]),
		);
		const cases: CaseSummary[] = owned.map((c) => ({
			id: c.id,
			title: c.title,
			category: c.category,
			location: c.location,
			status: c.status,
			goalCents: c.goalCents,
			raisedCents: c.raisedCents,
			donorsCount: c.donorsCount,
			storyLength: c.story.trim().length,
			hasCover: !!c.coverImageUrl,
			evidenceCount: Array.isArray(c.evidence) ? c.evidence.length : 0,
			attorneyName: c.attorneyName,
			attorneyFirm: c.attorneyFirm,
			attorneyArea: c.attorneyArea,
			attorneyLocation: c.attorneyLocation,
			attorneyId: c.match?.attorneyId ?? null,
			attorneyConversationId: c.match
				? (conversationByAttorney.get(c.match.attorneyId) ?? null)
				: null,
			createdAt: c.createdAt.toISOString(),
			interestCount: interests[c.id]?.open ?? 0,
			newInterestCount: interests[c.id]?.unseen ?? 0,
		}));
		return <PlaintiffDashboard cases={cases} />;
	}

	if (role === "donor") {
		const [stats, savedCount, saved, backed, backerUpdates] = await Promise.all(
			[
				donorStats(session.user.id, new Date().getFullYear()),
				countSavedCases(session.user.id),
				listSavedCases(session.user.id, 3),
				// Real backed cases (live + closed), newest gift first.
				listBackedCases(session.user.id),
				listUpdatesForBacker(session.user.id, 4),
			],
		);
		return (
			<DonorDashboard
				data={{
					totalCents: stats.totalCents,
					casesBacked: stats.casesBacked,
					savedCount,
					// Total raised across every case they backed — real community impact.
					helpedFundCents: backed.reduce(
						(sum, b) => sum + (b.case.raisedCents ?? 0),
						0,
					),
					saved: saved.map(toDonorCase),
					backing: backed.slice(0, 3).map((b) => ({
						id: b.case.id,
						title: b.case.title,
						category: b.case.category,
						status: b.case.status,
						givenCents: b.givenCents,
						raisedCents: b.case.raisedCents,
						goalCents: b.case.goalCents,
					})),
					backingCount: backed.length,
					updates: backerUpdates.map((u) => ({
						id: u.id,
						caseId: u.caseId,
						caseTitle: u.caseTitle,
						authorName: u.authorName,
						body: u.body,
						createdAt: u.createdAt,
					})),
				}}
			/>
		);
	}

	const home = getRoleNav(role).items[0];

	// The attorney's home is the Seeking Representation queue (JUS-25).
	if (role === "attorney") {
		const filters = readQueueParams(await searchParams);
		const [
			cases,
			categories,
			states,
			tally,
			interests,
			profile,
			payout,
			matched,
			invitations,
			admissions,
		] = await Promise.all([
			listSeekingQueue(session.user.id, {
				category: filters.category,
				state: filters.state,
				sort: toQueueSort(filters.sort),
			}),
			queueCategories(session.user.id),
			queueStates(session.user.id),
			interestCounts(session.user.id),
			listMyInterests(session.user.id),
			getAttorneyProfile(session.user.id),
			// Donations pay the firm, so an unfinished payout account here blocks
			// someone else's published case. This is the only screen that tells them.
			attorneyPayoutReadiness({
				userId: session.user.id,
				email: session.user.email,
			}),
			// Matched cases for the dashboard panel — gated to this attorney's own
			// cases (account activity + update posting are scoped by this).
			listAttorneyCases({ userId: session.user.id, email: session.user.email }),
			// Invitations sent to this address and not yet answered. Read by email,
			// because that is what the plaintiff named and the row can predate the
			// account — and read here at all because the emailed link was otherwise
			// the only way back to the decision.
			pendingInvitationsForEmail(session.user.email),
			// The states this attorney is admitted in, each with its bar standing. The
			// queue is already scoped to them server-side, so this is here to explain
			// the screen rather than to filter it — an empty list is the one case where
			// an empty queue is about the attorney rather than about the platform, and
			// each invitation below needs the standing of its own case's state.
			listAdmissions(session.user.id),
		]);

		return (
			<div>
				{/* Before the payout nudge: an unanswered invitation is a plaintiff
				    waiting on a decision only this attorney can make, and their case is
				    off the queue until it comes. */}
				<AttorneyInvitations
					invitations={invitations}
					admissions={admissions}
				/>
				<PayoutNudge
					waitingCases={payout.waitingCases}
					unstartedCases={payout.unstartedCases}
					inReviewCases={payout.inReviewCases}
					blockedCases={payout.blockedCases}
				/>
				{/* Matched cases first — the attorney's active work, with each case's
				    account activity and a way to post updates without leaving here. */}
				<div className="mt-2 mb-10">
					<MatchedCasesPanel cases={matched} authorName={session.user.name} />
				</div>
				<div className="border-border border-t pt-8">
					<h2 className="font-bold text-[18px] text-ink">
						Seeking representation
					</h2>
					<p className="mt-1 text-[14.5px] text-ink-soft leading-relaxed">
						{home.sub}
					</p>
				</div>
				<div className="mt-8">
					<SeekingQueue
						cases={cases}
						categories={categories}
						states={states}
						admittedStates={admissions.map((row) => row.state)}
						verifiedStates={admissions
							.filter((row) => row.verificationStatus === "verified")
							.map((row) => row.state)}
						filtered={filters.filtered}
						tally={tally}
						interests={interests}
						canExpressInterest={profile?.verificationStatus === "verified"}
					/>
				</div>
			</div>
		);
	}

	// The administrator's home is the platform overview dashboard.
	if (role === "administrator") {
		return <AdminOverview />;
	}

	return <ScreenPlaceholder sub={home.sub} />;
}
