import type { RepresentationCase } from "@just-us/db/requests";
import { buttonVariants } from "@just-us/ui/components/button";
import { cn } from "@just-us/ui/lib/utils";
import {
	ArrowRight,
	Clock,
	Hand,
	Handshake,
	Hourglass,
	Landmark,
	Mail,
	MapPin,
	Scale,
	Search,
	ShieldCheck,
	Users,
} from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

import {
	HeadshotFrame,
	Rating,
	yearsLicensed,
} from "@/components/attorneys/attorney-card";
import { MessageAttorneyButton } from "@/components/messages/message-attorney-button";

/**
 * One case, and where its representation stands.
 *
 * The screen is one card per case rather than a single "your attorney" panel: a
 * plaintiff can be running several matters at different points, and the answer to
 * "who is acting for me, for what fee, and how is it funded" is per case.
 *
 * Cases with nobody on them are shown by the same component, because a case still
 * looking for an attorney is the state that most needs the plaintiff — hiding it
 * would leave the screen quietly incomplete.
 */

/** Where a case's donations land, as `getCasePayoutOptions` resolved it. Null
 *  when there is no destination to report yet — no attorney linked, or a draft
 *  that cannot take a donation either way. */
export type RepresentationPayout = {
	/** The plaintiff has opened donations against the firm's account. */
	bound: boolean;
	/** The name money is paid to — the firm where there is one. */
	recipient: string;
	/** The attorney holding the account, and the address to chase them at. This
	 *  screen's not-ready states are someone else's work, so they have to name who
	 *  rather than read as the plaintiff's own unfinished setup. */
	attorneyName: string;
	attorneyEmail: string;
	hasAccount: boolean;
	detailsSubmitted: boolean;
	transfersEnabled: boolean;
};

export type RepresentationView = RepresentationCase & {
	/** An existing conversation with this attorney, so the button opens it instead
	 *  of offering to start a second one. */
	conversationId: string | null;
	payout: RepresentationPayout | null;
};

/** Every action on a card sits at the same height and padding, whether it is a
 *  Button or a link wearing `buttonVariants`. */
const ACTION = "h-10 px-4";

function money(cents: number) {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		maximumFractionDigits: 0,
	}).format(cents / 100);
}

function formatDate(d: Date) {
	return d.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}

export function RepresentationCaseCard({ view }: { view: RepresentationView }) {
	return (
		<section className="overflow-hidden rounded-[var(--radius-card-lg)] border border-border bg-surface shadow-[var(--shadow-rest)]">
			<CardHeader view={view} />
			{view.attorney ? (
				<div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[1.1fr_1fr]">
					<AttorneyPanel view={view} />
					<FundingPanel view={view} />
				</div>
			) : (
				<NoAttorneyPanel view={view} />
			)}
		</section>
	);
}

function CardHeader({ view }: { view: RepresentationView }) {
	const badge =
		view.status === "live"
			? {
					text: "Active Case",
					cls: "bg-green-soft text-green-deep",
					dot: "bg-success",
				}
			: view.status === "seeking"
				? {
						text: "Seeking attorney",
						cls: "bg-brass-wash text-brass-deep",
						dot: "bg-brass-deep",
					}
				: view.status === "closed"
					? {
							text: "Closed",
							cls: "bg-surface-2 text-ink-soft",
							dot: "bg-ink-soft",
						}
					: view.status === "pending_payout"
						? {
								text: "Awaiting firm",
								cls: "bg-gold-bright/20 text-gold-bright-ink",
								dot: "bg-gold-bright",
							}
						: {
								text: "Draft",
								cls: "bg-surface-2 text-ink-soft",
								dot: "bg-ink-soft",
							};
	const meta = [view.category, view.location].filter(Boolean).join(" · ");

	return (
		<div className="flex flex-wrap items-start justify-between gap-3 border-border border-b px-5 py-4 sm:px-6">
			<div className="min-w-0">
				<div className="flex flex-wrap items-center gap-2">
					<span
						className={cn(
							"inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] px-2.5 py-1 font-mono font-semibold text-[10px] uppercase tracking-[0.06em]",
							badge.cls,
						)}
					>
						<span className={cn("size-1.5 rounded-full", badge.dot)} />
						{badge.text}
					</span>
					{meta && (
						<span className="text-[12.5px] text-muted-foreground">{meta}</span>
					)}
				</div>
				<h2 className="mt-1.5 font-bold text-[17px] text-ink leading-snug">
					{view.title || "Untitled case"}
				</h2>
			</div>
			<Link
				href={`/my-cases/${view.id}` as Route}
				className="inline-flex shrink-0 items-center gap-1.5 font-semibold text-[13px] text-brass-deep hover:underline"
			>
				Manage case
				<ArrowRight className="size-3.5" aria-hidden="true" />
			</Link>
		</div>
	);
}

