import type { AttorneyCase } from "@just-us/db/representation";
import { cn } from "@just-us/ui/lib/utils";
import { BadgeCheck, Hourglass, Landmark } from "lucide-react";

/**
 * Shared, directive-free helpers for the attorney's intake screens.
 *
 * These live apart from `attorney-cases` on purpose: that file is a Client
 * Component (it filters interactively), but the payout math and chip are also
 * called from a Server Component (`attorney-case-detail`) at render time. Keeping
 * the pure helpers here — no `"use client"`, no hooks — lets both the server and
 * client sides import them without crossing a boundary the wrong way.
 */

/** USD, whole dollars — the money format shared across the attorney's screens. */
export function money(cents: number) {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		maximumFractionDigits: 0,
	}).format(cents / 100);
}

export type PayoutStage = "not_started" | "incomplete" | "in_review" | "ready";

export function payoutStage(c: AttorneyCase): PayoutStage {
	if (!c.payout.hasAccount) return "not_started";
	if (c.payout.transfersEnabled) return "ready";
	if (c.payout.detailsSubmitted) return "in_review";
	return "incomplete";
}

const STAGE_LABEL: Record<PayoutStage, string> = {
	not_started: "Payouts not set up",
	incomplete: "Payout setup unfinished",
	in_review: "Payouts in review",
	ready: "Payouts active",
};

/** A case whose account can't receive is the state the attorney themselves is
 *  blocking — that is what earns the loud treatment.
 *
 *  Two flavours, and `pending_payout` is the worse one: that client's case is not
 *  merely unable to take money, it is not public at all, and cannot be until this
 *  is done. A `live` case at least raises the moment the account clears. */
export function blocking(c: AttorneyCase) {
	return (
		(c.status === "live" || c.status === "pending_payout") &&
		!c.payout.transfersEnabled
	);
}

export function PayoutChip({ case: c }: { case: AttorneyCase }) {
	const stage = payoutStage(c);
	// A closed matter is not waiting on anyone's bank details. Reporting one as
	// "not set up" would be work that no longer exists, sitting next to cases where
	// the same words mean a client cannot be paid.
	if (c.status === "closed" && stage !== "ready") return null;
	const ready = stage === "ready";
	const review = stage === "in_review";
	return (
		<span
			className={cn(
				"inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] px-2.5 py-1 font-semibold text-[11.5px]",
				ready
					? "bg-green-soft text-green-deep"
					: review
						? "bg-brass-wash text-brass-deep"
						: blocking(c)
							? "bg-danger/10 text-danger"
							: "bg-surface-2 text-ink-soft",
			)}
		>
			{ready ? (
				<BadgeCheck className="size-3.5" aria-hidden="true" />
			) : review ? (
				<Hourglass className="size-3.5" aria-hidden="true" />
			) : (
				<Landmark className="size-3.5" aria-hidden="true" />
			)}
			{STAGE_LABEL[stage]}
		</span>
	);
}
