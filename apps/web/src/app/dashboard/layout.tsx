import type { Role } from "@just-us/auth";
import { cookies } from "next/headers";

import { AppShell } from "@/components/dashboard/app-shell";
import { requireOnboarded } from "@/lib/auth-server";

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

	return (
		<AppShell
			role={role}
			name={session.user.name}
			email={session.user.email}
			defaultOpen={sidebarState !== "false"}
		>
			{children}
		</AppShell>
	);
}
