import { buttonVariants } from "@just-us/ui/components/button";
import { cn } from "@just-us/ui/lib/utils";
import {
	ArrowRight,
	Bookmark,
	Compass,
	HandCoins,
	Heart,
	Home,
	type LucideIcon,
	Megaphone,
	Plus,
	Scale,
	Trophy,
	Wrench,
} from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

import type { DonorCase } from "@/components/dashboard/donor-case";
import { DonorCaseCard } from "@/components/dashboard/donor-case-card";

function money(n: number) {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		maximumFractionDigits: 0,
	}).format(n);
}

/** Category → the small tinted icon square on a backed-case row. */
const CAT_ICON: Record<string, { icon: LucideIcon; cls: string }> = {
	Employment: { icon: Scale, cls: "bg-brass-wash text-brass-deep" },
	"Wage & hours": { icon: Scale, cls: "bg-brass-wash text-brass-deep" },
	Housing: { icon: Home, cls: "bg-green-soft text-green-deep" },
	"Elder care": { icon: Heart, cls: "bg-gold-bright text-gold-bright-ink" },
	Medical: { icon: Plus, cls: "bg-green-soft text-green-deep" },
	"Consumer fraud": { icon: Wrench, cls: "bg-brass-wash text-brass-deep" },
	"Civil rights": { icon: Scale, cls: "bg-gold-bright text-gold-bright-ink" },
};
const DEFAULT_CAT = { icon: Scale, cls: "bg-brass-wash text-brass-deep" };

/** One compact row in "Cases you're backing" — text + progress, no cover image. */
function BackedRow({ c }: { c: DonorDashboardData["backing"][number] }) {
	const cat = CAT_ICON[c.category] ?? DEFAULT_CAT;
	const Icon = cat.icon;
	const href = `/discover/${c.id}` as Route;
	const closed = c.status === "closed";
	const pctExact = c.goalCents > 0 ? (c.raisedCents / c.goalCents) * 100 : 0;
	const pct = Math.min(100, Math.round(pctExact));
	const pctLabel = c.raisedCents > 0 && pct < 1 ? "<1%" : `${pct}%`;
	// Keep a visible sliver once any money's in, so a barely-funded case isn't empty.
	const barWidth = c.raisedCents > 0 ? Math.max(pct, 2) : pct;

	return (
		<li className="flex items-center gap-4 py-4 first:pt-0 last:pb-0">
			<Link
				href={href}
				className={cn(
					"flex size-11 shrink-0 items-center justify-center rounded-xl",
					cat.cls,
				)}
				aria-hidden="true"
				tabIndex={-1}
			>
				<Icon className="size-5" aria-hidden="true" />
			</Link>
			<div className="min-w-0 flex-1">
				<Link
					href={href}
					className="block truncate font-bold text-[14.5px] text-ink hover:text-brass-deep"
				>
					{c.title || "Untitled case"}
				</Link>
				<div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
					<div
						className="h-full rounded-full bg-brass"
						style={{ width: `${barWidth}%` }}
					/>
				</div>
				<p className="mt-1.5 text-[12.5px] text-muted-foreground">
					You gave {money(c.givenCents / 100)} · {pctLabel} funded
					{closed ? " · Closed" : ""}
				</p>
			</div>
			<Link
				href={href}
				className={cn(
					buttonVariants({ variant: "outline", size: "sm" }),
					"shrink-0",
				)}
			>
				{closed ? "View case" : "Give again"}
			</Link>
		</li>
	);
}

type Tone = "green" | "tan" | "dark" | "gold";
const TONES: Record<
	Tone,
	{ card: string; chip: string; value: string; label: string }
> = {
	green: {
		card: "bg-green-soft",
		chip: "bg-surface text-green-deep",
		value: "text-ink",
		label: "text-green-deep/80",
	},
	tan: {
		card: "bg-brass-wash",
		chip: "bg-surface text-brass-deep",
		value: "text-ink",
		label: "text-brass-deep/80",
	},
	dark: {
		card: "bg-dark",
		chip: "bg-dark-fg/10 text-gold-bright",
		value: "text-gold-bright",
		label: "text-dark-fg/70",
	},
	gold: {
		card: "bg-gold-bright",
		chip: "bg-surface/60 text-gold-bright-ink",
		value: "text-gold-bright-ink",
		label: "text-gold-bright-ink/75",
	},
};

