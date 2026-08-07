"use client";

import { buttonVariants } from "@just-us/ui/components/button";
import { cn } from "@just-us/ui/lib/utils";
import {
	ArrowRight,
	Check,
	Eye,
	FilePlus2,
	Flag,
	Folder,
	Gauge,
	Hand,
	HandCoins,
	Hourglass,
	type LucideIcon,
	Megaphone,
	Scale,
	Search,
	Share2,
	Sparkles,
	Target,
	TrendingUp,
	UserRound,
	Users,
} from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { toast } from "sonner";

import { MessageAttorneyButton } from "@/components/messages/message-attorney-button";

export type CaseSummary = {
	id: string;
	title: string;
	category: string;
	location: string;
	status: string;
	goalCents: number;
	raisedCents: number;
	donorsCount: number;
	storyLength: number;
	hasCover: boolean;
	evidenceCount: number;
	attorneyName: string | null;
	attorneyFirm: string | null;
	attorneyArea: string | null;
	attorneyLocation: string | null;
	/** Present only when the case is matched to a JustUs attorney account. */
	attorneyId: string | null;
	attorneyConversationId: string | null;
	createdAt: string;
	/** Attorneys who have expressed interest in representing this case and are
	 *  still awaiting a decision (JUS-25). */
	interestCount: number;
	/** How many of those the plaintiff hasn't seen yet — the "new" badge. */
	newInterestCount: number;
};

function readinessOf(c: CaseSummary) {
	return (
		(c.storyLength >= 120 ? 25 : 0) +
		(c.attorneyName ? 25 : 0) +
		(c.goalCents > 0 ? 25 : 0) +
		(c.hasCover ? 15 : 0) +
		(c.evidenceCount > 0 ? 10 : 0)
	);
}

function money(n: number) {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		maximumFractionDigits: 0,
	}).format(n);
}

function initials(name: string) {
	return (
		name
			.trim()
			.split(/\s+/)
			.slice(0, 2)
			.map((p) => p[0]?.toUpperCase() ?? "")
			.join("") || "—"
	);
}

type Tone = "green" | "cream" | "dark" | "gold";

const TONES: Record<
	Tone,
	{
		card: string;
		label: string;
		icon: string;
		value: string;
		sub: string;
		track: string;
		fill: string;
	}
> = {
	green: {
		card: "border-transparent bg-green-soft",
		label: "text-green-deep/80",
		icon: "text-brass-deep",
		value: "text-ink",
		sub: "text-green-deep/70",
		track: "bg-green-deep/15",
		fill: "bg-brass",
	},
	cream: {
		card: "border-transparent bg-surface-2",
		label: "text-muted-foreground",
		icon: "text-brass-deep",
		value: "text-ink",
		sub: "text-muted-foreground",
		track: "bg-ink/10",
		fill: "bg-brass",
	},
	dark: {
		card: "border-transparent bg-dark text-dark-fg",
		label: "text-dark-fg-soft",
		icon: "text-gold-bright",
		value: "text-gold-bright",
		sub: "text-dark-fg-soft",
		track: "bg-dark-fg/15",
		fill: "bg-gold-bright",
	},
	gold: {
		card: "border-transparent bg-gradient-to-br from-brass-wash to-[color-mix(in_oklch,var(--gold-bright)_65%,var(--brass-wash))] shadow-[var(--shadow-float)]",
		label: "text-brass-deep",
		icon: "text-brass-deep",
		value: "text-ink",
		sub: "text-ink-soft",
		track: "bg-ink/10",
		fill: "bg-brass",
	},
};

