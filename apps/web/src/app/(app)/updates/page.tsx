import type { Role } from "@just-us/auth";
import {
	type BackerUpdate,
	type CaseUpdateGroup,
	listCaseUpdateGroupsForOwner,
	listUpdatesForBacker,
} from "@just-us/db/case-updates";
import { cn } from "@just-us/ui/lib/utils";
import {
	ArrowRight,
	Check,
	ChevronRight,
	Heart,
	Home,
	type LucideIcon,
	Megaphone,
	Plus,
	Scale,
	Wrench,
} from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { MarkAllUpdatesRead } from "@/components/dashboard/mark-all-updates-read";
import { ScreenPlaceholder } from "@/components/dashboard/screen-placeholder";
import { TimeAgo } from "@/components/time-ago";
import { requireOnboarded } from "@/lib/auth-server";
import { findScreen } from "@/lib/dashboard-nav";
import { TAG_TONE_CLASS, tagConfig } from "@/lib/update-tags";

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

/** The tinted category tile that fronts each case, matching the case cards
 *  elsewhere in the dashboard. */
const CAT_ICON: Record<string, { icon: LucideIcon; cls: string }> = {
	Employment: { icon: Scale, cls: "bg-brass-wash text-brass-deep" },
	"Wage & hours": { icon: Scale, cls: "bg-brass-wash text-brass-deep" },
	Housing: { icon: Home, cls: "bg-green-soft text-green-deep" },
	"Elder care": { icon: Heart, cls: "bg-gold-bright text-gold-bright-ink" },
	Medical: { icon: Plus, cls: "bg-green-soft text-green-deep" },
	"Consumer fraud": { icon: Wrench, cls: "bg-brass-wash text-brass-deep" },
	"Civil rights": { icon: Scale, cls: "bg-gold-bright text-gold-bright-ink" },
};
const DEFAULT_CAT = { icon: Scale, cls: "bg-brass-wash text-brass-deep" };