function Stat({
	icon: Icon,
	value,
	label,
	tone,
}: {
	icon: LucideIcon;
	value: string;
	label: string;
	tone: Tone;
}) {
	const t = TONES[tone];
	return (
		<div
			className={cn(
				"rounded-[var(--radius-card)] p-5 shadow-[var(--shadow-rest)]",
				t.card,
			)}
		>
			<span
				className={cn(
					"mb-4 flex size-9 items-center justify-center rounded-lg",
					t.chip,
				)}
			>
				<Icon className="size-[18px]" aria-hidden="true" />
			</span>
			<p
				className={cn(
					"font-extrabold text-[28px] tabular-nums leading-none tracking-[-0.02em]",
					t.value,
				)}
			>
				{value}
			</p>
			<p
				className={cn(
					"mt-2 font-mono font-semibold text-[11px] uppercase tracking-[0.06em]",
					t.label,
				)}
			>
				{label}
			</p>
		</div>
	);
}

export type DonorDashboardData = {
	totalCents: number;
	casesBacked: number;
	savedCount: number;
	/** Total raised across every case this donor has backed, in cents. */
	helpedFundCents: number;
	saved: DonorCase[];
	/** The cases this donor has actually backed (live + closed), newest gift first —
	 *  a compact text row each: title, their gift, funding, and a quick CTA. */
	backing: {
		id: string;
		title: string;
		category: string;
		status: string;
		/** What this donor gave to the case, in cents. */
		givenCents: number;
		raisedCents: number;
		goalCents: number;
	}[];
	/** How many in total — for the "View all" count when more than shown. */
	backingCount: number;
	/** Recent progress updates on cases the donor backed. */
	updates: {
		id: string;
		caseId: string;
		caseTitle: string;
		authorName: string;
		body: string;
		createdAt: Date | string;
	}[];
};

