import type { AttorneyCase } from "@just-us/db/representation";
import { buttonVariants } from "@just-us/ui/components/button";
import { cn } from "@just-us/ui/lib/utils";
import {
	ArrowRight,
	BadgeCheck,
	Briefcase,
	Hourglass,
	Landmark,
	Megaphone,
	Search,
	Users,
} from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

/**
 * Cases this attorney is acting on.
 *
 * Ordered so the ones needing them come first: a published case whose payout
 * account isn't finished cannot take a donation, and the person who has to fix that
 * is the attorney reading this. Everything else — funding, the client, the matter —
 * follows on the case's own screen.
 */

export function money(cents: number) {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		maximumFractionDigits: 0,
	}).format(cents / 100);
}

export type PayoutStage = "not_started" | "incomplete" | "in_review" | "ready";

export function payoutStage(c: AttorneyCase): PayoutStage {
	if (!c.payout.hasAccount) return "not_started";
	if (c.payout.transfersEnabled) return "ready";
	if (c.payout.detailsSubmitted) return "in_review";
	return "incomplete";
}

const STAGE_LABEL: Record<PayoutStage, string> = {
	not_started: "Payouts not set up",
	incomplete: "Payout setup unfinished",
	in_review: "Payouts in review",
	ready: "Payouts active",
};

/** A case whose account can't receive is the state the attorney themselves is
 *  blocking — that is what earns the loud treatment.
 *
 *  Two flavours, and `pending_payout` is the worse one: that client's case is not
 *  merely unable to take money, it is not public at all, and cannot be until this
 *  is done. A `live` case at least raises the moment the account clears. */
function blocking(c: AttorneyCase) {
	return (
		(c.status === "live" || c.status === "pending_payout") &&
		!c.payout.transfersEnabled
	);
}

export function PayoutChip({ case: c }: { case: AttorneyCase }) {
	const stage = payoutStage(c);
	// A closed matter is not waiting on anyone's bank details. Reporting one as
	// "not set up" would be work that no longer exists, sitting next to cases where
	// the same words mean a client cannot be paid.
	if (c.status === "closed" && stage !== "ready") return null;
	const ready = stage === "ready";
	const review = stage === "in_review";
	return (
		<span
			className={cn(
				"inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] px-2.5 py-1 font-semibold text-[11.5px]",
				ready
					? "bg-green-soft text-green-deep"
					: review
						? "bg-brass-wash text-brass-deep"
						: blocking(c)
							? "bg-danger/10 text-danger"
							: "bg-surface-2 text-ink-soft",
			)}
		>
			{ready ? (
				<BadgeCheck className="size-3.5" aria-hidden="true" />
			) : review ? (
				<Hourglass className="size-3.5" aria-hidden="true" />
			) : (
				<Landmark className="size-3.5" aria-hidden="true" />
			)}
			{STAGE_LABEL[stage]}
		</span>
	);
}

export function AttorneyCases({ cases }: { cases: AttorneyCase[] }) {
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

	// Cases the attorney is holding up come first, then live, then the rest. Within
	// a group the list keeps its publication order.
	const ordered = [...cases].sort((a, b) => rank(a) - rank(b));
	const blocked = cases.filter(blocking).length;
	const raised = cases.reduce((sum, c) => sum + c.raisedCents, 0);

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

			<div className="flex flex-col gap-4">
				{ordered.map((c) => (
					<CaseRow key={c.id} case={c} />
				))}
			</div>
		</div>
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