function StatCard({
	icon: Icon,
	label,
	value,
	sub,
	tone = "cream",
	bar,
}: {
	icon: LucideIcon;
	label: string;
	value: React.ReactNode;
	sub: string;
	tone?: Tone;
	bar?: number;
}) {
	const t = TONES[tone];
	return (
		<div
			className={cn(
				"rounded-[var(--radius-card)] border p-5 shadow-[var(--shadow-rest)]",
				t.card,
			)}
		>
			<div
				className={cn(
					"mb-3 inline-flex items-center gap-2 font-mono font-semibold text-[11px] uppercase tracking-[0.08em]",
					t.label,
				)}
			>
				<Icon className={cn("size-4", t.icon)} aria-hidden="true" />
				{label}
			</div>
			<p
				className={cn(
					"font-extrabold text-[28px] leading-none tracking-[-0.02em]",
					t.value,
				)}
			>
				{value}
			</p>
			{typeof bar === "number" && (
				<div className={cn("mt-4 h-1.5 overflow-hidden rounded-full", t.track)}>
					<div
						className={cn("h-full rounded-full", t.fill)}
						style={{ width: `${Math.max(3, Math.min(100, bar))}%` }}
					/>
				</div>
			)}
			<p
				className={cn(
					typeof bar === "number" ? "mt-3" : "mt-2",
					"text-[12.5px]",
					t.sub,
				)}
			>
				{sub}
			</p>
		</div>
	);
}

function EmptyState({
	icon: Icon,
	title,
	body,
}: {
	icon: LucideIcon;
	title: string;
	body: string;
}) {
	return (
		<div className="flex flex-col items-center gap-1.5 rounded-[var(--radius-card)] border border-border border-dashed bg-paper/40 px-6 py-9 text-center">
			<Icon className="size-6 text-muted-foreground" aria-hidden="true" />
			<p className="font-bold text-[14px] text-ink">{title}</p>
			<p className="max-w-[40ch] text-[12.5px] text-muted-foreground leading-relaxed">
				{body}
			</p>
		</div>
	);
}

// No case row yet — the plaintiff hasn't started the wizard.
function NoCase() {
	return (
		<div className="flex flex-col gap-6">
			<p className="max-w-[640px] text-[14.5px] text-ink-soft leading-relaxed">
				You haven't started a case yet. Tell us what happened and we'll take it
				from there.
			</p>
			<div className="flex flex-col items-center gap-3 rounded-[var(--radius-card-lg)] border border-border bg-surface px-6 py-14 text-center shadow-[var(--shadow-rest)]">
				<span className="flex size-12 items-center justify-center rounded-xl bg-brass-wash text-brass-deep">
					<FilePlus2 className="size-6" aria-hidden="true" />
				</span>
				<p className="font-bold text-[16px] text-ink">Start your case</p>
				<p className="max-w-[44ch] text-[13.5px] text-muted-foreground leading-relaxed">
					Submit your story, choose your attorney, and raise the agreed fee —
					you decide when it goes live.
				</p>
				<Link
					href={"/cases/new" as Route}
					className={cn(buttonVariants({ size: "lg" }), "mt-2 px-6")}
				>
					<FilePlus2 data-icon="inline-start" aria-hidden="true" />
					Create your case
				</Link>
			</div>
		</div>
	);
}

export function PlaintiffDashboard({ cases }: { cases: CaseSummary[] }) {
	const first = cases[0];
	if (!first) return <NoCase />;
	// A plaintiff can run several cases. With one, show the detailed view; with
	// more, show a portfolio so nothing implies there's only a single case.
	if (cases.length > 1) return <CasesOverview cases={cases} />;
	return <SingleCaseDashboard c={first} />;
}