/**
 * Who is acting, as their profile reads right now.
 *
 * A matched attorney gets what the directory shows — bar standing, rating,
 * practice areas — because that is the record the plaintiff chose them on and it
 * can change under them. An attorney the plaintiff named themselves has none of
 * that, and the panel says so rather than leaving blanks that read as a profile
 * failing to load.
 */
function AttorneyPanel({ view }: { view: RepresentationView }) {
	const attorney = view.attorney;
	if (!attorney) return null;

	const years = yearsLicensed(attorney.admittedYear);
	const verified = attorney.verificationStatus === "verified";
	const onJustUs = !!attorney.userId;

	return (
		<div className="flex flex-col">
			<p className="mb-3 font-mono font-semibold text-[11px] text-muted-foreground uppercase tracking-[0.08em]">
				Your attorney
			</p>

			<div className="flex items-start gap-3.5">
				<HeadshotFrame
					url={attorney.headshotUrl}
					name={attorney.name}
					className="size-12 rounded-full"
				/>
				<div className="min-w-0 flex-1">
					<div className="flex flex-wrap items-center gap-x-2 gap-y-1">
						<p className="font-bold text-[15.5px] text-ink">{attorney.name}</p>
						{verified && (
							<span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] bg-brass-wash px-2 py-0.5 font-semibold text-[11.5px] text-brass-deep">
								<ShieldCheck className="size-3.5" aria-hidden="true" />
								Bar verified
							</span>
						)}
					</div>
					{attorney.firm && (
						<p className="mt-0.5 text-[13px] text-ink-soft">{attorney.firm}</p>
					)}
					<div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
						{onJustUs && (
							<Rating
								rating={attorney.rating}
								reviewCount={attorney.reviewCount}
							/>
						)}
						{years !== null && (
							<span className="text-[12.5px] text-muted-foreground">
								{onJustUs ? "· " : ""}
								{years} {years === 1 ? "year" : "years"} licensed
							</span>
						)}
						{attorney.location && (
							<span className="inline-flex items-center gap-1 text-[12.5px] text-muted-foreground">
								<MapPin className="size-3.5" aria-hidden="true" />
								{attorney.location}
							</span>
						)}
					</div>
					{attorney.practiceAreas.length > 0 && (
						<div className="mt-2 flex flex-wrap gap-1.5">
							{attorney.practiceAreas.map((area) => (
								<span
									key={area}
									className="rounded-[var(--radius-chip)] border border-border bg-paper-alt px-2 py-0.5 font-semibold text-[11.5px] text-ink-soft"
								>
									{area}
								</span>
							))}
						</div>
					)}
				</div>
			</div>

			<p className="mt-3.5 flex items-start gap-2 text-[12.5px] text-ink-soft leading-relaxed">
				<Handshake
					className="mt-0.5 size-3.5 shrink-0 text-brass-deep"
					aria-hidden="true"
				/>
				{howMatched(view)}
			</p>

			{/* One size across the row — `lg` trimmed to 40px, the same pairing the
			    interest card uses. The message button is a Button and the other two
			    are links, so the size has to be stated on all three or they render at
			    different heights. */}
			<div className="mt-4 flex flex-wrap items-center gap-2.5">
				{/* Messaging wherever there is an account to message — including an
				    attorney the plaintiff named by email, whose account is the one this
				    case's money will be paid into. Email is the fallback for an attorney
				    who has no account at all, not the default for the named path. */}
				{attorney.userId && (
					<MessageAttorneyButton
						attorneyId={attorney.userId}
						attorneyName={attorney.name}
						caseId={view.id}
						existingConversationId={view.conversationId}
						size="lg"
						className={ACTION}
					/>
				)}
				{attorney.email && (
					<a
						href={`mailto:${attorney.email}`}
						className={cn(
							buttonVariants({ variant: "outline", size: "lg" }),
							ACTION,
						)}
					>
						<Mail data-icon="inline-start" aria-hidden="true" />
						Email {attorney.name.trim().split(" ")[0]}
					</a>
				)}
				{attorney.profileId && (
					<Link
						href={`/find-attorney/${attorney.profileId}` as Route}
						className={cn(
							buttonVariants({ variant: "outline", size: "lg" }),
							ACTION,
						)}
					>
						View full profile
					</Link>
				)}
			</div>

			{/* An attorney with no account has no channel, and saying so beats a
			    button that cannot work. One reached through the address the plaintiff
			    typed does have a channel — but the link rests on that address being
			    right, which is worth naming before money moves. */}
			{!onJustUs ? (
				<p className="mt-3 text-[12px] text-muted-foreground leading-relaxed">
					{attorney.name} isn't on JustUs, so messages and their firm's payout
					account both wait on them signing up as an attorney
					{attorney.email ? ` with ${attorney.email}` : ""}.
				</p>
			) : attorney.linkedBy === "named_email" ? (
				<p className="mt-3 text-[12px] text-muted-foreground leading-relaxed">
					Matched from the attorney email on your case
					{attorney.email ? ` (${attorney.email})` : ""}. Check this is the
					right firm. It's who your case's donations will be paid to.
				</p>
			) : null}
		</div>
	);
}

