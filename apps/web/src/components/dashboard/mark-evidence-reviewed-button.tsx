"use client";

import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { markEvidenceReviewedAction } from "@/app/(app)/representation-actions";

/**
 * Clears the "new evidence" highlight for the attorney once they've looked at it.
 *
 * The highlight is deliberately persistent — it does not vanish just because the
 * case was opened — so this is the explicit "I've seen it" that stands the cue
 * down, on both the case and the intakes list.
 */
export function MarkEvidenceReviewedButton({ caseId }: { caseId: string }) {
	const router = useRouter();
	const [pending, start] = useTransition();

	return (
		<button
			type="button"
			disabled={pending}
			onClick={() =>
				start(async () => {
					await markEvidenceReviewedAction(caseId);
					toast.success("Marked as reviewed.");
					router.refresh();
				})
			}
			className="inline-flex shrink-0 items-center gap-1.5 rounded-[var(--radius-control)] border border-brass-deep/40 bg-surface px-2.5 py-1 font-semibold text-[12px] text-brass-deep transition-colors hover:bg-brass-wash disabled:opacity-60"
		>
			<Check className="size-3.5" aria-hidden="true" />
			{pending ? "Saving…" : "Mark reviewed"}
		</button>
	);
}
