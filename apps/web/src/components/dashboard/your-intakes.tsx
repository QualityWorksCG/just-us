"use client";

import { buttonVariants } from "@just-us/ui/components/button";
import { cn } from "@just-us/ui/lib/utils";
import { ArrowRight, Inbox } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useState } from "react";

/**
 * The "Your intakes" tab of the Intake requests screen (JUS-25).
 *
 * Three things an attorney's expressions of interest can become, in one list they
 * can filter:
 *   - matched   — the plaintiff took them forward; these are live work, so they
 *                 carry funding and open to the case they now represent.
 *   - interested— put forward, the plaintiff hasn't decided; opens to the queued
 *                 intake so they can re-read it.
 *   - passed    — the plaintiff went another way. Kept, not hidden, so an interest
 *                 never just vanishes.
 */

export type MatchedIntake = {
	id: string;
	title: string;
	status: string;
	category: string;
	state: string;
	raisedCents: number;
	goalCents: number;
	donorsCount: number;
};

export type ExpressionIntake = {
	id: string;
	caseId: string;
	title: string;
	category: string;
	state: string;
};

type Filter = "all" | "matched" | "interested" | "passed";

function money(cents: number) {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		maximumFractionDigits: 0,
	}).format(cents / 100);
}

function matchedBadge(status: string): { text: string; cls: string } {
	// Published and taking donations — green, and the only thing called "Active".
	if (status === "live")
		return { text: "Active", cls: "bg-green-soft text-green-deep" };
	if (status === "closed")
		return { text: "Closed", cls: "bg-surface-2 text-ink-soft" };
	if (status === "pending_payout")
		return {
			text: "Awaiting next steps",
			cls: "bg-gold-bright/20 text-gold-bright-ink",
		};
	// Matched but not published yet (no agreed fee) — not "Active", not green.
	return { text: "Fee not agreed", cls: "bg-brass-wash text-brass-deep" };
}

