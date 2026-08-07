import {
	listCaseUpdates,
	markCaseUpdatesSeenByOwner,
} from "@just-us/db/case-updates";
import { getOwnedCase } from "@just-us/db/cases";
import { getMatchedCase } from "@just-us/db/representation";
import { buttonVariants } from "@just-us/ui/components/button";
import { cn } from "@just-us/ui/lib/utils";
import { ArrowRight, ExternalLink, Scale } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CaseUpdates } from "@/components/cases/case-updates";
import { BackLink } from "@/components/dashboard/back-link";
import { CaseUpdateComposer } from "@/components/dashboard/case-update-composer";
import {
	ManageCase,
	type ManageCaseData,
} from "@/components/dashboard/manage-case";
import { requireRole } from "@/lib/auth-server";

export default async function ManageCasePage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	// Both roles land here from their own "My cases": the plaintiff manages the
	// case they own; the attorney posts progress updates to a case they represent.
	const { session, role } = await requireRole("plaintiff", "attorney");
	const { id } = await params;

	if (role === "attorney") {
		return <AttorneyCaseView id={id} attorneyId={session.user.id} />;
	}

	const c = await getOwnedCase(id, session.user.id);
	if (!c || c.deletedAt) notFound();

	// The owner is looking at the case, whose overview shows the attorney's
	// updates — so mark them seen (clears the bell) and load them for display.
	const [updates] = await Promise.all([
		listCaseUpdates(c.id),
		markCaseUpdatesSeenByOwner(c.id, session.user.id),
	]);

	const data: ManageCaseData = {
		id: c.id,
		title: c.title,
		category: c.category,
		location: c.location,
		summary: c.summary,
		story: c.story,
		status: c.status,
		goalCents: c.goalCents,
		raisedCents: c.raisedCents,
		donorsCount: c.donorsCount,
		viewsCount: c.viewsCount,
		sharesCount: c.sharesCount,
		coverImageUrl: c.coverImageUrl,
		images: c.images ?? [],
		attorneyName: c.attorneyName,
		attorneyFirm: c.attorneyFirm,
		attorneyArea: c.attorneyArea,
		attorneyLocation: c.attorneyLocation,
	};

	const badge =
		c.status === "live"
			? {
					text: "Live · Raising",
					cls: "bg-green-soft text-green-deep",
					dot: "bg-success",
				}
			: c.status === "seeking"
				? {
						text: "Seeking attorney",
						cls: "bg-brass-wash text-brass-deep",
						dot: "bg-brass-deep",
					}
				: {
						text: "Draft",
						cls: "bg-surface-2 text-ink-soft",
						dot: "bg-ink-soft",
					};

	return (
		<div className="flex flex-col gap-6">
			<div>
				<BackLink
					href={"/my-cases" as Route}
					label="Back to my cases"
					className="mb-3"
				/>
				<div className="flex flex-wrap items-center gap-3">
					<h2 className="font-extrabold text-[30px] text-ink tracking-[-0.02em]">
						{c.title || "Untitled case"}
					</h2>
					<span
						className={cn(
							"inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] px-3 py-1 font-mono font-semibold text-[11px] uppercase tracking-[0.06em]",
							badge.cls,
						)}
					>
						<span className={cn("size-1.5 rounded-full", badge.dot)} />
						{badge.text}
					</span>
					{/* Once live, the case has a public fundraiser page — let the owner
					    open it to see exactly what donors see. Opens in a new tab so the
					    manage view stays put. Only live cases have a public page (the
					    public route 404s otherwise). */}
					{c.status === "live" && (
						<a
							href={`/cases/${c.id}`}
							target="_blank"
							rel="noopener noreferrer"
							className={cn(
								buttonVariants({ variant: "outline", size: "sm" }),
								"ml-auto h-9",
							)}
						>
							<ExternalLink data-icon="inline-start" aria-hidden="true" />
							View public page
						</a>
					)}
				</div>
				<p className="mt-1.5 text-[14.5px] text-ink-soft">
					{c.status === "live"
						? "Manage your case, or view how your public fundraiser page looks to donors."
						: "Manage your case — edit the details, update images, or remove it."}
				</p>
			</div>

			<ManageCase
				data={data}
				updates={updates}
				updatesHighlightSince={c.ownerUpdatesSeenAt}
				viewerId={session.user.id}
			/>
		</div>
	);
}