/** How this attorney came to be on the case — the record `Match.origin` keeps,
 *  or the address on the case where there is no match to read. */
function howMatched(view: RepresentationView): string {
	const when = view.matchedAt ? ` on ${formatDate(view.matchedAt)}` : "";
	switch (view.origin) {
		case "expressed_interest":
			return `They put themselves forward for your case and you took them on${when}.`;
		case "directory":
			return `You chose them from the JustUs directory${when}.`;
		case "bring_your_own":
			return `You brought them to JustUs yourself${when}.`;
		default:
			return view.attorney?.userId
				? "You named them on your case, and they have a JustUs attorney account. JustUs didn't pick them for you."
				: "You named them on your case. JustUs didn't pick them for you.";
	}
}

/**
 * The agreed fee, what has been raised against it, and whether the firm can
 * actually receive it.
 *
 * All three belong together: the fee is the goal, the goal is what donations are
 * measured against, and a case whose firm has no working payout account is not
 * raising anything no matter what the bar says.
 */
function FundingPanel({ view }: { view: RepresentationView }) {
	const hasGoal = view.goalCents > 0;
	const pct = hasGoal
		? Math.min(100, Math.round((view.raisedCents / view.goalCents) * 100))
		: 0;
	const isLive = view.status === "live";

	return (
		<div className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-border bg-surface-2/50 p-5">
			<div>
				<p className="font-mono font-semibold text-[11px] text-muted-foreground uppercase tracking-[0.08em]">
					Agreed fee
				</p>
				{hasGoal ? (
					<>
						<p className="mt-1.5 font-extrabold text-[26px] text-ink leading-none tracking-[-0.02em]">
							{money(view.goalCents)}
						</p>
						<p className="mt-1.5 text-[12.5px] text-muted-foreground">
							Agreed with {view.attorney?.name ?? "your attorney"}. This is your
							funding goal.
						</p>
					</>
				) : (
					<>
						<p className="mt-1.5 font-extrabold text-[26px] text-ink-soft leading-none tracking-[-0.02em]">
							Not set
						</p>
						<p className="mt-1.5 text-[12.5px] text-muted-foreground leading-relaxed">
							Agree a fee with your attorney. It becomes the goal your case
							raises towards.
						</p>
						<Link
							href={`/cases/new?draft=${view.id}` as Route}
							className="mt-2 inline-flex items-center gap-1.5 font-semibold text-[12.5px] text-brass-deep hover:underline"
						>
							Set the fee
							<ArrowRight className="size-3.5" aria-hidden="true" />
						</Link>
					</>
				)}
			</div>

			<div className="border-border border-t pt-4">
				<p className="font-mono font-semibold text-[11px] text-muted-foreground uppercase tracking-[0.08em]">
					Funding
				</p>
				{isLive ? (
					<>
						<p className="mt-1.5 flex items-baseline gap-2">
							<span className="font-extrabold text-[22px] text-ink tabular-nums tracking-[-0.02em]">
								{money(view.raisedCents)}
							</span>
							{hasGoal && (
								<span className="text-[12.5px] text-muted-foreground">
									of {money(view.goalCents)} · {pct}%
								</span>
							)}
						</p>
						<div className="mt-2.5 h-2 overflow-hidden rounded-full bg-ink/10">
							<div
								className="h-full rounded-full bg-brass"
								style={{ width: `${Math.max(2, pct)}%` }}
							/>
						</div>
						<p className="mt-2.5 inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
							<Users className="size-3.5" aria-hidden="true" />
							{view.donorsCount === 0
								? "No donors yet. Share your case to reach the first one."
								: `${view.donorsCount} ${view.donorsCount === 1 ? "donor" : "donors"} so far`}
						</p>
					</>
				) : (
					<p className="mt-1.5 text-[12.5px] text-ink-soft leading-relaxed">
						{view.status === "closed"
							? "This case is closed, so it's no longer raising."
							: "Donations open once you publish this case. Nothing can be given to it before then."}
					</p>
				)}
			</div>

			<div className="border-border border-t pt-4">
				<p className="font-mono font-semibold text-[11px] text-muted-foreground uppercase tracking-[0.08em]">
					Where donations go
				</p>
				<PayoutLine view={view} />
			</div>
		</div>
	);
}

