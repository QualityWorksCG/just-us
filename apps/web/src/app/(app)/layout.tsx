import type { Role } from "@just-us/auth";
import { cookies } from "next/headers";

import { AppShell } from "@/components/dashboard/app-shell";
import { requireOnboarded } from "@/lib/auth-server";
import { isManagedPrivateAvatarUrl } from "@/lib/avatar-policy";
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
	const flags = await getFlags();

	return (
		<AppShell
			role={role}
			userId={session.user.id}
			name={session.user.name}
			email={session.user.email}
			hasAvatar={isManagedPrivateAvatarUrl(session.user.image)}
			defaultOpen={sidebarState !== "false"}
			flags={flags}
		>
			{children}
		</AppShell>
	);
}
