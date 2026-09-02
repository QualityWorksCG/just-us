"use client";

import type { AttorneyCase } from "@just-us/db/representation";
import { buttonVariants } from "@just-us/ui/components/button";
import { cn } from "@just-us/ui/lib/utils";
import {
	ArrowRight,
	Briefcase,
	Landmark,
	MapPin,
	Megaphone,
	Search,
	Users,
	X,
} from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useId, useMemo, useState } from "react";

import {
	blocking,
	money,
	PayoutChip,
} from "@/components/dashboard/attorney-payout";

/**
 * Cases this attorney is acting on.
 *
 * Ordered so the ones needing them come first: a published case whose payout
 * account isn't finished cannot take a donation, and the person who has to fix that
 * is the attorney reading this. Everything else — funding, the client, the matter —
 * follows on the case's own screen.
 */

type StatusKey = "active" | "fee" | "awaiting" | "closed";

const STATUS_LABELS: Record<StatusKey, string> = {
	active: "Active",
	fee: "Fee not agreed",
	awaiting: "Awaiting payout",
	closed: "Closed",
};

/** The filter bucket a row falls in — the same four the row's badge shows. */
function statusKey(c: AttorneyCase): StatusKey {
	if (c.status === "live") return "active";
	if (c.status === "closed") return "closed";
	if (c.status === "pending_payout") return "awaiting";
	return "fee";
}

