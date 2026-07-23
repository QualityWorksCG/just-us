import type { Role } from "@just-us/auth";

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

	return (
		<AppShell role={role} name={session.user.name} email={session.user.email}>
			{children}
		</AppShell>
	);
}
