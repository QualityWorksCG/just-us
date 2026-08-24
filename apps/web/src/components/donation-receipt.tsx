"use client";

import { CheckCircle2, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * The banner a donor lands on after paying, on the case page.
 *
 * It exists because the two things that follow a payment are not simultaneous: the
 * donor's browser comes back from Stripe immediately, while
 * `checkout.session.completed` — the event that marks the donation succeeded and
 * folds it into `raisedCents` / `donorsCount` — arrives separately, usually within
 * a second or two. Rendering the page once on return therefore shows the *old*
 * totals, and a donor reading their own gift missing from the bar reasonably
 * concludes it failed.
 *
 * So while the donation is still `pending` this re-renders the server component on
 * an interval until it settles. `router.refresh()` rather than a fetch loop: the
 * totals, the backers list and the "you backed this" state all come from the same
 * server render, so refreshing it updates them together instead of leaving the
 * page's numbers disagreeing with each other.
 *
 * Polling stops on its own — at settlement, or after `MAX_ATTEMPTS`, at which point
 * the delay is no longer webhook lag and telling the donor their gift is recorded
 * beats spinning forever.
 */

const POLL_MS = 2000;
const MAX_ATTEMPTS = 15;

export function DonationReceipt({
	settled,
	amountLabel,
}: {
	/** True once the webhook has marked the donation succeeded. */
	settled: boolean;
	/** The donated amount, already formatted; null if the row can't be read. */
	amountLabel: string | null;
}) {
	const router = useRouter();
	const [attempts, setAttempts] = useState(0);
	const waiting = !settled && attempts < MAX_ATTEMPTS;

	useEffect(() => {
		if (!waiting) return;
		const timer = setTimeout(() => {
			setAttempts((n) => n + 1);
			router.refresh();
		}, POLL_MS);
		return () => clearTimeout(timer);
	}, [waiting, attempts, router]);

	if (settled) {
		return (
			<div className="mb-6 flex items-start gap-2.5 rounded-[var(--radius-card)] border border-success/30 bg-green-soft px-4 py-3.5 text-[13.5px] text-green-deep">
				<CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
				<p aria-live="polite">
					<span className="font-bold">Thank you</span>. Your gift
					{amountLabel ? ` of ${amountLabel}` : ""} is in. It's counted below,
					and your receipt is on its way by email.
				</p>
			</div>
		);
	}

	return (
		<div className="mb-6 flex items-start gap-2.5 rounded-[var(--radius-card)] border border-border bg-surface px-4 py-3.5 text-[13.5px] text-ink-soft">
			{waiting ? (
				<Loader2
					className="mt-0.5 size-4 shrink-0 animate-spin text-brass-deep"
					aria-hidden="true"
				/>
			) : (
				<CheckCircle2
					className="mt-0.5 size-4 shrink-0 text-brass-deep"
					aria-hidden="true"
				/>
			)}
			<p aria-live="polite">
				<span className="font-bold text-ink">Payment received</span>:{" "}
				{waiting
					? "confirming it with our payment provider and updating this case's total."
					: "it's recorded and the case total will update shortly. Your receipt is on its way by email."}
			</p>
		</div>
	);
}
