"use client";

import { Button } from "@just-us/ui/components/button";
import { cn } from "@just-us/ui/lib/utils";
import { CircleCheck, RotateCcw, ShieldAlert, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";

import { setCampaignVisibilityAction } from "@/app/(app)/campaigns/actions";

/**
 * Administrator oversight controls, shown in place of the donor donate panel when
 * an admin previews a case from the campaigns table.
 *
 * The one action that matters here is visibility: take a case down from the
 * public site, or restore one that was taken down. Removal is two-step — one
 * click arms it, the next confirms — because it hides the case from everyone. A
 * note is optional and saved with the record for the audit trail.
 */
export function AdminCaseActions({
	caseId,
	moderationStatus,
}: {
	caseId: string;
	/** The case's current moderation state — drives remove vs. restore. */
	moderationStatus: string;
}) {
	const router = useRouter();
	const noteId = useId();
	const [note, setNote] = useState("");
	const [armedRemove, setArmedRemove] = useState(false);
	const [pending, startTransition] = useTransition();

	const isRemoved = moderationStatus === "removed";

	function run(resolution: "cleared" | "removed", success: string) {
		startTransition(async () => {
			const res = await setCampaignVisibilityAction({
				caseId,
				resolution,
				note,
			});
			if (res.ok) {
				toast.success(success);
				setArmedRemove(false);
				setNote("");
				router.refresh();
			} else {
				toast.error(res.error);
			}
		});
	}

	return (
		<div className="rounded-[var(--radius-card-lg)] border border-border bg-surface p-5 shadow-[var(--shadow-rest)]">
			<div className="flex items-center gap-2">
				<span className="flex size-8 items-center justify-center rounded-full bg-ink text-surface">
					<ShieldAlert className="size-4" aria-hidden="true" />
				</span>
				<h2 className="font-bold text-[15px] text-ink">
					Administrator controls
				</h2>
			</div>

			{/* Current visibility, so the admin knows the case's state before acting. */}
			<div className="mt-3 flex items-center gap-2 text-[13px]">
				<span className="text-ink-soft">Public visibility:</span>
				<span
					className={cn(
						"inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] px-2.5 py-0.5 font-semibold text-[12px]",
						isRemoved
							? "bg-danger/10 text-danger"
							: "bg-green-soft text-green-deep",
					)}
				>
					<span
						className={cn(
							"size-1.5 rounded-full",
							isRemoved ? "bg-danger" : "bg-success",
						)}
					/>
					{isRemoved ? "Removed from site" : "Visible"}
				</span>
			</div>

			<p className="mt-3 text-[13px] text-ink-soft leading-relaxed">
				{isRemoved
					? "This case has been taken down. Donors can't see or back it. You can restore it to the site."
					: "You're viewing this case exactly as the public does. Take it down if it breaches the rules."}
			</p>

			<label
				htmlFor={noteId}
				className="mt-4 block font-semibold text-[13px] text-ink"
			>
				Reason / note{" "}
				<span className="font-normal text-muted-foreground">(optional)</span>
			</label>
			<textarea
				id={noteId}
				value={note}
				onChange={(e) => setNote(e.target.value)}
				maxLength={2000}
				rows={3}
				placeholder="Why are you removing or restoring this case?"
				className="mt-2 w-full resize-y rounded-[var(--radius-control)] border border-line-strong bg-surface p-3 text-[14px] text-ink leading-relaxed outline-none focus:border-brass-deep focus:ring-1 focus:ring-brass-deep/30"
			/>

			<div className="mt-4 flex flex-wrap items-center gap-2.5">
				{isRemoved ? (
					<Button
						type="button"
						disabled={pending}
						onClick={() => run("cleared", "Case restored to the site.")}
						className={cn("bg-green-deep text-white hover:bg-green-deep/90")}
					>
						<RotateCcw data-icon="inline-start" aria-hidden="true" />
						Restore to site
					</Button>
				) : (
					<>
						<Button
							type="button"
							disabled={pending}
							onClick={() => {
								if (!armedRemove) {
									setArmedRemove(true);
									return;
								}
								run("removed", "Case removed from the site.");
							}}
							className={cn("bg-danger text-white hover:bg-danger/90")}
						>
							<Trash2 data-icon="inline-start" aria-hidden="true" />
							{armedRemove ? "Confirm: remove from site" : "Remove from site"}
						</Button>
						{armedRemove && (
							<button
								type="button"
								onClick={() => setArmedRemove(false)}
								disabled={pending}
								className="text-[13px] text-muted-foreground underline-offset-2 hover:underline"
							>
								Cancel
							</button>
						)}
					</>
				)}
			</div>

			{!isRemoved && (
				<p className="mt-3 flex items-start gap-1.5 text-[11.5px] text-muted-foreground leading-relaxed">
					<CircleCheck className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
					Removal is reversible. It hides the case from the public but doesn't
					delete it, so you can restore it later.
				</p>
			)}
		</div>
	);
}