function SingleCaseDashboard({ c }: { c: CaseSummary }) {
	const isLive = c.status === "live";
	const isSeeking = c.status === "seeking";
	const goal = c.goalCents / 100;
	const raised = c.raisedCents / 100;
	const pct = goal > 0 ? Math.round((raised / goal) * 100) : 0;
	const hasAttorney = !!c.attorneyName;
	const hasGoal = c.goalCents > 0;
	const attorneyMeta =
		[c.attorneyArea, c.attorneyLocation, c.attorneyFirm]
			.filter(Boolean)
			.join(" · ") || "—";

	// Readiness is computed from the case's own completeness — not invented.
	const checks = [
		{
			ok: c.storyLength >= 120,
			weight: 25,
			tip: "Expand your story with dates and what it cost you.",
		},
		{
			ok: hasAttorney,
			weight: 25,
			tip: "Choose the attorney who'll represent you.",
		},
		{
			ok: hasGoal,
			weight: 25,
			tip: "Agree a fee with your attorney to set your goal.",
		},
		{
			ok: c.hasCover,
			weight: 15,
			tip: "Add a cover image — campaigns with one raise far more.",
		},
		{
			ok: c.evidenceCount > 0,
			weight: 10,
			tip: "Attach evidence — optional, but it strengthens your case.",
		},
	];
	const readiness = checks.reduce((sum, x) => sum + (x.ok ? x.weight : 0), 0);
	const missing = checks.filter((x) => !x.ok).map((x) => x.tip);

	return (
		<div className="flex flex-col gap-6">
			{/* Header */}
			<p className="max-w-[640px] text-[14.5px] text-ink-soft leading-relaxed">
				{isLive
					? "Your campaign is live — here's how it's going."
					: "Your case at a glance — where it stands and what needs you next."}
			</p>

			{/* Stat row — all values from the case row */}
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<StatCard
					icon={TrendingUp}
					label="Raised"
					value={money(raised)}
					sub={hasGoal ? `of ${money(goal)} goal` : "no goal set yet"}
					tone="green"
					bar={pct}
				/>
				{/* A case still out to attorneys can't have donors — that slot is worth
				    more showing who has put themselves forward. */}
				{isSeeking && !hasAttorney ? (
					<StatCard
						icon={Hand}
						label="Attorneys interested"
						value={String(c.interestCount)}
						sub={
							c.interestCount === 0
								? "none yet — you can also choose one yourself"
								: c.newInterestCount > 0
									? `${c.newInterestCount} you haven't seen yet`
									: "waiting on your decision"
						}
						tone="cream"
					/>
				) : (
					<StatCard
						icon={Users}
						label="Donors"
						value={String(c.donorsCount)}
						sub={c.donorsCount === 0 ? "no backers yet" : "backers so far"}
						tone="cream"
					/>
				)}
				<StatCard
					icon={Gauge}
					label="Case readiness"
					value={`${readiness}%`}
					sub={
						missing.length === 0
							? "everything's in place"
							: `${missing.length} thing${missing.length === 1 ? "" : "s"} to finish`
					}
					tone="dark"
					bar={readiness}
				/>
				<StatCard
					icon={Target}
					label="Funding goal"
					value={hasGoal ? money(goal) : "—"}
					sub={
						hasGoal ? "agreed with your attorney" : "set when you agree a fee"
					}
					tone="gold"
				/>
			</div>

			{/* Funding progress — real numbers */}
			<section className="rounded-[var(--radius-card-lg)] border border-border bg-surface p-6 shadow-[var(--shadow-rest)]">
				<div className="flex flex-wrap items-start justify-between gap-3">
					<h2 className="font-bold text-ink text-lg">Funding progress</h2>
					{isLive && (
						<div className="flex gap-2.5">
							<button
								type="button"
								onClick={() => toast.success("Share link copied.")}
								className={cn(buttonVariants({ size: "sm" }), "h-9")}
							>
								<Share2 data-icon="inline-start" aria-hidden="true" />
								Share campaign
							</button>
							<Link
								href={`/my-cases/${c.id}` as Route}
								className={cn(
									buttonVariants({ variant: "outline", size: "sm" }),
									"h-9",
								)}
							>
								<Eye data-icon="inline-start" aria-hidden="true" />
								Manage case
							</Link>
						</div>
					)}
				</div>

				<div className="mt-4 flex items-baseline gap-2.5">
					<span className="font-extrabold text-[34px] text-ink tracking-[-0.02em]">
						{money(raised)}
					</span>
					<span className="text-[13.5px] text-muted-foreground">
						{hasGoal
							? `raised of ${money(goal)} goal · ${pct}%`
							: "no goal set yet"}
					</span>
				</div>
				<div className="mt-3 h-2.5 overflow-hidden rounded-full bg-surface-2">
					<div
						className="h-full rounded-full bg-brass"
						style={{ width: `${pct}%` }}
					/>
				</div>
				{c.donorsCount === 0 && (
					<p className="mt-3 text-[13px] text-muted-foreground">
						{isLive
							? "No donations yet — share your campaign to reach your first backer."
							: "Donations start once your case is live."}
					</p>
				)}
			</section>

			<div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
				{/* Left: next steps + updates */}
				<div className="flex flex-col gap-5">
					<StepTracker
						caseId={c.id}
						status={c.status}
						hasAttorney={hasAttorney}
						hasGoal={hasGoal}
					/>

					<section className="rounded-[var(--radius-card-lg)] border border-border bg-surface p-6 shadow-[var(--shadow-rest)]">
						<h2 className="mb-3 font-bold text-ink text-lg">Case updates</h2>
						<EmptyState
							icon={Megaphone}
							title="No updates yet"
							body="Once you're live, your attorney posts progress here — and backers get notified."
						/>
					</section>
				</div>

				{/* Right: attorney + readiness */}
				<div className="flex flex-col gap-5">
					<section className="rounded-[var(--radius-card-lg)] border border-border bg-surface p-6 shadow-[var(--shadow-rest)]">
						<p className="mb-3 font-mono font-semibold text-[11px] text-muted-foreground uppercase tracking-[0.08em]">
							Your attorney
						</p>
						{hasAttorney ? (
							<>
								<div className="flex items-center gap-3">
									<span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brass font-bold text-[12px] text-white">
										{/* biome-ignore lint/style/noNonNullAssertion: hasAttorney guards it */}
										{initials(c.attorneyName!)}
									</span>
									<div>
										<p className="font-bold text-[15px] text-ink">
											{c.attorneyName}
										</p>
										<p className="text-[12.5px] text-muted-foreground">
											{attorneyMeta}
										</p>
									</div>
								</div>
								{c.attorneyId ? (
									<MessageAttorneyButton
										attorneyId={c.attorneyId}
										attorneyName={c.attorneyName ?? "your attorney"}
										caseId={c.id}
										existingConversationId={c.attorneyConversationId}
										className="mt-4 w-full"
									/>
								) : (
									<p className="mt-4 text-[12.5px] text-muted-foreground">
										Messaging is available when your attorney has a JustUs
										account.
									</p>
								)}
							</>
						) : isSeeking ? (
							/* Out to attorneys: what matters here is who has put themselves
							   forward, which is the only thing that moves this case on. The
							   plaintiff makes contact from the inbox — an attorney cannot
							   reach them (JUS-25). */
							<>
								<div className="flex items-center gap-3">
									<span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brass-wash text-brass-deep">
										<Hand className="size-4" aria-hidden="true" />
									</span>
									<div>
										<p className="font-bold text-[15px] text-ink">
											{c.interestCount === 0
												? "No interest yet"
												: `${c.interestCount} ${c.interestCount === 1 ? "attorney" : "attorneys"} interested`}
										</p>
										<p className="text-[12.5px] text-muted-foreground">
											{c.interestCount === 0
												? "your case is out to attorneys"
												: c.newInterestCount > 0
													? `${c.newInterestCount} you haven't seen yet`
													: "you decide who to approach"}
										</p>
									</div>
								</div>
								<Link
									href={`/my-cases/${c.id}/requests` as Route}
									className={cn(buttonVariants(), "mt-4 w-full")}
								>
									{c.interestCount === 0 ? "View your case" : "Review interest"}
									<ArrowRight data-icon="inline-end" aria-hidden="true" />
								</Link>
							</>
						) : (
							<>
								<div className="flex items-center gap-3">
									<span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brass-wash text-brass-deep">
										<Scale className="size-4" aria-hidden="true" />
									</span>
									<p className="text-[13.5px] text-ink-soft">
										You haven't chosen an attorney yet.
									</p>
								</div>
								<Link
									href={"/cases/new" as Route}
									className={cn(buttonVariants(), "mt-4 w-full")}
								>
									Choose an attorney
									<ArrowRight data-icon="inline-end" aria-hidden="true" />
								</Link>
							</>
						)}
					</section>

					<section className="rounded-[var(--radius-card-lg)] border border-border bg-surface p-6 shadow-[var(--shadow-rest)]">
						<div className="mb-4 flex items-center gap-2.5">
							<span className="flex size-8 items-center justify-center rounded-lg bg-brass text-white">
								<Sparkles className="size-4" aria-hidden="true" />
							</span>
							<span className="font-bold text-[14px] text-ink">
								Case readiness
							</span>
						</div>
						<div className="flex items-center gap-5">
							<div
								className="flex size-20 shrink-0 items-center justify-center rounded-full"
								style={{
									background: `conic-gradient(var(--brass) ${readiness * 3.6}deg, var(--brass-wash) 0)`,
								}}
							>
								<div className="flex size-[60px] flex-col items-center justify-center rounded-full bg-surface">
									<span className="font-extrabold text-[16px] text-ink">
										{readiness}%
									</span>
								</div>
							</div>
							{missing.length > 0 ? (
								<ul className="flex flex-col gap-2">
									{missing.map((m) => (
										<li
											key={m}
											className="flex items-start gap-2 text-[13px] text-ink-soft leading-relaxed"
										>
											<span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brass-deep" />
											{m}
										</li>
									))}
								</ul>
							) : (
								<p className="text-[13.5px] text-ink-soft leading-relaxed">
									Your case has everything it needs. Nice work.
								</p>
							)}
						</div>
					</section>
				</div>
			</div>

			<TrustFooter />
		</div>
	);
}