/**
 * The attorney's view of a case they represent: post a broadcast update and read
 * the running list (JUS-33). `getMatchedCase` returns null for any case this
 * attorney isn't matched to, so a mistyped or someone else's id 404s here — the
 * same attachment rule the post action enforces.
 */
async function AttorneyCaseView({
	id,
	attorneyId,
}: {
	id: string;
	attorneyId: string;
}) {
	const c = await getMatchedCase(id, attorneyId);
	if (!c) notFound();

	const updates = await listCaseUpdates(id);
	const isLive = c.status === "live";
	const goal = c.goalCents / 100;
	const raised = c.raisedCents / 100;
	const pct = goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : 0;
	const paragraphs = c.story
		.split(/\n{2,}|\n/)
		.map((p) => p.trim())
		.filter(Boolean);

	return (
		<div className="flex flex-col gap-8">
			<div>
				<BackLink
					href={"/my-cases" as Route}
					label="Back to my cases"
					className="mb-3"
				/>
				<div className="flex flex-wrap items-center gap-3">
					<h2 className="font-extrabold text-[30px] text-ink tracking-[-0.02em]">
						{c.title || "Untitled case"}
					</h2>
					<span
						className={cn(
							"inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] px-3 py-1 font-mono font-semibold text-[11px] uppercase tracking-[0.06em]",
							isLive
								? "bg-green-soft text-green-deep"
								: "bg-brass-wash text-brass-deep",
						)}
					>
						<span
							className={cn(
								"size-1.5 rounded-full",
								isLive ? "bg-success" : "bg-brass-deep",
							)}
						/>
						{isLive ? "Live · Raising" : "Matched"}
					</span>
					{isLive && (
						<a
							href={`/cases/${c.id}`}
							target="_blank"
							rel="noopener noreferrer"
							className={cn(
								buttonVariants({ variant: "outline", size: "sm" }),
								"ml-auto h-9",
							)}
						>
							<ExternalLink data-icon="inline-start" aria-hidden="true" />
							View public page
						</a>
					)}
				</div>
				<p className="mt-1.5 text-[14.5px] text-ink-soft">
					{c.owner.name}'s case — review the details and post progress your
					backers can follow.
				</p>
			</div>

			{/* Overview — the case as it stands, so the attorney has the full picture,
			    not just a box to type in. */}
			<div className="grid items-start gap-8 lg:grid-cols-[1fr_320px]">
				<div className="flex flex-col gap-6">
					<div className="flex flex-wrap gap-1.5">
						<span className="rounded-[var(--radius-chip)] bg-brass-wash px-2.5 py-0.5 font-semibold text-[12px] text-brass-deep">
							{c.category || "Case"}
						</span>
						<span className="rounded-[var(--radius-chip)] border border-border px-2.5 py-0.5 text-[12px] text-ink-soft">
							{c.location || "—"}
						</span>
					</div>
					<div className="overflow-hidden rounded-[var(--radius-card-lg)] border border-border bg-surface-2">
						{c.coverImageUrl ? (
							// biome-ignore lint/performance/noImgElement: user-uploaded Blob cover, not a static asset
							<img
								src={c.coverImageUrl}
								alt=""
								className="aspect-[16/9] w-full object-cover"
							/>
						) : (
							<div className="flex aspect-[16/9] w-full items-center justify-center text-brass-deep/40">
								<Scale className="size-12" aria-hidden="true" />
							</div>
						)}
					</div>
					<section>
						<h3 className="mb-3 font-bold text-[18px] text-ink">The story</h3>
						<div className="flex flex-col gap-3 text-[15px] text-ink-soft leading-relaxed">
							{paragraphs.length > 0 ? (
								paragraphs.map((p, i) => (
									<p key={`${i}-${p.slice(0, 12)}`}>{p}</p>
								))
							) : (
								<p>{c.summary || "No story yet."}</p>
							)}
						</div>
					</section>
				</div>

				{/* Funding */}
				{/* Sticks below the shell's 64px sticky header (top-20 = 80px) so it
				    isn't clipped by it while scrolling. */}
				<aside className="flex flex-col gap-4 lg:sticky lg:top-20 lg:self-start">
					<div className="rounded-[var(--radius-card-lg)] border border-border bg-surface p-6 shadow-[var(--shadow-rest)]">
						{isLive && goal > 0 ? (
							<>
								<div className="flex items-center gap-4">
									{/* Progress ring — the same conic-gradient dial used on the
									    public case and manage screens. */}
									<div
										className="relative flex size-[76px] shrink-0 items-center justify-center rounded-full"
										style={{
											background: `conic-gradient(var(--success) ${pct * 3.6}deg, var(--surface-2) 0)`,
										}}
									>
										<div className="flex size-[60px] flex-col items-center justify-center rounded-full bg-surface text-center">
											<span className="font-extrabold text-[15px] text-ink tabular-nums leading-none">
												{pct}%
											</span>
											<span className="text-[9px] text-muted-foreground">
												funded
											</span>
										</div>
									</div>
									<div className="min-w-0">
										<p className="font-extrabold text-[22px] text-ink tabular-nums leading-tight tracking-[-0.02em]">
											{money(raised)}{" "}
											<span className="font-semibold text-[14px] text-muted-foreground">
												raised
											</span>
										</p>
										<p className="text-[13.5px] text-muted-foreground">
											of {money(goal)} goal
										</p>
										<p className="mt-0.5 text-[12.5px] text-muted-foreground">
											{c.donorsCount} {c.donorsCount === 1 ? "donor" : "donors"}
										</p>
									</div>
								</div>
								<p className="mt-4 border-border border-t pt-3 text-[12.5px] text-muted-foreground">
									{c.viewsCount} {c.viewsCount === 1 ? "view" : "views"}
								</p>
							</>
						) : (
							<>
								<p className="font-bold text-[16px] text-ink">
									{goal > 0 ? `${money(goal)} goal` : "Goal not set yet"}
								</p>
								<p className="mt-1 text-[13px] text-muted-foreground leading-relaxed">
									Funding starts once {c.owner.name.split(" ")[0]} publishes
									this case live.
								</p>
							</>
						)}
					</div>
				</aside>
			</div>

			{/* Updates */}
			<div>
				<h3 className="mb-3 font-bold text-[18px] text-ink">Case updates</h3>
				<div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
					<CaseUpdateComposer
						caseId={c.id}
						authorName={c.attorneyName ?? "You"}
						authorTone="brass"
						placeholder={`Post an update for ${c.owner.name.split(/\s+/)[0]} and their backers…`}
					/>

					<div className="flex flex-col gap-3">
						<div className="flex items-center gap-2">
							<h4 className="flex items-center gap-2 font-bold text-[15px] text-ink">
								Posted updates
								{updates.length > 0 && (
									<span className="inline-flex min-w-5 items-center justify-center rounded-full bg-surface-2 px-1.5 py-0.5 font-bold text-[11px] text-ink-soft">
										{updates.length}
									</span>
								)}
							</h4>
							{updates.length > 0 && (
								<Link
									href={`/my-cases/${c.id}/updates` as Route}
									className="ml-auto inline-flex items-center gap-1.5 font-semibold text-[13px] text-brass-deep transition-colors hover:text-brass"
								>
									View all updates
									<ArrowRight className="size-3.5" aria-hidden="true" />
								</Link>
							)}
						</div>
						<CaseUpdates
							updates={updates}
							viewerId={attorneyId}
							viewerRole="attorney"
							caseId={c.id}
							emptyHint="No updates yet — your first post will appear here and reach every backer."
							limit={2}
						/>
					</div>
				</div>
			</div>
		</div>
	);
}

function money(n: number) {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		maximumFractionDigits: 0,
	}).format(n);
}
