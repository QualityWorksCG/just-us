// biome-ignore-all lint/performance/noImgElement: user-uploaded Blob images aren't static assets next/image can optimize
import type { CaseEvidence } from "@just-us/db/cases";
import type { AttorneyCaseDetail } from "@just-us/db/representation";
import { buttonVariants } from "@just-us/ui/components/button";
import { cn } from "@just-us/ui/lib/utils";
import {
	BadgeCheck,
	FileText,
	Handshake,
	Hourglass,
	Images,
	Landmark,
	Link2,
	MapPin,
	MessageSquare,
	Paperclip,
	Scale,
	ShieldCheck,
	Tag,
	Users,
} from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

import {
	money,
	type PayoutStage,
	payoutStage,
} from "@/components/dashboard/attorney-cases";
import { CaseTabs } from "@/components/dashboard/case-tabs";

/**
 * One case an attorney is acting on.
 *
 * Everything about a matter cannot be one column of equal-weight panels — payout
 * setup, the client's story, the evidence, the progress posts and the money all
 * competed, and the screen read as a pile. So it is three things instead:
 *
 *   the header    — who and what, always on screen
 *   at a glance   — the three facts worth reading every visit: where funding
 *                   stands, how many backers, and whether payouts can receive
 *   tabs          — the bulky content, one job each
 *
 * Payout setup used to lead the page because it is the only thing here the attorney
 * can be *blocking*: a published case whose account cannot receive is raising
 * nothing, and their client has no way to fix it. Tabs must not bury that, so it
 * survives twice — as a glance tile that names the stage, and by opening its own tab
 * first whenever something is outstanding.
 *
 * The client is named but not reachable from here beyond a thread they already
 * started — `startConversationAction` is plaintiff-only, and that is the promise the
 * representation flow rests on (JUS-25). Where there is no thread, this says so
 * rather than offering a button that would be refused.
 */

function initials(name: string) {
	return (
		name
			.trim()
			.split(/\s+/)
			.slice(0, 2)
			.map((part) => part[0]?.toUpperCase() ?? "")
			.join("") || "—"
	);
}

