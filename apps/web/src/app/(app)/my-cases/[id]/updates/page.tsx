import {
	listCaseUpdates,
	markCaseUpdatesSeenByOwner,
} from "@just-us/db/case-updates";
import { getOwnedCase } from "@just-us/db/cases";
import { countCaseFollowers } from "@just-us/db/follows";
import { getMatchedCase } from "@just-us/db/representation";
import { cn } from "@just-us/ui/lib/utils";
import { Bell, MessageCircle, TrendingUp, UsersRound } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CaseUpdates } from "@/components/cases/case-updates";
import { BackLink } from "@/components/dashboard/back-link";
import { CaseUpdateComposer } from "@/components/dashboard/case-update-composer";
import { requireRole } from "@/lib/auth-server";

function money(n: number) {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		maximumFractionDigits: 0,
	}).format(n);
}

function firstName(name: string) {
	return name.trim().split(/\s+/)[0] || name;
}

/**
 * The full "Case updates" board (JUS-33) — the prototype's two-column layout:
 * a composer and time-grouped timeline on the left, a context sidebar on the
 * right. Both the plaintiff (owner) and the matched attorney reach it and can
 * post; each sees the case from their own side. Resolved through role-scoped
 * queries, so neither opens a case that isn't theirs.
 */
export default async function CaseUpdatesPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { session, role } = await requireRole("plaintiff", "attorney");
	const { id } = await params;
	const viewerId = session.user.id;
	const isAttorney = role === "attorney";

	let title: string;
	let location: string;
	let status: string;
	let raisedCents: number;
	let goalCents: number;
	let donorsCount: number;
	let attorneyName: string | null;
	let clientName: string;
	// Plaintiff-only: the last-seen time (captured before marking) drives which
	// updates highlight as new.
	let highlightSince: Date | null | undefined;

	if (role === "plaintiff") {
		const c = await getOwnedCase(id, viewerId);
		if (!c || c.deletedAt) notFound();
		title = c.title;
		location = c.location;
		status = c.status;
		raisedCents = c.raisedCents;
		goalCents = c.goalCents;
		donorsCount = c.donorsCount;
		attorneyName = c.attorneyName;
		clientName = session.user.name;
		highlightSince = c.ownerUpdatesSeenAt;
		await markCaseUpdatesSeenByOwner(id, viewerId);
	} else {
		const c = await getMatchedCase(id, viewerId);
		if (!c) notFound();
		title = c.title;
		location = c.location;
		status = c.status;
		raisedCents = c.raisedCents;
		goalCents = c.goalCents;
		donorsCount = c.donorsCount;
		attorneyName = c.attorneyName;
		clientName = c.owner.name;
	}

	const updates = await listCaseUpdates(id, { includeModerated: true });
	// The plaintiff's "who sees this" audience counts followers alongside backers.
	const followers = isAttorney ? 0 : await countCaseFollowers(id);
	const goal = goalCents / 100;
	const raised = raisedCents / 100;
	const pct = goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : 0;
	const isLive = status === "live";

	return (
		<div className="w-full">
			<BackLink
				href={`/my-cases/${id}` as Route}
				label="Back to case"
				className="mb-3"
			/>
			<h2 className="font-extrabold text-[30px] text-ink tracking-[-0.02em]">
				Case updates
			</h2>
			<p className="mt-1 text-[14.5px] text-ink-soft">
				{title || "Untitled case"} ·{" "}
				{isAttorney
					? `client ${clientName} · shared with their backers`
					: "shared with your backers"}
			</p>

			<div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
				{/* Left — post + timeline */}
				<div className="flex min-w-0 flex-col gap-6">
					<CaseUpdateComposer
						caseId={id}
						authorName={session.user.name}
						authorTone={isAttorney ? "brass" : "green"}
						placeholder={
							isAttorney
								? `Post an update for ${firstName(clientName)} and their backers…`
								: "Share an update with your backers…"
						}
					/>
					<CaseUpdates
						updates={updates}
						viewerId={viewerId}
						viewerRole={isAttorney ? "attorney" : "plaintiff"}
						caseId={id}
						grouped
						highlightSince={highlightSince}
						emptyHint="No updates yet — the first post will appear here and reach every backer."
					/>
				</div>

				{/* Right — context */}
				<aside className="flex flex-col gap-4 lg:sticky lg:top-20 lg:self-start">
					{isAttorney ? (
						<div className="rounded-[var(--radius-card-lg)] border border-border bg-surface p-5 shadow-[var(--shadow-rest)]">
							<p className="font-mono font-semibold text-[10.5px] text-muted-foreground uppercase tracking-[0.08em]">
								Your client
							</p>
							<div className="mt-3 flex items-center gap-3">
								<span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-green-deep font-bold text-[13px] text-white">
									{firstName(clientName)[0]?.toUpperCase() ?? "—"}
								</span>
								<div className="min-w-0">
									<p className="truncate font-bold text-[14.5px] text-ink">
										{clientName}
									</p>
									<p className="text-[12.5px] text-muted-foreground">
										Plaintiff · {location || "—"}
									</p>
								</div>
							</div>
							<Link
								href={"/messages" as Route}
								className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-[var(--radius-control)] border border-border font-semibold text-[13.5px] text-ink transition-colors hover:border-brass-deep"
							>
								<MessageCircle className="size-4" aria-hidden="true" />
								Message {firstName(clientName)}
							</Link>
						</div>
					) : (
						<div className="rounded-[var(--radius-card-lg)] border border-border bg-surface p-5 shadow-[var(--shadow-rest)]">
							<p className="font-mono font-semibold text-[10.5px] text-muted-foreground uppercase tracking-[0.08em]">
								Who sees your updates
							</p>
							<div className="mt-3 flex flex-col gap-3">
								<div className="flex items-center gap-3">
									<span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brass-wash text-brass-deep">
										<UsersRound className="size-5" aria-hidden="true" />
									</span>
									<div>
										<p className="font-extrabold text-[18px] text-ink tabular-nums leading-none">
											{donorsCount}
										</p>
										<p className="text-[12.5px] text-muted-foreground">
											{donorsCount === 1 ? "backer" : "backers"}
										</p>
									</div>
								</div>
								<div className="flex items-center gap-3">
									<span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-green-soft text-green-deep">
										<Bell className="size-4" aria-hidden="true" />
									</span>
									<div>
										<p className="font-extrabold text-[18px] text-ink tabular-nums leading-none">
											{followers}
										</p>
										<p className="text-[12.5px] text-muted-foreground">
											{followers === 1 ? "follower" : "followers"}
										</p>
									</div>
								</div>
							</div>
							<p className="mt-4 border-border border-t pt-3 text-[12.5px] text-muted-foreground leading-relaxed">
								Everyone backing or following your case sees every update you or
								your attorney post.
							</p>
						</div>
					)}

					{/* Case snapshot */}
					<div className="rounded-[var(--radius-card-lg)] border border-green-soft bg-green-soft/40 p-5">
						<p className="font-mono font-semibold text-[10.5px] text-green-deep/80 uppercase tracking-[0.08em]">
							Case snapshot
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
							{isLive ? "Live · Raising" : status}
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
							{isAttorney
								? `Agreed fee ${money(goal)} · routes to your account`
								: `With ${attorneyName ?? "your attorney"} · ${donorsCount} ${donorsCount === 1 ? "donor" : "donors"}`}
						</p>
					</div>
				</aside>
			</div>
		</div>
	);
}
