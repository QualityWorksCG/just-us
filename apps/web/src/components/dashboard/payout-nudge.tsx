import { Landmark } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

/**
 * The attorney's warning that clients are stuck behind their payout setup.
 *
 * Donations to a case are paid to the firm representing it, which puts the blocking
 * step on the attorney — while every consequence of not doing it lands on their
 * client, whose case is public, published, and unable to take a dollar. Nothing else
 * on the attorney's screens would tell them that.
 *
 * Per-case accounts make this sharper, not softer: an attorney who completed setup for
 * one matter has every reason to believe they are done, and no reason to guess that a
 * second case needs its own account. So the count is what leads, and the copy
 * distinguishes "none started" from "started but unfinished" — a firm on five cases can
 * be in both states at once.
 *
 * Rendered only when they can act: `waitingCases` is zero once every live case's own
 * account can receive (see `attorneyPayoutReadiness`), so this disappears on its own
 * rather than needing a dismissal.
 */
export function PayoutNudge({
	waitingCases,
	unstartedCases,
	inReviewCases,
	blockedCases = 0,
}: {
	waitingCases: number;
	/** Of those waiting, how many have no account at all yet. */
	unstartedCases: number;
	/** Of those waiting, how many are simply awaiting Stripe rather than the holder. */
	inReviewCases: number;
	/** Of those waiting, how many are `pending_payout` — not public at all yet. */
	blockedCases?: number;
}) {
	if (waitingCases < 1) return null;

	const cases =
		waitingCases === 1
			? "A case you represent"
			: `${waitingCases} cases you represent`;
	// Everything outstanding is with Stripe, so there is no action to offer — only the
	// reassurance that they are not the holdup.
	const allInReview = inReviewCases === waitingCases;
	const hasAccount = unstartedCases === 0;
	const detailsSubmitted = allInReview;

	return (
		<div className="mb-6 flex items-start gap-3 rounded-[var(--radius-card)] border border-brass-deep/30 bg-brass-wash/60 px-5 py-4">
			<span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-brass-deep text-white">
				<Landmark className="size-4" aria-hidden="true" />
			</span>
			<div className="min-w-0 flex-1">
				<p className="font-bold text-[14px] text-ink">
					{blockedCases > 0
						? `${cases} can't go public yet`
						: `${cases} can't accept donations yet`}
				</p>
				<p className="mt-1 text-[13px] text-ink-soft leading-relaxed">
					{detailsSubmitted
						? "Stripe is still verifying the details you submitted. There's nothing more for you to do — donations open as soon as it clears."
						: hasAccount
							? "The payout accounts for these cases aren't finished, so donations to them are blocked. Your clients can't do anything about it from their side."
							: "Each case is paid into its own account against your firm's operating account, and these don't have one yet. Until they do, the cases are published but unable to raise."}
				</p>
				{/* The sharper consequence, and the one an attorney will not guess: a
				    case held at `pending_payout` has no public page at all. Their client
				    finished everything and still has nothing to share. */}
				{blockedCases > 0 && !detailsSubmitted && (
					<p className="mt-1.5 text-[13px] text-ink-soft leading-relaxed">
						{blockedCases === 1
							? "One of them hasn't been published at all — that client is waiting on this before their campaign can even start."
							: `${blockedCases} of them haven't been published at all — those clients are waiting on this before their campaigns can even start.`}
					</p>
				)}
				{!detailsSubmitted && (
					// To the cases themselves: each one carries its own setup, so this is
					// where the outstanding work actually is.
					<Link
						href={"/my-cases" as Route}
						className="mt-2 inline-flex h-9 items-center justify-center rounded-[var(--radius-control)] bg-brass px-4 font-semibold text-[13px] text-white transition-colors hover:bg-brass-deep"
					>
						{hasAccount ? "Finish payout setup" : "Set up case payouts"}
					</Link>
				)}
			</div>
		</div>
	);
}
