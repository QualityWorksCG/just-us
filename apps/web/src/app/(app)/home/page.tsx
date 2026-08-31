import type { Role } from "@just-us/auth";
import { pendingInvitationsForEmail } from "@just-us/db/case-invitations";
import { listUpdatesForBacker } from "@just-us/db/case-updates";
import { listOwnedCases } from "@just-us/db/cases";
import { donorStats, listBackedCases } from "@just-us/db/donations";
import { listMessageConversations } from "@just-us/db/messages";
import { attorneyPayoutReadiness } from "@just-us/db/payouts";
import { listAttorneyCases, listMyInterests } from "@just-us/db/representation";
import { interestCountsByCase } from "@just-us/db/requests";
import { countSavedCases, listSavedCases } from "@just-us/db/saves";
import type { Route } from "next";

import { AdminOverview } from "@/components/dashboard/admin-overview";
import {
	type AttentionItem,
	AttorneyDashboard,
	type CaseloadItem,
} from "@/components/dashboard/attorney-dashboard";
import { toDonorCase } from "@/components/dashboard/donor-case";
import { DonorDashboard } from "@/components/dashboard/donor-dashboard";
import {
	type CaseSummary,
	PlaintiffDashboard,
} from "@/components/dashboard/plaintiff-dashboard";
import { ScreenPlaceholder } from "@/components/dashboard/screen-placeholder";
import { requireOnboarded } from "@/lib/auth-server";
import { caseInviteHref } from "@/lib/case-invite-ref";
import { getRoleNav } from "@/lib/dashboard-nav";

export default async function DashboardHome() {
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

	// The attorney's home is their dashboard (JUS-25): a read of where their work
	// stands. The open queue and their expressions of interest live on the separate
	// "Intake requests" screen.
	if (role === "attorney") {
		const [matched, invitations, payout, interests, conversations] =
			await Promise.all([
				listAttorneyCases({
					userId: session.user.id,
					email: session.user.email,
				}),
				// Invitations sent to this address and not yet answered — read by email,
				// because the plaintiff named an address and the row can predate the
				// account.
				pendingInvitationsForEmail(session.user.email),
				// Donations pay the firm, so an unfinished payout account blocks a
				// published case from taking money.
				attorneyPayoutReadiness({
					userId: session.user.id,
					email: session.user.email,
				}),
				listMyInterests(session.user.id),
				listMessageConversations(session.user.id),
			]);

		const liveCases = matched.filter((c) => c.status === "live").length;
		const closedCases = matched.filter((c) => c.status === "closed").length;
		const raisedCents = matched.reduce((sum, c) => sum + c.raisedCents, 0);
		const raisedCasesCount = matched.filter((c) => c.raisedCents > 0).length;
		const takenForward = interests.filter(
			(i) => i.status === "accepted",
		).length;
		const unread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);
		const payoutPending = payout.unstartedCases + payout.waitingCases;

		const attention: AttentionItem[] = [
			...invitations.map((inv) => ({
				id: `inv-${inv.id}`,
				kind: "request" as const,
				title: "New case request",
				sub: `${inv.caseTitle || "Untitled intake"} · ${inv.category} · ${inv.location}`,
				cta: "Review",
				href: caseInviteHref({ invitationId: inv.id }) as Route,
			})),
			...(payoutPending > 0
				? [
						{
							id: "payout",
							kind: "payout" as const,
							title: "Finish payout setup",
							sub: `${payoutPending} ${payoutPending === 1 ? "intake" : "intakes"} can't accept donations until set up`,
							cta: "Set up",
							href: "/my-cases" as Route,
						},
					]
				: []),
			...(unread > 0
				? [
						{
							id: "messages",
							kind: "reply" as const,
							title: "New messages",
							sub: `${unread} unread ${unread === 1 ? "message" : "messages"}`,
							cta: "Open",
							href: "/messages" as Route,
						},
					]
				: []),
		];

		const caseload: CaseloadItem[] = matched.map((c) => ({
			id: c.id,
			title: c.title,
			status: c.status,
			state: c.state,
			raisedCents: c.raisedCents,
			goalCents: c.goalCents,
		}));

		const firstName =
			session.user.name.trim().split(/\s+/)[0] || session.user.name;

		return (
			<AttorneyDashboard
				firstName={firstName}
				hour={new Date().getHours()}
				activeCases={matched.length}
				liveCases={liveCases}
				closedCases={closedCases}
				newRequests={invitations.length}
				raisedCents={raisedCents}
				raisedCasesCount={raisedCasesCount}
				expressionsTotal={interests.length}
				expressionsTakenForward={takenForward}
				attention={attention}
				caseload={caseload}
			/>
		);
	}

	// The administrator's home is the platform overview dashboard.
	if (role === "administrator") {
		return <AdminOverview />;
	}

	return <ScreenPlaceholder sub={home.sub} />;
}
