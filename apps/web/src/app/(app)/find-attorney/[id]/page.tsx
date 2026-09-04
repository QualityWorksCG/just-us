import { getDirectoryAttorney } from "@just-us/db/attorney-directory";
import { getOwnedCase } from "@just-us/db/cases";
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
	const { session } = await requireRole("plaintiff");
	const { id } = await params;
	const attorney = await getDirectoryAttorney(id);

	// Same answer for unlisted and unknown as the public page gives, so an
	// unverified profile isn't discoverable from in here either.
	if (!attorney) notFound();

	// When opened from a case (`?fromCase=<id>`), "back" has to return to that case,
	// not the attorney directory the profile normally lives in — otherwise a
	// plaintiff mid-decision is dropped onto Find an attorney and loses the case
	// they were choosing for. Where "back" lands must match the find-attorney banner
	// exactly: while the case is still being built — any status short of live/closed —
	// it returns to the wizard, which resumes at whatever step is unfinished (add the
	// attorney, agree the fee, publish). Never to the requests/manage view, which for
	// an unfinished case reads as if it were already published. Only a live/closed
	// case goes to the case itself. The id is validated and the case re-checked
	// against this owner, so a hand-crafted value simply yields the directory
	// fallback.
	const { fromCase } = await searchParams;
	const fromValidCase = fromCase && /^[a-zA-Z0-9_-]+$/.test(fromCase);
	const kase = fromValidCase
		? await getOwnedCase(fromCase, session.user.id)
		: null;
	const owned = kase && !kase.deletedAt;
	const inProgress =
		owned && kase.status !== "live" && kase.status !== "closed";
	const backHref = (
		!owned
			? "/find-attorney"
			: inProgress
				? `/cases/new?draft=${kase.id}`
				: `/my-cases/${kase.id}`
	) as Route;
	const backLabel = owned ? "Back to case" : "Back to attorneys";

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
