"use client";

import { Button } from "@just-us/ui/components/button";
import { cn } from "@just-us/ui/lib/utils";
import { CircleCheck, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";

import { resolveCampaignAction } from "@/app/(app)/moderation/actions";

/**
 * A moderator's ruling on a flagged campaign: keep it on the site or remove it,
 * with an optional note recorded on the flags for the audit trail.
 *
 * "Keep on site" clears the flags and makes the campaign visible again; "Remove
 * from site" takes it down. Remove is two-step — one click arms it, the next
 * confirms — because it hides the campaign from everyone.
 */
export function CampaignModerationActions({ caseId }: { caseId: string }) {
	const router = useRouter();
	const noteId = useId();
	const [note, setNote] = useState("");
	const [armedRemove, setArmedRemove] = useState(false);
	const [pending, startTransition] = useTransition();

	function run(resolution: "cleared" | "removed", success: string) {
		startTransition(async () => {
			const res = await resolveCampaignAction({ caseId, resolution, note });
			if (res.ok) {
				toast.success(success);
				router.push("/moderation");
			} else {
				toast.error(res.error);
			}
		});
	}

	return (
		<div className="rounded-[var(--radius-card-lg)] border border-border bg-surface p-5 shadow-[var(--shadow-rest)]">
			<h2 className="font-bold text-[16px] text-ink">Make a decision</h2>
			<p className="mt-1 text-[13px] text-ink-soft leading-relaxed">
				Keep this campaign on the site, or remove it. Your note is saved with
				the record.
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
				placeholder="Why are you keeping or removing this campaign?"
				className="mt-2 w-full resize-y rounded-[var(--radius-control)] border border-line-strong bg-surface p-3 text-[14px] text-ink leading-relaxed outline-none focus:border-brass-deep focus:ring-1 focus:ring-brass-deep/30"
			/>

			<div className="mt-4 flex flex-wrap items-center gap-2.5">
				<Button
					type="button"
					disabled={pending}
					onClick={() => run("cleared", "Campaign kept on the site.")}
					className={cn("bg-green-deep text-white hover:bg-green-deep/90")}
				>
					<CircleCheck data-icon="inline-start" aria-hidden="true" />
					Keep on site
				</Button>

				<Button
					type="button"
					disabled={pending}
					onClick={() => {
						if (!armedRemove) {
							setArmedRemove(true);
							return;
						}
						run("removed", "Campaign removed from the site.");
					}}
					className={cn("bg-danger text-white hover:bg-danger/90")}
				>
					<Trash2 data-icon="inline-start" aria-hidden="true" />
					{armedRemove ? "Confirm — remove from site" : "Remove from site"}
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
			</div>
		</div>
	);
}
