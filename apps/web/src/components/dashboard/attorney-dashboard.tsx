import { buttonVariants } from "@just-us/ui/components/button";
import { cn } from "@just-us/ui/lib/utils";
import {
	Briefcase,
	Inbox,
	Landmark,
	MessageCircle,
	Send,
	TrendingUp,
} from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

/**
 * The attorney's home (JUS-25). A read of where their work stands: what they're
 * acting on, what needs a decision, and what they've raised — with the queue and
 * their expressions of interest one click away under "Intake requests".
 *
 * Every figure here is real: matched cases, open invitations, unread messages, and
 * funds raised across their caseload. Nothing is projected or placeholder.
 */

export type AttentionItem = {
	id: string;
	kind: "request" | "reply" | "payout";
	title: string;
	sub: string;
	cta: string;
	href: Route;
};

export type CaseloadItem = {
	id: string;
	title: string;
	status: string;
	state: string;
	raisedCents: number;
	goalCents: number;
};

function money(cents: number) {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		maximumFractionDigits: 0,
	}).format(cents / 100);
}

function greeting(hour: number): string {
	if (hour < 12) return "Good morning";
	if (hour < 18) return "Good afternoon";
	return "Good evening";
}

const ATTENTION_ICON = {
	request: Inbox,
	reply: MessageCircle,
	payout: Landmark,
} as const;

export function AttorneyDashboard({
	firstName,
	hour,
	activeCases,
	liveCases,
	closedCases,
	newRequests,
	raisedCents,
	raisedCasesCount,
	expressionsTotal,
	expressionsTakenForward,
	attention,
	caseload,
}: {
	firstName: string;
	/** The server's current hour (0–23), for the greeting — passed in so the whole
	 *  page reads from one clock. */
	hour: number;
	activeCases: number;
	liveCases: number;
	closedCases: number;
	newRequests: number;
	raisedCents: number;
	raisedCasesCount: number;
	expressionsTotal: number;
	expressionsTakenForward: number;
	attention: AttentionItem[];
	caseload: CaseloadItem[];
}) {
	return (
		<div className="flex flex-col gap-7">
			<p className="text-[14.5px] text-ink-soft">
				{greeting(hour)}, {firstName}. Here's where your work stands.
			</p>

			{/* Stats */}
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<Stat
					icon={Briefcase}
					label="Active intakes"
					value={String(activeCases)}
					sub={
						activeCases === 0
							? "none yet"
							: `${liveCases} live · ${closedCases} closed`
					}
				/>
				<Stat
					icon={Inbox}
					label="New requests"
					value={String(newRequests)}
					sub={newRequests === 0 ? "none waiting" : "awaiting your reply"}
					accent={newRequests > 0}
				/>
				<Stat
					icon={TrendingUp}
					label="Raised · all intakes"
					value={money(raisedCents)}
					sub={`across ${raisedCasesCount} ${
						raisedCasesCount === 1 ? "intake" : "intakes"
					}`}
				/>
				<Stat
					icon={Send}
					label="Expressions out"
					value={String(expressionsTotal)}
					sub={`${expressionsTakenForward} taken forward`}
				/>
			</div>

			<div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
				{/* Needs your attention */}
				<section>
					<div className="flex items-center gap-2">
						<h2 className="font-bold text-[18px] text-ink">
							Needs your attention
						</h2>
						{attention.length > 0 && (
							<span className="inline-flex min-w-5 items-center justify-center rounded-full bg-brass px-1.5 py-0.5 font-bold text-[11px] text-white">
								{attention.length}
							</span>
						)}
					</div>

					{attention.length === 0 ? (
						<div className="mt-3 flex flex-col items-center gap-2 rounded-[var(--radius-card-lg)] border border-border border-dashed bg-paper-alt px-6 py-12 text-center">
							<span className="flex size-10 items-center justify-center rounded-xl bg-green-soft text-green-deep">
								<Briefcase className="size-5" aria-hidden="true" />
							</span>
							<p className="font-bold text-[14.5px] text-ink">
								You're all caught up
							</p>
							<p className="max-w-[40ch] text-[13px] text-muted-foreground leading-relaxed">
								New requests, replies, and payout steps will show up here.
							</p>
						</div>
					) : (
						<ul className="mt-3 overflow-hidden rounded-[var(--radius-card-lg)] border border-border bg-surface shadow-[var(--shadow-rest)]">
							{attention.map((item) => {
								const Icon = ATTENTION_ICON[item.kind];
								return (
									<li
										key={item.id}
										className="flex flex-wrap items-center gap-3 border-border border-b px-5 py-4 last:border-0"
									>
										<span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brass-wash text-brass-deep">
											<Icon className="size-[18px]" aria-hidden="true" />
										</span>
										<div className="min-w-0 flex-1">
											<p className="font-bold text-[14px] text-ink">
												{item.title}
											</p>
											<p className="truncate text-[12.5px] text-muted-foreground">
												{item.sub}
											</p>
										</div>
										<Link
											href={item.href}
											className={cn(
												buttonVariants({ variant: "outline", size: "sm" }),
												"h-9 shrink-0",
											)}
										>
											{item.cta}
										</Link>
									</li>
								);
							})}
						</ul>
					)}
				</section>

				{/* Your caseload */}
				<aside className="rounded-[var(--radius-card-lg)] border border-border bg-surface p-5 shadow-[var(--shadow-rest)]">
					<div className="flex items-center justify-between gap-2">
						<h2 className="font-mono font-semibold text-[11px] text-muted-foreground uppercase tracking-[0.08em]">
							Your intakes
						</h2>
						<Link
							href={"/my-cases" as Route}
							className="font-semibold text-[12.5px] text-brass-deep transition-colors hover:text-brass"
						>
							View all
						</Link>
					</div>

					{caseload.length === 0 ? (
						<p className="mt-4 text-[13px] text-muted-foreground leading-relaxed">
							No matched intakes yet. Put yourself forward under Intake
							requests.
						</p>
					) : (
						<ul className="mt-4 flex flex-col divide-y divide-border">
							{caseload.map((c) => {
								const badge = caseloadBadge(c.status);
								return (
									<li key={c.id} className="flex items-start gap-3 py-3">
										<span
											className={cn(
												"mt-1.5 size-2 shrink-0 rounded-full",
												badge.dot,
											)}
										/>
										<Link
											href={`/my-cases/${c.id}` as Route}
											className="min-w-0 flex-1 rounded-sm outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
										>
											<p className="truncate font-semibold text-[13.5px] text-ink">
												{c.title || "Untitled intake"}
											</p>
											<p className="truncate text-[12px] text-muted-foreground">
												{badge.text} · {c.state || "—"}
											</p>
										</Link>
										<span className="shrink-0 text-[12.5px] text-ink-soft tabular-nums">
											{money(c.raisedCents)} / {money(c.goalCents)}
										</span>
									</li>
								);
							})}
						</ul>
					)}
				</aside>
			</div>
		</div>
	);
}