export function YourIntakes({
	matched,
	interested,
	passed,
}: {
	matched: MatchedIntake[];
	interested: ExpressionIntake[];
	passed: ExpressionIntake[];
}) {
	const [filter, setFilter] = useState<Filter>("all");

	const counts = {
		all: matched.length + interested.length + passed.length,
		matched: matched.length,
		interested: interested.length,
		passed: passed.length,
	};

	const showMatched = filter === "all" || filter === "matched";
	const showInterested = filter === "all" || filter === "interested";
	const showPassed = filter === "all" || filter === "passed";
	const visible =
		(showMatched ? matched.length : 0) +
		(showInterested ? interested.length : 0) +
		(showPassed ? passed.length : 0);

	const FILTERS: { key: Filter; label: string }[] = [
		{ key: "all", label: "All" },
		{ key: "matched", label: "Matched" },
		{ key: "interested", label: "Interested" },
		{ key: "passed", label: "Declined" },
	];

	return (
		<div className="flex flex-col gap-5">
			<div className="flex flex-wrap items-center gap-2">
				{FILTERS.map((f) => {
					const active = filter === f.key;
					return (
						<button
							key={f.key}
							type="button"
							aria-pressed={active}
							onClick={() => setFilter(f.key)}
							className={cn(
								"inline-flex items-center gap-2 rounded-[var(--radius-pill)] px-3.5 py-1.5 font-semibold text-[13px] transition-colors",
								active
									? "bg-ink text-paper"
									: "text-ink-soft hover:bg-surface-2 hover:text-ink",
							)}
						>
							{f.label}
							<span
								className={cn(
									"font-bold text-[11.5px] tabular-nums",
									active ? "text-paper/70" : "text-muted-foreground",
								)}
							>
								{counts[f.key]}
							</span>
						</button>
					);
				})}
			</div>

			{visible === 0 ? (
				<div className="flex flex-col items-center gap-3 rounded-[var(--radius-card-lg)] border border-border border-dashed bg-paper-alt px-6 py-14 text-center">
					<span className="flex size-11 items-center justify-center rounded-xl bg-brass-wash text-brass-deep">
						<Inbox className="size-5" aria-hidden="true" />
					</span>
					<p className="font-bold text-[15px] text-ink">
						{filter === "matched"
							? "No matched intakes yet"
							: filter === "interested"
								? "Nothing awaiting a decision"
								: filter === "passed"
									? "Nothing declined"
									: "No intakes yet"}
					</p>
					<p className="max-w-[44ch] text-[13.5px] text-muted-foreground leading-relaxed">
						Put yourself forward for an open intake under Browse open. What
						becomes of each one shows up here.
					</p>
				</div>
			) : (
				<div className="overflow-hidden rounded-[var(--radius-card-lg)] border border-border bg-surface shadow-[var(--shadow-rest)]">
					<ul className="divide-y divide-border">
						{showMatched &&
							matched.map((c) => {
								const badge = matchedBadge(c.status);
								const pct =
									c.goalCents > 0
										? Math.min(
												100,
												Math.round((c.raisedCents / c.goalCents) * 100),
											)
										: 0;
								return (
									<li
										key={`m-${c.id}`}
										className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4"
									>
										<div className="min-w-0 flex-1">
											<div className="flex flex-wrap items-center gap-2">
												<p className="truncate font-bold text-[14.5px] text-ink">
													{c.title || "Untitled intake"}
												</p>
												<span
													className={cn(
														"shrink-0 rounded-[var(--radius-pill)] px-2 py-0.5 font-semibold text-[11px]",
														badge.cls,
													)}
												>
													{badge.text}
												</span>
											</div>
											<p className="mt-0.5 text-[12.5px] text-muted-foreground">
												{[c.category, c.state].filter(Boolean).join(" · ") ||
													"—"}
											</p>
											<p className="mt-1 text-[12.5px] text-ink-soft tabular-nums">
												<span className="font-semibold text-ink">
													{money(c.raisedCents)}
												</span>{" "}
												of {money(c.goalCents)} · {pct}% funded ·{" "}
												{c.donorsCount}{" "}
												{c.donorsCount === 1 ? "supporter" : "supporters"}
											</p>
										</div>
										<Link
											href={`/my-cases/${c.id}` as Route}
											className={cn(
												buttonVariants({ variant: "outline", size: "sm" }),
												"h-9 shrink-0",
											)}
										>
											Open
											<ArrowRight data-icon="inline-end" aria-hidden="true" />
										</Link>
									</li>
								);
							})}

						{showInterested &&
							interested.map((e) => (
								<ExpressionRow
									key={`i-${e.id}`}
									intake={e}
									badge={{
										text: "Interested",
										cls: "bg-brass-wash text-brass-deep",
									}}
								/>
							))}

						{showPassed &&
							passed.map((e) => (
								<ExpressionRow
									key={`p-${e.id}`}
									intake={e}
									badge={{
										text: "Declined",
										cls: "bg-surface-2 text-muted-foreground",
									}}
								/>
							))}
					</ul>
				</div>
			)}
		</div>
	);
}

function ExpressionRow({
	intake,
	badge,
}: {
	intake: ExpressionIntake;
	badge: { text: string; cls: string };
}) {
	return (
		<li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4">
			<div className="min-w-0 flex-1">
				<div className="flex flex-wrap items-center gap-2">
					<p className="truncate font-bold text-[14.5px] text-ink">
						{intake.title || "Untitled intake"}
					</p>
					<span
						className={cn(
							"shrink-0 rounded-[var(--radius-pill)] px-2 py-0.5 font-semibold text-[11px]",
							badge.cls,
						)}
					>
						{badge.text}
					</span>
				</div>
				<p className="mt-0.5 text-[12.5px] text-muted-foreground">
					{[intake.category, intake.state].filter(Boolean).join(" · ") || "—"}
				</p>
			</div>
			<Link
				href={`/queue/${intake.caseId}` as Route}
				className={cn(
					buttonVariants({ variant: "outline", size: "sm" }),
					"h-9 shrink-0",
				)}
			>
				View
				<ArrowRight data-icon="inline-end" aria-hidden="true" />
			</Link>
		</li>
	);
}
