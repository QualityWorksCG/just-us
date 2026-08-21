"use client";

import { Button } from "@just-us/ui/components/button";
import { cn } from "@just-us/ui/lib/utils";
import { CircleCheck, Flag } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { closeCaseAction } from "@/app/cases/actions";

/**
 * Marking a live case Closed — the end of its funding life.
 *
 * Deliberately framed, not just confirmed: closing stops donations and thanks
 * backers with a certificate of appreciation. It is **not** a refund, and the
 * copy here says so plainly, because a donor's gift was never an investment and
 * the plaintiff should understand that's what they're communicating.
 */
export function CloseCaseButton({
	caseId,
	title,
	backerCount,
}: {
	caseId: string;
	title: string;
	/** How many backers will receive a certificate — shown so the plaintiff knows
	 *  the reach of closing before they do it. */
	backerCount: number;
}) {
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const [pending, startTransition] = useTransition();

	function close() {
		startTransition(async () => {
			const res = await closeCaseAction(caseId);
			if (res.ok) {
				toast.success(
					backerCount > 0
						? "Case closed. Your backers are being thanked with a certificate."
						: "Case closed.",
				);
				setOpen(false);
				router.refresh();
			} else {
				toast.error(res.error);
			}
		});
	}

	return (
		<>
			<section className="rounded-[var(--radius-card-lg)] border border-border bg-surface p-6">
				<h2 className="font-bold text-[18px] text-ink">Close this case</h2>
				<p className="mt-1.5 max-w-[60ch] text-[13.5px] text-ink-soft leading-relaxed">
					When the matter has resolved, close the case to stop accepting
					donations. Everyone who backed it receives a certificate of
					appreciation. Closing is not a refund. A gift on JustUs is never an
					investment, and none is returned.
				</p>
				<button
					type="button"
					onClick={() => setOpen(true)}
					className="mt-4 inline-flex items-center gap-1.5 rounded-[var(--radius-control)] border border-border px-4 py-2 font-semibold text-[13px] text-ink transition-colors hover:border-brass-deep hover:text-brass-deep"
				>
					<Flag className="size-4" aria-hidden="true" />
					Close case
				</button>
			</section>

			{open && (
				<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
					<button
						type="button"
						aria-label="Cancel"
						disabled={pending}
						onClick={() => setOpen(false)}
						className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
					/>
					<div
						role="dialog"
						aria-modal="true"
						className="relative w-full max-w-[420px] rounded-[var(--radius-card-lg)] border border-border bg-surface p-6 shadow-[var(--shadow-modal)]"
					>
						<div className="mb-3 flex size-11 items-center justify-center rounded-full bg-brass-wash text-brass-deep">
							<Flag className="size-5" aria-hidden="true" />
						</div>
						<h3 className="font-bold text-[17px] text-ink">Close this case?</h3>
						<p className="mt-1.5 text-[13.5px] text-ink-soft leading-relaxed">
							“{title || "This case"}” will stop accepting donations and leave
							the public directory.{" "}
							{backerCount > 0
								? `Its ${backerCount} backer${backerCount === 1 ? "" : "s"} will be thanked with a certificate of appreciation.`
								: "It has no backers yet, so no certificates will be issued."}{" "}
							This does not refund anyone.
						</p>
						<div className="mt-5 flex justify-end gap-2.5">
							<Button
								variant="outline"
								disabled={pending}
								onClick={() => setOpen(false)}
							>
								Cancel
							</Button>
							<Button
								disabled={pending}
								onClick={close}
								className={cn("bg-brass text-white hover:bg-brass/90")}
							>
								<CircleCheck data-icon="inline-start" aria-hidden="true" />
								{pending ? "Closing…" : "Close case"}
							</Button>
						</div>
					</div>
				</div>
			)}
		</>
	);
}
