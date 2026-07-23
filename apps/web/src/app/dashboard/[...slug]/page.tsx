import type { Role } from "@just-us/auth";
import { redirect } from "next/navigation";

import { ScreenPlaceholder } from "@/components/dashboard/screen-placeholder";
import { requireOnboarded } from "@/lib/auth-server";
import { findScreen } from "@/lib/dashboard-nav";

export default async function DashboardScreen({
	params,
}: {
	params: Promise<{ slug: string[] }>;
}) {
	const session = await requireOnboarded();
	const role = ((session.user as { role?: Role }).role ?? "donor") as Role;

	const { slug } = await params;
	const key = slug[0] ?? "";

	// RBAC: a screen not in this role's nav (another role's screen or an unknown
	// path) bounces to the role home. Enforced server-side.
	const screen = findScreen(role, key);
	if (!screen || key === "") {
		redirect("/dashboard");
	}

	return <ScreenPlaceholder title={screen.title} sub={screen.sub} />;
}
