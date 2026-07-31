"use client";

import { buttonVariants } from "@just-us/ui/components/button";
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
}: {
	caseId: string;
	/** True once this attorney has already expressed interest in this case. */
	expressed: boolean;
	/** Set when the attorney can't express interest at all — an unverified bar
	 *  standing, today. Shown as the button's tooltip and disables it. */
	disabledReason?: string;
}) {
	const router = useRouter();
	const [pending, start] = useTransition();

	if (expressed) {
		return (
			<span className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-control)] bg-green-soft px-3 font-semibold text-[13px] text-green-deep">
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

	return (
		<button
			type="button"
			onClick={express}
			disabled={pending || !!disabledReason}
			title={disabledReason}
			className={cn(
				buttonVariants({ size: "sm" }),
				"h-9 w-full justify-center sm:w-auto",
			)}
		>
			<Hand data-icon="inline-start" aria-hidden="true" />
			{pending ? "Recording…" : "Express interest"}
		</button>
	);
}
