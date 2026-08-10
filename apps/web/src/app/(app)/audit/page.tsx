import { countAuditEntries, listAuditEntries } from "@just-us/db/audit";
import { buttonVariants } from "@just-us/ui/components/button";
import { cn } from "@just-us/ui/lib/utils";
import { ArrowLeft, ArrowRight, ScrollText } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { requireAdministrator } from "@/lib/auth-server";

const PAGE_SIZE = 20;

/** Short phrases for the dot-namespaced actions in AUDIT_ACTIONS. */
const ACTION_LABELS: Record<string, string> = {
	"invite.created": "Invitation sent",
	"invite.resent": "Invitation resent",
	"invite.revoked": "Invitation revoked",
	"invite.accepted": "Invitation accepted",
	"invite.rejected_existing_account": "Invitation rejected — account exists",
	"user.blocked": "User blocked",
	"user.unblocked": "User unblocked",
	"user.role_changed": "Role changed",
	"attorney.verified": "Attorney verified",
	"attorney.verification_cleared": "Attorney verification cleared",
};

// `action` is a plain column, so an entry written by an older or newer build can
// carry a verb this screen has no label for. Fall back to reading the verb.
function actionLabel(action: string) {
	const known = ACTION_LABELS[action];
	if (known) return known;
	const words = action.replace(/[._]/g, " ");
	return words.charAt(0).toUpperCase() + words.slice(1);
}

function actionDot(action: string) {
	if (
		action === "invite.accepted" ||
		action === "user.unblocked" ||
		action === "attorney.verified"
	) {
		return "bg-success";
	}
	if (action === "user.blocked") return "bg-danger";
	if (action.startsWith("invite.")) return "bg-brass-deep";
	return "bg-ink-soft";
}

// Formatted on the server so the rendered string is what every viewer sees.
// Date and time are separate formatters because a combined en-GB format renders
// "30 Jul 2026 at 14:05" rather than the "30 Jul 2026, 14:05" this screen wants.
const dayFmt = new Intl.DateTimeFormat("en-GB", {
	day: "2-digit",
	month: "short",
	year: "numeric",
});
const timeFmt = new Intl.DateTimeFormat("en-GB", {
	hour: "2-digit",
	minute: "2-digit",
	hour12: false,
});

function stamp(date: Date) {
	return `${dayFmt.format(date)}, ${timeFmt.format(date)}`;
}

function ago(date: Date) {
	const s = Math.floor((Date.now() - date.getTime()) / 1000);
	if (s < 60) return "just now";
	const m = Math.floor(s / 60);
	if (m < 60) return `${m}m ago`;
	const h = Math.floor(m / 60);
	if (h < 24) return `${h}h ago`;
	return `${Math.floor(h / 24)}d ago`;
}

function metaString(metadata: unknown, key: string) {
	if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
		return null;
	}
	const value = (metadata as Record<string, unknown>)[key];
	return typeof value === "string" && value.length > 0 ? value : null;
}

const COLUMNS = "sm:grid-cols-[150px_200px_1.2fr_2fr]";
const HEAD =
	"font-mono font-semibold text-[10.5px] text-muted-foreground uppercase tracking-[0.06em]";

/** One grid cell, with the column name inlined on narrow screens. */
function Cell({ label, children }: { label: string; children: ReactNode }) {
	return (
		<div className="min-w-0">
			<span className={cn(HEAD, "mb-0.5 block sm:hidden")}>{label}</span>
			{children}
		</div>
	);
}

export default async function AuditLogPage({
	searchParams,
}: {
	searchParams: Promise<{ page?: string }>;
}) {
	await requireAdministrator();
	const sp = await searchParams;

	const total = await countAuditEntries();
	const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
	const requested = Number(sp?.page) || 1;
	const page = Math.min(Math.max(1, requested), totalPages);
	const entries = await listAuditEntries({
		skip: (page - 1) * PAGE_SIZE,
		take: PAGE_SIZE,
	});

	return (
		<div className="flex flex-col gap-6">
			<p className="max-w-[640px] text-[14.5px] text-ink-soft leading-relaxed">
				A record of administrative actions.
			</p>

			{entries.length === 0 ? (
				<div className="flex flex-col items-center gap-3 rounded-[var(--radius-card-lg)] border border-border bg-surface px-6 py-16 text-center shadow-[var(--shadow-rest)]">
					<span className="flex size-12 items-center justify-center rounded-xl bg-brass-wash text-brass-deep">
						<ScrollText className="size-6" aria-hidden="true" />
					</span>
					<p className="font-bold text-[16px] text-ink">
						No administrative actions yet.
					</p>
					<p className="max-w-[42ch] text-[13.5px] text-muted-foreground leading-relaxed">
						Every invite, block, unblock and role change lands here.
					</p>
				</div>
			) : (
				<div className="overflow-hidden rounded-[var(--radius-card-lg)] border border-border bg-surface shadow-[var(--shadow-rest)]">
					<div className={cn("hidden gap-x-4 px-5 py-3 sm:grid", COLUMNS)}>
						<span className={HEAD}>When</span>
						<span className={HEAD}>Actor</span>
						<span className={HEAD}>Action</span>
						<span className={HEAD}>Target</span>
					</div>

					{entries.map((e) => {
						const invitedEmail = metaString(e.metadata, "email");
						return (
							<div
								key={e.id}
								className={cn(
									"grid grid-cols-1 gap-x-4 gap-y-2.5 border-border border-t px-5 py-4 sm:gap-y-0",
									COLUMNS,
								)}
							>
								<Cell label="When">
									<p className="font-medium text-[12.5px] text-ink tabular-nums">
										{stamp(e.createdAt)}
									</p>
									<p className="mt-0.5 text-[11.5px] text-muted-foreground">
										{ago(e.createdAt)}
									</p>
								</Cell>

								<Cell label="Actor">
									<p className="truncate font-semibold text-[13.5px] text-ink">
										{e.actor.name}
									</p>
									<p className="truncate text-[11.5px] text-muted-foreground">
										{e.actor.email}
									</p>
								</Cell>

								<Cell label="Action">
									<span className="inline-flex items-center gap-2 font-semibold text-[13.5px] text-ink">
										<span
											className={cn(
												"size-1.5 shrink-0 rounded-full",
												actionDot(e.action),
											)}
										/>
										{actionLabel(e.action)}
									</span>
									{e.reason && (
										<p className="mt-0.5 text-[12px] text-muted-foreground leading-relaxed">
											{e.reason}
										</p>
									)}
								</Cell>

								<Cell label="Target">
									{e.targetType === "user" && e.targetId ? (
										<Link
											href={`/users/${e.targetId}` as Route}
											className="break-all font-mono text-[12px] text-brass-deep hover:underline"
										>
											{e.targetId}
										</Link>
									) : e.targetType === "invitation" ? (
										<p
											className={cn(
												"break-all",
												invitedEmail
													? "text-[13px] text-ink"
													: "font-mono text-[12px] text-ink-soft",
											)}
										>
											{invitedEmail ?? e.targetId ?? "—"}
										</p>
									) : (
										<p className="text-[13px] text-muted-foreground">—</p>
									)}
								</Cell>
							</div>
						);
					})}
				</div>
			)}

			{totalPages > 1 && (
				<div className="flex items-center justify-between border-border border-t pt-5">
					<Link
						href={`/audit?page=${page - 1}` as Route}
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
						href={`/audit?page=${page + 1}` as Route}
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
