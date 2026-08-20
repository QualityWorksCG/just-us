"use client";

import { buttonVariants } from "@just-us/ui/components/button";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@just-us/ui/components/tooltip";
import { cn } from "@just-us/ui/lib/utils";
import { Check, Hand } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { expressInterestAction } from "@/app/(app)/representation-actions";

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
	// The card wants both stacked buttons the same width; the detail-page row wants
	// this one to size to its label. One switch drives every element below.
	const widthCls = fullWidth ? "w-full" : "w-full sm:w-auto";

	if (expressed) {
		return (
			<span
				className={cn(
					"inline-flex h-9 items-center justify-center gap-1.5 rounded-[var(--radius-control)] bg-green-soft px-3 font-semibold text-[13px] text-green-deep",
					widthCls,
				)}
			>
				<Check className="size-4" aria-hidden="true" />
				Interest sent
			</span>
		);
	}

	function express() {
		start(async () => {
			const res = await expressInterestAction({ caseId });
			if (res.ok) {
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
			onClick={express}
			disabled={pending || !!disabledReason}
			className={cn(
				buttonVariants({ size: "sm" }),
				"h-9 justify-center",
				widthCls,
			)}
		>
			<Hand data-icon="inline-start" aria-hidden="true" />
			{pending ? "Recording…" : "Express interest"}
		</button>
	);

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

	return button;
}
