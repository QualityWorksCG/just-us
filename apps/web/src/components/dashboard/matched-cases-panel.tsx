"use client";

import type { AttorneyCase } from "@just-us/db/representation";
import { cn } from "@just-us/ui/lib/utils";
import { ArrowRight, Megaphone, Users, X } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useState } from "react";
import { money, PayoutChip } from "@/components/dashboard/attorney-cases";
import { CaseUpdateComposer } from "@/components/dashboard/case-update-composer";

/** How many matched cases to surface on the dashboard before deferring to the
 *  full "My cases" screen. Attorneys rarely carry many, but the queue below still
 *  needs room. */
const MAX_SHOWN = 6;

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
	live: { label: "Live", cls: "bg-green-soft text-green-deep" },
	seeking: { label: "Seeking", cls: "bg-brass-wash text-brass-deep" },
	pending_payout: {
		label: "Awaiting payout setup",
		cls: "bg-gold-bright/20 text-gold-bright-ink",
	},
	closed: { label: "Closed", cls: "bg-surface-2 text-ink-soft" },
};

/**
 * The attorney's matched cases on their dashboard: each with its case-account
 * (Stripe Connect) activity and a way to post an update without leaving the
 * dashboard.
 *
 * Every case here comes from `listAttorneyCases`, which is gated to the cases this
 * attorney actually represents — so the account activity shown, and the cases they
 * can post to, are their own and no one else's. Posting is additionally re-checked
 * server-side in `postCaseUpdateAction`.
 */
export function MatchedCasesPanel({
	cases,
	authorName,
}: {
	cases: AttorneyCase[];
	authorName: string;
}) {
	// The case whose "Post update" composer is open, if any.
	const [composing, setComposing] = useState<AttorneyCase | null>(null);

	const shown = cases.slice(0, MAX_SHOWN);

	return (
		<section className="flex flex-col gap-4">
			<div className="flex items-center justify-between">
				<h2 className="font-bold text-[18px] text-ink">Your matched cases</h2>
				{cases.length > 0 && (
					<Link
						href={"/my-cases" as Route}
						className="inline-flex items-center gap-1 font-semibold text-[12.5px] text-brass-deep transition-colors hover:text-ink"
					>
						View all{cases.length > MAX_SHOWN ? ` (${cases.length})` : ""}
						<ArrowRight className="size-3.5" aria-hidden="true" />
					</Link>
				)}
			</div>

			{cases.length === 0 ? (
				<div className="rounded-[var(--radius-card-lg)] border border-border border-dashed bg-surface px-6 py-10 text-center">
					<p className="font-semibold text-[14px] text-ink">
						No matched cases yet
					</p>
					<p className="mx-auto mt-1 max-w-[44ch] text-[13px] text-muted-foreground leading-relaxed">
						When a plaintiff takes your interest further, their case appears
						here, with its funding, its account status, and a place to post
						updates. Put yourself forward in the queue below.
					</p>
				</div>
			) : (
				<div className="grid gap-3">
					{shown.map((c) => {
						const badge = STATUS_BADGE[c.status] ?? {
							label: c.status,
							cls: "bg-surface-2 text-ink-soft",
						};
						return (
							<div
								key={c.id}
								className="rounded-[var(--radius-card-lg)] border border-border bg-surface p-5 shadow-[var(--shadow-rest)]"
							>
								<div className="flex flex-wrap items-start justify-between gap-3">
									<div className="min-w-0">
										<div className="flex flex-wrap items-center gap-2">
											<Link
												href={`/my-cases/${c.id}` as Route}
												className="font-bold text-[15px] text-ink hover:text-brass-deep"
											>
												{c.title || "Untitled case"}
											</Link>
											<span
												className={cn(
													"inline-flex rounded-[var(--radius-pill)] px-2 py-0.5 font-mono font-semibold text-[10px] uppercase tracking-[0.06em]",
													badge.cls,
												)}
											>
												{badge.label}
											</span>
										</div>
										<p className="mt-1 text-[12.5px] text-muted-foreground">
											{c.plaintiffName} · {c.category} · {c.state}
										</p>
									</div>
									{/* Case-account (Stripe Connect) activity — readiness of this
									    case's own account, the attorney's to finish. */}
									<PayoutChip case={c} />
								</div>

								{/* Funding activity on the account. */}
								<div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px]">
									<span className="font-semibold text-ink tabular-nums">
										{money(c.raisedCents)}
										<span className="ml-1 font-normal text-muted-foreground">
											raised of {money(c.goalCents)}
										</span>
									</span>
									<span className="inline-flex items-center gap-1.5 text-muted-foreground">
										<Users className="size-3.5" aria-hidden="true" />
										{c.donorsCount} donor{c.donorsCount === 1 ? "" : "s"}
									</span>
									<span className="inline-flex items-center gap-1.5 text-muted-foreground">
										<Megaphone className="size-3.5" aria-hidden="true" />
										{c.updatesCount} update{c.updatesCount === 1 ? "" : "s"}
									</span>
								</div>

								<div className="mt-4 flex items-center gap-2.5">
									{/* Updates only reach backers on a live, raising case, so the
									    composer is offered only there — a case still seeking, awaiting
									    payout, or closed has nothing to post progress to yet. */}
									{c.status === "live" && (
										<button
											type="button"
											onClick={() => setComposing(c)}
											className="inline-flex items-center gap-1.5 rounded-[var(--radius-control)] bg-brass px-3.5 py-2 font-semibold text-[12.5px] text-white transition-colors hover:bg-brass/90"
										>
											<Megaphone className="size-3.5" aria-hidden="true" />
											Post update
										</button>
									)}
									<Link
										href={`/my-cases/${c.id}` as Route}
										className="inline-flex items-center gap-1.5 rounded-[var(--radius-control)] border border-border px-3.5 py-2 font-semibold text-[12.5px] text-ink transition-colors hover:border-brass-deep hover:text-brass-deep"
									>
										Open case
										<ArrowRight className="size-3.5" aria-hidden="true" />
									</Link>
								</div>
							</div>
						);
					})}
				</div>
			)}

			{/* Post-update composer, from the dashboard. Mounted only when open so a
			    dozen composers don't sit hydrated behind the list. */}
			{composing && (
				<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
					<button
						type="button"
						aria-label="Close"
						onClick={() => setComposing(null)}
						className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
					/>
					<div
						role="dialog"
						aria-modal="true"
						aria-label={`Post an update on ${composing.title || "your case"}`}
						className="relative w-full max-w-[560px] rounded-[var(--radius-card-lg)] border border-border bg-surface p-6 shadow-[var(--shadow-modal)]"
					>
						<div className="mb-4 flex items-start justify-between gap-4">
							<div>
								<h3 className="font-bold text-[16px] text-ink">
									Post an update
								</h3>
								<p className="mt-0.5 text-[12.5px] text-muted-foreground">
									{composing.title || "Your case"} · seen by{" "}
									{composing.plaintiffName} and every backer
								</p>
							</div>
							<button
								type="button"
								aria-label="Close"
								onClick={() => setComposing(null)}
								className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-surface-2 hover:text-ink"
							>
								<X className="size-4" aria-hidden="true" />
							</button>
						</div>
						<CaseUpdateComposer
							caseId={composing.id}
							authorName={authorName}
							authorTone="brass"
							placeholder={`Share progress on ${composing.title || "the case"} with ${composing.plaintiffName.split(/\s+/)[0]} and their backers…`}
							onPosted={() => setComposing(null)}
						/>
					</div>
				</div>
			)}
		</section>
	);
}
