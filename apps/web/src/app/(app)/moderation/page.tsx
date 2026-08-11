import { listConversationReports } from "@just-us/db/messages";
import {
	listModerationQueue,
	listResolvedModerationFlags,
	moderationWeeklyStats,
} from "@just-us/db/moderation";
import { cn } from "@just-us/ui/lib/utils";
import { CircleCheck, Flag, ShieldCheck } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

import { ModerationFlags } from "@/components/dashboard/moderation-flags";
import { ReportedConversationCard } from "@/components/messages/reported-conversation-card";
import { requirePermission } from "@/lib/auth-server";

const CATEGORY_LABEL: Record<string, string> = {
	defamation: "Defamation",
	frivolous: "Frivolous",
	sensitive: "Sensitive",
	pii: "Third-party PII",
	report: "Public report",
};

const TABS = [
	{ value: "review", label: "Needs review" },
	{ value: "resolved", label: "Resolved" },
] as const;

export default async function ModerationPage({
	searchParams,
}: {
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
	await requirePermission("moderation:review");
	const sp = await searchParams;
	const tab = typeof sp.tab === "string" ? sp.tab : "review";

	const [flags, reports, resolved, week] = await Promise.all([
		listModerationQueue(),
		listConversationReports(),
		listResolvedModerationFlags(30),
		moderationWeeklyStats(new Date()),
	]);

	const openReports = reports.filter((r) => r.status === "open");
	const counts = { review: flags.length };
	// Conversation reports sit alongside the flagged content on the review tab;
	// the Resolved tab is content-only.
	const showConversations = tab === "review";

	return (
		<div className="flex flex-col gap-6">
			<div>
				<p className="max-w-[680px] text-[14.5px] text-ink-soft leading-relaxed">
					Cases go live instantly. When the community reports a campaign, an
					update, or a conversation, it's held here for your ruling — you decide
					what stays and what comes down.
				</p>
			</div>

			{/* Filter tabs */}
			<div className="flex flex-wrap gap-2">
				{TABS.map((t) => {
					const active = tab === t.value;
					const count =
						t.value === "resolved"
							? undefined
							: counts[t.value as keyof typeof counts];
					return (
						<Link
							key={t.value}
							href={
								(t.value === "review"
									? "/moderation"
									: `/moderation?tab=${t.value}`) as Route
							}
							className={cn(
								"inline-flex items-center gap-2 rounded-[var(--radius-pill)] px-4 py-1.5 font-semibold text-[13px] transition-colors",
								active
									? "bg-ink text-surface"
									: "bg-surface-2 text-ink-soft hover:text-ink",
							)}
						>
							{t.label}
							{typeof count === "number" && (
								<span
									className={cn(
										"font-mono text-[11px]",
										active ? "text-surface/70" : "text-muted-foreground",
									)}
								>
									{count}
								</span>
							)}
						</Link>
					);
				})}
			</div>

			<div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
				{/* Main column */}
				<div className="flex flex-col gap-8">
					{tab === "resolved" ? (
						<section>
							<h2 className="mb-4 font-bold text-[18px] text-ink">
								Recently resolved
							</h2>
							{resolved.length === 0 ? (
								<p className="rounded-[var(--radius-card)] bg-paper-alt px-4 py-8 text-center text-[13px] text-muted-foreground">
									Nothing has been resolved yet.
								</p>
							) : (
								<div className="overflow-hidden rounded-[var(--radius-card-lg)] border border-border bg-surface shadow-[var(--shadow-rest)]">
									<ul className="divide-y divide-border">
										{resolved.map((r) => (
											<li
												key={r.id}
												className="flex items-center justify-between gap-4 px-5 py-3.5"
											>
												<span className="min-w-0">
													<Link
														href={`/moderation/campaigns/${r.caseId}` as Route}
														className="block truncate font-semibold text-[14px] text-ink hover:text-brass-deep"
													>
														{r.caseTitle}
													</Link>
													<span className="text-[12px] text-muted-foreground">
														Reported ·{" "}
														{CATEGORY_LABEL[r.category] ?? r.category}
													</span>
												</span>
												<span
													className={cn(
														"shrink-0 rounded-[var(--radius-pill)] px-2.5 py-0.5 font-semibold text-[11px]",
														r.resolution === "removed"
															? "bg-danger/10 text-danger"
															: "bg-green-soft text-green-deep",
													)}
												>
													{r.resolution === "removed" ? "Removed" : "Kept"}
												</span>
											</li>
										))}
									</ul>
								</div>
							)}
						</section>
					) : (
						<section>
							<h2 className="mb-4 font-bold text-[18px] text-ink">
								Reported campaigns &amp; updates
							</h2>
							<ModerationFlags flags={flags} />
						</section>
					)}

					{showConversations && (
						<section>
							<h2 className="mb-4 font-bold text-[18px] text-ink">
								Reported conversations
							</h2>
							{openReports.length === 0 ? (
								<p className="rounded-[var(--radius-card)] bg-paper-alt px-4 py-8 text-center text-[13px] text-muted-foreground">
									No reported conversations right now.
								</p>
							) : (
								<div className="flex flex-col gap-4">
									{openReports.map((r) => (
										<ReportedConversationCard
											key={r.id}
											r={{
												reportId: r.id,
												conversationId: r.conversation.id,
												plaintiffName: r.conversation.plaintiff.name,
												attorneyName: r.conversation.attorney.name,
												category: r.category,
												reason: r.reason,
												status: r.status,
											}}
										/>
									))}
								</div>
							)}
						</section>
					)}
				</div>

				{/* Sidebar */}
				<aside className="flex flex-col gap-4">
					<div className="rounded-[var(--radius-card-lg)] border border-border bg-surface p-5 shadow-[var(--shadow-rest)]">
						<p className="font-mono font-semibold text-[11px] text-muted-foreground uppercase tracking-[0.1em]">
							This week
						</p>
						<ul className="mt-4 flex flex-col gap-3.5">
							<StatRow icon={Flag} value={week.reported} label="reported" />
							<StatRow
								icon={CircleCheck}
								value={week.resolved}
								label="resolved"
							/>
						</ul>
						<div className="mt-4 border-border border-t pt-3 text-[12px] text-muted-foreground">
							Median time to a ruling:{" "}
							<span className="font-semibold text-ink">
								{week.medianHours === null
									? "—"
									: `${week.medianHours.toFixed(1)} hours`}
							</span>
						</div>
					</div>

					<div className="rounded-[var(--radius-card-lg)] border border-green-deep/20 bg-green-soft/60 p-5">
						<p className="flex items-center gap-2 font-bold text-[13.5px] text-green-deep">
							<ShieldCheck className="size-4" aria-hidden="true" />
							How moderation works
						</p>
						<p className="mt-2 text-[12.5px] text-ink-soft leading-relaxed">
							You review every report. Nothing is auto-removed, every ruling is
							logged to the audit trail, and users are notified of the outcome.
						</p>
					</div>
				</aside>
			</div>
		</div>
	);
}

function StatRow({
	icon: Icon,
	value,
	label,
}: {
	icon: typeof Flag;
	value: number;
	label: string;
}) {
	return (
		<li className="flex items-center gap-3">
			<span className="flex size-8 items-center justify-center rounded-full bg-surface-2 text-ink-soft">
				<Icon className="size-4" aria-hidden="true" />
			</span>
			<span className="font-extrabold text-[18px] text-ink tabular-nums leading-none">
				{value}
			</span>
			<span className="text-[13px] text-ink-soft">{label}</span>
		</li>
	);
}