function caseloadBadge(status: string): { text: string; dot: string } {
	// Published and taking donations — the only "Active", with the green dot.
	if (status === "live") return { text: "Active", dot: "bg-success" };
	if (status === "closed") return { text: "Closed", dot: "bg-ink-soft" };
	if (status === "pending_payout")
		return { text: "Awaiting plaintiff", dot: "bg-gold-bright" };
	return { text: "Fee not agreed", dot: "bg-brass-deep" };
}

function Stat({
	icon: Icon,
	label,
	value,
	sub,
	accent = false,
}: {
	icon: typeof Briefcase;
	label: string;
	value: string;
	sub: string;
	accent?: boolean;
}) {
	return (
		<div className="rounded-[var(--radius-card)] border border-border bg-surface p-5 shadow-[var(--shadow-rest)]">
			<span className="mb-3 flex size-9 items-center justify-center rounded-lg bg-brass-wash text-brass-deep">
				<Icon className="size-[18px]" aria-hidden="true" />
			</span>
			<p className="font-mono font-semibold text-[11px] text-muted-foreground uppercase tracking-[0.08em]">
				{label}
			</p>
			<p className="mt-1.5 font-extrabold text-[26px] text-ink tabular-nums leading-none tracking-[-0.02em]">
				{value}
			</p>
			<p
				className={cn(
					"mt-1.5 text-[12.5px]",
					accent ? "font-semibold text-brass-deep" : "text-muted-foreground",
				)}
			>
				{sub}
			</p>
		</div>
	);
}