function TrustFooter() {
	return (
		<div className="flex items-start gap-2.5 rounded-[var(--radius-card)] border border-border bg-surface/60 px-5 py-3.5 text-[12.5px] text-ink-soft leading-relaxed">
			<HandCoins
				className="mt-0.5 size-4 shrink-0 text-brass-deep"
				aria-hidden="true"
			/>
			Donations fund the agreed fee and are paid to your attorney's firm, which
			applies them to that fee — you never have to handle the money. One
			transparent 5% fee, shown to each donor before they give.
		</div>
	);
}

// Portfolio view for plaintiffs running more than one case: aggregate totals up
// top, then every case listed with its own status so none of it reads as "your
// one case".
function CasesOverview({ cases }: { cases: CaseSummary[] }) {
	const totalRaised = cases.reduce((s, c) => s + c.raisedCents, 0) / 100;
	const totalGoal = cases.reduce((s, c) => s + c.goalCents, 0) / 100;
	const totalDonors = cases.reduce((s, c) => s + c.donorsCount, 0);
	const liveCount = cases.filter((c) => c.status === "live").length;
	const pct = totalGoal > 0 ? Math.round((totalRaised / totalGoal) * 100) : 0;

	return (
		<div className="flex flex-col gap-6">
			<p className="max-w-[640px] text-[14.5px] text-ink-soft leading-relaxed">
				You have {cases.length} cases — here's your portfolio at a glance.
			</p>

			{/* Totals across every case */}
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<StatCard
					icon={TrendingUp}
					label="Raised across cases"
					value={money(totalRaised)}
					sub={
						totalGoal > 0
							? `of ${money(totalGoal)} combined`
							: "no goals set yet"
					}
					tone="green"
					bar={pct}
				/>
				<StatCard
					icon={Users}
					label="Total donors"
					value={String(totalDonors)}
					sub={totalDonors === 0 ? "no backers yet" : "across all cases"}
					tone="cream"
				/>
				<StatCard
					icon={Megaphone}
					label="Live campaigns"
					value={String(liveCount)}
					sub={liveCount === 0 ? "none live yet" : "raising right now"}
					tone="dark"
				/>
				<StatCard
					icon={Scale}
					label="All cases"
					value={String(cases.length)}
					sub="drafts, seeking & live"
					tone="gold"
				/>
			</div>

			{/* Your cases (top 3) beside the attorneys card */}
			<div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
				<section className="flex flex-col rounded-[var(--radius-card-lg)] border border-border bg-surface p-6 shadow-[var(--shadow-rest)]">
					<div className="mb-2 flex items-center justify-between">
						<h2 className="font-bold text-ink text-lg">Your cases</h2>
						<span className="text-[12.5px] text-muted-foreground">
							{cases.length} total
						</span>
					</div>
					<ul className="flex flex-col divide-y divide-border">
						{cases.slice(0, 3).map((c) => (
							<CaseRow key={c.id} c={c} />
						))}
					</ul>
					<Link
						href={"/my-cases" as Route}
						className="mt-3 inline-flex items-center justify-center gap-1 border-border border-t pt-4 font-semibold text-[13px] text-brass-deep hover:underline"
					>
						{cases.length > 3
							? `View all ${cases.length} cases`
							: "View all cases"}
						<ArrowRight className="size-3.5" aria-hidden="true" />
					</Link>
				</section>

				{/* Representation status, one row per case (top 3) */}
				<section className="flex flex-col rounded-[var(--radius-card-lg)] border border-border bg-surface p-6 shadow-[var(--shadow-rest)]">
					<div className="mb-4 flex items-center justify-between">
						<h2 className="font-bold text-ink text-lg">Your attorneys</h2>
						<span className="inline-flex items-center justify-center rounded-[var(--radius-pill)] bg-brass-wash px-2.5 py-0.5 font-bold text-[12px] text-brass-deep">
							{cases.length} {cases.length === 1 ? "case" : "cases"}
						</span>
					</div>
					<div className="flex flex-col gap-2.5">
						{cases.slice(0, 3).map((c) => (
							<RepresentationRow key={c.id} c={c} />
						))}
					</div>
					{cases.length > 3 && (
						<Link
							href={"/my-cases" as Route}
							className="mt-4 inline-flex items-center justify-center gap-1 border-border border-t pt-4 font-semibold text-[13px] text-brass-deep hover:underline"
						>
							View all {cases.length} cases
							<ArrowRight className="size-3.5" aria-hidden="true" />
						</Link>
					)}
				</section>
			</div>

			{/* Case updates — full width at the bottom, labeled per case once they exist. */}
			<section className="rounded-[var(--radius-card-lg)] border border-border bg-surface p-6 shadow-[var(--shadow-rest)]">
				<h2 className="mb-3 font-bold text-ink text-lg">Case updates</h2>
				<EmptyState
					icon={Megaphone}
					title="No updates yet"
					body="Once your cases are live, updates from each attorney appear here — each tagged with the case it belongs to."
				/>
			</section>

			<TrustFooter />
		</div>
	);
}

