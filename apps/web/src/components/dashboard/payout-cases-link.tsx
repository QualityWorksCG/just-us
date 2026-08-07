import { buttonVariants } from "@just-us/ui/components/button";
import { cn } from "@just-us/ui/lib/utils";
import { ArrowRight, Landmark } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

/**
 * What sits where the attorney's payout setup used to.
 *
 * Payouts were once one account per person, so settings was the right home for them.
 * They are one per case now, which turned this screen into a list of other people's
 * matters and put the question that actually matters — *can this case take money* —
 * one screen away from the case. The setup moved onto each case; this says so, and
 * says how much is outstanding, so an attorney who comes looking here isn't left
 * thinking the feature vanished.
 *
 * Not a stub: the count is the useful half. An attorney set up on two matters has no
 * reason to guess a third needs its own account, and this is the screen they visit
 * for account admin.
 */
export function PayoutCasesLink({
	waitingCases,
	inReviewCases,
}: {
	/** Live cases whose own account can't receive yet. */
	waitingCases: number;
	/** Of those, how many are simply awaiting Stripe rather than the attorney. */
	inReviewCases: number;
}) {
	const allInReview = waitingCases > 0 && inReviewCases === waitingCases;

	return (
		<section className="rounded-[var(--radius-card)] border border-border bg-card">
			<div className="border-border border-b px-5 py-4">
				<h2 className="font-bold text-[15px] text-ink">Donation payouts</h2>
				<p className="mt-1 text-[13.5px] text-ink-soft leading-relaxed">
					Each case you represent pays into an account of its own, so no two
					clients' funds share a balance. Setup lives on the case itself — open
					a case to link its account, check its status, or reach its Stripe
					dashboard.
				</p>
			</div>
			<div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
				<p className="flex items-start gap-2.5 text-[13px] text-ink-soft leading-relaxed">
					<Landmark
						className="mt-0.5 size-4 shrink-0 text-brass-deep"
						aria-hidden="true"
					/>
					{waitingCases === 0
						? "Every published case you're on can accept donations."
						: allInReview
							? `${waitingCases === 1 ? "One published case is" : `${waitingCases} published cases are`} still with Stripe for verification. Nothing for you to do.`
							: `${waitingCases === 1 ? "One published case" : `${waitingCases} published cases`} can't accept donations until their accounts are finished.`}
				</p>
				<Link
					href={"/my-cases" as Route}
					className={cn(
						buttonVariants({
							variant: waitingCases > 0 && !allInReview ? "default" : "outline",
							size: "lg",
						}),
						"h-10 px-4",
					)}
				>
					Go to my cases
					<ArrowRight data-icon="inline-end" aria-hidden="true" />
				</Link>
			</div>
		</section>
	);
}
