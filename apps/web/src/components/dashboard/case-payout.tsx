"use client";

import { cn } from "@just-us/ui/lib/utils";
import { Check, Landmark, Lock } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { bindCasePayoutAction } from "@/app/(app)/my-cases/[id]/payout-actions";

export type PayoutSide = {
	name: string;
	hasAccount: boolean;
	detailsSubmitted: boolean;
	transfersEnabled: boolean;
} | null;

export type CasePayoutData = {
	caseId: string;
	status: string;
	recipient: "plaintiff" | "attorney" | null;
	bound: boolean;
	plaintiff: PayoutSide;
	attorney: PayoutSide;
};

/**
 * Who this case pays out to (donations).
 *
 * A case cannot accept donations until this is set *and* the chosen side has
 * finished Stripe onboarding — so this screen shows both facts rather than only
 * offering a choice. A radio button the plaintiff can select but not use is worse
 * than one that explains what's missing.
 *
 * Locked once the case is live: donors were shown a recipient before they gave,
 * and moving the destination afterwards would break that.
 */
export function CasePayout({ data }: { data: CasePayoutData }) {
	const [recipient, setRecipient] = useState(data.recipient);
	const [bound, setBound] = useState(data.bound);
	const [pending, startTransition] = useTransition();

	// Matches the server rule: a live case that has never been bound has shown no
	// donor a recipient, so it can still be set. Only a bound live case is locked.
	const locked = data.status === "live" && data.bound;
	const chosen = recipient ? sideFor(data, recipient) : null;

	function choose(next: "plaintiff" | "attorney") {
		const previous = recipient;
		setRecipient(next);
		startTransition(async () => {
			const result = await bindCasePayoutAction({
				caseId: data.caseId,
				recipient: next,
			});
			if (result.ok) {
				setBound(true);
				toast.success(
					next === "plaintiff"
						? "Donations will go to your account."
						: "Donations will go to your attorney's account.",
				);
			} else {
				setRecipient(previous);
				toast.error(result.error);
			}
		});
	}

	return (
		<section className="rounded-[var(--radius-card-lg)] border border-border bg-surface shadow-[var(--shadow-rest)]">
			<div className="border-border border-b px-5 py-4">
				<h2 className="font-bold text-[15px] text-ink">
					Who receives donations
				</h2>
				<p className="mt-1 text-[13.5px] text-ink-soft leading-relaxed">
					Donations go straight into the recipient's own Stripe account — JustUs
					never holds the money. Donors are told who receives before they give.
				</p>
			</div>

			<div className="flex flex-col gap-2.5 px-5 py-4">
				{(["plaintiff", "attorney"] as const).map((kind) => {
					const side = sideFor(data, kind);
					const selected = recipient === kind;
					const unavailable = !side || !side.hasAccount;

					return (
						<button
							key={kind}
							type="button"
							disabled={locked || pending || unavailable}
							onClick={() => choose(kind)}
							className={cn(
								"flex items-start gap-3 rounded-[var(--radius-card)] border p-4 text-left transition-colors",
								selected
									? "border-brass-deep bg-brass-wash"
									: "border-border bg-card",
								!locked &&
									!unavailable &&
									!selected &&
									"hover:border-brass-deep",
								(locked || unavailable) && "cursor-not-allowed opacity-70",
							)}
						>
							<span
								className={cn(
									"mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border",
									selected
										? "border-brass-deep bg-brass-deep text-white"
										: "border-border",
								)}
							>
								{selected && <Check className="size-3" aria-hidden="true" />}
							</span>
							<span className="min-w-0 flex-1">
								<span className="block font-semibold text-[14px] text-ink">
									{kind === "plaintiff"
										? `You${side ? ` — ${side.name}` : ""}`
										: side
											? `Your attorney — ${side.name}`
											: "Your attorney"}
								</span>
								<span className="mt-0.5 block text-[12.5px] text-ink-soft leading-relaxed">
									{describe(kind, side)}
								</span>
							</span>
						</button>
					);
				})}

				{/* The plaintiff can act on their own missing setup; not the attorney's. */}
				{recipient === "plaintiff" &&
					data.plaintiff &&
					!data.plaintiff.transfersEnabled && (
						<Link
							href={"/settings" as Route}
							className="inline-flex items-center gap-1.5 self-start font-semibold text-[12.5px] text-brass-deep hover:underline"
						>
							<Landmark className="size-3.5" aria-hidden="true" />
							{data.plaintiff.hasAccount
								? "Finish your payout setup"
								: "Set up your payouts"}
						</Link>
					)}

				{locked ? (
					<p className="mt-1 flex items-start gap-2 rounded-[var(--radius-card-sm)] bg-surface-2 px-3.5 py-3 text-[12.5px] text-muted-foreground leading-relaxed">
						<Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
						This case is raising, so the recipient is locked. Donors were shown
						who receives their money before they gave.
					</p>
				) : (
					bound &&
					chosen &&
					!chosen.transfersEnabled && (
						<p className="mt-1 text-[12.5px] text-muted-foreground leading-relaxed">
							Recipient saved. This case can't accept donations until{" "}
							{recipient === "plaintiff" ? "your" : "their"} Stripe setup
							clears.
						</p>
					)
				)}
			</div>
		</section>
	);
}

function sideFor(data: CasePayoutData, kind: "plaintiff" | "attorney") {
	return kind === "plaintiff" ? data.plaintiff : data.attorney;
}

function describe(kind: "plaintiff" | "attorney", side: PayoutSide): string {
	if (kind === "attorney" && !side) {
		return "No attorney matched yet — once one is, they can receive directly.";
	}
	if (!side?.hasAccount) {
		return kind === "plaintiff"
			? "You haven't set up payouts yet. You'd receive the funds and pay your attorney yourself."
			: "They haven't set up payouts yet. Ask them to before choosing this.";
	}
	if (!side.transfersEnabled) {
		return side.detailsSubmitted
			? "Setup submitted — Stripe is still verifying it."
			: "Payout setup started but not finished.";
	}
	return kind === "plaintiff"
		? "Ready. You'd receive the funds and pay your attorney yourself."
		: "Ready. They receive the fee directly, so it never passes through you.";
}
