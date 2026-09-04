// biome-ignore-all lint/performance/noImgElement: user-uploaded Blob images aren't static assets next/image can optimize
import type { QueueCaseDetail } from "@just-us/db/representation";
import { buttonVariants } from "@just-us/ui/components/button";
import { cn } from "@just-us/ui/lib/utils";
import {
	CalendarClock,
	FileText,
	Link2,
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

import { declineNamedIntakeAction } from "@/app/(app)/queue/actions";
import { CaseInviteDecision } from "@/components/case-invite/case-invite-decision";
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
 *
 * Layout is two columns: the matter reads down the left; the one decision an
 * attorney can make — represent it, express interest, or clear a verification
 * gate — sits in a card at the top of the right rail, alongside the facts, so it
 * stays in view beside the story rather than trailing beneath it.
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

/**
 * One filing, opened where there is something to open.
 *
 * A stored document goes through the app's authorized evidence route (`file.href`),
 * never its storage URL; a pasted link opens directly; an entry from before
 * documents were stored has no href and renders plainly. Access is enforced at the
 * route — see `caseEvidenceFile` — so rendering the link here is safe. Mirrors the
 * representing attorney's evidence row so both read identically.
 */
function EvidenceRow({
	file,
	canOpen,
}: {
	file: QueueCaseDetail["evidence"][number];
	/** Whether this viewer is allowed to open the file — a link is only rendered
	 *  when the serving route would honour it. */
	canOpen: boolean;
}) {
	const Icon = file.kind === "link" ? Link2 : Paperclip;

	return (
		<li className="flex items-center gap-2.5 rounded-[var(--radius-card)] border border-border bg-paper-alt px-3 py-2">
			<Icon className="size-3.5 shrink-0 text-brass-deep" aria-hidden="true" />
			{canOpen && file.href ? (
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
				{file.kind === "link" ? "Link" : fileSize(file.size ?? 0)}
			</span>
		</li>
	);
}

function waitingFor(publishedAt: Date | null, createdAt: Date) {
	const since = publishedAt ?? createdAt;
	const days = Math.floor((Date.now() - since.getTime()) / 86_400_000);
	if (days < 1) return "Published today";
	if (days === 1) return "Waiting 1 day";
	if (days < 30) return `Waiting ${days} days`;
	const months = Math.floor(days / 30);
	return `Waiting ${months} ${months === 1 ? "month" : "months"}`;
}

type ExpressInterestGate =
	| { canExpress: true }
	| { canExpress: false; title: string; body: string; cta: string };

/**
 * Whether this attorney can put themselves forward for this case — and, when they
 * can't, why and what to do about it.
 *
 * The gate turns on the case's jurisdiction. A state case needs a *verified* bar
 * admission in that state; a federal case needs a *verified* federal-court
 * standing. Each not-yet status gets its own sentence and next step rather than a
 * single generic "get verified" that leaves the attorney guessing.
 */
function expressInterestGate(
	jurisdiction: "state" | "federal",
	state: string,
	admissionStatus: string | null,
	federalStatus: string | null,
): ExpressInterestGate {
	if (jurisdiction === "federal") {
		if (federalStatus === "verified") return { canExpress: true };
		if (federalStatus === "pending" || federalStatus === "needs_review") {
			return {
				canExpress: false,
				title: "Your federal standing is still being verified",
				body: "This is a federal case. Your federal-court check is in progress — you'll be able to express interest the moment it clears.",
				cta: "View your profile",
			};
		}
		if (federalStatus === "rejected") {
			return {
				canExpress: false,
				title: "Your federal standing couldn't be verified",
				body: "This is a federal case, and the federal-court check didn't pass. Review your federal practice on your profile and we'll re-check it.",
				cta: "Review your profile",
			};
		}
		return {
			canExpress: false,
			title: "Verify your federal standing to express interest",
			body: "This is a federal case. Turn on federal practice and verify your federal-court standing on your profile to put yourself forward.",
			cta: "Get verified",
		};
	}
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
	federalStatus,
}: {
	item: QueueCaseDetail;
	/** This attorney's admission standing in *this case's* state: `verified`
	 *  unlocks expressing interest; anything else — or `null`, meaning the state
	 *  isn't claimed at all — drives the explanation of what's outstanding. Used
	 *  for state cases. */
	admissionStatus: string | null;
	/** This attorney's federal-court standing, used for federal cases. */
	federalStatus: string | null;
}) {
	const gate = expressInterestGate(
		item.jurisdiction,
		item.state,
		admissionStatus,
		federalStatus,
	);
	const paragraphs = item.story
		.split(/\n{2,}|\n/)
		.map((p) => p.trim())
		.filter(Boolean);

	// May this attorney open the filed documents? Yes if the plaintiff named them
	// (a pending invitation) or they've put themselves forward (an expression of
	// interest) — the exact pair the evidence route authorizes. Kept in lockstep so
	// the panel never renders a link the route would 404.
	const canReviewEvidence = !!(item.invitationId || item.myInterest);

	// The one thing an attorney can do from here, as a card at the top of the
	// right rail. Which card depends on where they stand with this intake: named
	// directly (confirm/decline), already answered, free to express interest, or
	// held back by a verification gate that says exactly what's outstanding.
	const decision = item.invitationId ? (
		// The plaintiff named this attorney directly. The ask is not "express
		// interest" but "confirm or decline" — the same decision the emailed invite
		// offers, reusing that flow so there's one accept/decline path.
		<section className="rounded-[var(--radius-card-lg)] border border-border bg-surface p-5 shadow-[var(--shadow-rest)]">
			<span className="flex size-11 items-center justify-center rounded-[var(--radius-card-sm)] bg-brass-wash text-brass-deep">
				<Scale className="size-5" aria-hidden="true" />
			</span>
			<h3 className="mt-3 font-extrabold text-[18px] text-ink tracking-[-0.02em]">
				Represent this case?
			</h3>
			<p className="mt-2 text-[13.5px] text-ink-soft leading-relaxed">
				{item.plaintiffName} asked you to take this intake on. You can read
				everything first. Nothing is decided until you choose.
			</p>
			<div className="mt-4">
				<CaseInviteDecision
					invite={{ invitationId: item.invitationId }}
					confirmLabel="Yes, represent this case"
					declineLabel="Decline and send back to queue"
					confirmIcon
					declineAction={declineNamedIntakeAction}
				/>
			</div>
		</section>
	) : item.myInterest?.status === "declined" ? (
		// A closed chapter: the plaintiff went with someone else. Kept viewable
		// (they can re-read what they put forward for) but with no action left.
		<section className="rounded-[var(--radius-card-lg)] border border-border bg-surface p-5 shadow-[var(--shadow-rest)]">
			<p className="font-bold text-[14px] text-ink">No longer open</p>
			<p className="mt-1.5 text-[13px] text-ink-soft leading-relaxed">
				The plaintiff took this intake forward with another attorney. There's
				nothing more to do here. It stays in your requests as a record.
			</p>
		</section>
	) : item.myInterest || gate.canExpress ? (
		<section className="flex flex-col gap-3 rounded-[var(--radius-card-lg)] border border-border bg-surface p-5 shadow-[var(--shadow-rest)]">
			<p className="text-[13px] text-ink-soft leading-relaxed">
				{item.myInterest
					? "You've put yourself forward for this intake. The plaintiff sees it on their dashboard and will reach out if they want to take it further."
					: "Expressing interest tells the plaintiff you're available. It doesn't open a conversation. They decide whether to make contact."}
			</p>
			<ExpressInterestButton
				caseId={item.id}
				expressed={!!item.myInterest}
				fullWidth
			/>
		</section>
	) : (
		<section className="flex flex-col gap-3 rounded-[var(--radius-card-lg)] border border-brass/40 bg-brass-wash p-5 shadow-[var(--shadow-rest)]">
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
			<Link
				href={"/profile" as Route}
				className={cn(
					buttonVariants({ size: "sm" }),
					"h-9 w-full justify-center",
				)}
			>
				{gate.cta}
			</Link>
			<ExpressInterestButton
				caseId={item.id}
				expressed={false}
				disabledReason={gate.title}
				fullWidth
			/>
		</section>
	);

	return (
		// minmax(0,1fr) rather than 1fr: a bare 1fr takes its floor from the
		// content, so one long unbroken line in the story could push the grid wider
		// than the viewport. The right rail carries the decision and the facts.
		<div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_380px]">
			{/* The matter, as the plaintiff published it. */}
			<div className="flex min-w-0 flex-col gap-6">
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
							{item.invitationId
								? "named you as their attorney"
								: item.myInterest?.status === "declined"
									? "took this intake another way"
									: "is seeking representation"}
						</span>
					</div>

					{item.summary && (
						<p className="mt-4 max-w-[70ch] border-brass border-l-2 pl-4 text-[15px] text-ink-soft leading-relaxed">
							{item.summary}
						</p>
					)}
				</div>

				{/* Cover. Height-capped rather than a fixed aspect ratio: 16:9 across a
				    full-width screen is a banner over a thousand pixels tall, which
				    pushes the case itself below the fold. */}
				{item.coverImageUrl && (
					<div className="overflow-hidden rounded-[var(--radius-card-lg)] border border-border bg-surface-2">
						<img
							src={item.coverImageUrl}
							alt=""
							className="max-h-[380px] w-full object-cover"
						/>
					</div>
				)}

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
						<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
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

			{/* The decision, then the facts. Sticky on desktop so the accept/decline
			    stays in reach however far down the story the attorney reads. */}
			<div className="flex flex-col gap-6 lg:sticky lg:top-6 lg:self-start">
				{decision}

				<Panel icon={Paperclip} title="Evidence">
					{item.evidence.length > 0 ? (
						<>
							<ul className="flex flex-col gap-2">
								{item.evidence.map((file) => (
									<EvidenceRow
										key={`${file.name}-${file.size}`}
										file={file}
										// Only the attorney the plaintiff named, or one who has put
										// themselves forward, may open the files — the same gate the
										// serving route enforces (`caseEvidenceFile`). For a plain
										// browsing attorney the row stays a plain, unopenable listing,
										// so no link here ever 404s.
										canOpen={canReviewEvidence}
									/>
								))}
							</ul>
							<p className="mt-3 text-[12px] text-muted-foreground leading-relaxed">
								{canReviewEvidence
									? "Filed by the plaintiff. Open a document to review it before you decide — it opens in a new tab."
									: "Filed by the plaintiff. Express interest to open and review the documents."}
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
