import type { Role } from "@just-us/auth";
import { unreadMessageCount } from "@just-us/db/messages";
import { cookies } from "next/headers";
import { AppShell } from "@/components/dashboard/app-shell";
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
	const [flags, messageUnreadCount] = await Promise.all([
		getFlags(),
		role === "plaintiff" || role === "attorney"
			? unreadMessageCount(session.user.id)
			: Promise.resolve(0),
	]);

	return (
		<AppShell
			role={role}
			name={session.user.name}
			email={session.user.email}
			avatarUrl={session.user.image ?? null}
			defaultOpen={sidebarState !== "false"}
			flags={flags}
			messageUnreadCount={messageUnreadCount}
		>
			{children}
		</AppShell>
	);
}
