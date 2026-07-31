import {
	listDirectoryAttorneys,
	listedPracticeAreas,
	listedStates,
} from "@just-us/db/attorney-directory";

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
	await requireRole("plaintiff");

	const screen = findScreen("plaintiff", "attorneys");
	const filters = readDirectoryParams(await searchParams);

	const [attorneys, practiceAreas, states] = await Promise.all([
		listDirectoryAttorneys({
			practiceArea: filters.area,
			state: filters.state,
			keyword: filters.keyword,
			sort: toDirectorySort(filters.sort),
		}),
		listedPracticeAreas(),
		listedStates(),
	]);

	return (
		<div>
			<h1 className="font-extrabold text-[30px] text-ink tracking-[-0.02em]">
				{screen?.title ?? "Find an attorney"}
			</h1>
			<p className="mt-2 max-w-[640px] text-[14.5px] text-ink-soft leading-relaxed">
				{screen?.sub ??
					"Browse bar-verified attorneys and choose who represents you."}
			</p>
			<div className="mt-8">
				<AttorneyDirectory
					attorneys={attorneys}
					practiceAreas={practiceAreas}
					states={states}
					filtered={filters.filtered}
				/>
			</div>
		</div>
	);
}