function CaseRow({ c }: { c: CaseSummary }) {
	const isLive = c.status === "live";
	const isSeeking = c.status === "seeking";
	const goal = c.goalCents / 100;
	const raised = c.raisedCents / 100;
	const pct = goal > 0 ? Math.round((raised / goal) * 100) : 0;
	const readiness = readinessOf(c);
	const meta = [c.category, c.location].filter(Boolean).join(" · ") || "—";

	const badge = isLive
		? {
				text: "Live · Raising",
				cls: "bg-green-soft text-green-deep",
				dot: "bg-success",
			}
		: isSeeking
			? {
					// The count is on the badge because it's the one thing on this row
					// that needs the plaintiff, and the row is otherwise inert.
					text:
						c.interestCount > 0
							? `${c.interestCount} interested`
							: "Seeking attorney",
					cls: "bg-brass-wash text-brass-deep",
					dot: "bg-brass-deep",
				}
			: {
					text: "Draft",
					cls: "bg-surface-2 text-ink-soft",
					dot: "bg-ink-soft",
				};

	// Drafts resume in the wizard; live cases open Manage; seeking opens requests.
	const href = (
		isLive
			? `/my-cases/${c.id}`
			: isSeeking
				? `/my-cases/${c.id}/requests`
				: `/cases/new?draft=${c.id}`
	) as Route;

	const cta = isLive ? "Manage" : isSeeking ? "Requests" : "Continue";

	return (
		<li>
			<Link
				href={href}
				className="group -mx-2 flex items-center gap-3 rounded-[var(--radius-control)] px-2 py-3 transition-colors hover:bg-surface-2"
			>
				<div className="min-w-0 flex-1">
					<div className="flex items-center gap-2">
						<span
							className={cn(
								"inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] px-2 py-0.5 font-mono font-semibold text-[10px] uppercase tracking-[0.06em]",
								badge.cls,
							)}
						>
							<span className={cn("size-1.5 rounded-full", badge.dot)} />
							{badge.text}
						</span>
					</div>
					<p className="mt-1.5 truncate font-bold text-[14px] text-ink">
						{c.title || "Untitled case"}
					</p>
					<p className="truncate text-[12px] text-muted-foreground">
						{meta}
						{isLive
							? ` · ${money(raised)} of ${money(goal)} · ${pct}%`
							: isSeeking
								? c.newInterestCount > 0
									? ` · ${c.newInterestCount} new to review`
									: " · out to attorneys"
								: ` · ${readiness}% ready`}
					</p>
				</div>
				<span className="inline-flex shrink-0 items-center gap-1 font-semibold text-[12px] text-brass-deep">
					{cta}
					<ArrowRight
						className="size-3.5 transition-transform group-hover:translate-x-0.5"
						aria-hidden="true"
					/>
				</span>
			</Link>
		</li>
	);
}

