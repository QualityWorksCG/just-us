// biome-ignore-all lint/performance/noImgElement: user-uploaded Blob images aren't static assets next/image can optimize
import type { QueueCaseDetail } from "@just-us/db/representation";
import { buttonVariants } from "@just-us/ui/components/button";
import { cn } from "@just-us/ui/lib/utils";
import {
	CalendarClock,
	FileText,
	MapPin,
	Paperclip,
	Scale,
	ShieldAlert,
	ShieldCheck,
	Tag,
	UserRound,
} from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

import { ExpressInterestButton } from "@/components/dashboard/express-interest-button";

/**
 * One seeking case, as the attorney deciding whether to represent it sees it.
 *
 * This shows the matter in full — the plaintiff's account, their evidence, and
 * their name — because that is what the plaintiff published to attorneys and what
 * an attorney needs to judge whether they can help. What it does not show, and
 * cannot, is any way to reach the plaintiff: the data behind it carries no email,
 * no phone, and no user id (see `detailSelect`). The only action is to put
 * yourself forward and wait.
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
function fileSize(bytes: number) {
	if (bytes <= 0) return "—";
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function waitingFor(publishedAt: Date | null, createdAt: Date) {
	const since = publishedAt ?? createdAt;
	const days = Math.floor((Date.now() - since.getTime()) / 86_400_000);
	if (days < 1) return "published today";
	if (days === 1) return "waiting 1 day";
	if (days < 30) return `waiting ${days} days`;
	const months = Math.floor(days / 30);
	return `waiting ${months} ${months === 1 ? "month" : "months"}`;
}

type ExpressInterestGate =
	| { canExpress: true }
	| { canExpress: false; title: string; body: string; cta: string };

/**
 * Whether this attorney can put themselves forward for this case — and, when they
 * can't, why and what to do about it.
 *
 * The gate is the case's own state: representation needs a *verified* bar
 * admission there, so each not-yet standing gets its own sentence and next step
 * rather than a single generic "get verified" that leaves the attorney guessing
 * whether to add a state, wait on a check, or fix a rejected one.
 */
function expressInterestGate(
	state: string,
	admissionStatus: string | null,
): ExpressInterestGate {
	if (admissionStatus === "verified") return { canExpress: true };
	const where = state || "this state";
	if (admissionStatus === null) {
		return {
			canExpress: false,
			title: `You're not admitted in ${where}`,
			body: `This intake is in ${where}, and you can only see and take intakes in states you're admitted in. Add ${where} to your directory profile to put yourself forward.`,
			cta: "Add your states",
		};
	}
	if (admissionStatus === "pending" || admissionStatus === "needs_review") {
		return {
			canExpress: false,
			title: `Your ${where} bar standing is still being verified`,
			body: `You've claimed ${where} and its bar check is in progress. You can express interest the moment it clears. Nothing else is needed from you.`,
			cta: "View your profile",
		};
	}
	if (admissionStatus === "rejected") {
		return {
			canExpress: false,
			title: `Your ${where} bar standing couldn't be verified`,
			body: `The bar check for ${where} didn't pass. Update your ${where} bar number on your profile and we'll re-check it.`,
			cta: "Review your profile",
		};
	}
	// "unverified" — claimed, but no check has run yet — and any unknown status.
	return {
		canExpress: false,
		title: `Verify your ${where} bar standing to express interest`,
		body: `You've claimed ${where}, but expressing interest needs a verified licence there. Plaintiffs only ever see attorneys who can actually take the work.`,
		cta: "Get verified",
	};
}

