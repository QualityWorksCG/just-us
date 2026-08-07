import type { Role } from "@just-us/auth";
import {
	type CaseUpdateNotice,
	listNewUpdatesForPlaintiff,
} from "@just-us/db/case-updates";
import {
	type FollowerUpdateNotice,
	listNewUpdatesForFollower,
} from "@just-us/db/follows";
import { unreadMessageCount } from "@just-us/db/messages";
import {
	listNewInterestsForPlaintiff,
	type PlaintiffNewInterest,
} from "@just-us/db/requests";
import type { Route } from "next";
import { cookies } from "next/headers";

import { AppShell } from "@/components/dashboard/app-shell";
import type { BellNotification } from "@/components/dashboard/notification-bell";
import { requireOnboarded } from "@/lib/auth-server";
import { getFlags } from "@/lib/flags-server";

export default async function DashboardLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	// Verified + onboarded session required; guards handle the redirects.
	const session = await requireOnboarded();
	const role = ((session.user as { role?: Role }).role ?? "donor") as Role;

	// The Sidebar writes its open/closed state to this cookie. Reading it here so
	// the server renders the same state the user left it in — otherwise an
	// expanded sidebar renders first and snaps shut on hydration.
	const sidebarState = (await cookies()).get("sidebar_state")?.value;

	// Flag state is read here and handed down, so the client sidebar stays a pure
	// render of what the server decided rather than fetching flags itself. (JUS-13)
	const isPlaintiff = role === "plaintiff";
	const isDonor = role === "donor";
	const [flags, messageUnreadCount, newRequests, newUpdates, followerUpdates] =
		await Promise.all([
			getFlags(),
			role === "plaintiff" || role === "attorney"
				? unreadMessageCount(session.user.id)
				: Promise.resolve(0),
			// Plaintiff bell: attorney requests on their cases…
			isPlaintiff
				? listNewInterestsForPlaintiff(session.user.id)
				: Promise.resolve<PlaintiffNewInterest[]>([]),
			// …and updates their attorney posts.
			isPlaintiff
				? listNewUpdatesForPlaintiff(session.user.id)
				: Promise.resolve<CaseUpdateNotice[]>([]),
			// Donor bell: new updates on cases they follow.
			isDonor
				? listNewUpdatesForFollower(session.user.id)
				: Promise.resolve<FollowerUpdateNotice[]>([]),
		]);

	// One newest-first feed for the header bell. Each item carries its own href,
	// since a request/update opens a different screen for each role.
	const notifications: BellNotification[] = [
		...newRequests.map((r) => ({
			id: `req-${r.id}`,
			kind: "request" as const,
			caseTitle: r.caseTitle,
			actorName: r.attorneyName,
			href: `/my-cases/${r.caseId}/requests` as Route,
			createdAt: r.createdAt,
		})),
		...newUpdates.map((u) => ({
			id: `upd-${u.id}`,
			kind: "update" as const,
			caseTitle: u.caseTitle,
			actorName: u.attorneyName,
			href: `/my-cases/${u.caseId}` as Route,
			createdAt: u.createdAt,
		})),
		...followerUpdates.map((u) => ({
			id: `fupd-${u.id}`,
			kind: "update" as const,
			caseTitle: u.caseTitle,
			actorName: u.authorName,
			href: `/discover/${u.caseId}` as Route,
			createdAt: u.createdAt,
		})),
	]
		.sort(
			(a, b) =>
				new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
		)
		.slice(0, 15);

	return (
		<AppShell
			role={role}
			name={session.user.name}
			email={session.user.email}
			avatarUrl={session.user.image ?? null}
			defaultOpen={sidebarState !== "false"}
			flags={flags}
			messageUnreadCount={messageUnreadCount}
			notifications={notifications}
		>
			{children}
		</AppShell>
	);
}
