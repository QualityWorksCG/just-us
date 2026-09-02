import { getDirectoryAttorney } from "@just-us/db/attorney-directory";
import type { Route } from "next";
import { notFound } from "next/navigation";

import { AttorneyProfileView } from "@/components/attorneys/attorney-profile-view";
import { requireRole } from "@/lib/auth-server";

/**
 * An attorney's profile as a plaintiff sees it, inside the dashboard shell.
 *
 * The same profile as the public `/attorneys/[id]` page — one component, so the
 * two can't drift. It exists as its own route because the public page has no
 * sidebar: linking a signed-in plaintiff there dropped them out of the app
 * mid-task, with the marketing header hidden and nothing to navigate back with.
 *
 * A static segment, so it takes precedence over `dashboard/[...slug]`-style
 * matching and has to do its own RBAC — only plaintiffs have "Find an attorney"
 * in their nav.
 */
export default async function InAppAttorneyProfilePage({
	params,
	searchParams,
}: {
	params: Promise<{ id: string }>;
	searchParams: Promise<{ fromCase?: string }>;
}) {
	await requireRole("plaintiff");
	const { id } = await params;
	const attorney = await getDirectoryAttorney(id);

	// Same answer for unlisted and unknown as the public page gives, so an
	// unverified profile isn't discoverable from in here either.
	if (!attorney) notFound();

	// When opened from a case's attorney requests (`?fromCase=<id>`), "back" has to
	// return to that case, not the attorney directory the profile normally lives
	// in — otherwise a plaintiff mid-decision is dropped onto Find an attorney and
	// loses the case they were choosing for. The id is validated so a hand-crafted
	// value can't turn the back link into anything but a `/my-cases/<id>/requests`
	// path we build ourselves.
	const { fromCase } = await searchParams;
	const fromValidCase = fromCase && /^[a-zA-Z0-9_-]+$/.test(fromCase);
	const backHref = (
		fromValidCase ? `/my-cases/${fromCase}/requests` : "/find-attorney"
	) as Route;
	const backLabel = fromValidCase ? "Back to case" : "Back to attorneys";

	return (
		<AttorneyProfileView
			attorney={attorney}
			backHref={backHref}
			backLabel={backLabel}
			// The shell's header bar is this page's h1.
			headingLevel="h2"
			messagingEnabled
		/>
	);
}
