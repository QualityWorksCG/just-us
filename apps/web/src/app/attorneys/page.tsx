import {
	listDirectoryAttorneys,
	listedPracticeAreas,
	listedStates,
} from "@just-us/db/attorney-directory";
import { buttonVariants } from "@just-us/ui/components/button";
import { cn } from "@just-us/ui/lib/utils";
import { ArrowRight, FileText } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import {
	AttorneyDirectory,
	readDirectoryParams,
	toDirectorySort,
} from "@/components/attorneys/attorney-directory";

export const metadata: Metadata = {
	title: "Find an attorney",
	description:
		"An open directory of bar-verified attorneys. Search by practice area and state, compare profiles and reviews, and contact whoever you choose.",
};

export default async function AttorneysPage({
	searchParams,
}: {
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
	const filters = readDirectoryParams(await searchParams);

	// Filter options come from what's actually listed, so the controls can't offer
	// a choice that returns nothing.
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
		<main className="min-h-full overflow-y-auto px-6 py-12 sm:px-10">
			<div className="mx-auto flex max-w-[1080px] flex-col gap-8">
				<header>
					<h1 className="font-extrabold text-[clamp(1.75rem,3vw,2.25rem)] text-ink tracking-[-0.03em]">
						Find an attorney
					</h1>
					<p className="mt-2 max-w-[68ch] text-[14.5px] text-ink-soft leading-relaxed">
						An open directory of bar-verified attorneys. Search by practice area
						and state, compare profiles and reviews, and contact whoever you
						choose. JustUs never picks for you.
					</p>
				</header>

				{/* Why Contact leads to case submission, said once up front rather than
				    as a surprise after the click. */}
				<div className="flex flex-wrap items-center justify-between gap-4 rounded-[var(--radius-card)] border border-border bg-brass-wash/40 px-5 py-3.5">
					<p className="flex items-start gap-2.5 text-[13px] text-ink-soft leading-relaxed">
						<FileText
							className="mt-0.5 size-4 shrink-0 text-brass-deep"
							aria-hidden="true"
						/>
						Browse and compare freely. To contact an attorney about
						representation, submit your case first. They'll need it to say yes.
					</p>
					<Link
						href="/cases/new"
						className={cn(buttonVariants({ variant: "outline" }), "shrink-0")}
					>
						Submit a case
						<ArrowRight aria-hidden="true" />
					</Link>
				</div>

				<AttorneyDirectory
					attorneys={attorneys}
					practiceAreas={practiceAreas}
					states={states}
					filtered={filters.filtered}
				/>
			</div>
		</main>
	);
}
