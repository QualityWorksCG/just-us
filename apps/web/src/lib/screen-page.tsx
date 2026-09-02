import type { Role } from "@just-us/auth";
import { notFound } from "next/navigation";

import { ScreenPlaceholder } from "@/components/dashboard/screen-placeholder";
import { requireOnboarded } from "@/lib/auth-server";
import { findScreen } from "@/lib/dashboard-nav";
import { requireFeature } from "@/lib/flags-server";

/**
 * Builds the page for a dashboard screen that has no bespoke implementation yet.
 *
 * Each screen is a real route (`app/(app)/messages/page.tsx` and so on) rather
 * than one catch-all. Now that these screens sit at the top level, a
 * `[...slug]` catch-all would match every unrecognised URL on the site — so a
 * typo'd address would be treated as a dashboard screen, and a signed-out
 * visitor who mistyped anything would be sent to the sign-in page instead of
 * getting a 404. Enumerating the screens keeps 404s working.
 *
 * Usage is two lines per screen:
 *
 *     import { screenPage } from "@/lib/screen-page";
 *     export default screenPage("messages");
 */
export function screenPage(slug: string) {
	return async function Screen() {
		const session = await requireOnboarded();
		const role = ((session.user as { role?: Role }).role ?? "donor") as Role;

		// RBAC, enforced server-side: a screen that isn't in this role's nav is not
		// theirs. 404 rather than redirect, so another role's screen is
		// indistinguishable from a URL that doesn't exist.
		const screen = findScreen(role, slug);
		if (!screen) notFound();

		// Feature gating enforced here too, not only in the sidebar (JUS-13): a
		// flagged-off screen 404s even when the URL is typed directly.
		if (screen.flag) await requireFeature(screen.flag);

		return <ScreenPlaceholder sub={screen.sub} />;
	};
}
