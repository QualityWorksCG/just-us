import { browseLiveCases } from "@just-us/db/cases";
import { listSavedCaseIds } from "@just-us/db/saves";
import { SearchX } from "lucide-react";

import { BrowseControls } from "@/components/browse-controls";
import { toDonorCase } from "@/components/dashboard/donor-case";
import { DonorCaseCard } from "@/components/dashboard/donor-case-card";
import { requireRole } from "@/lib/auth-server";

export default async function DiscoverPage({
	searchParams,
}: {
	searchParams: Promise<{
		q?: string;
		state?: string;
		category?: string;
		sort?: string;
	}>;
}) {
	const { session } = await requireRole("donor");
	const sp = await searchParams;
	const sort =
		sp.sort === "funded" || sp.sort === "newest" ? sp.sort : "trending";

	const [cases, savedIds] = await Promise.all([
		browseLiveCases({
			q: sp.q,
			state: sp.state,
			category: sp.category,
			sort,
		}),
		listSavedCaseIds(session.user.id),
	]);
	const savedSet = new Set(savedIds);
	const filtered = !!(sp.q || sp.state || sp.category);

	return (
		<div className="flex flex-col gap-6">
			<div>
				<h1 className="font-extrabold text-[30px] text-ink tracking-[-0.02em]">
					Discover cases
				</h1>
				<p className="mt-1.5 text-[14.5px] text-ink-soft">
					Find a case that matters to you — save it, share it, or back it today.
				</p>
			</div>

			<BrowseControls />

			{cases.length === 0 ? (
				<div className="flex flex-col items-center gap-3 rounded-[var(--radius-card-lg)] border border-border border-dashed bg-surface px-6 py-16 text-center">
					<span className="flex size-12 items-center justify-center rounded-xl bg-brass-wash text-brass-deep">
						<SearchX className="size-6" aria-hidden="true" />
					</span>
					<p className="font-bold text-[16px] text-ink">
						{filtered ? "No cases match your search" : "No live cases yet"}
					</p>
					<p className="max-w-[44ch] text-[13.5px] text-muted-foreground leading-relaxed">
						{filtered
							? "Try clearing a filter or searching for something else."
							: "As soon as a case goes live and starts raising, it'll show up here."}
					</p>
				</div>
			) : (
				<div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
					{cases.map((c) => (
						<DonorCaseCard
							key={c.id}
							c={toDonorCase(c)}
							initialSaved={savedSet.has(c.id)}
						/>
					))}
				</div>
			)}
		</div>
	);
}
