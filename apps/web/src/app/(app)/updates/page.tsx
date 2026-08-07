// biome-ignore-all lint/performance/noImgElement: case covers are user-uploaded Blob URLs, not static assets
import type { Role } from "@just-us/auth";
import {
	type BackerUpdate,
	type CaseUpdateGroup,
	listCaseUpdateGroupsForOwner,
	listUpdatesForBacker,
	markAllCaseUpdatesSeenByOwner,
} from "@just-us/db/case-updates";
import { cn } from "@just-us/ui/lib/utils";
import { ArrowRight, Megaphone, Scale } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ScreenPlaceholder } from "@/components/dashboard/screen-placeholder";
import { TimeAgo } from "@/components/time-ago";
import { requireOnboarded } from "@/lib/auth-server";
import { findScreen } from "@/lib/dashboard-nav";

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

export default async function UpdatesPage() {
	const session = await requireOnboarded();
	const role = ((session.user as { role?: Role }).role ?? "donor") as Role;

	if (role === "donor") {
		const updates = await listUpdatesForBacker(session.user.id);
		return (
			<UpdatesFeed
				updates={updates}
				intro="The latest from the cases you're backing."
				emptyText="Back a case and its attorney's progress updates will show up here."
				hrefFor={(caseId) => `/discover/${caseId}` as Route}
			/>
		);
	}

	if (role === "plaintiff") {
		// Opening the aggregate feed is seeing every update, so clear them all from
		// the bell and card tags as they're read.
		const [groups] = await Promise.all([
			listCaseUpdateGroupsForOwner(session.user.id, 2),
			markAllCaseUpdatesSeenByOwner(session.user.id),
		]);

		return (
			<div className="flex flex-col gap-6">
				<p className="max-w-[640px] text-[14.5px] text-ink-soft leading-relaxed">
					Every update your attorney posts, grouped by case.
				</p>
				{groups.length === 0 ? (
					<div className="flex flex-col items-center gap-3 rounded-[var(--radius-card-lg)] border border-border border-dashed bg-surface px-6 py-16 text-center">
						<span className="flex size-12 items-center justify-center rounded-xl bg-brass-wash text-brass-deep">
							<Megaphone className="size-6" aria-hidden="true" />
						</span>
						<p className="font-bold text-[16px] text-ink">No updates yet</p>
						<p className="max-w-[44ch] text-[13.5px] text-muted-foreground leading-relaxed">
							When your attorney posts progress on one of your cases, it'll show
							up here.
						</p>
					</div>
				) : (
					<div className="flex max-w-[760px] flex-col gap-5">
						{groups.map((group) => (
							<CaseUpdateGroupCard key={group.caseId} group={group} />
						))}
					</div>
				)}
			</div>
		);
	}

	// Any other role keeps its placeholder screen.
	const screen = findScreen(role, "updates");
	if (!screen) redirect("/home");
	return <ScreenPlaceholder sub={screen.sub} />;
}

/** One case's recent updates, under a header that identifies the case and links
 *  to its full updates page. */
