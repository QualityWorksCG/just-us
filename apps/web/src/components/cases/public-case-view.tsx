// biome-ignore-all lint/performance/noImgElement: case images are user-uploaded Blob URLs, not static assets
import type { getPublicCase } from "@just-us/db/cases";
import { cn } from "@just-us/ui/lib/utils";
import {
	Eye,
	Heart,
	Lock,
	Scale,
	ShieldCheck,
	TrendingUp,
	UserRound,
} from "lucide-react";
import type { Route } from "next";
import type { ReactNode } from "react";

import { CaseGallery } from "@/components/cases/case-gallery";
import { CaseUpdates } from "@/components/cases/case-updates";
import { ReportCampaign } from "@/components/cases/report-campaign";
import { DetailBackLink } from "@/components/detail-back-link";
import {
	type DonateConfig,
	PublicCaseActions,
} from "@/components/public-case-actions";

/**
 * One live case, as a donor reads it.
 *
 * Shared by the public `/cases/[id]` page and the in-app `/discover/[id]` screen.
 * The funding claims on here — where the money goes, the fee, who chose the
 * attorney — have to read identically wherever the case appears, and a copy would
 * drift.
 *
 * Two routes rather than one because the in-app screen has to stay inside the
 * dashboard shell. Sending a signed-in donor to the public page dropped them out
 * of the app: the marketing header hides itself once there's a session, so the
 * case became a dead end with no sidebar and nothing to go back with.
 *
 * The page chrome around this — `<main>`, gutters, any max-width — belongs to the
 * route, since the shell already supplies its own.
 */
export type PublicCase = NonNullable<Awaited<ReturnType<typeof getPublicCase>>>;

function money(n: number) {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		maximumFractionDigits: 0,
	}).format(n);
}

function initials(name: string) {
	return (
		name
			.trim()
			.split(/\s+/)
			.slice(0, 2)
			.map((p) => p[0]?.toUpperCase() ?? "")
			.join("") || "—"
	);
}

