import { buttonVariants } from "@just-us/ui/components/button";
import { cn } from "@just-us/ui/lib/utils";
import {
	ArrowRight,
	Bookmark,
	Compass,
	Heart,
	type LucideIcon,
	Megaphone,
	Scale,
	Trophy,
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
	firstName: string;
	totalCents: number;
	casesBacked: number;
	savedCount: number;
	helpedFund: number;
	saved: DonorCase[];
};

export function DonorDashboard({ data }: { data: DonorDashboardData }) {
	return (
		<div className="flex flex-col gap-6">
			<div>
				<h1 className="font-extrabold text-[30px] text-ink tracking-[-0.02em]">
					Welcome back, {data.firstName}
				</h1>
				<p className="mt-1.5 text-[14.5px] text-ink-soft">
					Your giving at a glance — here's the difference you're making.
				</p>
			</div>

			{/* Stats */}
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<Stat
					icon={Heart}
					value={money(data.totalCents / 100)}
					label="Total donated"
					tone="green"
				/>
				<Stat
					icon={Scale}
					value={String(data.casesBacked)}
					label="Cases backed"
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
					value={String(data.helpedFund)}
					label="Helped fund"
					tone="gold"
				/>
			</div>

			<div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
				{/* Cases you're backing */}
				<section className="rounded-[var(--radius-card-lg)] border border-border bg-surface p-6 shadow-[var(--shadow-rest)]">
					<h2 className="mb-3 font-bold text-ink text-lg">
						Cases you're backing
					</h2>
					<div className="flex flex-col items-center gap-2 rounded-[var(--radius-card)] border border-border border-dashed bg-paper/40 px-6 py-10 text-center">
						<Heart
							className="size-6 text-muted-foreground"
							aria-hidden="true"
						/>
						<p className="font-bold text-[14px] text-ink">
							You haven't backed a case yet
						</p>
						<p className="max-w-[38ch] text-[12.5px] text-muted-foreground leading-relaxed">
							Find a cause that matters to you — every gift helps fund someone's
							day in court.
						</p>
						<Link
							href={"/dashboard/discover" as Route}
							className={cn(buttonVariants({ size: "sm" }), "mt-1")}
						>
							<Compass data-icon="inline-start" aria-hidden="true" />
							Discover cases
						</Link>
					</div>
				</section>

				{/* Updates from your cases */}
				<section className="rounded-[var(--radius-card-lg)] border border-border bg-surface p-6 shadow-[var(--shadow-rest)]">
					<h2 className="mb-3 font-bold text-ink text-lg">
						Updates from your cases
					</h2>
					<div className="flex flex-col items-center gap-2 rounded-[var(--radius-card)] border border-border border-dashed bg-paper/40 px-6 py-10 text-center">
						<Megaphone
							className="size-6 text-muted-foreground"
							aria-hidden="true"
						/>
						<p className="font-bold text-[14px] text-ink">No updates yet</p>
						<p className="max-w-[34ch] text-[12.5px] text-muted-foreground leading-relaxed">
							Once you back a case, its attorney's updates show up here.
						</p>
					</div>
				</section>
			</div>

			{/* Saved for later */}
			<section>
				<div className="mb-4 flex items-center justify-between">
					<h2 className="font-bold text-ink text-lg">Saved for later</h2>
					{data.saved.length > 0 && (
						<Link
							href={"/dashboard/saved" as Route}
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
							href={"/dashboard/discover" as Route}
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
				<Heart
					className="mt-0.5 size-4 shrink-0 text-brass-deep"
					aria-hidden="true"
				/>
				Every donation funds the plaintiff's agreed attorney fee — a gift, with
				no financial return. One transparent 5% fee, shown before you give.
			</div>
		</div>
	);
}
