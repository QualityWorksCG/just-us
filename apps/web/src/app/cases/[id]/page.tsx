// biome-ignore-all lint/performance/noImgElement: case images are user-uploaded Blob URLs, not static assets
import { getPublicCase } from "@just-us/db/cases";
import {
	donorSupportForCase,
	getDonationForCheckoutSession,
	listCaseBackers,
} from "@just-us/db/donations";
import { resolvePayoutDestination } from "@just-us/db/payouts";
import {
	donationPresets,
	minDonationCents,
	platformFeeBps,
} from "@just-us/payments";
import {
	Eye,
	HeartHandshake,
	Lock,
	Megaphone,
	Scale,
	ShieldCheck,
} from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DonationReceipt } from "@/components/donation-receipt";
import { PublicCaseActions } from "@/components/public-case-actions";
import { getSession } from "@/lib/auth-server";
import {
	syncDonationBySession,
	syncPendingDonationsForCase,
} from "@/lib/donation-sync";

function money(n: number) {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		maximumFractionDigits: 0,
	}).format(n);
}

function exactMoney(cents: number) {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
	}).format(cents / 100);
}

/**
 * How a backer is named in public.
 *
 * First name and last initial, not the full name Checkout collected. That name was
 * given to pay for something, not to be published next to an amount on a page
 * anyone can read — and there is no "give anonymously" choice on the donate card
 * yet, so the conservative rendering is the only consent we can honour. A donation
 * with no name at all shows as "Anonymous" rather than an empty row.
 */
function backerName(name: string | null) {
	const parts = name?.trim().split(/\s+/).filter(Boolean) ?? [];
	if (parts.length === 0) return "Anonymous";
	const [first, ...rest] = parts;
	const lastInitial = rest.at(-1)?.[0];
	return lastInitial ? `${first} ${lastInitial.toUpperCase()}.` : first;
}