/** File size as the plaintiff would recognise it, from the stored byte count. */
function fileSize(bytes: number | null) {
	if (bytes === null || bytes <= 0) return "";
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * One filing, opened where there is something to open.
 *
 * A stored document goes through the app's authorized evidence route rather than
 * its storage URL — the URL is readable by anyone holding it, so it stays on the
 * server. A pasted link is the client's own external address and opens directly.
 * An entry from before documents were stored is neither, and is rendered plainly
 * rather than as a link that would 404.
 */
function EvidenceRow({ file }: { file: CaseEvidence }) {
	const Icon = file.kind === "link" ? Link2 : Paperclip;
	const size = fileSize(file.size);

	return (
		<li className="flex items-center gap-2.5 rounded-[var(--radius-card)] border border-border bg-paper-alt px-3 py-2">
			<Icon className="size-3.5 shrink-0 text-brass-deep" aria-hidden="true" />
			{file.href ? (
				<a
					href={file.href}
					target="_blank"
					rel="noopener noreferrer"
					className="min-w-0 flex-1 truncate font-semibold text-[13px] text-brass-deep hover:underline"
				>
					{file.name}
				</a>
			) : (
				<span className="min-w-0 flex-1 truncate font-semibold text-[13px] text-ink">
					{file.name}
				</span>
			)}
			<span className="shrink-0 text-[12px] text-muted-foreground tabular-nums">
				{file.kind === "link" ? "Link" : size}
			</span>
		</li>
	);
}

function howMatched(item: AttorneyCaseDetail): string {
	switch (item.origin) {
		case "expressed_interest":
			return "You put yourself forward and they took you on.";
		case "directory":
			return "They found you in the JustUs directory.";
		case "bring_your_own":
			return "They brought you to JustUs themselves.";
		default:
			return "They named you on their case by email.";
	}
}

/** The glance tile for payouts — the stage, in the fewest words that still say
 *  whose move it is. `null` is Stripe not being configured on this environment. */
const PAYOUT_GLANCE: Record<PayoutStage, { value: string; hint: string }> = {
	not_started: {
		value: "Not set up",
		hint: "Link the firm's account for this case",
	},
	incomplete: { value: "Unfinished", hint: "Stripe still needs information" },
	in_review: {
		value: "In review",
		hint: "Stripe is verifying — nothing to do",
	},
	ready: { value: "Active", hint: "Funds land in the account you linked" },
};

export function AttorneyCaseDetailView({
	item,
	conversationId,
	payoutsConfigured,
	payoutPanel,
	updatesPanel,
}: {
	item: AttorneyCaseDetail;
	/** An existing thread with this client, if they have started one. */
	conversationId: string | null;
	/** Whether Stripe is configured at all in this environment — without it there
	 *  is no payout stage to report and nothing outstanding to chase. */
	payoutsConfigured: boolean;
	/** The payout panel, passed in so the page can wrap its client component in
	 *  the Suspense boundary `useSearchParams` needs. */
	payoutPanel: React.ReactNode;
	/** Progress updates: the composer and the posts already published (JUS-33).
	 *  Passed in for the same reason as `payoutPanel` — the page owns the data
	 *  fetching, this component owns where it sits on the screen. */
	updatesPanel: React.ReactNode;
}) {
	const paragraphs = item.story
		.split(/\n{2,}|\n/)
		.map((p) => p.trim())
		.filter(Boolean);

	const isLive = item.status === "live";
	const isClosed = item.status === "closed";
	const pct =
		item.goalCents > 0
			? Math.min(100, Math.round((item.raisedCents / item.goalCents) * 100))
			: 0;

	// "Fee not agreed" only where no fee is agreed. It used to be the catch-all for
	// everything that wasn't live or closed, which called a finished case awaiting
	// its payout account unpriced — and now sits directly above a tile reading
	// "$29,000 fee agreed".
	const badge = isLive
		? {
				text: "Live · Raising",
				cls: "bg-green-soft text-green-deep",
				dot: "bg-success",
			}
		: isClosed
			? {
					text: "Closed",
					cls: "bg-surface-2 text-ink-soft",
					dot: "bg-ink-soft",
				}
			: item.goalCents > 0
				? {
						text: "Not published yet",
						cls: "bg-brass-wash text-brass-deep",
						dot: "bg-brass-deep",
					}
				: {
						text: "Fee not agreed",
						cls: "bg-brass-wash text-brass-deep",
						dot: "bg-brass-deep",
					};

	const stage = payoutsConfigured ? payoutStage(item) : null;
	// What the attorney still owes on payouts. A closed matter is not waiting on
	// anyone's bank details, so it never opens on that tab or wears the dot.
	const payoutOutstanding = stage !== null && stage !== "ready" && !isClosed;

	return (
		<div className="flex w-full flex-col gap-6">
			{/* Header — who and what. Stays above the tabs, so no section can be read
			    without knowing whose case it is. */}
			<div>
				<div className="mb-2.5 flex flex-wrap items-center gap-1.5">
					<span
						className={cn(
							"inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] px-2.5 py-1 font-mono font-semibold text-[10px] uppercase tracking-[0.06em]",
							badge.cls,
						)}
					>
						<span className={cn("size-1.5 rounded-full", badge.dot)} />
						{badge.text}
					</span>
					<span className="inline-flex items-center gap-1.5 rounded-[var(--radius-chip)] bg-brass-wash px-2.5 py-0.5 font-semibold text-[12px] text-brass-deep">
						<Tag className="size-3.5" aria-hidden="true" />
						{item.category || "Case"}
					</span>
					<span className="inline-flex items-center gap-1.5 rounded-[var(--radius-chip)] border border-border px-2.5 py-0.5 text-[12px] text-ink-soft">
						<MapPin className="size-3.5" aria-hidden="true" />
						{item.state || "—"}
					</span>
				</div>

				<h2 className="font-extrabold text-[clamp(1.75rem,3.4vw,2.375rem)] text-ink leading-[1.08] tracking-[-0.03em]">
					{item.title || "Untitled case"}
				</h2>

				{/* The client, and the one way to reach them. Messaging was a sidebar
				    card halfway down the page; it belongs beside their name, which is
				    the only place on this screen the client is the subject. */}
				<div className="mt-3.5 flex flex-wrap items-center gap-x-3 gap-y-2.5">
					<span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-green-soft font-bold text-[11px] text-green-deep">
						{initials(item.plaintiffName)}
					</span>
					<span className="text-[13.5px]">
						<span className="font-semibold text-ink">{item.plaintiffName}</span>{" "}
						<span className="text-muted-foreground">is your client</span>
					</span>
					<span className="inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
						<Handshake className="size-3.5" aria-hidden="true" />
						{howMatched(item)}
					</span>
					{conversationId && (
						<Link
							href={`/messages/${conversationId}` as Route}
							className={cn(
								buttonVariants({ variant: "outline", size: "sm" }),
								"h-9 sm:ml-auto",
							)}
						>
							<MessageSquare data-icon="inline-start" aria-hidden="true" />
							Open messages
						</Link>
					)}
				</div>

				{!conversationId && (
					<p className="mt-2.5 flex items-start gap-2 text-[12.5px] text-muted-foreground leading-relaxed">
						<ShieldCheck
							className="mt-0.5 size-3.5 shrink-0 text-brass-deep"
							aria-hidden="true"
						/>
						No thread yet. Clients open the conversation on JustUs — once{" "}
						{item.plaintiffName.split(/\s+/)[0]} messages you, it appears here
						and in Messages.
					</p>
				)}

				{item.summary && (
					<p className="mt-4 max-w-[70ch] border-brass border-l-2 pl-4 text-[15px] text-ink-soft leading-relaxed">
						{item.summary}
					</p>
				)}
			</div>

			{/* At a glance — the three facts worth re-reading on every visit, so none
			    of them depends on which tab is open. */}
			<div className="grid gap-3 sm:grid-cols-3">
				<Glance
					icon={Scale}
					label="Funding"
					value={isLive ? money(item.raisedCents) : "Not raising"}
					hint={
						isLive
							? `of ${money(item.goalCents)} agreed fee · ${pct}%`
							: isClosed
								? "This case is closed"
								: item.goalCents > 0
									? `${money(item.goalCents)} fee agreed · not published yet`
									: "No fee agreed with your client yet"
					}
					bar={isLive ? pct : null}
				/>
				<Glance
					icon={Users}
					label="Backers"
					value={String(item.donorsCount)}
					hint={
						item.donorsCount > 0
							? "donations so far"
							: isLive
								? "no donations yet"
								: "donations open when the case is published"
					}
				/>
				<Glance
					icon={
						stage === "ready"
							? BadgeCheck
							: stage === "in_review"
								? Hourglass
								: Landmark
					}
					label="Payouts"
					value={stage ? PAYOUT_GLANCE[stage].value : "Unavailable"}
					hint={
						stage
							? PAYOUT_GLANCE[stage].hint
							: "Not configured on this environment"
					}
					tone={stage === "ready" ? "good" : "flat"}
				/>
			</div>

			<CaseTabs
				label="Case sections"
				// Opens on payouts whenever they are outstanding: that is the work only
				// the attorney can do, and their client is stuck behind it.
				initialKey={payoutOutstanding ? "funding" : "updates"}
				tabs={[
					{
						key: "updates",
						label: "Updates",
						count: item.updatesCount,
						content: updatesPanel,
					},
					{
						key: "case",
						label: "The case",
						content: (
							<div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
								<div className="flex min-w-0 flex-col gap-6">
									<Panel icon={FileText} title="What happened">
										{paragraphs.length > 0 ? (
											/* The measure is capped here, not on the page: prose past
											   roughly 85 characters a line is hard to track back from
											   one line to the next, and the panel is free to be as
											   wide as the screen. */
											<div className="flex max-w-[85ch] flex-col gap-3 text-[14.5px] text-ink-soft leading-relaxed">
												{paragraphs.map((paragraph, index) => (
													<p key={`${index}-${paragraph.slice(0, 12)}`}>
														{paragraph}
													</p>
												))}
											</div>
										) : (
											<p className="text-[14px] text-muted-foreground">
												Your client hasn't written up the details yet.
											</p>
										)}
									</Panel>

									{item.images.length > 0 && (
										<Panel icon={Images} title="Photos">
											<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
												{item.images.map((url) => (
													<img
														key={url}
														src={url}
														alt=""
														className="aspect-square w-full rounded-[var(--radius-card-sm)] border border-border object-cover"
													/>
												))}
											</div>
										</Panel>
									)}
								</div>

								<Panel icon={Paperclip} title="Evidence">
									{item.evidence.length > 0 ? (
										<>
											<ul className="flex flex-col gap-2">
												{item.evidence.map((file, i) => (
													<EvidenceRow
														key={`${file.name}-${file.kind}-${i}`}
														file={file}
													/>
												))}
											</ul>
											{/* Said only where it is true of something in the list:
											    entries filed before JustUs stored documents keep their
											    name and size and have nothing behind them, and a row
											    that opens nothing otherwise just reads as broken. */}
											{item.evidence.some((file) => file.kind === "record") && (
												<p className="mt-3 text-[12px] text-muted-foreground leading-relaxed">
													Items without a link were filed before JustUs stored
													documents — ask your client for those directly.
												</p>
											)}
										</>
									) : (
										<p className="text-[13px] text-muted-foreground leading-relaxed">
											No evidence attached yet.
										</p>
									)}
								</Panel>
							</div>
						),
					},
					{
						key: "funding",
						label: "Funding & payouts",
						needsAttention: payoutOutstanding,
						content: (
							<div className="flex flex-col gap-6">
								{payoutPanel}
								<Panel icon={Scale} title="Funding">
									{isLive ? (
										<>
											<p className="flex items-baseline gap-2.5">
												<span className="font-extrabold text-[28px] text-ink tabular-nums tracking-[-0.02em]">
													{money(item.raisedCents)}
												</span>
												<span className="text-[13px] text-muted-foreground">
													of {money(item.goalCents)} agreed fee · {pct}%
												</span>
											</p>
											<div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-2">
												<div
													className="h-full rounded-full bg-brass"
													style={{ width: `${Math.max(2, pct)}%` }}
												/>
											</div>
											<p className="mt-3 inline-flex items-center gap-1.5 text-[13px] text-muted-foreground">
												<Users className="size-3.5" aria-hidden="true" />
												{item.donorsCount === 0
													? "No donors yet."
													: `${item.donorsCount} ${item.donorsCount === 1 ? "donor" : "donors"} so far.`}{" "}
												Donations are paid into this case's own account as they
												come in.
											</p>
										</>
									) : (
										<p className="text-[13.5px] text-ink-soft leading-relaxed">
											{isClosed
												? "This case is closed and no longer raising."
												: item.goalCents > 0
													? `The fee agreed with your client is ${money(item.goalCents)}. Nothing can be donated until they publish the case.`
													: "Your client hasn't agreed a fee with you yet. The fee they set becomes the goal their case raises towards, so nothing can be donated until then."}
										</p>
									)}
								</Panel>
							</div>
						),
					},
				]}
			/>
		</div>
	);
}

/** One at-a-glance fact. Small on purpose — these sit above the tabs, and a row of
 *  big coloured slabs would outweigh the section the reader actually came for. */
function Glance({
	icon: Icon,
	label,
	value,
	hint,
	bar,
	tone = "flat",
}: {
	icon: typeof FileText;
	label: string;
	value: string;
	hint: string;
	/** Percent funded, where there is a goal being raised towards. */
	bar?: number | null;
	/** "good" is reserved for a settled state — a green number here has to mean
	 *  there is nothing to do, or it stops meaning anything. */
	tone?: "flat" | "good";
}) {
	return (
		<div className="rounded-[var(--radius-card)] border border-border bg-surface p-4 shadow-[var(--shadow-rest)]">
			<p className="flex items-center gap-1.5 font-mono font-semibold text-[10px] text-muted-foreground uppercase tracking-[0.08em]">
				<Icon
					className={cn(
						"size-3.5",
						tone === "good" ? "text-green-deep" : "text-brass-deep",
					)}
					aria-hidden="true"
				/>
				{label}
			</p>
			<p
				className={cn(
					"mt-2 font-extrabold text-[20px] tabular-nums leading-none tracking-[-0.02em]",
					tone === "good" ? "text-green-deep" : "text-ink",
				)}
			>
				{value}
			</p>
			{typeof bar === "number" && (
				<div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
					<div
						className="h-full rounded-full bg-brass"
						style={{ width: `${Math.max(2, bar)}%` }}
					/>
				</div>
			)}
			<p className="mt-2 text-[12px] text-muted-foreground leading-snug">
				{hint}
			</p>
		</div>
	);
}

function Panel({
	icon: Icon,
	title,
	children,
}: {
	icon: typeof FileText;
	title: string;
	children: React.ReactNode;
}) {
	return (
		<section className="rounded-[var(--radius-card-lg)] border border-border bg-surface p-5 shadow-[var(--shadow-rest)]">
			<h3 className="mb-3 flex items-center gap-2 font-bold text-[15px] text-ink">
				<Icon className="size-4 text-brass-deep" aria-hidden="true" />
				{title}
			</h3>
			{children}
		</section>
	);
}