/**
 * The one line a plaintiff needs about the money: can this case's donations
 * actually land, and if not, whose move is it.
 *
 * Every not-ready state names the attorney and their address. The account is
 * opened by them, per case, and the plaintiff's only available action is to chase
 * — a status that says "pending" without saying who to chase leaves them stuck.
 * The full panel, and the button that opens donations, are on the case page.
 */
function PayoutLine({ view }: { view: RepresentationView }) {
	const payout = view.payout;

	// Nothing resolved, for one of two reasons — and only one of them is a
	// problem. A draft has simply not got there yet; a published case with nobody
	// linked cannot take a donation at all, and saying "once it's published" to a
	// case that already is would hide that.
	if (!payout) {
		if (view.status === "draft") {
			return (
				<PayoutRow icon={Landmark} tone="neutral">
					Donations are paid to the firm representing you, into an account
					opened for this case alone. Your case page shows what's outstanding
					once you publish.
				</PayoutRow>
			);
		}
		const name = view.attorney?.name ?? "Your attorney";
		const email = view.attorney?.email;
		return (
			<PayoutRow icon={Clock} tone="waiting">
				{name} has no JustUs attorney account, so there's no firm account for
				this case to pay into and it can't accept donations yet. Ask them to
				sign up as an attorney{email ? ` with ${email}` : ""}. That's what links
				your case to their firm.
			</PayoutRow>
		);
	}

	if (!payout.hasAccount) {
		return (
			<PayoutRow icon={Clock} tone="waiting">
				{payout.attorneyName} hasn't opened a payout account for this case yet.
				Each case gets its own, so being set up on their other matters doesn't
				cover yours. {payout.attorneyEmail} is the address to nudge.
			</PayoutRow>
		);
	}
	if (!payout.transfersEnabled) {
		return (
			<PayoutRow icon={Clock} tone="waiting">
				{payout.detailsSubmitted
					? `${payout.attorneyName} has submitted this case's setup. Stripe is still verifying the firm's details. Nothing for you to do.`
					: `${payout.attorneyName} started this case's payout setup but hasn't finished it. They complete it in their own JustUs settings; ${payout.attorneyEmail} is the address to nudge.`}
			</PayoutRow>
		);
	}
	return (
		<PayoutRow icon={Landmark} tone="ready">
			{payout.bound
				? `Donations to this case are paid to ${payout.recipient}, who applies them to your fee under their bar's trust rules.`
				: `${payout.recipient} can receive. Open donations from your case page and this case starts raising.`}
		</PayoutRow>
	);
}