export function AttorneyCases({ cases }: { cases: AttorneyCase[] }) {
	const searchId = useId();
	const [query, setQuery] = useState("");
	const [selStates, setSelStates] = useState<string[]>([]);
	const [status, setStatus] = useState<StatusKey | "all">("all");

	// Holding-up first, then live, then the rest; publication order within a group.
	const ordered = useMemo(
		() => [...cases].sort((a, b) => rank(a) - rank(b)),
		[cases],
	);
	// The states an attorney can filter by are only the ones they actually have
	// intakes in — a multi-state practice sees each, a single-state one sees none.
	const states = useMemo(
		() =>
			[...new Set(cases.map((c) => c.state).filter(Boolean))].sort((a, b) =>
				a.localeCompare(b),
			),
		[cases],
	);
	// Likewise only offer status chips that match something, in a stable order.
	const statuses = useMemo(() => {
		const present = new Set(cases.map(statusKey));
		return (["active", "fee", "awaiting", "closed"] as StatusKey[]).filter(
			(s) => present.has(s),
		);
	}, [cases]);

	if (cases.length === 0) {
		return (
			<div className="flex flex-col gap-6">
				<p className="max-w-[640px] text-[14.5px] text-ink-soft leading-relaxed">
					Intakes matched to you: the matter, your client, and where its funding
					stands.
				</p>
				<div className="flex flex-col items-center gap-3 rounded-[var(--radius-card-lg)] border border-border bg-surface px-6 py-16 text-center shadow-[var(--shadow-rest)]">
					<span className="flex size-12 items-center justify-center rounded-xl bg-brass-wash text-brass-deep">
						<Briefcase className="size-6" aria-hidden="true" />
					</span>
					<p className="font-bold text-[16px] text-ink">No intakes yet</p>
					<p className="max-w-[46ch] text-[13.5px] text-muted-foreground leading-relaxed">
						Put yourself forward for intakes that need representation. When a
						plaintiff takes you on, or names you on their own intake, it appears
						here.
					</p>
					<Link
						href={"/queue?tab=open" as Route}
						className={cn(buttonVariants({ size: "lg" }), "mt-2 px-5")}
					>
						<Search data-icon="inline-start" aria-hidden="true" />
						Browse the queue
					</Link>
				</div>
			</div>
		);
	}

	const blocked = cases.filter(blocking).length;
	const raised = cases.reduce((sum, c) => sum + c.raisedCents, 0);

	const q = query.trim().toLowerCase();
	const filtered = ordered.filter((c) => {
		if (selStates.length && !selStates.includes(c.state)) return false;
		if (status !== "all" && statusKey(c) !== status) return false;
		if (
			q &&
			!`${c.title} ${c.category} ${c.state} ${c.plaintiffName}`
				.toLowerCase()
				.includes(q)
		)
			return false;
		return true;
	});

	const hasFilters = !!q || selStates.length > 0 || status !== "all";
	// The filter bar earns its space only once there's more than one intake to sift.
	const showFilters = cases.length > 1;

	function toggleState(s: string) {
		setSelStates((prev) =>
			prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
		);
	}
	function clearFilters() {
		setQuery("");
		setSelStates([]);
		setStatus("all");
	}

	return (
		<div className="flex flex-col gap-6">
			<p className="max-w-[680px] text-[14.5px] text-ink-soft leading-relaxed">
				{cases.length === 1
					? "The intake you're acting on: the matter, your client, and where its funding stands."
					: `${cases.length} intakes you're acting on. ${money(raised)} raised across them so far.`}
			</p>

			{blocked > 0 && (
				<div className="flex items-start gap-3 rounded-[var(--radius-card)] border border-brass-deep/30 bg-brass-wash/60 px-5 py-4">
					<span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-brass-deep text-white">
						<Landmark className="size-4" aria-hidden="true" />
					</span>
					<div>
						<p className="font-bold text-[14px] text-ink">
							{blocked === 1
								? "One published intake can't accept donations yet"
								: `${blocked} published intakes can't accept donations yet`}
						</p>
						<p className="mt-1 max-w-[70ch] text-[13px] text-ink-soft leading-relaxed">
							Each intake pays into its own account, so finishing one doesn't
							cover the others. Open the intake below to set its account up.
							Your client can do nothing about it from their side.
						</p>
					</div>
				</div>
			)}

			{showFilters && (
				<div className="flex flex-col gap-3 rounded-[var(--radius-card-lg)] border border-border bg-surface p-4 shadow-[var(--shadow-rest)]">
					<div className="flex flex-wrap items-center gap-3">
						<div className="relative min-w-[220px] flex-1">
							<Search
								className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
								aria-hidden="true"
							/>
							<input
								id={searchId}
								type="search"
								value={query}
								onChange={(e) => setQuery(e.target.value)}
								placeholder="Search intakes by title, client, or state…"
								className="h-10 w-full rounded-[var(--radius-control)] border border-line-strong bg-surface pr-3 pl-9 text-[14px] text-ink outline-none focus:border-brass-deep"
							/>
						</div>
						<div className="flex flex-wrap items-center gap-1.5">
							<FilterPill
								active={status === "all"}
								onClick={() => setStatus("all")}
							>
								All
							</FilterPill>
							{statuses.map((s) => (
								<FilterPill
									key={s}
									active={status === s}
									onClick={() => setStatus(s)}
								>
									{STATUS_LABELS[s]}
								</FilterPill>
							))}
						</div>
					</div>

					{states.length > 1 && (
						<div className="flex flex-wrap items-center gap-1.5 border-border border-t pt-3">
							<span className="mr-1 inline-flex items-center gap-1 font-mono font-semibold text-[10.5px] text-muted-foreground uppercase tracking-[0.08em]">
								<MapPin className="size-3.5" aria-hidden="true" />
								States
							</span>
							{states.map((s) => (
								<FilterPill
									key={s}
									active={selStates.includes(s)}
									onClick={() => toggleState(s)}
								>
									{s}
								</FilterPill>
							))}
							{hasFilters && (
								<button
									type="button"
									onClick={clearFilters}
									className="ml-auto inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] px-3 py-1.5 font-semibold text-[12.5px] text-ink-soft transition-colors hover:bg-brass-wash hover:text-brass-deep"
								>
									<X className="size-3.5" aria-hidden="true" />
									Clear
								</button>
							)}
						</div>
					)}
				</div>
			)}

			{filtered.length === 0 ? (
				<div className="flex flex-col items-center gap-3 rounded-[var(--radius-card-lg)] border border-border border-dashed bg-paper-alt px-6 py-14 text-center">
					<span className="flex size-11 items-center justify-center rounded-xl bg-brass-wash text-brass-deep">
						<Search className="size-5" aria-hidden="true" />
					</span>
					<p className="font-bold text-[15px] text-ink">
						No intakes match those filters
					</p>
					<button
						type="button"
						onClick={clearFilters}
						className="font-semibold text-[13px] text-brass-deep hover:underline"
					>
						Clear filters
					</button>
				</div>
			) : (
				<div className="flex flex-col gap-4">
					{showFilters && hasFilters && (
						<p className="text-[12.5px] text-muted-foreground">
							Showing {filtered.length} of {cases.length} intakes
						</p>
					)}
					{filtered.map((c) => (
						<CaseRow key={c.id} case={c} />
					))}
				</div>
			)}
		</div>
	);
}

/** A toggle chip in the intake filter bar. */
function FilterPill({
	active,
	onClick,
	children,
}: {
	active: boolean;
	onClick: () => void;
	children: React.ReactNode;
}) {
	return (
		<button
			type="button"
			aria-pressed={active}
			onClick={onClick}
			className={cn(
				"rounded-[var(--radius-pill)] px-3 py-1.5 font-semibold text-[12.5px] transition-colors",
				active
					? "bg-ink text-paper"
					: "border border-border bg-surface text-ink-soft hover:border-brass-deep hover:text-brass-deep",
			)}
		>
			{children}
		</button>
	);
}

function rank(c: AttorneyCase): number {
	if (c.status === "closed") return 4;
	if (blocking(c)) return 0;
	if (c.status === "live") return 1;
	// Seeking with a fee still to agree — the case is theirs but not raising yet.
	return c.goalCents > 0 ? 2 : 3;
}

