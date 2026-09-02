import type { Role } from "@just-us/auth";
import { listOwnedCases } from "@just-us/db/cases";

import {
	type CaseSummary,
	PlaintiffDashboard,
} from "@/components/dashboard/plaintiff-dashboard";
import { ScreenPlaceholder } from "@/components/dashboard/screen-placeholder";
import { requireOnboarded } from "@/lib/auth-server";
import { getRoleNav } from "@/lib/dashboard-nav";

export default async function DashboardHome() {
	const session = await requireOnboarded();
	const role = ((session.user as { role?: Role }).role ?? "donor") as Role;

	if (role === "plaintiff") {
		const owned = await listOwnedCases(session.user.id);
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
			createdAt: c.createdAt.toISOString(),
		}));
		return <PlaintiffDashboard name={session.user.name} cases={cases} />;
	}

	const home = getRoleNav(role).items[0];
	return <ScreenPlaceholder title={home.title} sub={home.sub} />;
}
