"use client";

import { Check, Landmark, Lock, Mail, UserPlus } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
	bindCasePayoutAction,
	checkAndGoLiveAction,
} from "@/app/(app)/my-cases/[id]/payout-actions";

/** The firm this case pays out to, and how far its Stripe setup has got. */
export type PayoutAttorney = {
	name: string;
	email: string;
	firmName: string | null;
	barNumber: string | null;
	/** How the case reached them — an accepted request, or the email on the case. */
	via: "match" | "invited_email";
	hasAccount: boolean;
	detailsSubmitted: boolean;
	transfersEnabled: boolean;
};

export type CasePayoutData = {
	caseId: string;
	status: string;
	bound: boolean;
	/** Null when nobody is linked yet — no match, and no registered attorney at the
	 *  case's designated email. */
	attorney: PayoutAttorney | null;
	/** The address on the case, so an unlinked state can name who is being waited on. */
	designatedEmail: string | null;
};

/**
 * Where this case's donations land.
 *
 * Donations pay the **operating account of the firm representing the case**; the
 * attorney moves them into their client trust account under their bar's rules. The
 * plaintiff owns this decision only in the sense of *when* — they open donations, and
 * the destination is derived from their case's attorney link.
 *
 * The screen is therefore mostly about someone else's readiness, which is the hard
 * part: the plaintiff can be blocked by a person they don't control. So every
 * not-ready state names the attorney and their email address rather than saying
 * "pending" — chasing them is the plaintiff's only available action, and a screen that
 * hides who to chase leaves them stuck.
 *
 * The readiness reported is for **this case's own account**. Each case a firm takes on
 * has a separate one, so an attorney who is fully set up on their other matters has
 * done nothing for this one — and telling this plaintiff "ready" on the strength of
 * another case's account would promise a case that cannot take a dollar.
 *
 * Binding is an explicit step, and once a live case is bound it locks: donors have
 * been shown who receives.
 */