/** "2 hours ago" — a backers list is about recency, not timestamps. */
function timeAgo(date: Date | null) {
	if (!date) return "just now";
	const seconds = Math.max(0, (Date.now() - date.getTime()) / 1000);
	const units: [Intl.RelativeTimeFormatUnit, number][] = [
		["year", 31_536_000],
		["month", 2_592_000],
		["week", 604_800],
		["day", 86_400],
		["hour", 3600],
		["minute", 60],
	];
	const rtf = new Intl.RelativeTimeFormat("en-US", { numeric: "auto" });
	for (const [unit, secondsPer] of units) {
		if (seconds >= secondsPer) {
			return rtf.format(-Math.floor(seconds / secondsPer), unit);
		}
	}
	return "just now";
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

export async function generateMetadata({
	params,
}: {
	params: Promise<{ id: string }>;
}): Promise<Metadata> {
	const { id } = await params;
	const c = await getPublicCase(id);
	if (!c) return { title: "Case not found" };
	return {
		title: `${c.title} · JustUs Financial`,
		description: c.summary || c.story.slice(0, 155),
	};
}

export default async function PublicCasePage({
	params,
	searchParams,
}: {
	params: Promise<{ id: string }>;
	/** Set by Stripe's return URL after a payment — see `donate-actions.ts`. */
	searchParams: Promise<{ donated?: string; session_id?: string }>;
}) {
	const { id } = await params;
	const sp = await searchParams;

	// Reconcile *before* the case is read, so the totals below are the ones after
	// any paid-but-unapplied donation lands rather than one render behind it. The
	// donor's own session id is reconciled first and exactly; the sweep then covers
	// donations by anyone else that a late or undelivered webhook left pending.
	const returningSessionId =
		sp.donated === "1" && sp.session_id ? sp.session_id : null;
	if (returningSessionId) await syncDonationBySession(returningSessionId);
	await syncPendingDonationsForCase(id);

	const c = await getPublicCase(id);
	if (!c) notFound();

	const goal = c.goalCents / 100;
	const raised = c.raisedCents / 100;
	const pct = goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : 0;
	const owner = c.owner?.name ?? "A plaintiff";
	const ownerFirst = owner.split(" ")[0];
	const attorneyMeta =
		[c.attorneyFirm, c.attorneyArea, c.attorneyLocation]
			.filter(Boolean)
			.join(" · ") || "—";

	// Can this case actually take money right now? Resolved server-side from the
	// case's *bound* payout account, so the button state and the charge path agree
	// rather than each deciding for itself.
	const destination = await resolvePayoutDestination(c.id);
	const BLOCKED: Record<string, string> = {
		not_live: "This case isn't raising right now.",
		unbound:
			"This case is still setting up where donations go, so it can't accept them yet.",
		transfers_disabled:
			"The receiving law firm's payout setup is still being verified. Donations open as soon as it clears.",
	};

	// Who this case's donations are paid to, read from the case's own
	// `payoutRecipient` rather than asserted globally — terms §4 commits to stating it
	// *per case*, and cases bound before the move to firm accounts still pay the
	// plaintiff. Telling their donors otherwise would make a disclosure those donors
	// already acted on retroactively false. Null means nothing is designated yet, and
	// the note must claim nobody rather than promise on a case that cannot receive.
	const firmLabel =
		destination.ok && (destination.holderFirm ?? destination.holderName)
			? (destination.holderFirm ?? destination.holderName)
			: (c.attorneyFirm ?? c.attorneyName ?? null);
	const fundsNote =
		c.payoutRecipient === "attorney"
			? firmLabel
				? `Funds go to ${firmLabel} — the law firm representing ${ownerFirst}, not to ${ownerFirst} and never to JustUs.`
				: `Funds go to the law firm representing ${ownerFirst} — never to JustUs.`
			: c.payoutRecipient === "plaintiff"
				? `Funds go to ${ownerFirst}'s account — ${ownerFirst} pays the attorney directly.`
				: "Funds go to the recipient this case designates — never to JustUs.";
	const paragraphs = c.story
		.split(/\n{2,}|\n/)
		.map((p) => p.trim())
		.filter(Boolean);

	// Who's already given, and whether the person reading is one of them. The email
	// is only offered as a match key when it is *verified*, for the same reason
	// `claimGuestDonations` insists on one: anyone can type another person's address
	// into Checkout, and an unverified match would report a stranger's giving back.
	const session = await getSession();
	const viewer = session?.user ?? null;
	const [backers, mySupport, myDonation] = await Promise.all([
		listCaseBackers(c.id),
		viewer
			? donorSupportForCase({
					caseId: c.id,
					donorId: viewer.id,
					donorEmail: viewer.emailVerified ? viewer.email : null,
				})
			: Promise.resolve({ totalCents: 0, count: 0 }),
		returningSessionId
			? getDonationForCheckoutSession({
					stripeCheckoutSessionId: returningSessionId,
					caseId: c.id,
				})
			: Promise.resolve(null),
	]);
	const iBackedThis = mySupport.count > 0;

	return (
		<main className="h-full overflow-y-auto bg-paper">
			<div className="mx-auto max-w-[1100px] px-6 py-10 sm:py-14">
				{/* Just paid. Confirms the gift and keeps refreshing this render until the
				    donation settles, so the totals below catch up without a manual reload. */}
				{returningSessionId && (
					<DonationReceipt
						settled={myDonation?.status === "succeeded"}
						amountLabel={myDonation ? exactMoney(myDonation.amountCents) : null}
					/>
				)}

				{/* Header */}
				<div className="mb-2.5 flex flex-wrap gap-1.5">
					<span className="rounded-[var(--radius-chip)] bg-brass-wash px-2.5 py-0.5 font-semibold text-[12px] text-brass-deep">
						{c.category || "Case"}
					</span>
					<span className="rounded-[var(--radius-chip)] border border-border px-2.5 py-0.5 text-[12px] text-ink-soft">
						{c.location || "—"}
					</span>
				</div>
				<div className="flex flex-wrap items-center gap-3">
					<h1 className="font-extrabold text-[clamp(1.9rem,4vw,2.75rem)] text-ink leading-[1.05] tracking-[-0.03em]">
						{c.title || "Untitled case"}
					</h1>
					<span className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-green-soft px-3 py-1 font-mono font-semibold text-[11px] text-green-deep uppercase tracking-[0.06em]">
						<span className="size-1.5 rounded-full bg-success" />
						Live · raising
					</span>
				</div>
				<div className="mt-3 flex items-center gap-2 text-[13.5px] text-muted-foreground">
					<span className="flex size-6 items-center justify-center rounded-full bg-green-soft font-bold text-[10px] text-green-deep">
						{initials(owner)}
					</span>
					<span className="font-semibold text-ink">{owner}</span>
					{c.attorneyName ? <span>· with {c.attorneyName}</span> : null}
				</div>

				{/* Cover */}
				<div className="mt-6 overflow-hidden rounded-[var(--radius-card-lg)] border border-border bg-surface-2">
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

				{/* Two columns */}
				<div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
					{/* Left — story + attorney */}
					<div className="flex flex-col gap-8">
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

						{/* Gallery */}
						{c.images.length > 0 && (
							<section>
								<h2 className="mb-3 font-bold text-[18px] text-ink">Photos</h2>
								<div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
									{c.images.map((url) => (
										<img
											key={url}
											src={url}
											alt=""
											className="aspect-square w-full rounded-[var(--radius-card-sm)] border border-border object-cover"
										/>
									))}
								</div>
							</section>
						)}

						{/* Case updates — no updates model yet, honest empty state */}
						<section>
							<h2 className="mb-3 font-bold text-[18px] text-ink">
								Case updates
							</h2>
							<div className="flex items-center gap-2.5 rounded-[var(--radius-card)] border border-border border-dashed bg-surface/60 px-4 py-4 text-[13.5px] text-muted-foreground">
								<Megaphone className="size-4 shrink-0" aria-hidden="true" />
								No updates yet — {ownerFirst}'s attorney will post progress
								here.
							</div>
						</section>

						{/* Represented by */}
						{c.attorneyName && (
							<section>
								<h2 className="mb-3 font-bold text-[18px] text-ink">
									Represented by
								</h2>
								<div className="flex items-center gap-3 rounded-[var(--radius-card-lg)] border border-border bg-surface p-5 shadow-[var(--shadow-rest)]">
									<span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brass font-bold text-[13px] text-white">
										{initials(c.attorneyName)}
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
					</div>

					{/* Right — funding sidebar */}
					<div className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
						<div className="rounded-[var(--radius-card-lg)] border border-border bg-surface p-6 shadow-[var(--shadow-rest)]">
							<p className="font-extrabold text-[34px] text-ink tabular-nums leading-none tracking-[-0.02em]">
								{money(raised)}
							</p>
							<p className="mt-2 text-[13.5px] text-muted-foreground">
								raised of {money(goal)} goal · {pct}%
							</p>
							<div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-2">
								<div
									className="h-full rounded-full bg-brass"
									style={{ width: `${Math.max(2, pct)}%` }}
								/>
							</div>
							<p className="mt-3 font-semibold text-[13px] text-ink">
								{c.donorsCount} {c.donorsCount === 1 ? "donor" : "donors"}
							</p>

							{/* Recognise a returning donor. Someone who has already given and
							    is shown the same undifferentiated donate card has no way to
							    tell whether their gift registered. */}
							{iBackedThis && (
								<p className="mt-3 flex items-center gap-2 rounded-[var(--radius-card-sm)] bg-green-soft px-3 py-2 font-semibold text-[12.5px] text-green-deep">
									<HeartHandshake
										className="size-4 shrink-0"
										aria-hidden="true"
									/>
									You backed this case — {exactMoney(mySupport.totalCents)}{" "}
									given
									{mySupport.count > 1
										? ` across ${mySupport.count} gifts`
										: ""}
								</p>
							)}

							<div className="mt-5">
								<PublicCaseActions
									sharePath={`/cases/${c.id}`}
									caseId={c.id}
									config={{
										presetsCents: donationPresets(),
										minCents: minDonationCents(),
										feeBps: platformFeeBps(),
										alreadyBacked: iBackedThis,
										canDonate: destination.ok,
										blockedReason: destination.ok
											? null
											: (BLOCKED[destination.reason] ?? null),
									}}
								/>
							</div>
						</div>

						{/* Recent backers */}
						<div className="rounded-[var(--radius-card-lg)] border border-border bg-surface p-6 shadow-[var(--shadow-rest)]">
							<p className="mb-3 font-mono font-semibold text-[11px] text-muted-foreground uppercase tracking-[0.08em]">
								Recent backers
							</p>
							{backers.length > 0 ? (
								<>
									<ul className="flex flex-col gap-3">
										{backers.map((b) => {
											const mine = !!viewer && b.donorId === viewer.id;
											return (
												<li key={b.id} className="flex items-center gap-2.5">
													<span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brass-wash font-bold text-[10.5px] text-brass-deep">
														{b.donorName ? initials(b.donorName) : "★"}
													</span>
													<span className="min-w-0 flex-1">
														<span className="flex items-center gap-1.5">
															<span className="truncate font-semibold text-[13px] text-ink">
																{mine ? "You" : backerName(b.donorName)}
															</span>
															{mine && (
																<span className="rounded-[var(--radius-chip)] bg-green-soft px-1.5 py-px font-mono font-semibold text-[9.5px] text-green-deep uppercase tracking-[0.06em]">
																	Your gift
																</span>
															)}
														</span>
														<span className="block text-[11.5px] text-muted-foreground">
															{timeAgo(b.succeededAt)}
														</span>
													</span>
													<span className="shrink-0 font-bold text-[13px] text-brass-deep tabular-nums">
														{exactMoney(b.amountCents)}
													</span>
												</li>
											);
										})}
									</ul>
									{c.donorsCount > backers.length && (
										<p className="mt-3 border-border border-t pt-3 text-[12px] text-muted-foreground">
											…and {c.donorsCount - backers.length} more{" "}
											{c.donorsCount - backers.length === 1
												? "donor"
												: "donors"}
											.
										</p>
									)}
								</>
							) : (
								<p className="text-[13px] text-muted-foreground leading-relaxed">
									No backers yet — be the first to help {ownerFirst} fund this
									case.
								</p>
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
				</div>
			</div>
		</main>
	);
}
