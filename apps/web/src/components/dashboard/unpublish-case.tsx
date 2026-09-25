"use client";

import { Button } from "@just-us/ui/components/button";
import { cn } from "@just-us/ui/lib/utils";
import { EyeOff, Play } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { republishCaseAction, unpublishCaseAction } from "@/app/cases/actions";

/**
 * Pausing and resuming a live case's public page — the plaintiff's reversible
 * counterpart to closing.
 *
 * Paused means: off the directory and the landing page, the public URL 404s, and
 * donations stop. The case stays live underneath, so its attorney, payout
 * binding, and raised total are untouched, and resuming puts it straight back.
 * The copy says what it is *not* — not a close, not a refund — so the plaintiff
 * doesn't reach for it expecting either.
 */
export function UnpublishCaseButton({
	caseId,
	title,
	paused,
}: {
	caseId: string;
	title: string;
	/** Whether the public page is currently paused. */
	paused: boolean;
}) {
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const [pending, startTransition] = useTransition();

	function pause() {
		startTransition(async () => {
			const res = await unpublishCaseAction(caseId);
			if (res.ok) {
				toast.success(
					"Public page paused. Resume it here whenever you're ready.",
				);
				setOpen(false);
				router.refresh();
			} else {
				toast.error(res.error);
			}
		});
	}

	function resume() {
		startTransition(async () => {
			const res = await republishCaseAction(caseId);
			if (res.ok) {
				toast.success("Your case is public again.");
				router.refresh();
			} else {
				toast.error(res.error);
			}
		});
	}

	if (paused) {
		return (
			<section className="rounded-[var(--radius-card-lg)] border border-gold-bright/40 bg-gold-bright/10 p-6">
				<h2 className="font-bold text-[18px] text-ink">Public page paused</h2>
				<p className="mt-1.5 max-w-[60ch] text-[13.5px] text-ink-soft leading-relaxed">
					Your case is hidden from the directory and its public link, and it
					isn't accepting donations. Everything you've raised so far is
					unchanged. Resume whenever you're ready and it goes straight back.
				</p>
				<Button
					disabled={pending}
					onClick={resume}
					className={cn("mt-4 bg-brass text-white hover:bg-brass/90")}
				>
					<Play data-icon="inline-start" aria-hidden="true" />
					{pending ? "Resuming…" : "Resume public page"}
				</Button>
			</section>
		);
	}

	return (
		<>
			<section className="rounded-[var(--radius-card-lg)] border border-border bg-surface p-6">
				<h2 className="font-bold text-[18px] text-ink">Pause public page</h2>
				<p className="mt-1.5 max-w-[60ch] text-[13.5px] text-ink-soft leading-relaxed">
					Take your case off the public site for a while without closing it. It
					leaves the directory and stops accepting donations until you resume.
					Nothing is refunded, and your attorney and what you've raised stay
					exactly as they are.
				</p>
				<button
					type="button"
					onClick={() => setOpen(true)}
					className="mt-4 inline-flex items-center gap-1.5 rounded-[var(--radius-control)] border border-border px-4 py-2 font-semibold text-[13px] text-ink transition-colors hover:border-brass-deep hover:text-brass-deep"
				>
					<EyeOff className="size-4" aria-hidden="true" />
					Pause public page
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
							<EyeOff className="size-5" aria-hidden="true" />
						</div>
						<h3 className="font-bold text-[17px] text-ink">
							Pause the public page?
						</h3>
						<p className="mt-1.5 text-[13.5px] text-ink-soft leading-relaxed">
							“{title || "This case"}” will leave the directory and stop
							accepting donations until you resume it. People who already
							supported it keep their gifts. This is not a close and not a
							refund.
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
								onClick={pause}
								className={cn("bg-brass text-white hover:bg-brass/90")}
							>
								<EyeOff data-icon="inline-start" aria-hidden="true" />
								{pending ? "Pausing…" : "Pause public page"}
							</Button>
						</div>
					</div>
				</div>
			)}
		</>
	);
}
