import type { Role } from "@just-us/auth";

import { ScreenPlaceholder } from "@/components/dashboard/screen-placeholder";
import { requireOnboarded } from "@/lib/auth-server";
import { getRoleNav } from "@/lib/dashboard-nav";

export default async function DashboardHome() {
	const session = await requireOnboarded();
	const role = ((session.user as { role?: Role }).role ?? "donor") as Role;
	const home = getRoleNav(role).items[0];

	return <ScreenPlaceholder title={home.title} sub={home.sub} />;
}
