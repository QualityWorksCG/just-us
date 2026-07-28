import type { Role } from "@just-us/auth";
import type { Route } from "next";
import { redirect } from "next/navigation";

import { FeatureFlags } from "@/components/dashboard/feature-flags";
import { ScreenPlaceholder } from "@/components/dashboard/screen-placeholder";
import { requireOnboarded } from "@/lib/auth-server";
import { findScreen } from "@/lib/dashboard-nav";
import { getFlags, requireFeature } from "@/lib/flags-server";

export default async function DashboardScreen({
	params,
}: {
	params: Promise<{ slug: string[] }>;
}) {
	const session = await requireOnboarded();
	const role = ((session.user as { role?: Role }).role ?? "donor") as Role;

	const { slug } = await params;
	const key = slug[0] ?? "";

	// The plaintiff "Submit a case" screen is the full-page creation wizard.
	if (role === "plaintiff" && key === "submit") {
		redirect("/cases/new" as Route);
	}

	// RBAC: a screen not in this role's nav (another role's screen or an unknown
	// path) bounces to the role home. Enforced server-side.
	const screen = findScreen(role, key);
	if (!screen || key === "") {
		redirect("/dashboard");
	}

	// Feature gating enforced here, not only in the sidebar (JUS-13): a flagged-off
	// screen 404s even when the URL is typed directly.
	if (screen.flag) {
		await requireFeature(screen.flag);
	}

	// The administrator Configuration screen owns the feature-flag controls.
	if (key === "configuration" && role === "administrator") {
		const flags = await getFlags();
		return (
			<div>
				<h1 className="font-extrabold text-[30px] text-ink tracking-[-0.02em]">
					{screen.title}
				</h1>
				<p className="mt-2 max-w-[640px] text-[14.5px] text-ink-soft leading-relaxed">
					{screen.sub}
				</p>
				<div className="mt-8">
					<FeatureFlags initial={flags} />
				</div>
			</div>
		);
	}

	return <ScreenPlaceholder title={screen.title} sub={screen.sub} />;
}
