"use client";

import { buttonVariants } from "@just-us/ui/components/button";
import { cn } from "@just-us/ui/lib/utils";
import { ArrowRight, Inbox } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useState } from "react";

/**
 * The "Your requests" tab of the Intake requests screen (JUS-25).
 *
 * Two directions of request meet here, kept clearly apart:
 *   - New          — a plaintiff invited THIS attorney to represent them and is
 *                    waiting on their decision. Incoming and actionable: Review
 *                    opens the accept/decline flow.
 *   - Interest sent— expressions of interest the attorney sent OUT on open
 *                    intakes, awaiting the plaintiff's decision. Read-only.
 *   - Accepted     — taken forward with them; opens to My intakes.
 *   - Declined     — a plaintiff went another way. Kept as a record.
 */

export type ExpressionIntake = {
	id: string;
	caseId: string;
	title: string;
	category: string;
	state: string;
};

export type InvitationItem = {
	id: string;
	caseId: string;
	title: string;
	category: string;
	state: string;
	plaintiffName: string;
};

type Filter = "new" | "sent" | "accepted" | "declined";

export function YourRequests({
	invitations,
	awaiting,
	accepted,
	declined,
}: {
	invitations: InvitationItem[];
	awaiting: ExpressionIntake[];
	accepted: ExpressionIntake[];
	declined: ExpressionIntake[];
}) {
	const [filter, setFilter] = useState<Filter>("new");

	const counts: Record<Filter, number> = {
		new: invitations.length,
		sent: awaiting.length,
		accepted: accepted.length,
		declined: declined.length,
	};

	const FILTERS: { key: Filter; label: string }[] = [
		{ key: "new", label: "New" },
		{ key: "sent", label: "Interest sent" },
		{ key: "accepted", label: "Accepted" },
		{ key: "declined", label: "Declined" },
	];

	const empty = counts[filter] === 0;

	return (
		<div className="flex flex-col gap-5">
			<div className="flex flex-wrap items-center gap-2">
				{FILTERS.map((f) => {
					const active = filter === f.key;
					return (
						<button
							key={f.key}
							type="button"
							aria-pressed={active}
							onClick={() => setFilter(f.key)}
							className={cn(
								"inline-flex items-center gap-2 rounded-[var(--radius-pill)] px-3.5 py-1.5 font-semibold text-[13px] transition-colors",
								active
									? "bg-ink text-paper"
									: "text-ink-soft hover:bg-surface-2 hover:text-ink",
							)}
						>
							{f.label}
							<span
								className={cn(
									"font-bold text-[11.5px] tabular-nums",
									active ? "text-paper/70" : "text-muted-foreground",
								)}
							>
								{counts[f.key]}
							</span>
						</button>
					);
				})}
			</div>

			{empty ? (
				<div className="flex flex-col items-center gap-3 rounded-[var(--radius-card-lg)] border border-border border-dashed bg-paper-alt px-6 py-14 text-center">
					<span className="flex size-11 items-center justify-center rounded-xl bg-brass-wash text-brass-deep">
						<Inbox className="size-5" aria-hidden="true" />
					</span>
					<p className="font-bold text-[15px] text-ink">
						{filter === "new"
							? "You have no requests at this time"
							: filter === "sent"
								? "No interest sent yet"
								: filter === "accepted"
									? "No accepted requests yet"
									: "Nothing declined"}
					</p>
					<p className="max-w-[48ch] text-[13.5px] text-muted-foreground leading-relaxed">
						{filter === "new"
							? "When a plaintiff invites you to represent them, their request shows up here for you to accept or decline."
							: filter === "sent"
								? "Under Browse open, put yourself forward for an intake that needs an attorney. It waits here until the plaintiff decides."
								: filter === "accepted"
									? "When a plaintiff takes you forward, it appears here and on My intakes, where you manage it."
									: "Expressions of interest a plaintiff turned down land here as a record."}
					</p>
				</div>
			) : (
				<div className="overflow-hidden rounded-[var(--radius-card-lg)] border border-border bg-surface shadow-[var(--shadow-rest)]">
					<ul className="divide-y divide-border">
						{filter === "new" &&
							invitations.map((inv) => (
								<InvitationRow key={inv.id} inv={inv} />
							))}
						{filter === "sent" &&
							awaiting.map((e) => (
								<RequestRow key={e.id} intake={e} outcome="sent" />
							))}
						{filter === "accepted" &&
							accepted.map((e) => (
								<RequestRow key={e.id} intake={e} outcome="accepted" />
							))}
						{filter === "declined" &&
							declined.map((e) => (
								<RequestRow key={e.id} intake={e} outcome="declined" />
							))}
					</ul>
				</div>
			)}
		</div>
	);
}

function InvitationRow({ inv }: { inv: InvitationItem }) {
	return (
		<li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4">
			<div className="min-w-0 flex-1">
				<div className="flex flex-wrap items-center gap-2">
					<p className="truncate font-bold text-[14.5px] text-ink">
						{inv.title || "Untitled intake"}
					</p>
					<span className="shrink-0 rounded-[var(--radius-pill)] bg-gold-bright/20 px-2 py-0.5 font-semibold text-[11px] text-gold-bright-ink">
						New
					</span>
				</div>
				<p className="mt-0.5 text-[12.5px] text-muted-foreground">
					<span className="font-semibold text-ink-soft">
						{inv.plaintiffName}
					</span>{" "}
					invited you ·{" "}
					{[inv.category, inv.state].filter(Boolean).join(" · ") || "—"}
				</p>
			</div>
			<Link
				href={`/queue/${inv.caseId}` as Route}
				className={cn(buttonVariants({ size: "sm" }), "h-9 shrink-0")}
			>
				Review
				<ArrowRight data-icon="inline-end" aria-hidden="true" />
			</Link>
		</li>
	);
}

const BADGE: Record<
	"sent" | "accepted" | "declined",
	{ text: string; cls: string }
> = {
	sent: { text: "Awaiting", cls: "bg-brass-wash text-brass-deep" },
	accepted: { text: "Accepted", cls: "bg-green-soft text-green-deep" },
	declined: { text: "Declined", cls: "bg-destructive/10 text-destructive" },
};

function RequestRow({
	intake,
	outcome,
}: {
	intake: ExpressionIntake;
	outcome: "sent" | "accepted" | "declined";
}) {
	const badge = BADGE[outcome];
	// An accepted request is a case they now represent — that lives on My intakes,
	// so open it there. Sent and declined open back to the queued intake.
	const href = (
		outcome === "accepted"
			? `/my-cases/${intake.caseId}`
			: `/queue/${intake.caseId}`
	) as Route;
	const label = outcome === "accepted" ? "Open" : "View";

	return (
		<li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4">
			<div className="min-w-0 flex-1">
				<div className="flex flex-wrap items-center gap-2">
					<p className="truncate font-bold text-[14.5px] text-ink">
						{intake.title || "Untitled intake"}
					</p>
					<span
						className={cn(
							"shrink-0 rounded-[var(--radius-pill)] px-2 py-0.5 font-semibold text-[11px]",
							badge.cls,
						)}
					>
						{badge.text}
					</span>
				</div>
				<p className="mt-0.5 text-[12.5px] text-muted-foreground">
					{[intake.category, intake.state].filter(Boolean).join(" · ") || "—"}
				</p>
			</div>
			<Link
				href={href}
				className={cn(
					buttonVariants({ variant: "outline", size: "sm" }),
					"h-9 shrink-0",
				)}
			>
				{label}
				<ArrowRight data-icon="inline-end" aria-hidden="true" />
			</Link>
		</li>
	);
}
