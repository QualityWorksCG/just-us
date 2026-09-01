"use client";

import { Button } from "@just-us/ui/components/button";
import { cn } from "@just-us/ui/lib/utils";
import { Check, Handshake, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { requestRepresentationAction } from "@/app/(app)/find-attorney/actions";

/**
 * A plaintiff asks a specific attorney from the directory to represent their case.
 *
 * The directed counterpart to "Message this attorney": messaging is for context,
 * this is the ask itself. It confirms first, because it emails the attorney and
 * sends the case out to them — a deliberate step, not a stray click.
 */
export function RequestRepresentationButton({
	attorneyId,
	attorneyName,
	caseId,
	className,
	size = "lg",
}: {
	attorneyId: string;
	attorneyName: string;
	/** The plaintiff's case the request is for. */
	caseId: string;
	className?: string;
	size?: "default" | "lg";
}) {
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const [sent, setSent] = useState(false);
	const [pending, start] = useTransition();
	const firstName = attorneyName.split(" ")[0] || "them";

	useEffect(() => {
		if (!open) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape" && !pending) setOpen(false);
		};
		document.addEventListener("keydown", onKey);
		const prev = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => {
			document.removeEventListener("keydown", onKey);
			document.body.style.overflow = prev;
		};
	}, [open, pending]);

	function send() {
		start(async () => {
			const res = await requestRepresentationAction({ caseId, attorneyId });
			if (res.ok) {
				setSent(true);
				setOpen(false);
				toast.success(`Request sent to ${firstName}`, {
					description:
						"They'll see it under their intake requests and can accept or decline.",
				});
				router.refresh();
			} else {
				toast.error(res.error);
			}
		});
	}

	if (sent) {
		return (
			<span
				className={cn(
					"inline-flex h-11 items-center justify-center gap-1.5 rounded-[var(--radius-control)] bg-green-soft px-4 font-semibold text-[14px] text-green-deep",
					className,
				)}
			>
				<Check className="size-4" aria-hidden="true" />
				Request sent
			</span>
		);
	}

	return (
		<>
			<Button
				size={size}
				className={cn(
					// Green so it reads as its own CTA, distinct from the gold Message
					// button beneath it — the ask, not the aside.
					"bg-green-deep text-white hover:bg-green-deep/90",
					className,
				)}
				onClick={() => setOpen(true)}
			>
				<Handshake data-icon="inline-start" aria-hidden="true" />
				Request to represent
			</Button>
			{open && (
				<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
					<button
						type="button"
						aria-label="Cancel request"
						className="absolute inset-0 cursor-default bg-ink/50"
						onClick={() => !pending && setOpen(false)}
					/>
					<section
						role="dialog"
						aria-modal="true"
						aria-labelledby="request-rep-title"
						className="relative w-full max-w-[500px] rounded-[var(--radius-card-lg)] border border-border bg-surface p-7 text-left shadow-[var(--shadow-modal)]"
					>
						<div className="flex items-start justify-between gap-4">
							<h2
								id="request-rep-title"
								className="font-extrabold text-[20px] text-ink tracking-[-0.02em]"
							>
								Ask {firstName} to represent you?
							</h2>
							<button
								type="button"
								aria-label="Close"
								onClick={() => !pending && setOpen(false)}
								className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border text-ink-soft transition-colors hover:text-ink"
							>
								<X className="size-4" />
							</button>
						</div>
						<p className="mt-3 text-[14px] text-ink-soft leading-relaxed">
							We'll send {firstName} your case and ask them to take it on. Your
							case goes out to attorneys, held just for {firstName} until they
							answer — never the open queue. They accept or decline, and you can
							still message them for context.
						</p>
						<div className="mt-6 flex justify-end gap-2">
							<Button
								variant="outline"
								size="lg"
								onClick={() => setOpen(false)}
								disabled={pending}
							>
								Cancel
							</Button>
							<Button
								size="lg"
								className="bg-green-deep text-white hover:bg-green-deep/90"
								onClick={send}
								disabled={pending}
							>
								<Handshake data-icon="inline-start" aria-hidden="true" />
								{pending ? "Sending…" : "Send request"}
							</Button>
						</div>
					</section>
				</div>
			)}
		</>
	);
}