export function QueueCaseDetailView({
	item,
	admissionStatus,
}: {
	item: QueueCaseDetail;
	/** This attorney's admission standing in *this case's* state: `verified`
	 *  unlocks expressing interest; anything else — or `null`, meaning the state
	 *  isn't claimed at all — drives the explanation of what's outstanding. */
	admissionStatus: string | null;
}) {
	const gate = expressInterestGate(item.state, admissionStatus);
	const paragraphs = item.story
		.split(/\n{2,}|\n/)
		.map((p) => p.trim())
		.filter(Boolean);

	return (
		<div className="flex flex-col gap-6">
			{/* Header */}
			<div>
				<div className="mb-2.5 flex flex-wrap items-center gap-1.5">
					<span className="inline-flex items-center gap-1.5 rounded-[var(--radius-chip)] bg-brass-wash px-2.5 py-0.5 font-semibold text-[12px] text-brass-deep">
						<Tag className="size-3.5" aria-hidden="true" />
						{item.category || "Intake"}
					</span>
					<span className="inline-flex items-center gap-1.5 rounded-[var(--radius-chip)] bg-green-soft px-2.5 py-0.5 font-semibold text-[12px] text-green-deep">
						<MapPin className="size-3.5" aria-hidden="true" />
						{item.state || "—"}
					</span>
					<span className="inline-flex items-center gap-1.5 rounded-[var(--radius-chip)] bg-surface-2 px-2.5 py-0.5 font-semibold text-[12px] text-ink-soft">
						<CalendarClock className="size-3.5" aria-hidden="true" />
						{waitingFor(item.publishedAt, item.createdAt)}
					</span>
				</div>

				<h2 className="font-extrabold text-[clamp(1.75rem,3.4vw,2.375rem)] text-ink leading-[1.08] tracking-[-0.03em]">
					{item.title || "Untitled intake"}
				</h2>

				<div className="mt-3 flex flex-wrap items-center gap-2 text-[13.5px]">
					<span className="flex size-7 items-center justify-center rounded-full bg-green-soft font-bold text-[11px] text-green-deep">
						{initials(item.plaintiffName)}
					</span>
					<span className="font-semibold text-ink">{item.plaintiffName}</span>
					<span className="text-muted-foreground">
						is seeking representation
					</span>
				</div>

				{item.summary && (
					<p className="mt-4 max-w-[70ch] border-brass border-l-2 pl-4 text-[15px] text-ink-soft leading-relaxed">
						{item.summary}
					</p>
				)}
			</div>

			{/* Action bar — the one thing an attorney can do from here. When they
			    can't yet, it says exactly why and what to do, rather than a bare
			    disabled button with a hover-only hint. */}
			{item.myInterest || gate.canExpress ? (
				<div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-card-lg)] border border-border bg-surface p-4 shadow-[var(--shadow-rest)]">
					<p className="min-w-[24ch] flex-1 text-[13px] text-ink-soft leading-relaxed">
						{item.myInterest
							? "You've put yourself forward for this intake. The plaintiff sees it on their dashboard and will reach out if they want to take it further."
							: "Expressing interest tells the plaintiff you're available. It doesn't open a conversation. They decide whether to make contact."}
					</p>
					<ExpressInterestButton
						caseId={item.id}
						expressed={!!item.myInterest}
					/>
				</div>
			) : (
				<div className="flex flex-col gap-3 rounded-[var(--radius-card-lg)] border border-brass/40 bg-brass-wash p-4 shadow-[var(--shadow-rest)]">
					<div className="flex items-start gap-3">
						<ShieldAlert
							className="mt-0.5 size-5 shrink-0 text-brass-deep"
							aria-hidden="true"
						/>
						<div className="min-w-0">
							<p className="font-bold text-[14px] text-ink">{gate.title}</p>
							<p className="mt-1 text-[13px] text-ink-soft leading-relaxed">
								{gate.body}
							</p>
						</div>
					</div>
					<div className="flex flex-wrap items-center gap-2.5 sm:pl-8">
						<Link
							href={"/profile" as Route}
							className={cn(buttonVariants({ size: "sm" }), "h-9")}
						>
							{gate.cta}
						</Link>
						<ExpressInterestButton
							caseId={item.id}
							expressed={false}
							disabledReason={gate.title}
						/>
					</div>
				</div>
			)}

			{/* Cover. Height-capped rather than a fixed aspect ratio: 16:9 across a
			    full-width screen is a banner over a thousand pixels tall, which pushes
			    the case itself below the fold. */}
			{item.coverImageUrl && (
				<div className="overflow-hidden rounded-[var(--radius-card-lg)] border border-border bg-surface-2">
					<img
						src={item.coverImageUrl}
						alt=""
						className="max-h-[380px] w-full object-cover"
					/>
				</div>
			)}

			{/* minmax(0,1fr) rather than 1fr: a bare 1fr takes its floor from the
			    content, so one long unbroken line in the story could push the grid
			    wider than the viewport. The aside grows a little on the widest screens
			    so it doesn't read as a sliver against a very wide story column. */}
			<div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_360px]">
				<div className="flex min-w-0 flex-col gap-6">
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
								The plaintiff hasn't written up the details yet.
							</p>
						)}
					</Panel>

					{item.images.length > 0 && (
						<Panel icon={Scale} title="Photos">
							{/* More columns as the panel widens, so a photo stays a thumbnail
							    instead of growing to a third of a wide screen. */}
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
					<Panel icon={Paperclip} title="Evidence">
						{item.evidence.length > 0 ? (
							<>
								<ul className="flex flex-col gap-2">
									{item.evidence.map((file) => (
										<li
											key={`${file.name}-${file.size}`}
											className="flex items-center gap-2.5 rounded-[var(--radius-card)] border border-border bg-paper-alt px-3 py-2"
										>
											<Paperclip
												className="size-3.5 shrink-0 text-brass-deep"
												aria-hidden="true"
											/>
											<span className="min-w-0 flex-1 truncate font-semibold text-[13px] text-ink">
												{file.name}
											</span>
											<span className="shrink-0 text-[12px] text-muted-foreground tabular-nums">
												{fileSize(file.size)}
											</span>
										</li>
									))}
								</ul>
								{/* Honest about what this list is: the wizard records evidence
								    metadata, and file storage isn't wired up yet. Rendering
								    these as downloads would promise something that doesn't
								    work. */}
								<p className="mt-3 text-[12px] text-muted-foreground leading-relaxed">
									Filed by the plaintiff. Documents themselves are shared once
									you're representing the intake.
								</p>
							</>
						) : (
							<p className="text-[13px] text-muted-foreground leading-relaxed">
								No evidence attached yet.
							</p>
						)}
					</Panel>

					<Panel icon={UserRound} title="The plaintiff">
						<dl className="flex flex-col gap-2.5 text-[13px]">
							<Row label="Name" value={item.plaintiffName} />
							<Row label="Jurisdiction" value={item.state || "—"} />
							<Row label="Matter type" value={item.category || "—"} />
						</dl>
						<p className="mt-3 flex items-start gap-2 border-border border-t pt-3 text-[12px] text-muted-foreground leading-relaxed">
							<ShieldCheck
								className="mt-0.5 size-3.5 shrink-0 text-brass-deep"
								aria-hidden="true"
							/>
							Contact details aren't shared. The plaintiff reaches out to you if
							they choose you. You can't contact them first.
						</p>
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

function Row({ label, value }: { label: string; value: string }) {
	return (
		<div className="flex items-baseline justify-between gap-3">
			<dt className="shrink-0 text-muted-foreground">{label}</dt>
			<dd className={cn("min-w-0 text-right font-semibold text-ink")}>
				{value}
			</dd>
		</div>
	);
}