export default async function UpdatesPage({
	searchParams,
}: {
	searchParams?: Promise<{ tab?: string }>;
}) {
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
		const tab = (await searchParams)?.tab === "unread" ? "unread" : "all";
		// One latest update per case for the preview; the full timeline lives on
		// the case's own updates page. Deliberately NOT marking everything seen on
		// open — the unread badges persist until the plaintiff clears them with
		// "Mark all as read", or reads a case by opening it.
		const groups = await listCaseUpdateGroupsForOwner(session.user.id, 1);
		const unreadGroups = groups.filter((g) => g.unread > 0);
		const shown = tab === "unread" ? unreadGroups : groups;

		return (
			<div className="flex flex-col gap-6">
				<p className="text-[14.5px] text-ink-soft leading-relaxed">
					Every case with new activity, grouped by case. Open one to see the
					full timeline.
				</p>

				{groups.length === 0 ? (
					<EmptyUpdates />
				) : (
					<div className="flex flex-col gap-4">
						{/* Tabs + mark-all */}
						<div className="flex flex-wrap items-center justify-between gap-3">
							<div className="flex items-center gap-2">
								<TabLink
									href={"/updates" as Route}
									label="All cases"
									count={groups.length}
									active={tab === "all"}
								/>
								<TabLink
									href={"/updates?tab=unread" as Route}
									label="Unread"
									count={unreadGroups.length}
									active={tab === "unread"}
								/>
							</div>
							<MarkAllUpdatesRead hasUnread={unreadGroups.length > 0} />
						</div>

						{shown.length === 0 ? (
							<p className="rounded-[var(--radius-card-lg)] border border-border border-dashed bg-surface px-6 py-12 text-center text-[13.5px] text-muted-foreground">
								You're all caught up. No unread updates right now.
							</p>
						) : (
							<div className="flex flex-col gap-4">
								{shown.map((group) => (
									<CaseUpdateCard key={group.caseId} group={group} />
								))}
							</div>
						)}
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

/** A filter pill for the All / Unread tabs. */
function TabLink({
	href,
	label,
	count,
	active,
}: {
	href: Route;
	label: string;
	count: number;
	active: boolean;
}) {
	return (
		<Link
			href={href}
			aria-current={active ? "page" : undefined}
			className={cn(
				"inline-flex items-center gap-2 rounded-[var(--radius-pill)] px-3.5 py-1.5 font-semibold text-[13px] transition-colors",
				active
					? "bg-ink text-paper"
					: "text-ink-soft hover:bg-surface-2 hover:text-ink",
			)}
		>
			{label}
			<span
				className={cn(
					"font-bold text-[11.5px]",
					active ? "text-paper/70" : "text-muted-foreground",
				)}
			>
				{count}
			</span>
		</Link>
	);
}

/**
 * One case's activity at a glance: the case (linking to its full timeline), its
 * newest update as a preview, and a footer summarising how much there is.
 */
function CaseUpdateCard({ group }: { group: CaseUpdateGroup }) {
	const href = `/my-cases/${group.caseId}/updates` as Route;
	const cat = CAT_ICON[group.category] ?? DEFAULT_CAT;
	const Icon = cat.icon;
	const latest = group.updates[0] ?? null;
	const tag = latest ? tagConfig(latest.tag) : null;
	const meta = [group.category, group.location].filter(Boolean).join(" · ");

	return (
		<section className="overflow-hidden rounded-[var(--radius-card-lg)] border border-border bg-surface shadow-[var(--shadow-rest)]">
			{/* Header — the whole row opens the case's full timeline. */}
			<Link
				href={href}
				className="flex items-center gap-3 px-5 py-4 transition-colors hover:bg-surface-2/40"
			>
				<span
					className={cn(
						"flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-card-sm)]",
						cat.cls,
					)}
				>
					<Icon className="size-5" aria-hidden="true" />
				</span>
				<div className="min-w-0 flex-1">
					<p className="truncate font-bold text-[15px] text-ink">
						{group.title}
					</p>
					<p className="truncate text-[12.5px] text-muted-foreground">
						{meta || "—"}
					</p>
				</div>
				{group.unread > 0 ? (
					<span className="inline-flex shrink-0 items-center rounded-[var(--radius-pill)] bg-gold-bright px-2.5 py-1 font-mono font-semibold text-[10.5px] text-gold-bright-ink uppercase tracking-[0.06em]">
						{group.unread} new
					</span>
				) : (
					<span className="inline-flex shrink-0 items-center gap-1 rounded-[var(--radius-pill)] bg-green-soft px-2.5 py-1 font-mono font-semibold text-[10.5px] text-green-deep uppercase tracking-[0.06em]">
						<Check className="size-3" aria-hidden="true" />
						Up to date
					</span>
				)}
				<ChevronRight
					className="size-4 shrink-0 text-muted-foreground"
					aria-hidden="true"
				/>
			</Link>

			{/* Newest update, as a preview. */}
			{latest && (
				<div className="border-border border-t px-5 py-4">
					<div className="flex flex-wrap items-center justify-between gap-2">
						<span className="inline-flex min-w-0 items-center gap-2">
							<span
								className={cn(
									"flex size-8 shrink-0 items-center justify-center rounded-full font-bold text-[11px] text-white",
									latest.authorRole === "plaintiff"
										? "bg-green-deep"
										: "bg-brass",
								)}
							>
								{initials(latest.authorName)}
							</span>
							<span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
								<span className="font-bold text-[13px] text-ink">
									{latest.authorName}
								</span>
								<span className="rounded-[var(--radius-chip)] bg-surface-2 px-1.5 py-0.5 font-mono font-semibold text-[9.5px] text-ink-soft uppercase tracking-[0.06em]">
									{latest.authorRole === "plaintiff" ? "You" : "Attorney"}
								</span>
								<span className="text-[11.5px] text-muted-foreground">
									<TimeAgo date={latest.createdAt} />
								</span>
							</span>
						</span>
						{tag && (
							<span
								className={cn(
									"inline-flex shrink-0 items-center gap-1 rounded-[var(--radius-pill)] px-2.5 py-1 font-semibold text-[11px]",
									TAG_TONE_CLASS[tag.tone],
								)}
							>
								<tag.icon className="size-3.5" aria-hidden="true" />
								{tag.label}
							</span>
						)}
					</div>
					<p className="mt-2 line-clamp-2 whitespace-pre-wrap text-[14px] text-ink-soft leading-relaxed">
						{latest.body}
					</p>
				</div>
			)}

			{/* Footer — how much there is, and the way in. */}
			<div className="flex items-center justify-between gap-3 border-border border-t px-5 py-3">
				<span className="text-[12.5px] text-muted-foreground">
					{group.total} {group.total === 1 ? "update" : "updates"}
					{group.lastActivityAt ? (
						<>
							{" · last activity "}
							<TimeAgo date={group.lastActivityAt} />
						</>
					) : null}
				</span>
				<Link
					href={href}
					className="inline-flex shrink-0 items-center gap-1.5 font-semibold text-[13px] text-brass-deep transition-colors hover:text-brass"
				>
					View all updates
					<ArrowRight className="size-3.5" aria-hidden="true" />
				</Link>
			</div>
		</section>
	);
}

/** Shared empty state for the plaintiff feed. */
function EmptyUpdates() {
	return (
		<div className="flex flex-col items-center gap-3 rounded-[var(--radius-card-lg)] border border-border border-dashed bg-surface px-6 py-16 text-center">
			<span className="flex size-12 items-center justify-center rounded-xl bg-brass-wash text-brass-deep">
				<Megaphone className="size-6" aria-hidden="true" />
			</span>
			<p className="font-bold text-[16px] text-ink">No updates yet</p>
			<p className="max-w-[44ch] text-[13.5px] text-muted-foreground leading-relaxed">
				When your attorney posts progress on one of your cases, it'll show up
				here.
			</p>
		</div>
	);
}

/**
 * The donor "Case updates" feed — one attorney update per row, newest first,
 * each linking to where the full case lives. The plaintiff screen groups by case
 * instead.
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
