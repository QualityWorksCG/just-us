import { getPublicCase } from "@just-us/db/cases";
import type { Route } from "next";
import { notFound } from "next/navigation";

import { PublicCaseView } from "@/components/cases/public-case-view";
import { requireRole } from "@/lib/auth-server";

/**
 * A live case as a signed-in donor sees it, inside the dashboard shell.
 *
 * The same case as the public `/cases/[id]` page — one component, so the two
 * can't drift. It exists as its own route because the public page has no
 * sidebar: linking a signed-in donor there dropped them out of the app with the
 * marketing header hidden and nothing to navigate back with.
 *
 * A static segment, so it sits alongside `/discover` rather than under a
 * catch-all, and does its own RBAC — this is the donor's browse flow.
 */

/**
 * Where "back" returns to. A donor opens a case from Discover, Saved, or the
 * saved strip on their dashboard, and the card says which — so back goes to the
 * list they actually came from instead of always dropping them on Discover.
 * Anything unrecognised (a pasted link, an old bookmark) falls back to Discover.
 */
const BACK_TO: Record<string, { href: Route; label: string }> = {
	discover: { href: "/discover" as Route, label: "Back to discover" },
	saved: { href: "/saved" as Route, label: "Back to saved" },
	home: { href: "/home" as Route, label: "Back to dashboard" },
};

export default async function InAppCasePage({
	params,
	searchParams,
}: {
	params: Promise<{ id: string }>;
	searchParams: Promise<{ from?: string }>;
}) {
	await requireRole("donor");
	const [{ id }, { from }] = await Promise.all([params, searchParams]);

	// The same predicate the public page uses: a case that isn't live 404s here
	// too, even for a donor holding the link.
	const c = await getPublicCase(id);
	if (!c) notFound();

	const back = BACK_TO[from ?? ""] ?? BACK_TO.discover;

	return (
		// Full-bleed, like the other app screens: the shell's content column already
		// supplies the gutters.
		<div className="w-full">
			<PublicCaseView
				c={c}
				backHref={back.href}
				backLabel={back.label}
				// The shell's header bar is this page's h1.
				headingLevel="h2"
			/>
		</div>
	);
}