function PayoutRow({
	icon: Icon,
	tone,
	children,
}: {
	icon: typeof Landmark;
	tone: "ready" | "waiting" | "neutral";
	children: React.ReactNode;
}) {
	return (
		<div className="mt-2 flex items-start gap-2.5">
			<span
				className={cn(
					"mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full",
					tone === "ready" && "bg-green-soft text-green-deep",
					tone === "waiting" && "bg-brass-wash text-brass-deep",
					tone === "neutral" && "bg-surface-2 text-muted-foreground",
				)}
			>
				<Icon className="size-3.5" aria-hidden="true" />
			</span>
			<p className="text-[12.5px] text-ink-soft leading-relaxed">{children}</p>
		</div>
	);
}

/**
 * A case with nobody on it — either out to attorneys, or not yet asking.
 *
 * The two are different problems. A `seeking` case is waiting on attorneys and
 * the plaintiff's move is to weigh whoever came forward; a draft is waiting on
 * the plaintiff, and the directory is where they go. Neither state gets a funding
 * panel: there is no fee to state and nothing to raise until someone is acting.
 */
function NoAttorneyPanel({ view }: { view: RepresentationView }) {
	const isSeeking = view.status === "seeking";
	const interested = view.openInterest;
	// Waiting on one named attorney. Told apart from "out to attorneys" because it
	// is the opposite: while this is open the case is shown to nobody else, and a
	// plaintiff who reads it as the queue has no way to explain the silence.
	const invited = view.pendingInvitation;

	const heading = invited
		? "Waiting on your attorney to confirm"
		: isSeeking
			? interested > 0
				? `${interested} ${interested === 1 ? "attorney has" : "attorneys have"} put themselves forward`
				: "Out to attorneys"
			: "No attorney yet";

	const body = invited
		? `We emailed ${invited.email} an invitation to confirm they represent you. Until they answer, your case isn't shown to other attorneys. If they haven't by ${formatDate(invited.expiresAt)}, it goes in front of every bar-verified attorney automatically.`
		: isSeeking
			? interested > 0
				? "None of them can contact you. You reach out by choosing one, which sets your attorney and moves you on to agree the fee."
				: "Bar-verified attorneys can see this case and put themselves forward. You'll see them here, and you can connect with an attorney yourself at any time."
			: "Your case needs an attorney before it can name a fee or raise anything. Browse the directory, or publish it out to attorneys and let them come to you.";

	const Icon = invited
		? Hourglass
		: isSeeking
			? interested > 0
				? Hand
				: Hourglass
			: Scale;

	return (
		<div className="flex flex-col items-start gap-3 px-5 py-6 sm:flex-row sm:items-center sm:px-6">
			<span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brass-wash text-brass-deep">
				<Icon className="size-5" aria-hidden="true" />
			</span>
			<div className="min-w-0 flex-1">
				<p className="font-bold text-[15px] text-ink">
					{heading}
					{isSeeking && view.newInterest > 0 && (
						<span className="ml-2 rounded-[var(--radius-pill)] bg-green-soft px-2 py-0.5 font-mono font-semibold text-[10px] text-green-deep uppercase tracking-[0.06em]">
							{view.newInterest} new
						</span>
					)}
				</p>
				<p className="mt-1 max-w-[62ch] text-[13px] text-ink-soft leading-relaxed">
					{body}
				</p>
			</div>
			{invited ? (
				// The wizard is where the invitation lives: resend it, or send it to a
				// different address. The requests inbox cannot receive anything while
				// this is open, so pointing there would be an empty room.
				<Link
					href={`/cases/new?draft=${view.id}` as Route}
					className={cn(
						buttonVariants({ variant: "outline", size: "lg" }),
						ACTION,
						"shrink-0",
					)}
				>
					Manage invitation
					<ArrowRight data-icon="inline-end" aria-hidden="true" />
				</Link>
			) : isSeeking ? (
				<Link
					href={`/my-cases/${view.id}/requests` as Route}
					className={cn(
						buttonVariants({
							variant: interested > 0 ? "default" : "outline",
							size: "lg",
						}),
						ACTION,
						"shrink-0",
					)}
				>
					{interested > 0 ? "Review interest" : "View case"}
					<ArrowRight data-icon="inline-end" aria-hidden="true" />
				</Link>
			) : (
				<Link
					href={"/find-attorney" as Route}
					className={cn(buttonVariants({ size: "lg" }), ACTION, "shrink-0")}
				>
					<Search data-icon="inline-start" aria-hidden="true" />
					Find an attorney
				</Link>
			)}
		</div>
	);
}
