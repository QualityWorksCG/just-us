"use client";

import { cn } from "@just-us/ui/lib/utils";
import { BadgeCheck, ExternalLink, Hourglass, Landmark } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import {
	openPayoutDashboard,
	refreshPayoutStatus,
	startPayoutOnboarding,
} from "@/app/(app)/settings/payout-actions";

export type PayoutAccountState = {
	/** Null until they start onboarding. */
	stripeAccountId: string | null;
	detailsSubmitted: boolean;
	/** The donation gate — whether a case bound here can accept money. */
	transfersEnabled: boolean;
	payoutsEnabled: boolean;
	/** Whether Stripe is configured at all in this environment. */
	configured: boolean;
};

type Stage = "not_started" | "in_review" | "incomplete" | "ready";

function stageOf(s: PayoutAccountState): Stage {
	if (!s.stripeAccountId) return "not_started";
	if (s.transfersEnabled) return "ready";
	// Everything submitted but transfers still off means Stripe is reviewing —
	// materially different from "you still owe us information", and the only one of
	// the two the holder cannot act on.
	if (s.detailsSubmitted) return "in_review";
	return "incomplete";
}

const COPY: Record<Stage, { title: string; body: string; cta: string | null }> =
	{
		not_started: {
			title: "Set up donation payouts",
			body: "Donations to a case you receive go straight into your own Stripe account — JustUs never holds the money. Stripe collects your identity and bank details directly; we never see them.",
			cta: "Set up payouts",
		},
		incomplete: {
			title: "Finish setting up payouts",
			body: "Stripe still needs some information from you. Until it's done, cases that pay out to you can't accept donations. Already submitted everything? Use \u201cCheck again\u201d \u2014 Stripe can take a moment to finish reviewing.",
			cta: "Continue setup",
		},
		in_review: {
			title: "Stripe is reviewing your details",
			body: "You've submitted everything. Stripe is verifying it — this is usually quick, and there's nothing for you to do. Cases that pay out to you can't accept donations until it clears.",
			cta: null,
		},
		ready: {
			title: "Payouts are active",
			body: "Cases that pay out to you can accept donations. Stripe sends the money to your bank on its usual schedule.",
			cta: null,
		},
	};

/**
 * Payout-account setup for plaintiffs and attorneys (donations).
 *
 * Either can be the recipient a case pays out to, so this screen is identical for
 * both — the only difference is invisible (the MCC on the Stripe account).
 *
 * Every status shown here comes from Stripe via the server, never from this
 * component's own optimism: `transfersEnabled` gates real money, so it is only
 * ever displayed as what Stripe last said.
 */