function CaseRow({ case: c }: { case: AttorneyCase }) {
	const pct =
		c.goalCents > 0
			? Math.min(100, Math.round((c.raisedCents / c.goalCents) * 100))
			: 0;
	const isLive = c.status === "live";
	const meta = [c.category, c.state].filter(Boolean).join(" · ");

	const badge = isLive
		? {
				text: "Active Case",
				cls: "bg-green-soft text-green-deep",
				dot: "bg-success",
			}
		: c.status === "closed"
			? {
					text: "Closed",
					cls: "bg-surface-2 text-ink-soft",
					dot: "bg-ink-soft",
				}
			: c.status === "pending_payout"
				? {
						// Named for what the attorney has to do, not for the state the
						// case is in — this row is the only place they will learn it.
						text: c.payout.transfersEnabled
							? "Ready · client to publish"
							: "Waiting on your setup",
						cls: c.payout.transfersEnabled
							? "bg-brass-wash text-brass-deep"
							: "bg-gold-bright/20 text-gold-bright-ink",
						dot: c.payout.transfersEnabled ? "bg-brass-deep" : "bg-gold-bright",
					}
				: {
						text: "Fee not agreed",
						cls: "bg-brass-wash text-brass-deep",
						dot: "bg-brass-deep",
					};

	return (
		<Link
			href={`/my-cases/${c.id}` as Route}
			className="group flex flex-col gap-4 rounded-[var(--radius-card-lg)] border border-border bg-surface p-5 shadow-[var(--shadow-rest)] transition-colors hover:border-brass-deep sm:flex-row sm:items-center sm:gap-6"
		>
			<div className="min-w-0 flex-1">
				<div className="flex flex-wrap items-center gap-2">
					<span
						className={cn(
							"inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] px-2.5 py-1 font-mono font-semibold text-[10px] uppercase tracking-[0.06em]",
							badge.cls,
						)}
					>
						<span className={cn("size-1.5 rounded-full", badge.dot)} />
						{badge.text}
					</span>
					<PayoutChip case={c} />
				</div>
				<h2 className="mt-2 font-bold text-[17px] text-ink leading-snug">
					{c.title || "Untitled intake"}
				</h2>
				<p className="mt-1 text-[12.5px] text-muted-foreground">
					{meta ? `${meta} · ` : ""}for {c.plaintiffName}
				</p>
			</div>

			<div className="w-full shrink-0 sm:w-[280px]">
				{isLive ? (
					<>
						<p className="flex items-baseline gap-2">
							<span className="font-extrabold text-[20px] text-ink tabular-nums tracking-[-0.02em]">
								{money(c.raisedCents)}
							</span>
							<span className="text-[12.5px] text-muted-foreground">
								of {money(c.goalCents)} · {pct}%
							</span>
						</p>
						<div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
							<div
								className="h-full rounded-full bg-brass"
								style={{ width: `${Math.max(2, pct)}%` }}
							/>
						</div>
						<p className="mt-2 inline-flex items-center gap-1.5 text-[12px] text-muted-foreground">
							<Users className="size-3.5" aria-hidden="true" />
							{c.donorsCount === 0
								? "no donors yet"
								: `${c.donorsCount} ${c.donorsCount === 1 ? "donor" : "donors"}`}
						</p>
					</>
				) : (
					<p className="text-[13px] text-ink-soft leading-relaxed">
						{c.status === "closed"
							? "Closed. No longer raising."
							: c.status === "pending_payout"
								? c.payout.transfersEnabled
									? `${money(c.goalCents)} agreed and your account is ready. Your client publishes when they're set.`
									: // The one line that says the quiet part: their client's
										// campaign does not exist yet, and this is why.
										`${money(c.goalCents)} agreed. Their intake can't go public until this one's payout account is set up.`
								: c.goalCents > 0
									? `${money(c.goalCents)} agreed. Not raising until your client publishes.`
									: "Your client hasn't agreed the fee with you yet, so there's no goal to raise."}
					</p>
				)}
				{/* Outside the funding branch on purpose: an attorney posts updates on a
				    case whether or not it is currently raising, and "no updates posted" is
				    the nudge (JUS-33). Plain text rather than a link — this whole row is
				    already one, and the composer lives on the case's own screen. */}
				<p className="mt-2 inline-flex items-center gap-1.5 text-[12px] text-muted-foreground">
					<Megaphone className="size-3.5" aria-hidden="true" />
					{c.updatesCount === 0
						? "no updates posted"
						: `${c.updatesCount} ${c.updatesCount === 1 ? "update" : "updates"} posted`}
				</p>
			</div>

			<span className="inline-flex shrink-0 items-center gap-1 font-semibold text-[13px] text-brass-deep">
				Open
				<ArrowRight
					className="size-3.5 transition-transform group-hover:translate-x-0.5"
					aria-hidden="true"
				/>
			</span>
		</Link>
	);
}
