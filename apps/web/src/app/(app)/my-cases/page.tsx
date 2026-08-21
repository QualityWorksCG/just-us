import { pendingInvitationsForCases } from "@just-us/db/case-invitations";
import { caseIdsWithUnseenUpdates } from "@just-us/db/case-updates";
import {
	type CaseFilter,
	caseCounts,
	countOwnedCases,
	listOwnedCases,
} from "@just-us/db/cases";
import { listAttorneyCases } from "@just-us/db/representation";
import { interestCountsByCase } from "@just-us/db/requests";
import { buttonVariants } from "@just-us/ui/components/button";
import { cn } from "@just-us/ui/lib/utils";
import {
	ArrowLeft,
	ArrowRight,
	Clock,
	FolderOpen,
	ImageIcon,
	MailCheck,
	Megaphone,
	Plus,
	Settings2,
	Trash2,
	UsersRound,
} from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

import { AttorneyCases } from "@/components/dashboard/attorney-cases";
import { DeleteDraftButton } from "@/components/dashboard/delete-draft-button";
import { requireRole } from "@/lib/auth-server";

const PAGE_SIZE = 6;

const TABS: { key: CaseFilter; label: string }[] = [
	{ key: "all", label: "All" },
	{ key: "active", label: "Active" },
	{ key: "draft", label: "Draft" },
	{ key: "seeking", label: "Seeking" },
	// Finished and sent, held back until the firm's payout account can receive.
	// Its own tab because these are the cases with someone to chase.
	{ key: "pending", label: "Awaiting firm" },
	{ key: "closed", label: "Closed" },
	{ key: "deleted", label: "Deleted" },
];

// Formatted on the server so every viewer reads the same date.
const dayFmt = new Intl.DateTimeFormat("en-US", {
	day: "numeric",
	month: "short",
});

function money(n: number) {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		maximumFractionDigits: 0,
	}).format(n);
}

function readinessOf(c: {
	story: string;
	attorneyName: string | null;
	goalCents: number;
	coverImageUrl: string | null;
	evidence: unknown;
}) {
	const evidenceCount = Array.isArray(c.evidence) ? c.evidence.length : 0;
	return (
		(c.story.trim().length >= 120 ? 25 : 0) +
		(c.attorneyName ? 25 : 0) +
		(c.goalCents > 0 ? 25 : 0) +
		(c.coverImageUrl ? 15 : 0) +
		(evidenceCount > 0 ? 10 : 0)
	);
}

function ProgressBar({ pct }: { pct: number }) {
	return (
		<div className="h-2 overflow-hidden rounded-full bg-surface-2">
			<div
				className="h-full rounded-full bg-brass"
				style={{ width: `${Math.max(2, Math.min(100, pct))}%` }}
			/>
		</div>
	);
}

function isFilter(v: string | undefined): v is CaseFilter {
	return (
		v === "all" ||
		v === "active" ||
		v === "draft" ||
		v === "seeking" ||
		v === "pending" ||
		v === "closed" ||
		v === "deleted"
	);
}

