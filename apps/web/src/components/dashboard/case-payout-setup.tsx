"use client";

import type { AttorneyCasePayout } from "@just-us/db/representation";
import { cn } from "@just-us/ui/lib/utils";
import { BadgeCheck, ExternalLink, Hourglass, Landmark } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import {
	openPayoutDashboard,
	refreshPayoutStatus,
	startPayoutOnboarding,
} from "@/app/(app)/my-cases/[id]/payout-actions";

/**
 * Payout setup for **one case**, on that case's own screen.
 *
 * This was a list on Profile & settings, which is where it belonged when payouts were
 * one account per person. They are one per case now: a firm on three matters holds
 * three Stripe accounts, each at its own point in Stripe's review, each with its own
 * bank destination. A list of other people's cases under "settings" made the one thing
 * that matters — *which case can take money* — something the attorney had to go and
 * look up. Here the answer sits under the case it is about.
 *
 * Every status shown comes from Stripe via the server, never from this component's own
 * optimism: `transfersEnabled` gates real money, so it is only ever displayed as what
 * Stripe last said.
 */

type Stage = "not_started" | "in_review" | "incomplete" | "ready";

function stageOf(payout: AttorneyCasePayout): Stage {
	if (!payout.hasAccount) return "not_started";
	if (payout.transfersEnabled) return "ready";
	// Everything submitted but transfers still off means Stripe is reviewing —
	// materially different from "you still owe us information", and the only one of
	// the two the holder cannot act on.
	if (payout.detailsSubmitted) return "in_review";
	return "incomplete";
}

const COPY: Record<Stage, { title: string; body: string; cta: string | null }> =
	{
		not_started: {
			title: "Not set up",
			body: "This case has no payout account yet, so it can't accept donations. Link the firm's business checking account for this matter — use the operating account, not a client trust account.",
			cta: "Set up payouts",
		},
		incomplete: {
			title: "Unfinished",
			body: "Stripe still needs information for this case's account. Already submitted everything? Use “Check again” — Stripe can take a moment to finish reviewing.",
			cta: "Continue setup",
		},
		in_review: {
			title: "In review",
			body: "Everything's submitted for this case. Stripe is verifying it, and there's nothing more for you to do. Donations open as soon as it clears.",
			cta: null,
		},
		ready: {
			title: "Active",
			body: "This case can accept donations, and its funds land in the account you linked for it. Moving them into your client trust account and applying them to the fee is yours to do, under your bar's rules.",
			cta: null,
		},
	};