function CaseUpdateGroupCard({ group }: { group: CaseUpdateGroup }) {
	const href = `/my-cases/${group.caseId}/updates` as Route;
	const meta = [group.category, group.location].filter(Boolean).join(" · ");
	const remaining = group.total - group.updates.length;

	return (
		<section className="overflow-hidden rounded-[var(--radius-card-lg)] border border-border bg-surface shadow-[var(--shadow-rest)]">
			<div className="flex items-center gap-3 border-border border-b px-5 py-4">
				<span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-card-sm)] bg-surface-2 text-brass-deep">
					{group.coverImageUrl ? (
						<img
							src={group.coverImageUrl}
							alt=""
							className="size-full object-cover"
						/>
					) : (
						<Scale className="size-5" aria-hidden="true" />
					)}
				</span>
				<div className="min-w-0 flex-1">
					<Link
						href={href}
						className="block truncate font-bold text-[15px] text-ink hover:text-brass-deep hover:underline"
					>
						{group.title}
					</Link>
					<p className="truncate text-[12.5px] text-muted-foreground">
						{meta ? `${meta} · ` : ""}
						{group.total} {group.total === 1 ? "update" : "updates"}
					</p>
				</div>
				<Link
					href={href}
					className="inline-flex shrink-0 items-center gap-1.5 font-semibold text-[13px] text-brass-deep transition-colors hover:text-brass"
				>
					View all
					<ArrowRight className="size-3.5" aria-hidden="true" />
				</Link>
			</div>

			<ol className="divide-y divide-border">
				{group.updates.map((u) => (
					<li key={u.id} className="flex gap-3 px-5 py-4">
						<span
							className={cn(
								"mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full font-bold text-[11px] text-white",
								u.authorRole === "plaintiff" ? "bg-green-deep" : "bg-brass",
							)}
						>
							{initials(u.authorName)}
						</span>
						<div className="min-w-0 flex-1">
							<p className="font-mono text-[10.5px] text-muted-foreground uppercase tracking-[0.07em]">
								{u.authorName} · <TimeAgo date={u.createdAt} />
							</p>
							<p className="mt-1 whitespace-pre-wrap text-[14px] text-ink-soft leading-relaxed">
								{u.body}
							</p>
						</div>
					</li>
				))}
			</ol>

			{remaining > 0 && (
				<Link
					href={href}
					className="flex items-center justify-center gap-1.5 border-border border-t px-5 py-3 font-semibold text-[13px] text-brass-deep transition-colors hover:bg-surface-2"
				>
					View {remaining} more {remaining === 1 ? "update" : "updates"}
					<ArrowRight className="size-3.5" aria-hidden="true" />
				</Link>
			)}
		</section>
	);
}

/**
 * The shared "Case updates" feed — one attorney update per row, newest first,
 * each linking to where the full case lives. Used by the donor screen; the
 * plaintiff screen groups by case instead.
 */
function UpdatesFeed({
	updates,
	intro,
	emptyText,
	hrefFor,
}: {
	updates: BackerUpdate[];
	intro: string;
	emptyText: string;
	hrefFor: (caseId: string) => Route;
}) {
	return (
		<div className="flex flex-col gap-6">
			<p className="max-w-[640px] text-[14.5px] text-ink-soft leading-relaxed">
				{intro}
			</p>
			{updates.length === 0 ? (
				<div className="flex flex-col items-center gap-3 rounded-[var(--radius-card-lg)] border border-border border-dashed bg-surface px-6 py-16 text-center">
					<span className="flex size-12 items-center justify-center rounded-xl bg-brass-wash text-brass-deep">
						<Megaphone className="size-6" aria-hidden="true" />
					</span>
					<p className="font-bold text-[16px] text-ink">No updates yet</p>
					<p className="max-w-[44ch] text-[13.5px] text-muted-foreground leading-relaxed">
						{emptyText}
					</p>
				</div>
			) : (
				<ol className="flex max-w-[720px] flex-col gap-4">
					{updates.map((u) => (
						<li
							key={u.id}
							className="rounded-[var(--radius-card-lg)] border border-border bg-surface p-5 shadow-[var(--shadow-rest)]"
						>
							<div className="flex flex-wrap items-center justify-between gap-2">
								<Link
									href={hrefFor(u.caseId)}
									className="font-bold text-[14.5px] text-ink hover:text-brass-deep hover:underline"
								>
									{u.caseTitle}
								</Link>
								<span className="font-mono text-[10.5px] text-muted-foreground uppercase tracking-[0.07em]">
									{u.authorName} · <TimeAgo date={u.createdAt} />
								</span>
							</div>
							<div className="mt-2.5 whitespace-pre-wrap text-[14.5px] text-ink-soft leading-relaxed">
								{u.body}
							</div>
						</li>
					))}
				</ol>
			)}
		</div>
	);
}
