"use client";

import { Button } from "@just-us/ui/components/button";
import { Flag, X } from "lucide-react";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";

import { reportCampaignAction } from "@/app/cases/[id]/report-actions";

/**
 * The public "report this campaign" control (Reg. & Ops §3–4).
 *
 * Deliberately quiet — a small link, not a button competing with donate/share —
 * but open to anyone, signed in or not. Submitting records a moderation flag for
 * an administrator; it does not tell the reporter whether anything was hidden,
 * because that decision is a human's and threshold-based, not theirs to see.
 */
export function ReportCampaign({
	targetId,
	targetType = "case",
}: {
	targetId: string;
	targetType?: "case" | "update";
}) {
	const fieldId = useId();
	const [open, setOpen] = useState(false);
	const [reason, setReason] = useState("");
	const [pending, startTransition] = useTransition();

	function submit() {
		const trimmed = reason.trim();
		if (trimmed.length < 5) {
			toast.error("Add a short reason for the report.");
			return;
		}
		startTransition(async () => {
			const res = await reportCampaignAction({
				targetType,
				targetId,
				reason: trimmed,
			});
			if (res.ok) {
				toast.success(
					"Thanks — this has been sent to our moderators for review.",
				);
				setOpen(false);
				setReason("");
			} else {
				toast.error(res.error);
			}
		});
	}

	return (
		<>
			<button
				type="button"
				onClick={() => setOpen(true)}
				className="inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground transition-colors hover:text-danger"
			>
				<Flag className="size-3.5" aria-hidden="true" />
				Report this campaign
			</button>

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
						aria-label="Report this campaign"
						className="relative w-full max-w-[440px] rounded-[var(--radius-card-lg)] border border-border bg-surface p-6 shadow-[var(--shadow-modal)]"
					>
						<div className="mb-3 flex items-start justify-between gap-4">
							<div className="flex items-center gap-2.5">
								<span className="flex size-9 items-center justify-center rounded-full bg-danger/10 text-danger">
									<Flag className="size-4" aria-hidden="true" />
								</span>
								<h3 className="font-bold text-[16px] text-ink">
									Report this campaign
								</h3>
							</div>
							<button
								type="button"
								aria-label="Close"
								disabled={pending}
								onClick={() => setOpen(false)}
								className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-surface-2 hover:text-ink"
							>
								<X className="size-4" aria-hidden="true" />
							</button>
						</div>
						<label
							htmlFor={fieldId}
							className="block text-[13px] text-ink-soft leading-relaxed"
						>
							Tell our moderators what's wrong — a misleading claim, something
							defamatory, private information, or anything else. A person
							reviews every report.
						</label>
						<textarea
							id={fieldId}
							value={reason}
							onChange={(e) => setReason(e.target.value)}
							maxLength={2000}
							rows={4}
							placeholder="What's the concern?"
							className="mt-3 w-full resize-y rounded-[var(--radius-control)] border border-border bg-surface px-3 py-2 text-[13.5px] text-ink outline-none focus:border-brass-deep"
						/>
						<div className="mt-4 flex justify-end gap-2.5">
							<Button
								variant="outline"
								disabled={pending}
								onClick={() => setOpen(false)}
							>
								Cancel
							</Button>
							<Button
								disabled={pending || reason.trim().length < 5}
								onClick={submit}
							>
								{pending ? "Sending…" : "Submit report"}
							</Button>
						</div>
					</div>
				</div>
			)}
		</>
	);
}