export function CasePayoutSetup({
	caseId,
	caseStatus,
	initial,
	configured,
}: {
	caseId: string;
	/** Drives the one line that is about the plaintiff's step rather than theirs. */
	caseStatus: string;
	initial: AttorneyCasePayout;
	/** Whether Stripe is configured at all in this environment. */
	configured: boolean;
}) {
	const [payout, setPayout] = useState(initial);
	const [pending, startTransition] = useTransition();
	const router = useRouter();
	const params = useSearchParams();
	const payoutParam = params.get("payout");
	const handled = useRef<string | null>(null);

	// Coming back from Stripe means the holder *left* the hosted flow — completed or
	// abandoned, Stripe uses the same return URL for both. So re-read the real status
	// instead of assuming success. `?payout=refresh` means the link expired or was
	// reused, which needs a brand-new link rather than a status read.
	//
	// `begin` is deliberately not a dependency: it is redefined every render, so
	// declaring it would re-fire this on each one — and firing twice here mints a
	// second Stripe onboarding link or overwrites a status with a stale read. The
	// `handled` ref is what makes one arrival run exactly once.
	// biome-ignore lint/correctness/useExhaustiveDependencies: runs on the return param only
	useEffect(() => {
		if (!payoutParam) return;
		if (handled.current === payoutParam) return;
		handled.current = payoutParam;

		if (payoutParam === "return") {
			startTransition(async () => {
				const result = await refreshPayoutStatus({ caseId });
				if (result.ok) {
					setPayout((current) => ({
						...current,
						hasAccount: true,
						detailsSubmitted: result.detailsSubmitted,
						transfersEnabled: result.transfersEnabled,
						payoutsEnabled: result.payoutsEnabled,
					}));
					toast.success(
						result.transfersEnabled
							? "Payouts are active for this case."
							: "Details received — Stripe is reviewing them.",
					);
				} else {
					toast.error(result.error);
				}
				router.replace(`/my-cases/${caseId}`);
			});
		} else if (payoutParam === "refresh") {
			toast.message("That setup link expired. Starting a fresh one.");
			router.replace(`/my-cases/${caseId}`);
			begin();
		}
	}, [payoutParam, caseId, router]);

	function begin() {
		startTransition(async () => {
			const result = await startPayoutOnboarding({ caseId });
			if (!result.ok) {
				toast.error(result.error);
				return;
			}
			// Full navigation, not router.push — this leaves the app for Stripe.
			window.location.href = result.url;
		});
	}

	function recheck() {
		startTransition(async () => {
			const result = await refreshPayoutStatus({ caseId });
			if (!result.ok) {
				toast.error(result.error);
				return;
			}
			setPayout((current) => ({
				...current,
				hasAccount: true,
				detailsSubmitted: result.detailsSubmitted,
				transfersEnabled: result.transfersEnabled,
				payoutsEnabled: result.payoutsEnabled,
			}));
			toast.success(
				result.transfersEnabled
					? "Payouts are active for this case."
					: "Still pending on Stripe's side.",
			);
		});
	}

	function viewDashboard() {
		startTransition(async () => {
			const result = await openPayoutDashboard({ caseId });
			if (!result.ok) {
				toast.error(result.error);
				return;
			}
			window.open(result.url, "_blank", "noopener,noreferrer");
		});
	}

	if (!configured) {
		return (
			<Shell stage={null}>
				<p className="text-[13.5px] text-muted-foreground leading-relaxed">
					Donation payouts aren't configured on this environment yet.
				</p>
			</Shell>
		);
	}

	const stage = stageOf(payout);
	const copy = COPY[stage];

	return (
		<Shell stage={stage}>
			<p className="text-[13.5px] text-ink-soft leading-relaxed">{copy.body}</p>

			{stage === "ready" && !payout.payoutsEnabled && (
				<p className="mt-2.5 text-[12.5px] text-muted-foreground leading-relaxed">
					Bank payouts aren't switched on for this account yet, so money will
					collect in its Stripe balance until they are. Donations still work.
				</p>
			)}
			{/* The plaintiff's step, named so a fully-onboarded attorney doesn't read a
			    still-closed case as their own failure. */}
			{stage === "ready" && !payout.bound && caseStatus === "live" && (
				<p className="mt-2.5 text-[12.5px] text-muted-foreground leading-relaxed">
					Waiting on your client to open donations on their side.
				</p>
			)}

			<div className="mt-4 flex flex-wrap items-center gap-2">
				{copy.cta && (
					<button
						type="button"
						onClick={begin}
						disabled={pending}
						className="inline-flex h-10 items-center justify-center rounded-[var(--radius-control)] bg-brass px-4 font-semibold text-[13px] text-white transition-colors hover:bg-brass-deep disabled:opacity-60"
					>
						{pending ? "Working…" : copy.cta}
					</button>
				)}
				{/* Available in every unfinished stage, not just review: someone who has
				    in fact submitted everything but whose stored status is stale would
				    otherwise see only "Continue", which sends them back into a flow they
				    already completed. */}
				{stage !== "ready" && (
					<button
						type="button"
						onClick={recheck}
						disabled={pending}
						className="inline-flex h-10 items-center justify-center rounded-[var(--radius-control)] border border-border bg-surface px-4 font-semibold text-[13px] text-ink transition-colors hover:border-brass-deep disabled:opacity-60"
					>
						{pending ? "Checking…" : "Check again"}
					</button>
				)}
				{payout.detailsSubmitted && (
					<button
						type="button"
						onClick={viewDashboard}
						disabled={pending}
						className="inline-flex h-10 items-center gap-1.5 rounded-[var(--radius-control)] border border-border bg-surface px-4 font-semibold text-[13px] text-ink transition-colors hover:border-brass-deep disabled:opacity-60"
					>
						Stripe dashboard
						<ExternalLink className="size-3.5" aria-hidden="true" />
					</button>
				)}
			</div>
		</Shell>
	);
}

function Shell({
	stage,
	children,
}: {
	stage: Stage | null;
	children: React.ReactNode;
}) {
	return (
		<section className="rounded-[var(--radius-card-lg)] border border-border bg-surface shadow-[var(--shadow-rest)]">
			<div className="flex flex-wrap items-start justify-between gap-3 border-border border-b px-5 py-4">
				<div className="flex items-start gap-3">
					<span
						className={cn(
							"mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg",
							stage === "ready"
								? "bg-green-soft text-green-deep"
								: stage === "in_review"
									? "bg-brass-wash text-brass-deep"
									: "bg-surface-2 text-muted-foreground",
						)}
					>
						{stage === "ready" ? (
							<BadgeCheck className="size-[18px]" aria-hidden="true" />
						) : stage === "in_review" ? (
							<Hourglass className="size-[18px]" aria-hidden="true" />
						) : (
							<Landmark className="size-[18px]" aria-hidden="true" />
						)}
					</span>
					<div>
						<h2 className="font-bold text-[15px] text-ink">
							Donations for this case
						</h2>
						<p className="mt-1 max-w-[62ch] text-[13px] text-ink-soft leading-relaxed">
							This case pays into an account of its own, so no two clients'
							funds share a balance. Handled by Stripe — JustUs never takes
							custody of donated funds.
						</p>
					</div>
				</div>
				{stage && (
					<span
						className={cn(
							"rounded-[var(--radius-chip)] px-2.5 py-1 font-mono font-semibold text-[10.5px] uppercase tracking-[0.06em]",
							stage === "ready"
								? "bg-green-soft text-green-deep"
								: "bg-surface-2 text-ink-soft",
						)}
					>
						{COPY[stage].title}
					</span>
				)}
			</div>
			<div className="px-5 py-4">{children}</div>
		</section>
	);
}
