import { browseLiveCases, countLiveCases } from "@just-us/db/cases";
import { listBackedCaseIds } from "@just-us/db/donations";
import { listFollowedCaseIds } from "@just-us/db/follows";
import { listSavedCaseIds } from "@just-us/db/saves";
import { buttonVariants } from "@just-us/ui/components/button";
import { cn } from "@just-us/ui/lib/utils";
import { ArrowLeft, ArrowRight, SearchX } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

import { BrowseControls } from "@/components/browse-controls";
import { toDonorCase } from "@/components/dashboard/donor-case";
import { DonorCaseCard } from "@/components/dashboard/donor-case-card";
import { requireRole } from "@/lib/auth-server";

const PAGE_SIZE = 12;

export default async function DiscoverPage({
	searchParams,
}: {
	searchParams: Promise<{
		q?: string;
		state?: string;
		category?: string;
		sort?: string;
		page?: string;
	}>;
}) {
	const { session } = await requireRole("donor");
	const sp = await searchParams;
	const sort =
		sp.sort === "funded" || sp.sort === "newest" ? sp.sort : "trending";
	const filters = {
		q: sp.q,
		state: sp.state,
		category: sp.category,
		sort,
	} as const;
	const filtered = !!(sp.q || sp.state || sp.category);

	const total = await countLiveCases(filters);
	const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
	const page = Math.min(Math.max(1, Number(sp.page) || 1), totalPages);

	const [cases, savedIds, followedIds, backedIds] = await Promise.all([
		browseLiveCases({
			...filters,
			skip: (page - 1) * PAGE_SIZE,
			take: PAGE_SIZE,
		}),
		listSavedCaseIds(session.user.id),
		listFollowedCaseIds(session.user.id),
		listBackedCaseIds(session.user.id),
	]);
	const savedSet = new Set(savedIds);
	const followedSet = new Set(followedIds);
	const backedSet = new Set(backedIds);

	// Preserve the active filters when building pagination links.
	const pageHref = (p: number): Route => {
		const qs = new URLSearchParams();
		if (sp.q) qs.set("q", sp.q);
		if (sp.state) qs.set("state", sp.state);
		if (sp.category) qs.set("category", sp.category);
		if (sort !== "trending") qs.set("sort", sort);
		if (p > 1) qs.set("page", String(p));
		const s = qs.toString();
		return (s ? `/discover?${s}` : "/discover") as Route;
	};

	const start = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
	const end = (page - 1) * PAGE_SIZE + cases.length;

	return (
		<div className="flex flex-col gap-6">
			<p className="max-w-[640px] text-[14.5px] text-ink-soft leading-relaxed">
				Find a case that matters to you. Save it, share it, or back it today.
			</p>

			<BrowseControls />

			{total > 0 && (
				<p className="text-[13.5px] text-muted-foreground">
					Showing{" "}
					<span className="font-semibold text-ink">
						{start}–{end}
					</span>{" "}
					of <span className="font-semibold text-ink">{total}</span>{" "}
					{total === 1 ? "case" : "cases"}
					{filtered ? " matching your filters" : ""}
				</p>
			)}

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
					{filtered && (
						<Link
							href={"/discover" as Route}
							className={cn(buttonVariants({ variant: "outline" }), "mt-1")}
						>
							Clear filters
						</Link>
					)}
				</div>
			) : (
				<div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
					{cases.map((c) => (
						<DonorCaseCard
							key={c.id}
							c={toDonorCase(c)}
							initialSaved={savedSet.has(c.id)}
							initialFollowing={followedSet.has(c.id)}
							backed={backedSet.has(c.id)}
						/>
					))}
				</div>
			)}

			{cases.length > 0 && (
				<div className="flex items-center justify-between border-border border-t pt-5">
					<Link
						href={pageHref(page - 1)}
						aria-disabled={page <= 1}
						className={cn(
							buttonVariants({ variant: "outline", size: "sm" }),
							"h-9",
							page <= 1 && "pointer-events-none opacity-40",
						)}
					>
						<ArrowLeft data-icon="inline-start" aria-hidden="true" />
						Previous
					</Link>
					<span className="text-[13px] text-muted-foreground">
						Page {page} of {totalPages}
					</span>
					<Link
						href={pageHref(page + 1)}
						aria-disabled={page >= totalPages}
						className={cn(
							buttonVariants({ variant: "outline", size: "sm" }),
							"h-9",
							page >= totalPages && "pointer-events-none opacity-40",
						)}
					>
						Next
						<ArrowRight data-icon="inline-end" aria-hidden="true" />
					</Link>
				</div>
			)}
		</div>
	);
}