export function DonorDashboard({ data }: { data: DonorDashboardData }) {
	return (
		<div className="flex flex-col gap-6">
			<p className="max-w-[640px] text-[14.5px] text-ink-soft leading-relaxed">
				Your giving at a glance. Here's the difference you're making.
			</p>

			{/* Stats */}
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<Stat
					icon={HandCoins}
					value={money(data.totalCents / 100)}
					label="Total donated"
					tone="green"
				/>
				<Stat
					icon={Scale}
					value={String(data.casesBacked)}
					label="Cases funded"
					tone="tan"
				/>
				<Stat
					icon={Bookmark}
					value={String(data.savedCount)}
					label="Saved for later"
					tone="dark"
				/>
				<Stat
					icon={Trophy}
					value={money(data.helpedFundCents / 100)}
					label="Raised together"
					tone="gold"
				/>
			</div>

			<div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
				{/* Cases you're backing — the real cases this donor has given to,
				    live or closed (closed shows a "Closed" badge so they can look back). */}
				<section className="rounded-[var(--radius-card-lg)] border border-border bg-surface p-6 shadow-[var(--shadow-rest)]">
					<div className="mb-3 flex items-center justify-between">
						<h2 className="font-bold text-ink text-lg">
							Cases you're supporting
						</h2>
						{data.backingCount > 0 && (
							<Link
								href={"/saved?tab=backed" as Route}
								className="inline-flex items-center gap-1 font-semibold text-[13px] text-brass-deep hover:underline"
							>
								View all
								{data.backingCount > data.backing.length
									? ` (${data.backingCount})`
									: ""}
								<ArrowRight className="size-3.5" aria-hidden="true" />
							</Link>
						)}
					</div>
					{data.backing.length > 0 ? (
						<ul className="flex flex-col divide-y divide-border">
							{data.backing.map((c) => (
								<BackedRow key={c.id} c={c} />
							))}
						</ul>
					) : (
						<div className="flex flex-col items-center gap-2 rounded-[var(--radius-card)] border border-border border-dashed bg-paper/40 px-6 py-10 text-center">
							<HandCoins
								className="size-6 text-muted-foreground"
								aria-hidden="true"
							/>
							<p className="font-bold text-[14px] text-ink">
								You haven't donated to a case yet
							</p>
							<p className="max-w-[38ch] text-[12.5px] text-muted-foreground leading-relaxed">
								Find a cause that matters to you. Every gift helps fund
								someone's day in court.
							</p>
							<Link
								href={"/discover" as Route}
								className={cn(buttonVariants({ size: "sm" }), "mt-1")}
							>
								<Compass data-icon="inline-start" aria-hidden="true" />
								Discover cases
							</Link>
						</div>
					)}
				</section>

				{/* Updates from your cases — real progress posts on cases the donor backed. */}
				<section className="rounded-[var(--radius-card-lg)] border border-border bg-surface p-6 shadow-[var(--shadow-rest)]">
					<h2 className="mb-3 font-bold text-ink text-lg">
						Updates from your cases
					</h2>
					{data.updates.length > 0 ? (
						<ul className="flex flex-col divide-y divide-border">
							{data.updates.map((u) => (
								<li key={u.id} className="py-3 first:pt-0 last:pb-0">
									<Link
										href={`/discover/${u.caseId}/updates` as Route}
										className="group block"
									>
										<p className="truncate font-semibold text-[13px] text-ink group-hover:text-brass-deep">
											{u.caseTitle}
										</p>
										<p className="mt-0.5 line-clamp-2 text-[12.5px] text-ink-soft leading-relaxed">
											{u.body}
										</p>
										<p className="mt-1 font-mono text-[10.5px] text-muted-foreground uppercase tracking-[0.06em]">
											{u.authorName}
										</p>
									</Link>
								</li>
							))}
						</ul>
					) : (
						<div className="flex flex-col items-center gap-2 rounded-[var(--radius-card)] border border-border border-dashed bg-paper/40 px-6 py-10 text-center">
							<Megaphone
								className="size-6 text-muted-foreground"
								aria-hidden="true"
							/>
							<p className="font-bold text-[14px] text-ink">No updates yet</p>
							<p className="max-w-[34ch] text-[12.5px] text-muted-foreground leading-relaxed">
								Once you donate to a case, the attorney's updates appear here.
							</p>
						</div>
					)}
				</section>
			</div>

			{/* Saved for later */}
			<section>
				<div className="mb-4 flex items-center justify-between">
					<h2 className="font-bold text-ink text-lg">Saved for later</h2>
					{data.saved.length > 0 && (
						<Link
							href={"/saved" as Route}
							className="inline-flex items-center gap-1 font-semibold text-[13px] text-brass-deep hover:underline"
						>
							View all saved
							<ArrowRight className="size-3.5" aria-hidden="true" />
						</Link>
					)}
				</div>
				{data.saved.length > 0 ? (
					<div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
						{data.saved.map((c) => (
							<DonorCaseCard key={c.id} c={c} initialSaved variant="compact" />
						))}
					</div>
				) : (
					<div className="flex flex-col items-center gap-2 rounded-[var(--radius-card-lg)] border border-border border-dashed bg-surface px-6 py-12 text-center">
						<Bookmark
							className="size-6 text-muted-foreground"
							aria-hidden="true"
						/>
						<p className="font-bold text-[14px] text-ink">Nothing saved yet</p>
						<p className="max-w-[40ch] text-[12.5px] text-muted-foreground leading-relaxed">
							Save cases while you browse to keep them handy here.
						</p>
						<Link
							href={"/discover" as Route}
							className={cn(
								buttonVariants({ variant: "outline", size: "sm" }),
								"mt-1",
							)}
						>
							Discover cases
						</Link>
					</div>
				)}
			</section>

			{/* Trust footer */}
			<div className="flex items-start gap-2.5 rounded-[var(--radius-card)] border border-border bg-surface/60 px-5 py-3.5 text-[12.5px] text-ink-soft leading-relaxed">
				<HandCoins
					className="mt-0.5 size-4 shrink-0 text-brass-deep"
					aria-hidden="true"
				/>
				Every donation funds the plaintiff's agreed attorney fee. It's a gift,
				with no financial return. One transparent 5% fee, shown before you give.
			</div>
		</div>
	);
}