export function PublicCaseView({
	c,
	backHref,
	backLabel,
	headingLevel = "h1",
	donate,
	fundsNote,
	backers = [],
	donationCount = 0,
	canSave = false,
	initialSaved = false,
	canFollow = false,
	initialFollowing = false,
	updatesHref,
	updatesHighlightSince,
	adminSlot,
}: {
	c: PublicCase;
	/** When set (administrator preview), replaces the donor donate/save/follow
	 *  panel with admin controls, and drops the public report entry — an admin
	 *  acts on the case rather than donating to or reporting it. */
	adminSlot?: ReactNode;
	/** The case's supporters, name or "Anonymous" per each donor's preference. */
	backers?: {
		id: string;
		displayName: string;
		anonymous: boolean;
		amountCents: number;
		at: Date | string | null;
	}[];
	/** Total successful gifts (a donor who gave twice counts twice) — the header
	 *  count and the "+ N more" line, since the list shows individual donations. */
	donationCount?: number;
	/** Whether and how this case can take money, resolved server-side from its
	 *  bound payout account. Required rather than optional: every route that shows
	 *  a case has to answer the donate question the same way, and a default here
	 *  would let a route quietly render a donate card it never checked. */
	donate: DonateConfig;
	/**
	 * Who this case's donations are paid to, in the words the donor reads.
	 *
	 * Passed in rather than written here, because it is derived per case from
	 * `Case.payoutRecipient` — terms §4 commits to stating the recipient for *this*
	 * case, and cases bound before payouts moved to firm accounts still pay the
	 * plaintiff. A single sentence hardcoded in this component was wrong for every
	 * attorney-recipient case, telling those donors the money went to the plaintiff.
	 */
	fundsNote: string;
	/** Where "back" goes — the list this case was opened from. */
	backHref: Route;
	backLabel: string;
	/** "h2" inside the app shell, whose header bar is already the page's h1. */
	headingLevel?: "h1" | "h2";
	/** True only for a signed-in donor — the role that can save a case. */
	canSave?: boolean;
	initialSaved?: boolean;
	/** True for a signed-in user who isn't the case's own team. */
	canFollow?: boolean;
	initialFollowing?: boolean;
	/** The case's full updates page — capping the inline list links out to it. */
	updatesHref?: Route;
	/** Highlight updates newer than this (a follower's last-seen time). */
	updatesHighlightSince?: Date | string | null;
}) {
	const Heading = headingLevel;

	const goal = c.goalCents / 100;
	const raised = c.raisedCents / 100;
	const pctExact = goal > 0 ? (raised / goal) * 100 : 0;
	const pct = Math.min(100, Math.round(pctExact));
	// $75 of $20k is 0.375% — rounding that to "0%" makes a funded case look
	// untouched. Show "<1%" once any money is in, and keep the ring's fill at least
	// a visible sliver so it doesn't read as empty.
	const pctLabel = raised > 0 && pct < 1 ? "<1%" : `${pct}%`;
	const ringDeg = Math.min(
		360,
		(raised > 0 ? Math.max(pctExact, 1.5) : pctExact) * 3.6,
	);
	const owner = c.owner?.name ?? "A plaintiff";
	const ownerFirst = owner.split(" ")[0];
	// Photo-or-initials, same as the rest of the app: the plaintiff shows their
	// account avatar; the matched attorney prefers their directory headshot and
	// falls back to their account avatar. Null on either falls back to initials.
	const ownerImage = c.owner?.image ?? null;
	const attorneyImage =
		c.match?.attorney?.attorneyProfile?.headshotUrl ??
		c.match?.attorney?.image ??
		null;
	const attorneyMeta =
		[c.attorneyFirm, c.attorneyArea, c.attorneyLocation]
			.filter(Boolean)
			.join(" · ") || "—";
	const paragraphs = c.story
		.split(/\n{2,}|\n/)
		.map((p) => p.trim())
		.filter(Boolean);

	return (
		<div>
			{/* Sits above the title, flush with the page's left edge — the same return
			    control the attorney profile and conversation views use. */}
			<DetailBackLink href={backHref} label={backLabel} />

			{/* Header */}
			<div className="mt-4 mb-2.5 flex flex-wrap gap-1.5">
				<span className="rounded-[var(--radius-chip)] bg-brass-wash px-2.5 py-0.5 font-semibold text-[12px] text-brass-deep">
					{c.category || "Case"}
				</span>
				<span className="rounded-[var(--radius-chip)] border border-border px-2.5 py-0.5 text-[12px] text-ink-soft">
					{c.location || "—"}
				</span>
			</div>
			<Heading className="font-extrabold text-[clamp(1.9rem,4vw,2.75rem)] text-ink leading-[1.05] tracking-[-0.03em]">
				{c.title || "Untitled case"}
			</Heading>
			{/* Status — live cases pulse; a closed case reads as resolved, so a backer
			    looking back sees it's over rather than a dead "raising" claim. */}
			{c.status === "closed" ? (
				<div className="mt-3 inline-flex items-center gap-2 rounded-[var(--radius-pill)] bg-surface-2 px-3.5 py-1.5 text-ink-soft">
					<span className="size-2 rounded-full bg-ink-soft" />
					<span className="font-semibold text-[12.5px]">Closed</span>
					<span className="text-ink-soft/50">·</span>
					<span className="font-semibold text-[12.5px] tabular-nums">
						{pctLabel} funded
					</span>
				</div>
			) : (
				<div className="mt-3 inline-flex items-center gap-2 rounded-[var(--radius-pill)] bg-green-soft px-3.5 py-1.5 text-green-deep">
					<span className="relative flex size-2">
						<span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60" />
						<span className="relative inline-flex size-2 rounded-full bg-success" />
					</span>
					<span className="font-semibold text-[12.5px]">Active Case</span>
					<span className="text-green-deep/50">·</span>
					<span className="font-semibold text-[12.5px] tabular-nums">
						{pctLabel} funded
					</span>
				</div>
			)}

			{/* Two columns — image beside the funding card; on mobile the funding card
			    jumps above the story so donating/saving stays near the top. */}
			<div className="mt-6 grid items-start gap-8 lg:grid-cols-[1fr_360px] lg:grid-rows-[auto_1fr]">
				{/* Cover + parties — first on mobile, top-left on desktop */}
				<div className="order-1 lg:col-start-1 lg:row-start-1">
					{/* Cover */}
					<div className="overflow-hidden rounded-[var(--radius-card-lg)] border border-border bg-surface-2">
						{c.coverImageUrl ? (
							<img
								src={c.coverImageUrl}
								alt=""
								className="aspect-[16/9] w-full object-cover"
							/>
						) : (
							<div className="flex aspect-[16/9] w-full items-center justify-center text-brass-deep/40">
								<Scale className="size-12" aria-hidden="true" />
							</div>
						)}
					</div>

					{/* Who's on this case — plaintiff (raising) and attorney (representing) */}
					<div className="mt-5 flex flex-wrap items-center gap-x-8 gap-y-4 border-border border-b pb-5">
						<div className="flex items-center gap-2.5">
							<span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-green-soft font-bold text-[13px] text-green-deep">
								{ownerImage ? (
									<img
										src={ownerImage}
										alt=""
										className="size-full object-cover"
									/>
								) : (
									initials(owner)
								)}
							</span>
							<div>
								<p className="font-bold text-[15px] text-ink">{owner}</p>
								<p className="font-mono text-[10.5px] text-muted-foreground uppercase tracking-[0.07em]">
									Plaintiff · bringing this case
								</p>
							</div>
						</div>
						{c.attorneyName ? (
							<div className="flex items-center gap-2.5">
								<span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brass-wash font-bold text-[13px] text-brass-deep">
									{attorneyImage ? (
										<img
											src={attorneyImage}
											alt=""
											className="size-full object-cover"
										/>
									) : (
										initials(c.attorneyName)
									)}
								</span>
								<div>
									<p className="font-bold text-[15px] text-ink">
										{c.attorneyName}
									</p>
									<p className="font-mono text-[10.5px] text-muted-foreground uppercase tracking-[0.07em]">
										Attorney · representing
									</p>
								</div>
							</div>
						) : (
							<div className="flex items-center gap-2.5">
								<span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-line-strong border-dashed text-muted-foreground">
									<UserRound className="size-[18px]" aria-hidden="true" />
								</span>
								<div>
									<p className="font-semibold text-[15px] text-muted-foreground">
										Not yet chosen
									</p>
									<p className="font-mono text-[10.5px] text-muted-foreground uppercase tracking-[0.07em]">
										Attorney
									</p>
								</div>
							</div>
						)}
					</div>
				</div>

				{/* Funding sidebar — right column (sticky) on desktop; on mobile it sits
				    right under the image via order-2 so donating stays near the top. */}
				<div className="order-2 flex flex-col gap-4 lg:sticky lg:top-6 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start">
					<div className="rounded-[var(--radius-card-lg)] border border-border bg-surface p-6 shadow-[var(--shadow-rest)]">
						<div className="flex items-center gap-4">
							{/* Progress ring */}
							<div
								className="relative flex size-[76px] shrink-0 items-center justify-center rounded-full"
								style={{
									background: `conic-gradient(var(--success) ${ringDeg}deg, var(--surface-2) 0)`,
								}}
							>
								<div className="flex size-[60px] items-center justify-center rounded-full bg-surface">
									<span className="font-extrabold text-[15px] text-ink tabular-nums leading-none">
										{pctLabel}
									</span>
								</div>
							</div>
							<div className="min-w-0">
								<p className="font-extrabold text-[22px] text-ink leading-tight tracking-[-0.02em]">
									{money(raised)}{" "}
									<span className="font-semibold text-[15px] text-muted-foreground">
										raised
									</span>
								</p>
								<p className="text-[13.5px] text-muted-foreground">
									of {money(goal)} goal
								</p>
								<p className="mt-0.5 text-[12.5px] text-muted-foreground">
									{donationCount}{" "}
									{donationCount === 1 ? "donation" : "donations"}
								</p>
							</div>
						</div>
						<div className="mt-5">
							{/* An administrator previewing the case gets oversight controls
							    here instead of the donor's donate/save/follow panel. */}
							{adminSlot ?? (
								// Always the public link, even from inside the app — the in-app
								// route is signed-in only, so sharing it would send everyone
								// else to the login screen.
								<PublicCaseActions
									caseId={c.id}
									sharePath={`/cases/${c.id}`}
									config={donate}
									canSave={canSave}
									initialSaved={initialSaved}
									canFollow={canFollow}
									initialFollowing={initialFollowing}
								/>
							)}
						</div>
					</div>

					{/* Recent donations — no per-donor records yet, honest empty state */}
					<div className="rounded-[var(--radius-card-lg)] border border-border bg-surface p-6 shadow-[var(--shadow-rest)]">
						<div className="mb-4 flex items-center gap-2.5">
							<span className="flex size-8 items-center justify-center rounded-full bg-brass-wash text-brass-deep">
								<TrendingUp className="size-4" aria-hidden="true" />
							</span>
							<p className="font-bold text-[14px] text-ink">
								{donationCount > 0
									? `${donationCount} ${donationCount === 1 ? "donation" : "donations"}`
									: "Recent donations"}
							</p>
						</div>
						{backers.length > 0 ? (
							<ul className="flex flex-col gap-1">
								{backers.map((b) => (
									<li
										key={b.id}
										className="flex items-center gap-3 rounded-[var(--radius-card)] px-2 py-2"
									>
										<span
											className={cn(
												"flex size-8 shrink-0 items-center justify-center rounded-full font-bold text-[11px]",
												b.anonymous
													? "bg-surface-2 text-muted-foreground"
													: "bg-green-soft text-green-deep",
											)}
										>
											{b.anonymous ? "—" : initials(b.displayName)}
										</span>
										<span className="min-w-0 flex-1 truncate font-semibold text-[13px] text-ink">
											{b.displayName}
										</span>
										<span className="shrink-0 font-bold text-[13px] text-ink tabular-nums">
											{money(b.amountCents / 100)}
										</span>
									</li>
								))}
								{donationCount > backers.length && (
									<li className="px-2 pt-1 text-[12px] text-muted-foreground">
										+ {donationCount - backers.length} more
									</li>
								)}
							</ul>
						) : c.donorsCount > 0 ? (
							<p className="text-[13px] text-ink-soft leading-relaxed">
								{c.donorsCount === 1
									? "1 person has"
									: `${c.donorsCount} people have`}{" "}
								backed this case so far.
							</p>
						) : (
							<div className="flex flex-col items-center gap-2 rounded-[var(--radius-card)] border border-border border-dashed bg-surface/60 px-4 py-6 text-center">
								<span className="flex size-9 items-center justify-center rounded-full bg-green-soft text-green-deep">
									<Heart className="size-4" aria-hidden="true" />
								</span>
								<p className="font-semibold text-[13.5px] text-ink">
									Be the first to support {ownerFirst}
								</p>
								<p className="max-w-[30ch] text-[12px] text-muted-foreground leading-relaxed">
									Every gift helps fund {ownerFirst}'s day in court.
								</p>
							</div>
						)}
					</div>

					{/* Trust notes */}
					<div className="flex flex-col gap-2.5 rounded-[var(--radius-card-lg)] border border-border bg-surface/60 p-5 text-[12.5px] text-ink-soft">
						<span className="flex items-start gap-2">
							<Lock
								className="mt-0.5 size-4 shrink-0 text-brass-deep"
								aria-hidden="true"
							/>
							{fundsNote}
						</span>
						<span className="flex items-start gap-2">
							<Eye
								className="mt-0.5 size-4 shrink-0 text-brass-deep"
								aria-hidden="true"
							/>
							One 5% fee, shown to you before you give.
						</span>
						<span className="flex items-start gap-2">
							<ShieldCheck
								className="mt-0.5 size-4 shrink-0 text-brass-deep"
								aria-hidden="true"
							/>
							{ownerFirst} chose their own attorney.
						</span>
					</div>
				</div>

				{/* Story, gallery, updates — left column row 2 (after the funding card on
				    mobile so donate/save stays near the top) */}
				<div className="order-3 flex flex-col gap-8 lg:col-start-1 lg:row-start-2">
					<section>
						<h2 className="mb-3 font-bold text-[18px] text-ink">The story</h2>
						<div className="flex flex-col gap-3 text-[15px] text-ink-soft leading-relaxed">
							{paragraphs.length > 0 ? (
								paragraphs.map((p, i) => (
									<p key={`${i}-${p.slice(0, 12)}`}>{p}</p>
								))
							) : (
								<p>{c.summary}</p>
							)}
						</div>
					</section>

					{/* Gallery — small thumbnails; click one to view it full size. */}
					{c.images.length > 0 && (
						<section>
							<h2 className="mb-3 font-bold text-[18px] text-ink">Photos</h2>
							<CaseGallery images={c.images} />
						</section>
					)}

					{/* Case updates — the matched attorney's broadcast progress (JUS-33) */}
					<section>
						<h2 className="mb-3 flex items-center gap-2 font-bold text-[18px] text-ink">
							Case updates
							{c.updates.length > 0 && (
								<span className="inline-flex min-w-5 items-center justify-center rounded-full bg-surface-2 px-1.5 py-0.5 font-bold text-[11px] text-ink-soft">
									{c.updates.length}
								</span>
							)}
						</h2>
						<CaseUpdates
							updates={c.updates.map((u) => {
								const isOwner = u.authorId === c.ownerId;
								return {
									id: u.id,
									body: u.body,
									createdAt: u.createdAt,
									editedAt: u.editedAt,
									authorId: u.authorId,
									tag: u.tag,
									attachments: Array.isArray(u.attachments)
										? (u.attachments as {
												url: string;
												name: string;
												contentType: string;
											}[])
										: [],
									authorRole: isOwner
										? ("plaintiff" as const)
										: ("attorney" as const),
									authorName: isOwner ? owner : (c.attorneyName ?? "Attorney"),
								};
							})}
							viewerId=""
							viewerRole="donor"
							caseId={c.id}
							limit={2}
							viewAllHref={updatesHref}
							highlightSince={updatesHighlightSince}
							emptyHint={`No updates yet. ${ownerFirst}'s attorney will post progress here.`}
						/>
					</section>

					{/* Represented by */}
					{c.attorneyName && (
						<section>
							<h2 className="mb-3 font-bold text-[18px] text-ink">
								Represented by
							</h2>
							<div className="flex items-center gap-3 rounded-[var(--radius-card-lg)] border border-border bg-surface p-5 shadow-[var(--shadow-rest)]">
								<span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brass font-bold text-[13px] text-white">
									{attorneyImage ? (
										<img
											src={attorneyImage}
											alt=""
											className="size-full object-cover"
										/>
									) : (
										initials(c.attorneyName)
									)}
								</span>
								<div>
									<p className="font-bold text-[15px] text-ink">
										{c.attorneyName}
									</p>
									<p className="text-[12.5px] text-muted-foreground">
										{attorneyMeta}
									</p>
								</div>
							</div>
						</section>
					)}

					{/* Quiet, always-available public report entry point (Reg. & Ops §3–4).
					    An administrator acts on the case directly, so it's dropped there. */}
					{!adminSlot && (
						<div className="flex justify-end pt-2">
							<ReportCampaign targetId={c.id} targetType="case" />
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
