import type { Role } from "@just-us/auth";
import { pendingInvitationsForEmail } from "@just-us/db/case-invitations";
import { unreadMessageCount } from "@just-us/db/messages";
import {
	countUnreadNotifications,
	listNotifications,
} from "@just-us/db/notifications";
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
	const [
		flags,
		messageUnreadCount,
		rows,
		notificationUnreadCount,
		intakeNewInvites,
	] = await Promise.all([
		getFlags(),
		role === "plaintiff" || role === "attorney"
			? unreadMessageCount(session.user.id)
			: Promise.resolve(0),
		// The bell and its badge both come from the unified Notification store,
		// so every role sees the events that concern it (JUS email-notifications).
		listNotifications(session.user.id, 15),
		countUnreadNotifications(session.user.id),
		// The "New" intake requests for an attorney: plaintiffs who named them and
		// are waiting on a decision. Same source as the queue's New tab, so the
		// sidebar count and that tab's count are always the same number.
		role === "attorney"
			? pendingInvitationsForEmail(session.user.email)
			: Promise.resolve([]),
	]);

	const intakeNewCount = intakeNewInvites.length;

	const notifications: BellNotification[] = rows.map((n) => ({
		id: n.id,
		type: n.type,
		title: n.title,
		body: n.body,
		actorName: n.actorName,
		href: n.href as Route,
		createdAt: n.createdAt,
		readAt: n.readAt,
	}));

	return (
		<AppShell
			role={role}
			name={session.user.name}
			email={session.user.email}
			avatarUrl={session.user.image ?? null}
			defaultOpen={sidebarState !== "false"}
			flags={flags}
			messageUnreadCount={messageUnreadCount}
			intakeNewCount={intakeNewCount}
			notifications={notifications}
			notificationUnreadCount={notificationUnreadCount}
		>
			{children}
		</AppShell>
	);
}
