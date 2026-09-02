import { cn } from "@just-us/ui/lib/utils";
import { Heart, TrendingUp } from "lucide-react";
import type { Route } from "next";

import {
	type CaseUpdateItem,
	CaseUpdates,
} from "@/components/cases/case-updates";
import {
	BackCaseButton,
	FollowToggle,
	ShareCaseButton,
} from "@/components/cases/donor-update-actions";
import { DetailBackLink } from "@/components/detail-back-link";

function money(n: number) {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		maximumFractionDigits: 0,
	}).format(n);
}

const dateFmt = new Intl.DateTimeFormat("en-US", {
	month: "short",
	day: "numeric",
});

function firstName(name: string) {
	return name.trim().split(/\s+/)[0] || name;
}

/**
 * The full "Case updates" page as a donor / public visitor reads it (JUS-33) —
 * the prototype's two-column layout: a "you're following/backing" banner and the
 * time-grouped timeline on the left, the reader's support + case progress on the
 * right. Shared by the in-app `/discover/[id]/updates` and public
 * `/cases/[id]/updates` routes; each route supplies its own page chrome.
 */
export function CaseUpdatesBoard({
	caseId,
	caseTitle,
	plaintiffName,
	status,
	raisedCents,
	goalCents,
	donorsCount,
	updates,
	viewerId,
	viewerFirstName,
	backHref,
	backLabel,
	caseHref,
	headingLevel = "h1",
	highlightSince,
	following,
	canFollow,
	donation,
}: {
	caseId: string;
	caseTitle: string;
	plaintiffName: string;
	status: string;
	raisedCents: number;
	goalCents: number;
	donorsCount: number;
	updates: CaseUpdateItem[];
	viewerId: string;
	viewerFirstName: string | null;
	backHref: Route;
	backLabel: string;
	/** This case's own page — where "Back this case" sends the reader, since the
	 *  donate panel with the fee breakdown lives there. Separate from `backHref`:
	 *  they happen to match today, but one is navigation and one is the donate path. */
	caseHref: string;
	headingLevel?: "h1" | "h2";
	highlightSince?: Date | string | null;
	following: boolean;
	canFollow: boolean;
	/** The reader's giving on this case, or null if they haven't donated. */
	donation: { totalCents: number; latestAt: Date | string } | null;
}) {
	const Heading = headingLevel;
	const goal = goalCents / 100;
	const raised = raisedCents / 100;
	const pct = goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : 0;
	const isLive = status === "live";
	const plaintiffFirst = firstName(plaintiffName);
	const hasDonated = !!donation;

	const bannerText = hasDonated
		? "You're supporting this case. You'll get every update here."
		: following
			? "You're following this case. You'll get every update here."
			: "Follow this case to get every update here.";

	return (
		<div>
			<DetailBackLink href={backHref} label={backLabel} />
			<Heading className="mt-4 font-extrabold text-[clamp(1.75rem,3.4vw,2.375rem)] text-ink tracking-[-0.03em]">
				Case updates
			</Heading>
			<p className="mt-1.5 text-[14.5px] text-ink-soft">
				{caseTitle || "Untitled case"} · by {plaintiffName}
			</p>

			<div className="mt-6 grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
				{/* Left — banner + timeline */}
				<div className="flex min-w-0 flex-col gap-6">
					<div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-card-lg)] border border-green-soft bg-green-soft/40 px-4 py-3">
						<span className="flex items-center gap-2.5">
							<span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface text-green-deep">
								<Heart className="size-4" aria-hidden="true" />
							</span>
							<span className="text-[13.5px] text-ink">{bannerText}</span>
						</span>
						<FollowToggle
							caseId={caseId}
							canFollow={canFollow}
							initialFollowing={following}
						/>
					</div>

					<CaseUpdates
						updates={updates}
						viewerId={viewerId}
						viewerRole="donor"
						caseId={caseId}
						grouped
						highlightSince={highlightSince}
						emptyHint="No updates yet. The attorney's progress posts will appear here."
					/>
				</div>

				{/* Right — support + progress */}
				<aside className="flex flex-col gap-4 lg:sticky lg:top-20 lg:self-start">
					<div className="rounded-[var(--radius-card-lg)] border border-border bg-surface p-5 shadow-[var(--shadow-rest)]">
						<p className="font-mono font-semibold text-[10.5px] text-muted-foreground uppercase tracking-[0.08em]">
							Your support
						</p>
						{donation ? (
							<>
								<p className="mt-2 font-extrabold text-[24px] text-ink tabular-nums leading-none">
									{money(donation.totalCents / 100)}{" "}
									<span className="font-semibold text-[13.5px] text-muted-foreground">
										given {dateFmt.format(new Date(donation.latestAt))}
									</span>
								</p>
								<p className="mt-2 text-[13px] text-ink-soft leading-relaxed">
									Thank you{viewerFirstName ? `, ${viewerFirstName}` : ""}.
									You're one of {donorsCount}{" "}
									{donorsCount === 1 ? "person" : "people"} supporting{" "}
									{plaintiffFirst}.
								</p>
							</>
						) : (
							<p className="mt-2 text-[13px] text-ink-soft leading-relaxed">
								{donorsCount > 0
									? `Join ${donorsCount} ${donorsCount === 1 ? "supporter" : "supporters"} helping ${plaintiffFirst} fund their day in court.`
									: `Be the first to support ${plaintiffFirst}'s fight.`}
							</p>
						)}
						<div className="mt-4 flex flex-col gap-2.5">
							<BackCaseButton
								label={hasDonated ? "Give again" : "Support this case"}
								caseHref={caseHref}
							/>
							<ShareCaseButton sharePath={`/cases/${caseId}`} />
						</div>
					</div>

					<div className="rounded-[var(--radius-card-lg)] border border-green-soft bg-green-soft/40 p-5">
						<p className="font-mono font-semibold text-[10.5px] text-green-deep/80 uppercase tracking-[0.08em]">
							Case progress
						</p>
						<span
							className={cn(
								"mt-3 inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] px-2.5 py-1 font-mono font-semibold text-[10.5px] uppercase tracking-[0.06em]",
								isLive
									? "bg-green-soft text-green-deep"
									: "bg-brass-wash text-brass-deep",
							)}
						>
							<TrendingUp className="size-3" aria-hidden="true" />
							{isLive ? "Active Case" : status}
						</span>
						<p className="mt-3 font-extrabold text-[20px] text-ink tabular-nums tracking-[-0.02em]">
							{money(raised)}{" "}
							<span className="font-semibold text-[13.5px] text-ink/70">
								of {money(goal)}
							</span>
						</p>
						<div className="mt-3 h-2 overflow-hidden rounded-full bg-surface/70">
							<div
								className="h-full rounded-full bg-gradient-to-r from-brass to-success"
								style={{ width: `${Math.max(2, pct)}%` }}
							/>
						</div>
						<p className="mt-3 text-[12.5px] text-ink-soft">
							{donorsCount} {donorsCount === 1 ? "donor" : "donors"} · {pct}%
							funded
						</p>
					</div>
				</aside>
			</div>
		</div>
	);
}
