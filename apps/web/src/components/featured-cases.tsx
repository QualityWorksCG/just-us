// biome-ignore-all lint/performance/noImgElement: case covers are user-uploaded Blob URLs, not static assets
import { buttonVariants } from "@just-us/ui/components/button";
import { cn } from "@just-us/ui/lib/utils";
import { ArrowRight, Scale } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

export type LandingCase = {
	id: string;
	title: string;
	category: string;
	jurisdiction: string;
	cover: string | null;
	blurb: string;
	owner: string;
	attorney: string | null;
	raised: number;
	goal: number;
	donors: number;
};

function money(n: number) {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		maximumFractionDigits: 0,
	}).format(n);
}

function pctOf(raised: number, goal: number) {
	return goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : 0;
}

function CoverPlaceholder({ className }: { className?: string }) {
	return (
		<div
			className={cn(
				"flex items-center justify-center bg-surface-2 text-brass-deep/50",
				className,
			)}
		>
			<Scale className="size-8" aria-hidden="true" />
		</div>
	);
}

function Bar({ pct, className }: { pct: number; className?: string }) {
	return (
		<div
			className={cn("h-2 overflow-hidden rounded-full bg-surface-2", className)}
		>
			<div
				className="h-full rounded-full bg-brass"
				style={{ width: `${Math.max(2, pct)}%` }}
			/>
		</div>
	);
}

/** The "Cases raising right now" section, driven by real live cases. Renders
 *  nothing when there are none, so the landing page never shows an empty shell. */
export function FeaturedCases({ cases }: { cases: LandingCase[] }) {
	if (cases.length === 0) return null;
	const [featured, ...rest] = cases;
	const sides = rest.slice(0, 2);
	const featuredPct = pctOf(featured.raised, featured.goal);

	return (
		<section
			id="cases"
			aria-labelledby="cases-heading"
			className="border-border border-b"
		>
			<div className="mx-auto max-w-[1180px] px-6 py-16 sm:py-20">
				<div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
					<h2
						id="cases-heading"
						className="font-extrabold text-[30px] text-ink tracking-[-0.02em]"
					>
						Cases raising right now
					</h2>
					<Link
						href="/cases"
						className={cn(buttonVariants({ variant: "outline" }))}
					>
						See all cases
						<ArrowRight data-icon="inline-end" aria-hidden="true" />
					</Link>
				</div>

				<div
					className={cn(
						"grid gap-5",
						sides.length > 0 && "lg:grid-cols-[1.15fr_0.85fr]",
					)}
				>
					{/* Featured large card */}
					<Link
						href={`/cases/${featured.id}` as Route}
						className="group flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-border bg-card shadow-[var(--shadow-rest)] transition-[transform,box-shadow,border-color] duration-[var(--dur-base)] hover:-translate-y-0.5 hover:border-line-strong hover:shadow-[var(--shadow-hover)]"
					>
						<div className="relative h-[220px] overflow-hidden bg-surface-2">
							{featured.cover ? (
								<img
									src={featured.cover}
									alt=""
									className="size-full object-cover transition-transform duration-[var(--dur-base)] group-hover:scale-[1.03]"
								/>
							) : (
								<CoverPlaceholder className="size-full" />
							)}
							<span className="absolute top-4 left-4 inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-card/95 px-3 py-1 font-semibold text-[12px] text-success shadow-[var(--shadow-float)] backdrop-blur">
								<span className="size-1.5 rounded-full bg-success" />
								Live · raising
							</span>
						</div>
						<div className="flex flex-1 flex-col p-6">
							<div className="mb-2.5 flex flex-wrap gap-1.5">
								<span className="rounded-[var(--radius-chip)] bg-brass-wash px-2 py-0.5 font-semibold text-[12px] text-brass-deep">
									{featured.category}
								</span>
								<span className="rounded-[var(--radius-chip)] border border-border px-2 py-0.5 text-[12px] text-ink-soft">
									{featured.jurisdiction}
								</span>
							</div>
							<h3 className="mb-2 font-bold text-[19px] text-ink leading-snug">
								{featured.title}
							</h3>
							<p className="mb-4 line-clamp-2 text-[13.5px] text-ink-soft leading-relaxed">
								{featured.blurb}
							</p>
							<p className="mb-4 text-[13px] text-muted-foreground">
								{featured.owner}
								{featured.attorney ? ` · with ${featured.attorney}` : ""}
							</p>
							<div className="mt-auto">
								<Bar pct={featuredPct} />
								<div className="mt-2.5 flex justify-between text-[12.5px] text-ink-soft">
									<span className="font-bold tabular-nums">
										{money(featured.raised)} of {money(featured.goal)}
									</span>
									<span className="text-muted-foreground">
										{featured.donors}{" "}
										{featured.donors === 1 ? "donor" : "donors"} · {featuredPct}
										%
									</span>
								</div>
							</div>
						</div>
					</Link>

					{/* Side cases */}
					{sides.length > 0 && (
						<div className="grid gap-5">
							{sides.map((c) => {
								const pct = pctOf(c.raised, c.goal);
								return (
									<Link
										key={c.id}
										href={`/cases/${c.id}` as Route}
										className="group flex gap-4 rounded-[var(--radius-card)] border border-border bg-card p-4 shadow-[var(--shadow-rest)] transition-[transform,box-shadow,border-color] duration-[var(--dur-base)] hover:-translate-y-0.5 hover:border-line-strong hover:shadow-[var(--shadow-hover)]"
									>
										<div className="relative min-h-[128px] w-[132px] shrink-0 self-stretch overflow-hidden rounded-[var(--radius-card-sm)] bg-surface-2">
											{c.cover ? (
												<img
													src={c.cover}
													alt=""
													className="size-full object-cover"
												/>
											) : (
												<CoverPlaceholder className="size-full" />
											)}
										</div>
										<div className="flex min-w-0 flex-col">
											<span className="mb-1.5 w-fit rounded-[var(--radius-chip)] bg-brass-wash px-2 py-0.5 font-semibold text-[11.5px] text-brass-deep">
												{c.category}
											</span>
											<h3 className="mb-1 font-bold text-[14.5px] text-ink leading-snug">
												{c.title}
											</h3>
											<p className="mb-2 text-[12px] text-muted-foreground">
												{c.attorney ? `with ${c.attorney}` : c.jurisdiction}
											</p>
											<div className="mt-auto">
												<Bar pct={pct} className="h-1.5" />
												<div className="mt-1.5 flex justify-between text-[12px] text-ink-soft">
													<span className="font-bold tabular-nums">
														{money(c.raised)} of {money(c.goal)}
													</span>
													<span>{pct}%</span>
												</div>
											</div>
										</div>
									</Link>
								);
							})}
						</div>
					)}
				</div>
			</div>
		</section>
	);
}