export function CasePayout({ data }: { data: CasePayoutData }) {
	const [bound, setBound] = useState(data.bound);
	const [status, setStatus] = useState(data.status);
	const [pending, startTransition] = useTransition();

	// Matches the server rule: a live case that has never been bound has shown no
	// donor a recipient, so it can still be set. Only a bound live case is locked.
	const locked = status === "live" && bound;
	// Finished, private, waiting on the firm. Here the destination and the
	// publication are one act, so this panel offers publishing rather than
	// binding — see `goLiveCase`.
	const isPending = status === "pending_payout";
	const attorney = data.attorney;
	// The firm's readiness is a cache of Stripe's view; "Check & publish" refreshes
	// it from Stripe, so it lives in state and updates in place after a check rather
	// than only on a full reload — the reload is what was stuck showing "waiting".
	const [ready, setReady] = useState(!!attorney?.transfersEnabled);
	const [detailsSubmitted, setDetailsSubmitted] = useState(
		!!attorney?.detailsSubmitted,
	);
	const effAttorney = attorney
		? { ...attorney, transfersEnabled: ready, detailsSubmitted }
		: null;
	const recipient = attorney
		? (attorney.firmName ?? attorney.name)
		: "your attorney's firm";

	function bind() {
		startTransition(async () => {
			const result = await bindCasePayoutAction({ caseId: data.caseId });
			if (result.ok) {
				setBound(true);
				toast.success(
					`Donations to this case will go to ${result.recipientName}.`,
				);
			} else {
				toast.error(result.error);
			}
		});
	}

	function checkAndPublish() {
		startTransition(async () => {
			const result = await checkAndGoLiveAction({ caseId: data.caseId });
			if (!result.ok) {
				toast.error(result.error);
				return;
			}
			if (result.live) {
				setBound(true);
				setStatus("live");
				setReady(true);
				toast.success(
					`Your case is live. Donations go to ${result.recipientName}.`,
				);
				return;
			}
			// Re-checked with Stripe and it still can't receive — update the panel to
			// the fresh state and say exactly what's outstanding, rather than leaving a
			// stale "waiting on your attorney" the plaintiff can't move.
			setReady(false);
			setDetailsSubmitted(result.detailsSubmitted);
			toast(
				result.reason === "no_attorney"
					? "No attorney is linked to this case yet, so there's nowhere for donations to go."
					: result.reason === "attorney_no_account"
						? `${recipient} hasn't opened a payout account for this case yet.`
						: result.detailsSubmitted
							? `Checked with Stripe. ${recipient}'s details are in and still under review. Your case publishes the moment it clears.`
							: `Checked with Stripe. ${recipient} hasn't finished payout setup for this case yet.`,
			);
		});
	}

	return (
		<section className="rounded-[var(--radius-card-lg)] border border-border bg-surface shadow-[var(--shadow-rest)]">
			<div className="border-border border-b px-5 py-4">
				<h2 className="font-bold text-[15px] text-ink">Where donations go</h2>
				<p className="mt-1 text-[13.5px] text-ink-soft leading-relaxed">
					Donations to this case are paid to your attorney's firm, into an
					account opened for this case alone, so your funds are never mixed with
					another client's. Through Stripe, never into a JustUs balance. Your
					attorney applies the money to your fee under their state bar's trust
					rules. Donors are told who receives before they give.
				</p>
			</div>

			<div className="flex flex-col gap-2.5 px-5 py-4">
				{attorney ? (
					<div className="flex items-start gap-3 rounded-[var(--radius-card)] border border-border bg-card p-4">
						<span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-brass-wash text-brass-deep">
							<Landmark className="size-3" aria-hidden="true" />
						</span>
						<span className="min-w-0 flex-1">
							<span className="block font-semibold text-[14px] text-ink">
								{recipient}
							</span>
							<span className="mt-0.5 block text-[12.5px] text-ink-soft leading-relaxed">
								{attorney.firmName ? `${attorney.name} · ` : ""}
								{attorney.email}
								{attorney.barNumber ? ` · Bar #${attorney.barNumber}` : ""}
							</span>
							<span className="mt-1 block text-[12.5px] text-ink-soft leading-relaxed">
								{describe(effAttorney ?? attorney)}
							</span>
						</span>
						{bound && ready && (
							<span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-brass-deep text-white">
								<Check className="size-3" aria-hidden="true" />
							</span>
						)}
					</div>
				) : (
					<div className="flex items-start gap-3 rounded-[var(--radius-card)] border border-border bg-card p-4">
						<span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-surface-2 text-muted-foreground">
							<UserPlus className="size-3" aria-hidden="true" />
						</span>
						<span className="min-w-0 flex-1">
							<span className="block font-semibold text-[14px] text-ink">
								No attorney linked yet
							</span>
							<span className="mt-0.5 block text-[12.5px] text-ink-soft leading-relaxed">
								{data.designatedEmail
									? `Your case names ${data.designatedEmail}, but no attorney account on JustUs uses that address yet. Ask them to sign up as an attorney with it. That's what links your case to their firm's payout account.`
									: "Donations are paid to the firm representing you, so this case needs an attorney before it can accept them. Add your attorney's details to the case, or take on one of the attorneys who've expressed interest."}
							</span>
						</span>
					</div>
				)}

				{attorney && !ready && (
					<p className="flex items-start gap-2 rounded-[var(--radius-card-sm)] bg-surface-2 px-3.5 py-3 text-[12.5px] text-muted-foreground leading-relaxed">
						<Mail className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
						{attorney.hasAccount
							? `Nothing for you to do here. ${attorney.name} finishes this in their own JustUs settings. If it's holding your case up, ${attorney.email} is the address to nudge.`
							: `${attorney.name} hasn't opened a payout account for this case yet. Each case gets its own, so they may well be set up on their other matters and still owe this one. They do it in Settings on their own JustUs account; ${attorney.email} is the address to reach them at.`}
					</p>
				)}

				{locked ? (
					<p className="mt-1 flex items-start gap-2 rounded-[var(--radius-card-sm)] bg-surface-2 px-3.5 py-3 text-[12.5px] text-muted-foreground leading-relaxed">
						<Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
						This case is raising, so the destination is locked. Donors were
						shown who receives their money before they gave.
					</p>
				) : isPending ? (
					// One button for both halves: publishing a case and binding its
					// destination are the same server-side act, so the page can never be
					// public with nothing to receive.
					<>
						<button
							type="button"
							onClick={checkAndPublish}
							disabled={pending}
							className="inline-flex h-10 items-center justify-center gap-2 self-start rounded-[var(--radius-control)] bg-brass px-4 font-bold text-[13.5px] text-white transition-colors hover:bg-brass-deep disabled:cursor-not-allowed disabled:opacity-60"
						>
							{pending
								? ready
									? "Publishing…"
									: "Checking with Stripe…"
								: ready
									? "Publish & go live"
									: "Check & publish"}
						</button>
						<p className="text-[12px] text-muted-foreground leading-relaxed">
							{ready
								? `Your case goes public straight away, raising toward its goal, with ${recipient} receiving. The destination is fixed from that moment. Donors are shown it before they give.`
								: `Your case is finished and private. Once ${recipient} enables payouts this doesn't always update on its own. Press Check & publish to re-check with Stripe and go live the moment their account can receive.`}
						</p>
					</>
				) : bound ? (
					!ready && (
						<p className="mt-1 text-[12.5px] text-muted-foreground leading-relaxed">
							Saved. This case can't accept donations until the firm's Stripe
							setup clears.
						</p>
					)
				) : (
					<>
						<button
							type="button"
							onClick={bind}
							disabled={pending || !attorney?.hasAccount}
							className="inline-flex h-10 items-center justify-center gap-2 self-start rounded-[var(--radius-control)] bg-brass px-4 font-bold text-[13.5px] text-white transition-colors hover:bg-brass-deep disabled:cursor-not-allowed disabled:opacity-60"
						>
							{pending ? "Saving…" : `Send donations to ${recipient}`}
						</button>
						{/* Named before confirming, and permanent after: an attorney reached by
						    the email on the case was designated by the plaintiff, and a mistyped
						    address is the one way this ends up at the wrong firm. */}
						{attorney?.via === "invited_email" && (
							<p className="text-[12px] text-muted-foreground leading-relaxed">
								Matched from the attorney email on your case. Check the firm
								above is the right one. Once this case starts raising, the
								destination can't be changed.
							</p>
						)}
					</>
				)}
			</div>
		</section>
	);
}

function describe(attorney: PayoutAttorney): string {
	if (!attorney.hasAccount) {
		return "No payout account opened for this case yet, so it can't accept donations.";
	}
	if (!attorney.transfersEnabled) {
		return attorney.detailsSubmitted
			? "Setup submitted for this case. Stripe is still verifying the firm's details."
			: "Payout setup for this case started but not finished.";
	}
	return "Ready to receive this case's donations.";
}
