import { FeatureFlags } from "@/components/dashboard/feature-flags";
import { requireAdministrator } from "@/lib/auth-server";
import { findScreen } from "@/lib/dashboard-nav";
import { getFlags } from "@/lib/flags-server";

/**
 * Platform configuration — the screen that owns the feature-flag controls
 * (JUS-13). Administrators only; the guard is here rather than inherited,
 * because this is a real route of its own.
 */
export default async function ConfigurationPage() {
	await requireAdministrator();

	const screen = findScreen("administrator", "configuration");
	const flags = await getFlags();

	return (
		<div>
			<p className="max-w-[640px] text-[14.5px] text-ink-soft leading-relaxed">
				{screen?.sub ??
					"Where the platform is permitted to operate, and platform settings."}
			</p>
			<div className="mt-8">
				<FeatureFlags initial={flags} />
			</div>
		</div>
	);
}
