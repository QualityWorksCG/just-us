import type { Role } from "@just-us/auth";
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
	const [flags, messageUnreadCount, rows, notificationUnreadCount] =
		await Promise.all([
			getFlags(),
			role === "plaintiff" || role === "attorney"
				? unreadMessageCount(session.user.id)
				: Promise.resolve(0),
			// The bell and its badge both come from the unified Notification store,
			// so every role sees the events that concern it (JUS email-notifications).
			listNotifications(session.user.id, 15),
			countUnreadNotifications(session.user.id),
		]);

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
			notifications={notifications}
			notificationUnreadCount={notificationUnreadCount}
		>
			{children}
		</AppShell>
	);
}
