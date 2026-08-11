"use client";

import { Check, EyeOff, Flag } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { resolveModerationFlagAction } from "@/app/(app)/moderation/actions";
import { TimeAgo } from "@/components/time-ago";

export type QueueFlag = {
	id: string;
	targetType: string;
	targetId: string;
	caseId: string;
	source: string;
	aiGenerated: boolean;
	category: string;
	detail: string;
	confidence: number | null;
	createdAt: Date | string;
	caseTitle: string;
	caseCategory: string;
	caseLocation: string;
	ownerName: string;
	authorName: string | null;
	targetSnippet: string;
	targetModerationStatus: string;
	caseStatus: string;
};

export function ModerationFlags({ flags }: { flags: QueueFlag[] }) {
	if (flags.length === 0) {
		return (
			<p className="rounded-[var(--radius-card)] bg-paper-alt px-4 py-8 text-center text-[13px] text-muted-foreground">
				Nothing here right now — reported campaigns and updates will appear for
				your ruling.
			</p>
		);
	}
	return (
		<div className="flex flex-col gap-4">
			{flags.map((f) => (
				<FlagCard key={f.id} flag={f} />
			))}
		</div>
	);
}

function FlagCard({ flag: f }: { flag: QueueFlag }) {
	const [pending, startTransition] = useTransition();
	const [done, setDone] = useState(false);
	const reviewHref = `/moderation/campaigns/${f.caseId}` as Route;

	function resolve(resolution: "cleared" | "removed", success: string) {
		startTransition(async () => {
			const res = await resolveModerationFlagAction({
				flagId: f.id,
				resolution,
			});
			if (res.ok) {
				setDone(true);
				toast.success(success);
			} else {
				toast.error(res.error);
			}
		});
	}

	if (done) return null;

	const isUpdate = f.targetType === "update";
	const meta = isUpdate
		? [
				f.authorName ? `Posted by ${f.authorName}` : "Update",
				undefined, // time rendered separately
			]
		: [f.caseCategory, f.caseLocation, `by ${f.ownerName}`].filter(Boolean);

	return (
		<article className="rounded-[var(--radius-card-lg)] border border-border bg-surface p-6 shadow-[var(--shadow-rest)]">
			<div className="flex items-start justify-between gap-3">
				<div className="flex flex-wrap items-center gap-2">
					<span className="rounded-[var(--radius-pill)] border border-border px-2.5 py-0.5 font-mono font-semibold text-[10.5px] text-ink-soft uppercase tracking-[0.08em]">
						{isUpdate ? "Update" : "Campaign"}
					</span>
					<span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] bg-danger/10 px-2.5 py-0.5 font-semibold text-[10.5px] text-danger uppercase tracking-[0.06em]">
						<Flag className="size-3" aria-hidden="true" />
						Reported
					</span>
				</div>
				<span className="shrink-0 font-mono text-[11px] text-muted-foreground uppercase tracking-[0.04em]">
					<TimeAgo date={f.createdAt} />
				</span>
			</div>

			<Link
				href={reviewHref}
				className="mt-3 block font-bold text-[18px] text-ink leading-snug tracking-[-0.01em] hover:text-brass-deep"
			>
				{isUpdate ? `Update on “${f.caseTitle}”` : f.caseTitle}
			</Link>

			{/* Why it was reported. */}
			<div className="mt-3 flex gap-2.5 rounded-[var(--radius-card)] bg-brass-wash/60 px-4 py-3 text-[14px] text-ink-soft leading-relaxed">
				<Flag
					className="mt-0.5 size-4 shrink-0 text-danger"
					aria-hidden="true"
				/>
				<span>{f.detail}</span>
			</div>

			{f.targetSnippet && (
				<p className="mt-3 text-[14px] text-ink-soft leading-relaxed">
					“{f.targetSnippet}”
				</p>
			)}

			<p className="mt-3 text-[12.5px] text-muted-foreground">
				{meta.filter(Boolean).join(" · ")}
			</p>

			<div className="mt-5 flex items-center gap-2.5">
				<button
					type="button"
					disabled={pending}
					onClick={() => resolve("cleared", "Kept visible.")}
					className="inline-flex items-center gap-2 rounded-[var(--radius-control)] bg-green-deep px-4 py-2 font-semibold text-[13.5px] text-white transition-colors hover:bg-green-deep/90 disabled:opacity-60"
				>
					<Check className="size-4" aria-hidden="true" />
					Keep visible
				</button>
				<button
					type="button"
					disabled={pending}
					onClick={() => resolve("removed", "Taken down.")}
					className="inline-flex items-center gap-2 rounded-[var(--radius-control)] border border-danger/50 px-4 py-2 font-semibold text-[13.5px] text-danger transition-colors hover:bg-danger/5 disabled:opacity-60"
				>
					<EyeOff className="size-4" aria-hidden="true" />
					Take down
				</button>
				<button
					type="button"
					disabled={pending}
					onClick={() => resolve("cleared", "Flag dismissed.")}
					className="ml-auto text-[13px] text-muted-foreground transition-colors hover:text-ink disabled:opacity-60"
				>
					Dismiss flag
				</button>
			</div>
		</article>
	);
}