// One row per case in the "Your attorneys" card, showing its representation
// state: an assigned attorney, out seeking one, or none chosen yet.
function RepresentationRow({ c }: { c: CaseSummary }) {
	const attorneyName = c.attorneyName;
	const isSeeking = c.status === "seeking";
	const caseTitle = c.title || "Untitled case";

	let avatar: React.ReactNode;
	let heading: string;
	let action: React.ReactNode;

	if (attorneyName) {
		const meta = [c.category, c.location].filter(Boolean).join(" · ");
		heading = meta ? `${attorneyName} · ${meta}` : attorneyName;
		avatar = (
			<span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brass font-bold text-[13px] text-white">
				{initials(attorneyName)}
			</span>
		);
		action = c.attorneyId ? (
			<MessageAttorneyButton
				attorneyId={c.attorneyId}
				attorneyName={attorneyName}
				caseId={c.id}
				existingConversationId={c.attorneyConversationId}
				className="shrink-0"
			/>
		) : (
			<span className="max-w-32 text-right text-[12px] text-muted-foreground leading-snug">
				Not on JustUs messaging
			</span>
		);
	} else if (isSeeking) {
		const interested = c.interestCount;
		heading =
			interested > 0
				? `${interested} ${interested === 1 ? "attorney" : "attorneys"} interested`
				: "Seeking representation";
		avatar = (
			<span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brass-wash text-brass-deep">
				{interested > 0 ? (
					<Hand className="size-5" aria-hidden="true" />
				) : (
					<Hourglass className="size-5" aria-hidden="true" />
				)}
			</span>
		);
		action = (
			<Link
				href={`/my-cases/${c.id}/requests` as Route}
				className={cn(
					buttonVariants({
						variant: interested > 0 ? "default" : "outline",
						size: "sm",
					}),
					"h-9 shrink-0",
				)}
			>
				{interested > 0 ? "Review interest" : "View case"}
				<ArrowRight data-icon="inline-end" aria-hidden="true" />
			</Link>
		);
	} else {
		heading = "No attorney yet";
		avatar = (
			<span className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-muted-foreground">
				<UserRound className="size-5" aria-hidden="true" />
			</span>
		);
		action = (
			<Link
				href={`/cases/new?draft=${c.id}` as Route}
				className={cn(
					buttonVariants({ variant: "outline", size: "sm" }),
					"h-9 shrink-0",
				)}
			>
				<Search data-icon="inline-start" aria-hidden="true" />
				Find one
			</Link>
		);
	}

	return (
		<div className="flex items-center gap-3 rounded-[var(--radius-card)] border border-border bg-surface-2/40 p-3">
			{avatar}
			<div className="min-w-0 flex-1">
				<p className="truncate font-bold text-[14px] text-ink">{heading}</p>
				<p className="mt-0.5 flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
					<Folder className="size-3.5 shrink-0" aria-hidden="true" />
					<span className="truncate">{caseTitle}</span>
				</p>
			</div>
			{action}
		</div>
	);
}

