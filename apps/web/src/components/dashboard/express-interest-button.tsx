"use client";

import { Button, buttonVariants } from "@just-us/ui/components/button";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@just-us/ui/components/tooltip";
import { cn } from "@just-us/ui/lib/utils";
import { Check, Hand, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import {
	expressInterestAction,
	withdrawInterestAction,
} from "@/app/(app)/representation-actions";

/**
 * The one action an attorney can take on a case in the queue.
 *
 * It sends nothing to the plaintiff and opens no conversation — the toast says so
 * plainly, because an attorney who expects a reply and gets none will assume the
 * feature is broken rather than that it is working as intended.
 */
export function ExpressInterestButton({
	caseId,
	expressed,
	disabledReason,
	fullWidth = false,
}: {
	caseId: string;
	/** True once this attorney has already expressed interest in this case. */
	expressed: boolean;
	/** Set when the attorney can't express interest — usually an unverified bar
	 *  standing in the case's state. Shown as a hover/focus tooltip explaining why,
	 *  and disables the button. */
	disabledReason?: string;
	/** Fill the container's width rather than sizing to content — the queue card
	 *  stacks it above an equal-width "View case", so the two must match. */
	fullWidth?: boolean;
}) {
	const router = useRouter();
	const [pending, start] = useTransition();
	// Express interest is a one-way nudge to the plaintiff, and the CTA is large and
	// easy to hit by accident on the queue — so the click opens a confirm step
	// rather than firing straight away (JUS).
	const [confirmOpen, setConfirmOpen] = useState(false);
	// The card wants both stacked buttons the same width; the detail-page row wants
	// this one to size to its label. One switch drives every element below.
	const widthCls = fullWidth ? "w-full" : "w-full sm:w-auto";

	useEffect(() => {
		if (!confirmOpen) return;
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape" && !pending) setConfirmOpen(false);
		};
		document.addEventListener("keydown", onKey);
		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => {
			document.removeEventListener("keydown", onKey);
			document.body.style.overflow = previousOverflow;
		};
	}, [confirmOpen, pending]);

	function withdraw() {
		start(async () => {
			const res = await withdrawInterestAction({ caseId });
			if (res.ok) {
				toast.success("Interest withdrawn", {
					description:
						"It's been removed from the plaintiff's dashboard. You can put yourself forward again any time.",
				});
				router.refresh();
			} else {
				toast.error(res.error);
			}
		});
	}

	if (expressed) {
		// Confirms the interest is on record, and offers the undo for an accidental
		// tap — a low-emphasis text button, so it can't itself be fat-fingered the
		// way the primary CTA can.
		return (
			<div className={cn("flex flex-col items-center gap-1", widthCls)}>
				<span
					className={cn(
						"inline-flex h-9 items-center justify-center gap-1.5 rounded-[var(--radius-control)] bg-green-soft px-3 font-semibold text-[13px] text-green-deep",
						"w-full",
					)}
				>
					<Check className="size-4" aria-hidden="true" />
					Interest sent
				</span>
				<button
					type="button"
					onClick={withdraw}
					disabled={pending}
					className="font-semibold text-[12px] text-muted-foreground underline-offset-2 transition-colors hover:text-destructive hover:underline disabled:opacity-60"
				>
					{pending ? "Withdrawing…" : "Withdraw interest"}
				</button>
			</div>
		);
	}

	function express() {
		start(async () => {
			const res = await expressInterestAction({ caseId });
			if (res.ok) {
				setConfirmOpen(false);
				toast.success("Interest recorded", {
					description:
						"The plaintiff will see it on their dashboard. They'll reach out if they want to take it forward.",
				});
				router.refresh();
			} else {
				toast.error(res.error);
			}
		});
	}

	const button = (
		<button
			type="button"
			onClick={() => setConfirmOpen(true)}
			disabled={pending || !!disabledReason}
			className={cn(
				buttonVariants({ size: "sm" }),
				"h-9 justify-center",
				widthCls,
			)}
		>
			<Hand data-icon="inline-start" aria-hidden="true" />
			Express interest
		</button>
	);

	// The confirm step — a small modal, so an accidental tap on the CTA above never
	// records interest without a second, deliberate click.
	const confirmModal = confirmOpen ? (
		<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
			<button
				type="button"
				aria-label="Cancel expressing interest"
				className="absolute inset-0 cursor-default bg-ink/50"
				onClick={() => !pending && setConfirmOpen(false)}
			/>
			<section
				role="dialog"
				aria-modal="true"
				aria-labelledby="express-interest-title"
				className="relative w-full max-w-[460px] rounded-[var(--radius-card-lg)] border border-border bg-surface p-7 text-left shadow-[var(--shadow-modal)]"
			>
				<div className="flex items-start justify-between gap-4">
					<h2
						id="express-interest-title"
						className="font-extrabold text-[20px] text-ink tracking-[-0.02em]"
					>
						Express interest in this case?
					</h2>
					<button
						type="button"
						aria-label="Close"
						onClick={() => !pending && setConfirmOpen(false)}
						className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border text-ink-soft transition-colors hover:text-ink"
					>
						<X className="size-4" />
					</button>
				</div>
				<p className="mt-3 text-[14px] text-ink-soft leading-relaxed">
					The plaintiff will see your interest on their dashboard. This sends no
					message and opens no conversation — they reach out if they want to
					take it forward. You can withdraw it any time.
				</p>
				<div className="mt-6 flex justify-end gap-2">
					<Button
						variant="outline"
						size="lg"
						onClick={() => setConfirmOpen(false)}
						disabled={pending}
					>
						Cancel
					</Button>
					<Button size="lg" onClick={express} disabled={pending}>
						<Hand data-icon="inline-start" aria-hidden="true" />
						{pending ? "Recording…" : "Yes, express interest"}
					</Button>
				</div>
			</section>
		</div>
	) : null;

	// A bare disabled button says nothing about why. A tooltip gives the reason on
	// hover and keyboard focus without the room a full banner takes. The disabled
	// button can't be the trigger itself — a disabled control emits no pointer or
	// focus events — so a focusable span wraps it and carries the tooltip.
	if (disabledReason) {
		return (
			<TooltipProvider delay={150}>
				<Tooltip>
					<TooltipTrigger
						render={
							<span
								// biome-ignore lint/a11y/noNoninteractiveTabindex: the wrapped button is disabled, so the span is what surfaces the reason to keyboard users
								tabIndex={0}
								className={cn(
									"inline-flex rounded-[var(--radius-control)]",
									widthCls,
								)}
							/>
						}
					>
						{button}
					</TooltipTrigger>
					<TooltipContent side="top" className="max-w-[16rem] text-center">
						{disabledReason}
					</TooltipContent>
				</Tooltip>
			</TooltipProvider>
		);
	}

	return (
		<>
			{button}
			{confirmModal}
		</>
	);
}
