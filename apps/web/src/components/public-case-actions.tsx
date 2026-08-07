"use client";

// Pure fee arithmetic only — importing "@just-us/payments" here would pull the
// Stripe client and the platform secret key into the browser bundle.
import { breakdownAtBps, checkDonationAmount } from "@just-us/payments/fees";
import { cn } from "@just-us/ui/lib/utils";
import { HandCoins, Lock, Share2 } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { startDonation } from "@/app/cases/[id]/donate-actions";

export type DonateConfig = {
	/** Quick-pick amounts in cents, already filtered to the floor by the server. */
	presetsCents: number[];
	minCents: number;
	/** Platform fee rate, resolved server-side — never assumed in the browser. */
	feeBps: number;
	/** True when the viewer has already given here — changes the CTA to "give again". */
	alreadyBacked: boolean;
	/** False when the case can't take money; `blockedReason` says why. */
	canDonate: boolean;
	blockedReason: string | null;
};

function usd(cents: number) {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
	}).format(cents / 100);
}

function exactUsd(cents: number) {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
	}).format(cents / 100);
}

/**
 * Back / Share on the public case page.
 *
 * The fee is shown **to the cent before confirming**, which the landing page and
 * terms §4 both promise — so it is a requirement, not decoration. The split is
 * computed with the same pure function the server uses to build the Checkout
 * Session, and the rate comes from the server rather than being hardcoded here, so
 * the number a donor reads is the number they are charged.
 */
export function PublicCaseActions({
	sharePath,
	caseId,
	config,
}: {
	sharePath: string;
	caseId: string;
	config: DonateConfig;
}) {
	const [selected, setSelected] = useState<number | null>(
		config.presetsCents[0] ?? config.minCents,
	);
	const [customInput, setCustomInput] = useState("");
	const [pending, startTransition] = useTransition();

	// A custom entry wins over a preset whenever it parses; typing clears the
	// preset selection so two amounts are never highlighted at once.
	const customCents = useMemo(() => {
		const trimmed = customInput.trim();
		if (!trimmed) return null;
		const dollars = Number(trimmed);
		if (!Number.isFinite(dollars) || dollars <= 0) return null;
		return Math.round(dollars * 100);
	}, [customInput]);

	const amountCents = customCents ?? selected;
	const check =
		amountCents === null
			? null
			: checkDonationAmount(amountCents, config.minCents);
	const breakdown =
		amountCents !== null && check?.ok
			? breakdownAtBps(amountCents, config.feeBps)
			: null;

	function donate() {
		if (amountCents === null || !check?.ok) return;
		startTransition(async () => {
			const result = await startDonation({ caseId, amountCents });
			if (!result.ok) {
				toast.error(result.error);
				return;
			}
			// Full navigation — this leaves the app for Stripe's hosted Checkout.
			window.location.href = result.url;
		});
	}

	function share() {
		const url =
			typeof window !== "undefined"
				? `${window.location.origin}${sharePath}`
				: "";
		navigator.clipboard?.writeText(url);
		toast.success("Link copied — thanks for sharing!");
	}

	return (
		<div className="flex flex-col gap-2.5">
			{config.canDonate ? (
				<div className="flex flex-col gap-3 rounded-[var(--radius-card-lg)] border border-border bg-surface p-4">
					<div className="grid grid-cols-2 gap-2">
						{config.presetsCents.map((cents) => {
							const active = customCents === null && selected === cents;
							return (
								<button
									key={cents}
									type="button"
									onClick={() => {
										setSelected(cents);
										setCustomInput("");
									}}
									className={cn(
										"h-10 rounded-[var(--radius-control)] border font-bold text-[14px] transition-colors",
										active
											? "border-brass-deep bg-brass-wash text-brass-deep"
											: "border-border bg-card text-ink hover:border-brass-deep",
									)}
								>
									{usd(cents)}
								</button>
							);
						})}
					</div>

					<label className="flex flex-col gap-1.5">
						<span className="font-mono font-semibold text-[10.5px] text-muted-foreground uppercase tracking-[0.08em]">
							Or another amount
						</span>
						<span className="relative">
							<span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[14px] text-muted-foreground">
								$
							</span>
							<input
								type="text"
								inputMode="decimal"
								value={customInput}
								onChange={(e) => setCustomInput(e.target.value)}
								placeholder={String(Math.round(config.minCents / 100))}
								className="h-10 w-full rounded-[var(--radius-control)] border border-border bg-card pr-3 pl-7 text-[14px] text-ink outline-none focus:border-brass-deep"
							/>
						</span>
					</label>

					{/* "5% shown to the cent" — exact formatting, never rounded to dollars. */}
					{breakdown ? (
						<dl className="flex flex-col gap-1 rounded-[var(--radius-card-sm)] bg-surface-2 px-3.5 py-3 text-[12.5px]">
							<div className="flex justify-between">
								<dt className="text-ink-soft">Your donation</dt>
								<dd className="font-semibold text-ink tabular-nums">
									{exactUsd(breakdown.amountCents)}
								</dd>
							</div>
							<div className="flex justify-between">
								<dt className="text-ink-soft">
									JustUs fee ({breakdown.feeBps / 100}%)
								</dt>
								<dd className="text-muted-foreground tabular-nums">
									−{exactUsd(breakdown.feeCents)}
								</dd>
							</div>
							<div className="flex justify-between border-border border-t pt-1">
								<dt className="font-semibold text-ink">To this case</dt>
								<dd className="font-extrabold text-brass-deep tabular-nums">
									{exactUsd(breakdown.netCents)}
								</dd>
							</div>
						</dl>
					) : (
						check &&
						!check.ok && (
							<p className="text-[12.5px] text-danger leading-relaxed">
								{check.message}
							</p>
						)
					)}

					<button
						type="button"
						onClick={donate}
						disabled={pending || !check?.ok}
						className="inline-flex h-12 items-center justify-center gap-2 rounded-[var(--radius-control)] bg-brass px-5 font-bold text-[15px] text-white transition-colors hover:bg-brass-deep disabled:cursor-not-allowed disabled:opacity-60"
					>
						<HandCoins className="size-[18px]" aria-hidden="true" />
						{pending
							? "Taking you to checkout…"
							: breakdown
								? `${config.alreadyBacked ? "Give again" : "Back this case"} — ${exactUsd(breakdown.amountCents)}`
								: config.alreadyBacked
									? "Give again"
									: "Back this case"}
					</button>

					<p className="flex items-start gap-1.5 text-[11.5px] text-muted-foreground leading-relaxed">
						<Lock className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
						No account needed. Paid securely through Stripe — a donation is a
						gift, with no financial return and no share of any settlement.
					</p>
				</div>
			) : (
				<div className="rounded-[var(--radius-card-lg)] border border-border bg-surface p-4">
					<p className="font-bold text-[14px] text-ink">
						Not accepting donations yet
					</p>
					<p className="mt-1 text-[12.5px] text-muted-foreground leading-relaxed">
						{config.blockedReason ??
							"This case isn't raising right now. Check back shortly."}
					</p>
				</div>
			)}

			<button
				type="button"
				onClick={share}
				className="inline-flex h-12 items-center justify-center gap-2 rounded-[var(--radius-control)] border border-border bg-surface px-5 font-semibold text-[14px] text-ink transition-colors hover:border-brass-deep"
			>
				<Share2 className="size-4" aria-hidden="true" />
				Share
			</button>
		</div>
	);
}