export default async function MyCasesPage({
	searchParams,
}: {
	searchParams: Promise<{ page?: string; filter?: string }>;
}) {
	// Both roles have a "My cases" nav entry pointing here, and they mean different
	// things: the plaintiff's own cases below, and the cases an attorney is acting
	// on. Before this route was flattened the attorney's link hit a plaintiff-only
	// page and bounced them to their home.
	const { session, role } = await requireRole("plaintiff", "attorney");
	if (role === "attorney") {
		return (
			<AttorneyCases
				cases={
					await listAttorneyCases({
						userId: session.user.id,
						email: session.user.email,
					})
				}
			/>
		);
	}

	const sp = await searchParams;

	const filter: CaseFilter = isFilter(sp?.filter) ? sp.filter : "all";
	const counts = await caseCounts(session.user.id);

	const total = await countOwnedCases(session.user.id, filter);
	const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
	const requested = Number(sp?.page) || 1;
	const page = Math.min(Math.max(1, requested), totalPages);
	const cases = await listOwnedCases(session.user.id, {
		skip: (page - 1) * PAGE_SIZE,
		take: PAGE_SIZE,
		filter,
	});
	// Expressions of interest per case, so a "seeking" card says how many
	// attorneys have come forward rather than just that it's out there (JUS-25).
	const interests = await interestCountsByCase(session.user.id);
	// Cases with an attorney update the owner hasn't opened yet — tagged on the
	// card so a new update is visible without drilling in (JUS-33).
	const casesWithNewUpdate = await caseIdsWithUnseenUpdates(session.user.id);
	// A `seeking` case whose named attorney hasn't answered is not in front of any
	// attorney at all, so it must not be reported as though it were. Only the cases
	// on this page are asked about.
	const pendingInvites = await pendingInvitationsForCases(
		cases.filter((c) => c.status === "seeking").map((c) => c.id),
	);

	return (
		<div className="flex flex-col gap-6">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div>
					{/* No heading — the shell's header bar carries the screen title. */}
					<p className="text-[14.5px] text-ink-soft">
						Every case you've started: draft, raising, or resolved.
					</p>
				</div>
				<Link
					href="/my-cases/new"
					className={cn(buttonVariants({ size: "lg" }), "px-5")}
				>
					<Plus data-icon="inline-start" aria-hidden="true" />
					Start a new case
				</Link>
			</div>

			{/* Filter tabs */}
			<div className="flex flex-wrap gap-2">
				{TABS.map((t) => {
					const active = t.key === filter;
					const count = counts[t.key];
					return (
						<Link
							key={t.key}
							href={
								(t.key === "all"
									? "/my-cases"
									: `/my-cases?filter=${t.key}`) as Route
							}
							aria-current={active ? "page" : undefined}
							className={cn(
								"inline-flex items-center gap-2 rounded-[var(--radius-pill)] border px-4 py-2 font-semibold text-[13px] transition-colors",
								active
									? "border-ink bg-ink text-paper"
									: "border-border bg-surface text-ink-soft hover:border-brass-deep hover:text-ink",
							)}
						>
							{t.label}
							<span
								className={cn(
									"inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 font-bold text-[11px]",
									active
										? "bg-paper/20 text-paper"
										: "bg-surface-2 text-ink-soft",
								)}
							>
								{count}
							</span>
						</Link>
					);
				})}
			</div>

			{cases.length === 0 ? (
				<div className="flex flex-col items-center gap-3 rounded-[var(--radius-card-lg)] border border-border bg-surface px-6 py-16 text-center shadow-[var(--shadow-rest)]">
					<span className="flex size-12 items-center justify-center rounded-xl bg-brass-wash text-brass-deep">
						<FolderOpen className="size-6" aria-hidden="true" />
					</span>
					<p className="font-bold text-[16px] text-ink">
						{filter === "deleted"
							? "Nothing deleted"
							: filter === "all"
								? "No cases yet"
								: `No ${filter} cases`}
					</p>
					<p className="max-w-[42ch] text-[13.5px] text-muted-foreground leading-relaxed">
						{filter === "deleted"
							? "Deleted cases stay here as a record. Deleting is permanent. A deleted case can't be restored."
							: "Start your first case: tell your story, choose your attorney, and raise the agreed fee."}
					</p>
					{filter !== "deleted" && (
						<Link
							href="/my-cases/new"
							className={cn(buttonVariants(), "mt-2 px-5")}
						>
							<Plus data-icon="inline-start" aria-hidden="true" />
							Start a new case
						</Link>
					)}
				</div>
			) : (
				<div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
					{cases.map((c) => {
						const goal = c.goalCents / 100;
						const raised = c.raisedCents / 100;
						const pct = goal > 0 ? Math.round((raised / goal) * 100) : 0;
						const isDeleted = !!c.deletedAt;
						const isLive = !isDeleted && c.status === "live";
						const isSeeking = !isDeleted && c.status === "seeking";
						// Finished and sent, waiting on the firm's payout account. Not a
						// draft: there is nothing left for the plaintiff to fill in, so
						// offering "Continue draft" would send them looking for work that
						// isn't theirs.
						const isPending = !isDeleted && c.status === "pending_payout";
						const isClosed = !isDeleted && c.status === "closed";
						const readiness = readinessOf(c);
						const meta = [c.category, c.location].filter(Boolean).join(" · ");
						const resume = `/cases/new?draft=${c.id}` as Route;
						// Waiting on one named attorney, not on the queue.
						const invite = isSeeking ? pendingInvites.get(c.id) : undefined;

						const badge = isDeleted
							? { text: "Deleted", dot: "bg-danger" }
							: isLive
								? { text: "Live", dot: "bg-success" }
								: isClosed
									? { text: "Closed", dot: "bg-ink-soft" }
									: invite
										? { text: "Invitation sent", dot: "bg-gold-bright" }
										: isSeeking
											? { text: "Seeking", dot: "bg-brass-deep" }
											: isPending
												? { text: "Awaiting firm", dot: "bg-gold-bright" }
												: { text: "Draft", dot: "bg-ink-soft" };
						const hasNewUpdate = !isDeleted && casesWithNewUpdate.has(c.id);

						return (
							<div
								key={c.id}
								className={cn(
									"flex flex-col overflow-hidden rounded-[var(--radius-card-lg)] border border-border bg-surface shadow-[var(--shadow-rest)]",
									isDeleted && "opacity-75",
								)}
							>
								{/* Cover — a fixed, compact height (not the image's own aspect),
								    so every card stays the same, sensible height regardless of the
								    uploaded photo's proportions. */}
								<div className="relative h-40 overflow-hidden bg-surface-2">
									{c.coverImageUrl ? (
										// biome-ignore lint/performance/noImgElement: user-uploaded Blob covers aren't static assets
										<img
											src={c.coverImageUrl}
											alt=""
											className={cn(
												"size-full object-cover",
												isDeleted && "grayscale",
											)}
										/>
									) : (
										<div className="flex size-full items-center justify-center text-muted-foreground">
											<ImageIcon className="size-8" aria-hidden="true" />
										</div>
									)}
									<span className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-surface/85 px-2.5 py-1 font-mono font-semibold text-[10px] text-ink uppercase tracking-[0.06em] backdrop-blur-sm">
										<span className={cn("size-1.5 rounded-full", badge.dot)} />
										{badge.text}
									</span>
									{hasNewUpdate && (
										<span className="absolute top-3 right-3 inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-gold-bright px-2.5 py-1 font-mono font-semibold text-[10px] text-gold-bright-ink uppercase tracking-[0.06em] shadow-[var(--shadow-rest)]">
											<Megaphone className="size-3" aria-hidden="true" />
											New update
										</span>
									)}
								</div>

								{/* Body */}
								<div className="flex flex-1 flex-col p-5">
									<h2 className="line-clamp-2 font-bold text-[17px] text-ink leading-snug">
										{c.title || "Untitled case"}
									</h2>
									<p className="mt-1 text-[12.5px] text-muted-foreground">
										{meta || "—"}
									</p>

									<div className="mt-3 flex-1">
										{isLive || isClosed ? (
											<>
												<ProgressBar pct={pct} />
												<p className="mt-2 font-medium text-[13px] text-ink tabular-nums">
													{money(raised)} of {money(goal)} · {c.donorsCount}{" "}
													donors
													{isClosed ? " · resolved" : ""}
												</p>
											</>
										) : invite ? (
											<p className="inline-flex items-start gap-1.5 text-[13px] text-ink-soft">
												<MailCheck
													className="mt-0.5 size-4 shrink-0 text-gold-bright-ink"
													aria-hidden="true"
												/>
												<span>
													Waiting on{" "}
													<span className="break-all font-medium text-ink">
														{invite.email}
													</span>{" "}
													to confirm. If they don't answer by{" "}
													{dayFmt.format(invite.expiresAt)}, other attorneys see
													it.
												</span>
											</p>
										) : isSeeking ? (
											<p className="inline-flex items-center gap-1.5 text-[13px] text-ink-soft">
												<UsersRound
													className="size-4 text-brass-deep"
													aria-hidden="true"
												/>
												{(interests[c.id]?.open ?? 0) > 0
													? `${interests[c.id]?.open} ${interests[c.id]?.open === 1 ? "attorney" : "attorneys"} interested`
													: "Out to attorneys"}
											</p>
										) : isPending ? (
											<p className="inline-flex items-start gap-1.5 text-[13px] text-ink-soft">
												<Clock
													className="mt-0.5 size-4 shrink-0 text-gold-bright-ink"
													aria-hidden="true"
												/>
												Ready to publish once{" "}
												{c.attorneyName ?? "your attorney"} finishes payout
												setup.
											</p>
										) : isDeleted ? (
											<p className="text-[13px] text-muted-foreground">
												Deleted. This can't be undone.
											</p>
										) : (
											<>
												<ProgressBar pct={readiness} />
												<p className="mt-2 text-[13px] text-muted-foreground">
													{readiness}% ready · not submitted
												</p>
											</>
										)}
									</div>

									{/* Footer: what this case needs next on the left, and — for
									    everything still in the plaintiff's hands — a way straight to
									    the editor on the right.

									    The two are separate because they were previously the same
									    control, and only a live case's version of it led anywhere
									    editable: a `seeking` card offered "Review interest" and a
									    draft "Continue draft", so the only route to a case's details
									    was to publish it first. The manage screen has always handled
									    every status — see the "Draft — not live yet" and "Out to
									    attorneys" states it renders — so this was never a permission
									    question, just a missing door. */}
									<div className="mt-4 flex items-center justify-between gap-3 border-border border-t pt-4">
										{isDeleted ? (
											<span className="inline-flex items-center gap-1.5 font-semibold text-[13px] text-muted-foreground">
												<Trash2 className="size-4" aria-hidden="true" />
												Permanently deleted
											</span>
										) : isLive || isClosed ? (
											<Link
												href={`/my-cases/${c.id}` as Route}
												className="inline-flex items-center gap-1.5 font-semibold text-[13px] text-brass-deep hover:underline"
											>
												{isClosed ? "View case" : "Manage campaign"}
												<ArrowRight className="size-3.5" aria-hidden="true" />
											</Link>
										) : invite ? (
											// No expressions of interest can arrive while an invitation
											// is open, so the requests inbox would be an empty room.
											// The wizard is where the invitation itself is managed —
											// resend it, or send it to a different address.
											<Link
												href={resume}
												className="inline-flex items-center gap-1.5 font-semibold text-[13px] text-brass-deep hover:underline"
											>
												Manage invitation
												<ArrowRight className="size-3.5" aria-hidden="true" />
											</Link>
										) : isSeeking ? (
											<Link
												href={`/my-cases/${c.id}/requests` as Route}
												className="inline-flex items-center gap-1.5 font-semibold text-[13px] text-brass-deep hover:underline"
											>
												{(interests[c.id]?.unseen ?? 0) > 0
													? `Review ${interests[c.id]?.unseen} new`
													: "Review interest"}
												<ArrowRight className="size-3.5" aria-hidden="true" />
											</Link>
										) : isPending ? (
											// Back into the wizard, which lands on the review step and
											// carries the payout step's account status behind it.
											<Link
												href={resume}
												className="inline-flex items-center gap-1.5 font-semibold text-[13px] text-brass-deep hover:underline"
											>
												Check &amp; publish
												<ArrowRight className="size-3.5" aria-hidden="true" />
											</Link>
										) : (
											<Link
												href={resume}
												className="inline-flex items-center gap-1.5 font-semibold text-[13px] text-brass-deep hover:underline"
											>
												Continue draft
												<ArrowRight className="size-3.5" aria-hidden="true" />
											</Link>
										)}

										{!isDeleted && (
											<div className="flex shrink-0 items-center gap-1">
												{/* Straight to the editor rather than the case's overview:
												    a gear that lands on a stats panel has answered a
												    question nobody asked it. Icon-only, so the accessible
												    name carries the case title — a screen reader hearing
												    six "Edit case" links in a grid learns nothing about
												    which is which. */}
												<Link
													href={`/my-cases/${c.id}?tab=edit` as Route}
													title="Edit case details"
													aria-label={`Edit ${c.title || "untitled case"}`}
													className="inline-flex size-8 items-center justify-center rounded-[var(--radius-control)] text-muted-foreground transition-colors hover:bg-surface-2 hover:text-ink"
												>
													<Settings2 className="size-4" aria-hidden="true" />
												</Link>
												{!isLive && !isSeeking && !isPending && !isClosed && (
													<DeleteDraftButton
														id={c.id}
														title={c.title || undefined}
													/>
												)}
											</div>
										)}
									</div>
								</div>
							</div>
						);
					})}
				</div>
			)}

			{totalPages > 1 && (
				<div className="flex items-center justify-between border-border border-t pt-5">
					<Link
						href={`/my-cases?filter=${filter}&page=${page - 1}` as Route}
						aria-disabled={page <= 1}
						className={cn(
							buttonVariants({ variant: "outline", size: "sm" }),
							"h-9",
							page <= 1 && "pointer-events-none opacity-40",
						)}
					>
						<ArrowLeft data-icon="inline-start" aria-hidden="true" />
						Previous
					</Link>
					<span className="text-[13px] text-muted-foreground">
						Page {page} of {totalPages}
					</span>
					<Link
						href={`/my-cases?filter=${filter}&page=${page + 1}` as Route}
						aria-disabled={page >= totalPages}
						className={cn(
							buttonVariants({ variant: "outline", size: "sm" }),
							"h-9",
							page >= totalPages && "pointer-events-none opacity-40",
						)}
					>
						Next
						<ArrowRight data-icon="inline-end" aria-hidden="true" />
					</Link>
				</div>
			)}
		</div>
	);
}
