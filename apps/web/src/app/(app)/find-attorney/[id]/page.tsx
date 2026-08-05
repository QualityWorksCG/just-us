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
}: {
	params: Promise<{ id: string }>;
}) {
	await requireRole("plaintiff");
	const { id } = await params;
	const attorney = await getDirectoryAttorney(id);

	// Same answer for unlisted and unknown as the public page gives, so an
	// unverified profile isn't discoverable from in here either.
	if (!attorney) notFound();

	return (
		<AttorneyProfileView
			attorney={attorney}
			backHref={"/find-attorney" as Route}
			backLabel="Back to attorneys"
			// The shell's header bar is this page's h1.
			headingLevel="h2"
			messagingEnabled
		/>
	);
}
