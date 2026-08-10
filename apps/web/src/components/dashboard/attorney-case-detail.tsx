// biome-ignore-all lint/performance/noImgElement: user-uploaded Blob images aren't static assets next/image can optimize
import type { CaseEvidence } from "@just-us/db/cases";
import type { AttorneyCaseDetail } from "@just-us/db/representation";
import { buttonVariants } from "@just-us/ui/components/button";
import { cn } from "@just-us/ui/lib/utils";
import {
	FileText,
	Handshake,
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

import { money } from "@/components/dashboard/attorney-cases";

/**
 * One case an attorney is acting on.
 *
 * Payout setup leads, because it is the only thing on this screen the attorney can
 * be *blocking*: a published case whose account cannot receive is raising nothing,
 * and their client has no way to fix it. The matter itself follows.
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

export function AttorneyCaseDetailView({
	item,
	conversationId,
	payoutPanel,
	updatesPanel,
}: {
	item: AttorneyCaseDetail;
	/** An existing thread with this client, if they have started one. */
	conversationId: string | null;
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
	const pct =
		item.goalCents > 0
			? Math.min(100, Math.round((item.raisedCents / item.goalCents) * 100))
			: 0;

	const badge = isLive
		? {
				text: "Live · Raising",
				cls: "bg-green-soft text-green-deep",
				dot: "bg-success",
			}
		: item.status === "closed"
			? {
					text: "Closed",
					cls: "bg-surface-2 text-ink-soft",
					dot: "bg-ink-soft",
				}
			: {
					text: "Fee not agreed",
					cls: "bg-brass-wash text-brass-deep",
					dot: "bg-brass-deep",
				};

	return (
		<div className="flex w-full flex-col gap-6">
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

				<div className="mt-3 flex flex-wrap items-center gap-2 text-[13.5px]">
					<span className="flex size-7 items-center justify-center rounded-full bg-green-soft font-bold text-[11px] text-green-deep">
						{initials(item.plaintiffName)}
					</span>
					<span className="font-semibold text-ink">{item.plaintiffName}</span>
					<span className="text-muted-foreground">is your client</span>
					<span className="inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
						<Handshake className="size-3.5" aria-hidden="true" />
						{howMatched(item)}
					</span>
				</div>

				{item.summary && (
					<p className="mt-4 max-w-[70ch] border-brass border-l-2 pl-4 text-[15px] text-ink-soft leading-relaxed">
						{item.summary}
					</p>
				)}
			</div>

			{/* Payouts first — the one thing here that can be blocking the client.
			    Updates follow: the work the attorney does here regularly, versus the
			    setup they do once. */}
			{payoutPanel}
			{updatesPanel}

			<div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_360px]">
				<div className="flex min-w-0 flex-col gap-6">
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
									Donations are paid into this case's own account as they come
									in.
								</p>
							</>
						) : (
							<p className="text-[13.5px] text-ink-soft leading-relaxed">
								{item.status === "closed"
									? "This case is closed and no longer raising."
									: item.goalCents > 0
										? `The fee agreed with your client is ${money(item.goalCents)}. Nothing can be donated until they publish the case.`
										: "Your client hasn't agreed a fee with you yet. The fee they set becomes the goal their case raises towards, so nothing can be donated until then."}
							</p>
						)}
					</Panel>

					<Panel icon={FileText} title="What happened">
						{paragraphs.length > 0 ? (
							/* The measure is capped here, not on the page: prose past roughly
							   85 characters a line is hard to track back from one line to the
							   next, and the panel is free to be as wide as the screen. */
							<div className="flex max-w-[85ch] flex-col gap-3 text-[14.5px] text-ink-soft leading-relaxed">
								{paragraphs.map((paragraph, index) => (
									<p key={`${index}-${paragraph.slice(0, 12)}`}>{paragraph}</p>
								))}
							</div>
						) : (
							<p className="text-[14px] text-muted-foreground">
								Your client hasn't written up the details yet.
							</p>
						)}
					</Panel>

					{item.images.length > 0 && (
						<Panel icon={Scale} title="Photos">
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

				<div className="flex flex-col gap-6">
					<Panel icon={MessageSquare} title="Your client">
						<div className="flex items-center gap-3">
							<span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-green-soft font-bold text-[13px] text-green-deep">
								{initials(item.plaintiffName)}
							</span>
							<div className="min-w-0">
								<p className="font-bold text-[14.5px] text-ink">
									{item.plaintiffName}
								</p>
								<p className="text-[12.5px] text-muted-foreground">
									{item.state || "—"}
								</p>
							</div>
						</div>
						{conversationId ? (
							<Link
								href={`/messages/${conversationId}` as Route}
								className={cn(buttonVariants(), "mt-4 h-10 w-full px-4")}
							>
								<MessageSquare data-icon="inline-start" aria-hidden="true" />
								Open messages
							</Link>
						) : (
							<p className="mt-3 flex items-start gap-2 border-border border-t pt-3 text-[12px] text-muted-foreground leading-relaxed">
								<ShieldCheck
									className="mt-0.5 size-3.5 shrink-0 text-brass-deep"
									aria-hidden="true"
								/>
								No thread yet. Clients open the conversation on JustUs — once
								they message you, it appears here and in Messages.
							</p>
						)}
					</Panel>

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
								{/* Said only where it is true of something in the list: entries
								    filed before JustUs stored documents keep their name and size
								    and have nothing behind them, and a row that opens nothing
								    otherwise just reads as broken. */}
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
			</div>
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
			<h2 className="mb-3 flex items-center gap-2 font-bold text-[15px] text-ink">
				<Icon className="size-4 text-brass-deep" aria-hidden="true" />
				{title}
			</h2>
			{children}
		</section>
	);
}
