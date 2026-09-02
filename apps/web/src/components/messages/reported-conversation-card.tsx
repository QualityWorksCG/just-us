"use client";

import { cn } from "@just-us/ui/lib/utils";
import { ArrowLeftRight, Ban, Eye, TriangleAlert } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
	blockReportedUserAction,
	resolveReportAction,
	warnReportedUserAction,
} from "@/app/(app)/moderation/actions";

const CATEGORY_LABEL: Record<string, string> = {
	spam: "Spam",
	fraud: "Fraud or scam",
	harassment: "Harassment",
	inappropriate: "Inappropriate",
	other: "Other",
};

export type ReportedConversation = {
	reportId: string;
	conversationId: string;
	plaintiffName: string;
	attorneyName: string;
	category: string;
	reason: string;
	status: string;
};

/**
 * One reported conversation in the moderation queue — the two participants, the
 * reason, and the moderator's options: read the thread, warn, suspend, or dismiss.
 */
export function ReportedConversationCard({ r }: { r: ReportedConversation }) {
	const [pending, startTransition] = useTransition();
	const [done, setDone] = useState(false);
	const [armedSuspend, setArmedSuspend] = useState(false);

	function run(
		action: () => Promise<{ ok: boolean; error?: string }>,
		success: string,
	) {
		startTransition(async () => {
			const res = await action();
			if (res.ok) {
				setDone(true);
				toast.success(success);
			} else {
				toast.error(res.error ?? "Something went wrong.");
			}
		});
	}

	if (done) return null;

	return (
		<article className="rounded-[var(--radius-card-lg)] border border-border bg-surface p-5 shadow-[var(--shadow-rest)]">
			<div className="flex flex-wrap items-center gap-2.5">
				<span className="inline-flex items-center gap-1.5 font-bold text-[14.5px] text-ink">
					{r.plaintiffName}
					<ArrowLeftRight
						className="size-3.5 text-muted-foreground"
						aria-hidden="true"
					/>
					{r.attorneyName}
				</span>
				<span className="rounded-[var(--radius-pill)] bg-danger/10 px-2 py-0.5 font-semibold text-[11px] text-danger">
					{CATEGORY_LABEL[r.category] ?? r.category}
				</span>
				<span className="ml-auto rounded-[var(--radius-pill)] bg-gold-bright/20 px-2 py-0.5 font-mono font-semibold text-[10px] text-gold-bright-ink uppercase tracking-[0.06em]">
					{r.status}
				</span>
			</div>

			{r.reason && (
				<p className="mt-3 text-[14px] text-ink-soft italic leading-relaxed">
					“{r.reason}”
				</p>
			)}

			<div className="mt-4 flex flex-wrap items-center gap-2.5">
				<Link
					href={`/moderation/conversations/${r.conversationId}` as Route}
					className="inline-flex items-center gap-2 rounded-[var(--radius-control)] bg-ink px-4 py-2 font-semibold text-[13.5px] text-surface transition-colors hover:bg-ink/90"
				>
					<Eye className="size-4" aria-hidden="true" />
					Review thread
				</Link>
				<button
					type="button"
					disabled={pending}
					onClick={() =>
						run(
							() => warnReportedUserAction({ reportId: r.reportId }),
							"Warning sent.",
						)
					}
					className="inline-flex items-center gap-2 rounded-[var(--radius-control)] border border-border px-4 py-2 font-semibold text-[13.5px] text-ink transition-colors hover:border-brass-deep hover:text-brass-deep disabled:opacity-60"
				>
					<TriangleAlert className="size-4" aria-hidden="true" />
					Warn user
				</button>
				<button
					type="button"
					disabled={pending}
					onClick={() => {
						if (!armedSuspend) {
							setArmedSuspend(true);
							return;
						}
						run(
							() => blockReportedUserAction({ reportId: r.reportId }),
							"Account suspended.",
						);
					}}
					className={cn(
						"inline-flex items-center gap-2 rounded-[var(--radius-control)] border border-danger/50 px-4 py-2 font-semibold text-[13.5px] text-danger transition-colors hover:bg-danger/5 disabled:opacity-60",
					)}
				>
					<Ban className="size-4" aria-hidden="true" />
					{armedSuspend ? "Confirm suspend" : "Suspend"}
				</button>
				<button
					type="button"
					disabled={pending}
					onClick={() =>
						run(
							() =>
								resolveReportAction({
									reportId: r.reportId,
									resolution: "dismissed",
								}),
							"Report dismissed.",
						)
					}
					className="ml-auto text-[13px] text-muted-foreground transition-colors hover:text-ink disabled:opacity-60"
				>
					Dismiss
				</button>
			</div>
		</article>
	);
}
