import type { PendingInvitationForAttorney } from "@just-us/db/case-invitations";
import { Handshake, MapPin, Tag, Wallet } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

import type { VerificationStatus } from "@/lib/attorney-verification";
import { caseInviteHref } from "@/lib/case-invite-ref";
import { withNext } from "@/lib/next-path";

import { money } from "./attorney-cases";

/**
 * The cases an attorney has been asked to take on, on the screen they actually
 * open.
 *
 * Until this existed the invitation lived in exactly one place: the emailed link.
 * Only the hash of its token is stored, so nothing in the product could rebuild
 * that link — and the invited attorney is sent away twice on the way to
 * answering it, once to finish onboarding and again to have their bar standing
 * checked. Either detour, or simply closing the tab, left them with a dashboard
 * that said nothing about the plaintiff waiting on them and no way back. Their
 * matched cases panel showed nothing, the queue hid the case (a pending
 * invitation is what holds it out), and the plaintiff's week ran down.
 *
 * So the invitation is stated here, with the reason they can't answer it yet
 * spelled out rather than left to be discovered on the invitation screen. An
 * unverified attorney is sent to the directory profile that owns the bar check,
 * carrying a way back; a verified one goes straight to the decision.
 *
 * Nothing here is a permission check — `confirmCaseInvitation` re-applies every
 * one of these conditions in its own transaction. This only decides what to say.
 */
export function AttorneyInvitations({
	invitations,
	verification,
}: {
	invitations: PendingInvitationForAttorney[];
	verification: VerificationStatus;
}) {
	if (invitations.length === 0) return null;

	return (
		<section className="mb-10">
			<h2 className="font-bold text-[18px] text-ink">
				{invitations.length === 1
					? "You've been asked to represent a case"
					: `You've been asked to represent ${invitations.length} cases`}
			</h2>
			<p className="mt-1 max-w-[640px] text-[14.5px] text-ink-soft leading-relaxed">
				A plaintiff named you as their attorney. Their case is held off the
				queue until you answer, so it waits on you rather than going in front of
				other attorneys.
			</p>
			<div className="mt-5 flex flex-col gap-4">
				{invitations.map((invitation) => (
					<InvitationCard
						key={invitation.id}
						invitation={invitation}
						verification={verification}
					/>
				))}
			</div>
		</section>
	);
}

/** Whole days left, rounded up: "expires in 1 day" should still be true for the
 *  last few hours of it, because that is the day they have to act in. */
function daysLeft(expiresAt: Date) {
	const ms = expiresAt.getTime() - Date.now();
	if (ms <= 0) return 0;
	return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

function InvitationCard({
	invitation,
	verification,
}: {
	invitation: PendingInvitationForAttorney;
	verification: VerificationStatus;
}) {
	const href = caseInviteHref({ invitationId: invitation.id });
	const verified = verification === "verified";
	// A check already under way needs no second run; an unverified or rejected one
	// is the attorney's move, and the profile is where that move is made.
	const awaitingCheck =
		verification === "pending" || verification === "needs_review";
	const left = daysLeft(invitation.expiresAt);

	return (
		<div className="rounded-[var(--radius-card)] border border-brass-deep/30 bg-brass-wash/60 px-5 py-4">
			<div className="flex items-start gap-3">
				<span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-brass-deep text-white">
					<Handshake className="size-4" aria-hidden="true" />
				</span>
				<div className="min-w-0 flex-1">
					<p className="font-bold text-[14px] text-ink">
						{invitation.plaintiffName} named you as their attorney
					</p>
					<p className="mt-1 font-semibold text-[14px] text-ink leading-snug">
						{invitation.caseTitle || "Untitled case"}
					</p>
					<ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-[13px] text-ink-soft">
						<Fact icon={Tag} value={invitation.category} />
						<Fact icon={MapPin} value={invitation.location} />
						<Fact
							icon={Wallet}
							value={`${money(invitation.goalCents)} agreed fee`}
						/>
					</ul>

					{/* Why they can't answer yet, said here rather than only on the
					    invitation screen — the whole point of this card is that the
					    blocker is what they need to know from their dashboard. */}
					{!verified && (
						<p className="mt-2.5 text-[13px] text-ink-soft leading-relaxed">
							{awaitingCheck
								? "Your bar standing is still being checked. As soon as it clears you'll be able to confirm — nothing else is needed from you."
								: "Every attorney is checked against their state bar before taking on a case, including one they were invited to. Complete yours to unlock this."}
						</p>
					)}

					<div className="mt-3 flex flex-wrap items-center gap-2">
						{verified || awaitingCheck ? (
							<Link href={href as Route} className={primaryClass}>
								{verified ? "Review and confirm" : "Review the invitation"}
							</Link>
						) : (
							<>
								<Link
									href={withNext("/profile", href) as Route}
									className={primaryClass}
								>
									Complete verification
								</Link>
								<Link href={href as Route} className={secondaryClass}>
									Review the invitation
								</Link>
							</>
						)}
						<span className="text-[12.5px] text-ink-soft">
							{left <= 1
								? "Expires today"
								: `Expires in ${left} days${left <= 2 ? " — the case goes back to the queue after that" : ""}`}
						</span>
					</div>
				</div>
			</div>
		</div>
	);
}

const primaryClass =
	"inline-flex h-9 items-center justify-center rounded-[var(--radius-control)] bg-brass px-4 font-semibold text-[13px] text-white transition-colors hover:bg-brass-deep";

const secondaryClass =
	"inline-flex h-9 items-center justify-center rounded-[var(--radius-control)] border border-line-strong bg-surface px-4 font-semibold text-[13px] text-ink transition-colors hover:bg-paper";

function Fact({ icon: Icon, value }: { icon: typeof Tag; value: string }) {
	if (!value) return null;
	return (
		<li className="inline-flex items-center gap-1.5">
			<Icon className="size-3.5 text-muted-foreground" aria-hidden="true" />
			{value}
		</li>
	);
}
