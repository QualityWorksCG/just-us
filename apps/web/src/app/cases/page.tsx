// biome-ignore-all lint/performance/noImgElement: case covers are user-uploaded Blob URLs, not static assets
import { browseLiveCases } from "@just-us/db/cases";
import { buttonVariants } from "@just-us/ui/components/button";
import { cn } from "@just-us/ui/lib/utils";
import { HandCoins, Scale, SearchX } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";

import { BrowseControls } from "@/components/browse-controls";

export const metadata: Metadata = {
	title: "Browse cases · JustUs Financial",
	description:
		"Browse cases people are funding on JustUs and support someone's fight for justice.",
};

function money(n: number) {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		maximumFractionDigits: 0,
	}).format(n);
}

export default async function BrowseCasesPage({
	searchParams,
}: {
	searchParams: Promise<{
		q?: string;
		state?: string;
		category?: string;
		sort?: string;
	}>;
}) {
	const sp = await searchParams;
	const sort =
		sp.sort === "funded" || sp.sort === "newest" ? sp.sort : "trending";
	const cases = await browseLiveCases({
		q: sp.q,
		state: sp.state,
		category: sp.category,
		sort,
	});
	const filtered = !!(sp.q || sp.state || sp.category);

	return (
		<main className="h-full overflow-y-auto bg-paper">
			<div className="mx-auto max-w-[1180px] px-6 py-12 sm:py-16">
				<p className="font-mono font-semibold text-[12px] text-brass-deep uppercase tracking-[0.12em]">
					Live now
				</p>
				<h1 className="mt-2 font-extrabold text-[clamp(2rem,4.4vw,3rem)] text-ink leading-[1.03] tracking-[-0.03em]">
					Browse cases people are funding
				</h1>
				<p className="mt-3 max-w-[56ch] text-[15px] text-ink-soft leading-relaxed">
					Every dollar helps fund someone's day in court. Find a case that
					matters to you.
				</p>

				<div className="mt-8">
					<BrowseControls />
				</div>

				{cases.length > 0 && (
					<p className="mt-6 text-[13.5px] text-muted-foreground">
						<span className="font-semibold text-ink">{cases.length}</span>{" "}
						{cases.length === 1 ? "case" : "cases"}
						{filtered ? " match your filters" : ""}
					</p>
				)}

				{cases.length === 0 ? (
					<div className="mt-10 flex flex-col items-center gap-3 rounded-[var(--radius-card-lg)] border border-border border-dashed bg-surface px-6 py-16 text-center">
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
								href={"/cases" as Route}
								className={cn(buttonVariants({ variant: "outline" }), "mt-1")}
							>
								Clear filters
							</Link>
						)}
					</div>
				) : (
					<div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
						{cases.map((c) => {
							const goal = c.goalCents / 100;
							const raised = c.raisedCents / 100;
							const pct =
								goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : 0;
							const owner = c.owner?.name ?? "A plaintiff";
							// "Rosa J." — first name and last initial, the browse card's light
							// touch on the plaintiff's identity.
							const nameParts = owner.trim().split(/\s+/);
							const ownerLabel =
								nameParts.length > 1
									? `${nameParts[0]} ${nameParts[nameParts.length - 1][0]}.`
									: nameParts[0];
							return (
								<article
									key={c.id}
									className="group flex flex-col overflow-hidden rounded-[var(--radius-card-lg)] border border-border bg-surface shadow-[var(--shadow-rest)] transition-[transform,box-shadow,border-color] duration-[var(--dur-base)] hover:-translate-y-0.5 hover:border-line-strong hover:shadow-[var(--shadow-hover)]"
								>
									<Link
										href={`/cases/${c.id}` as Route}
										className="flex flex-1 flex-col outline-none focus-visible:ring-2 focus-visible:ring-ring"
									>
										<div className="relative aspect-[16/10] overflow-hidden bg-surface-2">
											{c.coverImageUrl ? (
												<img
													src={c.coverImageUrl}
													alt=""
													className="size-full object-cover transition-transform duration-[var(--dur-base)] group-hover:scale-[1.03]"
												/>
											) : (
												<div className="flex size-full items-center justify-center text-brass-deep/40">
													<Scale className="size-9" aria-hidden="true" />
												</div>
											)}
										</div>
										<div className="flex flex-1 flex-col px-5 pt-5">
											<div className="mb-2.5 flex flex-wrap gap-1.5">
												<span className="rounded-[var(--radius-chip)] bg-brass-wash px-2 py-0.5 font-semibold text-[11.5px] text-brass-deep">
													{c.category || "Case"}
												</span>
												<span className="rounded-[var(--radius-chip)] border border-border px-2 py-0.5 text-[11.5px] text-ink-soft">
													{c.location || "—"}
												</span>
											</div>
											<h2 className="font-bold text-[16px] text-ink leading-snug">
												{c.title || "Untitled case"}
											</h2>
											<p className="mt-1 text-[12.5px] text-muted-foreground">
												{ownerLabel}
												{c.attorneyName ? ` · with ${c.attorneyName}` : ""}
											</p>
											<div className="mt-4">
												<div className="flex items-center justify-between text-[12.5px]">
													<span className="tabular-nums">
														<span className="font-bold text-brass-deep">
															{pct}%
														</span>{" "}
														<span className="text-muted-foreground">
															funded
														</span>
													</span>
													<span className="text-muted-foreground">
														{c.donorsCount}{" "}
														{c.donorsCount === 1 ? "donor" : "donors"}
													</span>
												</div>
												<div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2">
													<div
														className="h-full rounded-full bg-brass"
														style={{ width: `${Math.max(2, pct)}%` }}
													/>
												</div>
												<p className="mt-2 text-[12.5px] text-muted-foreground tabular-nums">
													{money(raised)} of {money(goal)}
												</p>
											</div>
										</div>
									</Link>
									{/* An explicit way in for donors — the card body links to the case
									    too, but the button names the action on every card. */}
									<div className="px-5 pt-4 pb-5">
										<Link
											href={`/cases/${c.id}` as Route}
											className={cn(
												buttonVariants({ size: "lg" }),
												"h-12 w-full justify-center text-[14.5px]",
											)}
										>
											<HandCoins data-icon="inline-start" aria-hidden="true" />
											Support this case
										</Link>
									</div>
								</article>
							);
						})}
					</div>
				)}
			</div>
		</main>
	);
}
