"use client";

import { Button } from "@just-us/ui/components/button";
import { cn } from "@just-us/ui/lib/utils";
import { Trash2 } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { deleteCaseAction } from "@/app/cases/actions";

export function DeleteDraftButton({
	id,
	title,
}: {
	id: string;
	title?: string;
}) {
	const [open, setOpen] = useState(false);
	const [pending, startTransition] = useTransition();

	// Close on Escape (unless a delete is in flight).
	useEffect(() => {
		if (!open) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape" && !pending) setOpen(false);
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [open, pending]);

	function confirmDelete() {
		startTransition(async () => {
			const res = await deleteCaseAction(id);
			if (res.ok) {
				toast.success("Draft deleted — this can't be undone.");
				setOpen(false);
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
				className="inline-flex items-center gap-1.5 font-semibold text-[13px] text-danger transition-colors hover:text-danger/80"
			>
				<Trash2 className="size-4" aria-hidden="true" />
				Delete
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
						aria-labelledby="delete-draft-title"
						className="relative w-full max-w-[400px] rounded-[var(--radius-card-lg)] border border-border bg-surface p-6 shadow-[var(--shadow-modal)]"
					>
						<div className="mb-3 flex size-11 items-center justify-center rounded-full bg-danger/10 text-danger">
							<Trash2 className="size-5" aria-hidden="true" />
						</div>
						<h2
							id="delete-draft-title"
							className="font-bold text-[17px] text-ink"
						>
							Delete this draft?
						</h2>
						<p className="mt-1.5 text-[13.5px] text-ink-soft leading-relaxed">
							{title ? `“${title}” ` : "This draft "}will be permanently
							deleted. This can't be undone — a deleted case can't be restored.
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
								onClick={confirmDelete}
								className={cn("bg-danger text-white hover:bg-danger/90")}
							>
								<Trash2 data-icon="inline-start" aria-hidden="true" />
								{pending ? "Deleting…" : "Delete draft"}
							</Button>
						</div>
					</div>
				</div>
			)}
		</>
	);
}