function StepTracker({
	caseId,
	status,
	hasAttorney,
	hasGoal,
}: {
	caseId: string;
	status: string;
	hasAttorney: boolean;
	hasGoal: boolean;
}) {
	const isLive = status === "live";
	const steps = [
		{ label: "Submit your case", done: true },
		{ label: "Choose your attorney", done: hasAttorney },
		{ label: "Agree the fee", done: hasGoal },
		{ label: "Go live", done: isLive },
	];
	const activeIndex = steps.findIndex((s) => !s.done);
	const stepNo = activeIndex === -1 ? steps.length : activeIndex + 1;

	// Resume this case's wizard while it's in progress; once live, manage it.
	const resume = `/cases/new?draft=${caseId}` as Route;
	const manage = `/my-cases/${caseId}` as Route;

	// The one thing that needs the plaintiff next — always with somewhere to go.
	let next: { text: string; href: Route; cta: string };
	if (!hasAttorney)
		next = {
			text: "Choose who represents you.",
			href: resume,
			cta: "Choose an attorney",
		};
	else if (!hasGoal)
		next = {
			text: "Agree a fee with your attorney to set your goal.",
			href: resume,
			cta: "Set the fee",
		};
	else if (isLive)
		next = {
			text: "Your campaign is live — keep sharing to reach your goal.",
			href: manage,
			cta: "Manage your case",
		};
	else
		next = {
			text: "Finish your case and take it live.",
			href: resume,
			cta: "Finish & publish",
		};

	return (
		<section className="rounded-[var(--radius-card-lg)] border border-border bg-surface p-6 shadow-[var(--shadow-rest)]">
			<div className="mb-5 flex items-center justify-between">
				<h2 className="font-bold text-ink text-lg">Where you are</h2>
				<span className="text-[12.5px] text-muted-foreground">
					Step {stepNo} of {steps.length}
				</span>
			</div>
			<ol className="flex flex-col gap-4 sm:flex-row sm:items-center">
				{steps.map((s, i) => {
					const state = s.done ? "done" : i === activeIndex ? "active" : "todo";
					return (
						<li key={s.label} className="flex flex-1 items-center gap-2.5">
							<span
								className={cn(
									"flex size-7 shrink-0 items-center justify-center rounded-full font-bold text-[12px]",
									state === "done" && "bg-brass text-white",
									state === "active" && "bg-ink text-white",
									state === "todo" &&
										"border border-line-strong text-muted-foreground",
								)}
							>
								{state === "done" ? (
									<Check className="size-3.5" aria-hidden="true" />
								) : (
									i + 1
								)}
							</span>
							<span
								className={cn(
									"text-[13.5px]",
									state === "todo"
										? "text-muted-foreground"
										: "font-semibold text-ink",
								)}
							>
								{s.label}
							</span>
							{i < steps.length - 1 && (
								<span className="hidden h-px flex-1 bg-border sm:block" />
							)}
						</li>
					);
				})}
			</ol>
			<div className="mt-6 flex flex-wrap items-end justify-between gap-3 border-border border-t pt-5">
				<p className="max-w-[52ch] text-[13px] text-ink-soft leading-relaxed">
					<Flag
						className="mr-1.5 inline size-3.5 text-brass-deep"
						aria-hidden="true"
					/>
					{next.text}
				</p>
				{next.href && next.cta && (
					<Link href={next.href} className={cn(buttonVariants(), "px-5")}>
						{next.cta}
						<ArrowRight data-icon="inline-end" aria-hidden="true" />
					</Link>
				)}
			</div>
		</section>
	);
}
