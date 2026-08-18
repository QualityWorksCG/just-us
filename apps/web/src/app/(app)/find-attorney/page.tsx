import {
	listDirectoryAttorneys,
	listedPracticeAreas,
	listedStates,
} from "@just-us/db/attorney-directory";
import { getOwnedCase } from "@just-us/db/cases";
import { ArrowLeft } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

import {
	AttorneyDirectory,
	readDirectoryParams,
	toDirectorySort,
} from "@/components/attorneys/attorney-directory";
import { requireRole } from "@/lib/auth-server";
import { findScreen } from "@/lib/dashboard-nav";

/**
 * The plaintiff's "Find an attorney" screen — the same directory as the public
 * `/attorneys` page, inside the dashboard shell.
 *
 * This static segment takes precedence over `dashboard/[...slug]`, which was
 * serving a placeholder here. That catch-all does the RBAC check for the screens
 * it renders, so taking the route over means doing it here instead: only
 * plaintiffs have this item in their nav.
 */
export default async function DashboardAttorneysPage({
	searchParams,
}: {
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
	const { session } = await requireRole("plaintiff");

	const screen = findScreen("plaintiff", "attorneys");
	const params = await searchParams;
	const filters = readDirectoryParams(params);
	// Where to look first, until the plaintiff chooses otherwise.
	//
	// Their own `User.jurisdiction` used to fill this, which was wrong twice over:
	// the column is documented as not-a-plaintiff-field and may hold a stale value
	// from before jurisdiction became per case, and a plaintiff's own state is not
	// necessarily their case's. The case they arrived from is the honest default —
	// an attorney can only take a case in the state it falls under, so a directory
	// scoped to anything else lists attorneys they cannot engage. Resolved below,
	// once the draft has been read.

	// Arrived from the case wizard's "Search and reach out yourself". Their draft
	// was saved on the way out, so the only thing missing is the road back — and
	// without it this screen is a one-way door out of a half-written case.
	//
	// Ownership is re-checked rather than trusted from the query string: the id is
	// about to become a link, and `getOwnedCase` is scoped to this plaintiff, so a
	// stranger's id simply yields no banner.
	const draftId = Array.isArray(params.draft) ? params.draft[0] : params.draft;
	const draft = draftId ? await getOwnedCase(draftId, session.user.id) : null;
	const defaultState = draft?.location || undefined;

	const [attorneys, practiceAreas, states] = await Promise.all([
		listDirectoryAttorneys({
			practiceArea: filters.area,
			state: filters.allStates ? undefined : (filters.state ?? defaultState),
			keyword: filters.keyword,
			sort: toDirectorySort(filters.sort),
		}),
		listedPracticeAreas(),
		listedStates(),
	]);

	return (
		<div>
			<p className="max-w-[640px] text-[14.5px] text-ink-soft leading-relaxed">
				{screen?.sub ??
					"Browse bar-verified attorneys and choose who represents you."}
			</p>

			{draft && (
				<div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-card)] border border-brass-deep/30 bg-brass-wash/60 px-5 py-4">
					<div className="min-w-0">
						<p className="font-bold text-[14px] text-ink">
							{draft.title?.trim() || "Your case"} is saved
						</p>
						<p className="mt-0.5 text-[13px] text-ink-soft leading-relaxed">
							Find someone who fits, then head back and add them to your case.
						</p>
					</div>
					<Link
						href={`/cases/new?draft=${draft.id}` as Route}
						className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[var(--radius-control)] bg-brass px-4 font-semibold text-[13px] text-white transition-colors hover:bg-brass-deep"
					>
						<ArrowLeft className="size-3.5" aria-hidden="true" />
						Back to your case
					</Link>
				</div>
			)}
			<div className="mt-8">
				<AttorneyDirectory
					attorneys={attorneys}
					practiceAreas={practiceAreas}
					states={states}
					filtered={filters.filtered}
					defaultState={defaultState}
					// Keep profile links inside the shell (see AttorneyCard).
					profileBasePath="/find-attorney"
					showMessageAction
				/>
			</div>
		</div>
	);
}
