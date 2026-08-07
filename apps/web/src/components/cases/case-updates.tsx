import { ArrowRight, Megaphone } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

import {
	type CaseUpdateItem,
	UpdateCard,
	type UpdateViewerRole,
} from "@/components/cases/update-card";

export type {
	CaseUpdateAuthorRole,
	CaseUpdateItem,
	UpdateViewerRole,
} from "@/components/cases/update-card";

/** Section a set of updates into recency buckets, preserving newest-first order. */
function groupByRecency(updates: CaseUpdateItem[]) {
	const startOfToday = new Date();
	startOfToday.setHours(0, 0, 0, 0);
	const dayMs = 86_400_000;
	const label = (d: Date) => {
		if (d.getTime() >= startOfToday.getTime()) return "Today";
		const days = Math.floor((startOfToday.getTime() - d.getTime()) / dayMs);
		if (days < 1) return "Yesterday";
		if (days < 7) return "Earlier this week";
		return "Earlier";
	};
	const groups: { label: string; items: CaseUpdateItem[] }[] = [];
	for (const u of updates) {
		const l = label(new Date(u.createdAt));
		const last = groups.at(-1);
		if (last && last.label === l) last.items.push(u);
		else groups.push({ label: l, items: [u] });
	}
	return groups;
}

/**
 * A case's broadcast updates (JUS-33), attributed to their real author — the
 * plaintiff or the matched attorney — each rendered by {@link UpdateCard} with a
 * role badge, optional category tag, attachments, an author-only edit affordance,
 * and a highlight on anything new since the reader last looked.
 *
 * `grouped` splits the list under recency headers for the full-page view; inline
 * surfaces leave it off and cap with `limit`.
 */
export function CaseUpdates({
	updates,
	viewerId,
	viewerRole,
	caseId,
	emptyHint,
	limit,
	viewAllHref,
	highlightSince,
	grouped = false,
}: {
	updates: CaseUpdateItem[];
	viewerId: string;
	viewerRole: UpdateViewerRole;
	/** The case these updates belong to — needed to save an edit. */
	caseId: string;
	emptyHint: string;
	limit?: number;
	viewAllHref?: Route;
	/** Highlight updates newer than this that the viewer didn't write (null = all
	 *  are new). Omit to disable. */
	highlightSince?: Date | string | null;
	grouped?: boolean;
}) {
	if (updates.length === 0) {
		return (
			<div className="flex items-center gap-2.5 rounded-[var(--radius-card)] border border-border border-dashed bg-surface/60 px-4 py-4 text-[13.5px] text-muted-foreground">
				<Megaphone className="size-4 shrink-0" aria-hidden="true" />
				{emptyHint}
			</div>
		);
	}

	const shown = typeof limit === "number" ? updates.slice(0, limit) : updates;
	const hidden = updates.length - shown.length;

	const highlightOn = highlightSince !== undefined;
	const sinceMs = highlightSince ? new Date(highlightSince).getTime() : null;
	const isNew = (u: CaseUpdateItem) =>
		highlightOn &&
		u.authorId !== viewerId &&
		(sinceMs === null || new Date(u.createdAt).getTime() > sinceMs);

	const card = (u: CaseUpdateItem) => (
		<UpdateCard
			key={u.id}
			u={u}
			viewerId={viewerId}
			viewerRole={viewerRole}
			caseId={caseId}
			isNew={isNew(u)}
		/>
	);

	const viewAll = viewAllHref && (
		<Link
			href={viewAllHref}
			className="inline-flex items-center gap-1.5 self-start font-semibold text-[13px] text-brass-deep transition-colors hover:text-brass"
		>
			{hidden > 0 ? `View all ${updates.length} updates` : "View all updates"}
			<ArrowRight className="size-3.5" aria-hidden="true" />
		</Link>
	);

	if (grouped) {
		return (
			<div className="flex flex-col gap-6">
				{groupByRecency(shown).map((g) => (
					<section key={g.label} className="flex flex-col gap-3">
						<p className="font-mono font-semibold text-[11px] text-muted-foreground uppercase tracking-[0.1em]">
							{g.label}
						</p>
						{g.items.map(card)}
					</section>
				))}
				{viewAll}
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-4">
			{shown.map(card)}
			{viewAll}
		</div>
	);
}