export function PayoutAccount({ initial }: { initial: PayoutAccountState }) {
	const [state, setState] = useState(initial);
	const [pending, startTransition] = useTransition();
	const router = useRouter();
	const params = useSearchParams();
	const payoutParam = params.get("payout");
	const handled = useRef<string | null>(null);

	const stage = stageOf(state);
	const copy = COPY[stage];

	// Coming back from Stripe means the holder *left* the hosted flow — completed
	// or abandoned, Stripe uses the same return URL for both. So re-read the real
	// status instead of assuming success. `?payout=refresh` means the link expired
	// or was reused, which needs a brand-new link rather than a status read.
	useEffect(() => {
		if (!payoutParam || handled.current === payoutParam) return;
		handled.current = payoutParam;

		if (payoutParam === "return") {
			startTransition(async () => {
				const result = await refreshPayoutStatus();
				if (result.ok) {
					setState((s) => ({
						...s,
						detailsSubmitted: result.detailsSubmitted,
						transfersEnabled: result.transfersEnabled,
						payoutsEnabled: result.payoutsEnabled,
					}));
					toast.success(
						result.transfersEnabled
							? "Payouts are active."
							: "Details received — Stripe is reviewing them.",
					);
				} else {
					toast.error(result.error);
				}
				router.replace("/settings");
			});
		} else if (payoutParam === "refresh") {
			toast.message("That setup link expired. Starting a fresh one.");
			router.replace("/settings");
			begin();
		}
	}, [payoutParam, router]);

	function begin() {
		startTransition(async () => {
			const result = await startPayoutOnboarding();
			if (!result.ok) {
				toast.error(result.error);
				return;
			}
			// Full navigation, not router.push — this leaves the app for Stripe.
			window.location.href = result.url;
		});
	}

	function viewDashboard() {
		startTransition(async () => {
			const result = await openPayoutDashboard();
			if (!result.ok) {
				toast.error(result.error);
				return;
			}
			window.open(result.url, "_blank", "noopener,noreferrer");
		});
	}

	function recheck() {
		startTransition(async () => {
			const result = await refreshPayoutStatus();
			if (!result.ok) {
				toast.error(result.error);
				return;
			}
			setState((s) => ({
				...s,
				detailsSubmitted: result.detailsSubmitted,
				transfersEnabled: result.transfersEnabled,
				payoutsEnabled: result.payoutsEnabled,
			}));
			toast.success(
				result.transfersEnabled
					? "Payouts are active."
					: "Still pending on Stripe's side.",
			);
		});
	}

	if (!state.configured) {
		return (
			<Shell>
				<p className="text-[13.5px] text-muted-foreground leading-relaxed">
					Donation payouts aren't configured on this environment yet.
				</p>
			</Shell>
		);
	}

	return (
		<Shell>
			<div className="flex items-start gap-3">
				<span
					className={cn(
						"flex size-9 shrink-0 items-center justify-center rounded-lg",
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
				<div className="min-w-0 flex-1">
					<p className="font-semibold text-[14px] text-ink">{copy.title}</p>
					<p className="mt-1 text-[13px] text-ink-soft leading-relaxed">
						{copy.body}
					</p>

					{stage === "ready" && !state.payoutsEnabled && (
						<p className="mt-2 text-[12.5px] text-muted-foreground leading-relaxed">
							Bank payouts aren't switched on yet, so money will collect in your
							Stripe balance until they are. Donations still work.
						</p>
					)}

					<div className="mt-3 flex flex-wrap items-center gap-2">
						{copy.cta && (
							<button
								type="button"
								onClick={begin}
								disabled={pending}
								className="inline-flex h-9 items-center justify-center rounded-[var(--radius-control)] bg-brass px-4 font-semibold text-[13px] text-white transition-colors hover:bg-brass-deep disabled:opacity-60"
							>
								{pending ? "Working…" : copy.cta}
							</button>
						)}
						{/* Available in every unfinished stage, not just review: someone who
						    has in fact submitted everything but whose stored status is stale
						    would otherwise see only "Continue setup", which sends them back
						    into a flow they already completed. */}
						{stage !== "ready" && (
							<button
								type="button"
								onClick={recheck}
								disabled={pending}
								className="inline-flex h-9 items-center justify-center rounded-[var(--radius-control)] border border-border bg-surface px-4 font-semibold text-[13px] text-ink transition-colors hover:border-brass-deep disabled:opacity-60"
							>
								{pending ? "Checking…" : "Check again"}
							</button>
						)}
						{state.detailsSubmitted && (
							<button
								type="button"
								onClick={viewDashboard}
								disabled={pending}
								className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-control)] border border-border bg-surface px-4 font-semibold text-[13px] text-ink transition-colors hover:border-brass-deep disabled:opacity-60"
							>
								Stripe dashboard
								<ExternalLink className="size-3.5" aria-hidden="true" />
							</button>
						)}
					</div>
				</div>
			</div>
		</Shell>
	);
}

function Shell({ children }: { children: React.ReactNode }) {
	return (
		<section className="rounded-[var(--radius-card)] border border-border bg-card">
			<div className="border-border border-b px-5 py-4">
				<h2 className="font-bold text-[15px] text-ink">Donation payouts</h2>
				<p className="mt-1 text-[13.5px] text-ink-soft leading-relaxed">
					Where donations to your cases are sent. Handled by Stripe — JustUs
					never takes custody of donated funds.
				</p>
			</div>
			<div className="px-5 py-4">{children}</div>
		</section>
	);
}
