"use client";

import { Button } from "@just-us/ui/components/button";
import { Checkbox } from "@just-us/ui/components/checkbox";
import { MessageSquare, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState, useTransition } from "react";
import { toast } from "sonner";

import { startConversationAction } from "@/app/(app)/message-actions";

export function MessageAttorneyButton({
	attorneyId,
	attorneyName,
	caseId,
	existingConversationId,
	promptOnExisting = false,
	className,
	size = "lg",
}: {
	attorneyId: string;
	attorneyName: string;
	/** Link a first contact made from a matched case to that case. */
	caseId?: string;
	/** A plaintiff can have only one conversation with an attorney. */
	existingConversationId?: string | null;
	/** When a conversation already exists: `false` (dashboard, an active
	 *  relationship) opens the thread directly; `true` (the directory, a discovery
	 *  context) shows a "you already have a conversation" prompt instead, so a
	 *  "Message this attorney" click never silently navigates away. */
	promptOnExisting?: boolean;
	className?: string;
	size?: "default" | "lg";
}) {
	const [open, setOpen] = useState(false);
	const [body, setBody] = useState("");
	const [acknowledged, setAcknowledged] = useState(false);
	const [pending, startTransition] = useTransition();
	// Set when submitting reveals a conversation with this attorney already exists:
	// the modal switches to a "go to your messages" prompt rather than dropping the
	// message on a first-contact path that has nothing to create.
	const [existingThreadId, setExistingThreadId] = useState<string | null>(null);
	const router = useRouter();
	const descriptionId = useId();
	const acknowledgmentId = useId();

	function openCompose() {
		setExistingThreadId(null);
		setOpen(true);
	}

	useEffect(() => {
		if (!open) return;
		const close = (event: KeyboardEvent) =>
			event.key === "Escape" && setOpen(false);
		document.addEventListener("keydown", close);
		const previous = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => {
			document.removeEventListener("keydown", close);
			document.body.style.overflow = previous;
		};
	}, [open]);

	function send() {
		startTransition(async () => {
			const result = await startConversationAction({
				attorneyId,
				body,
				caseId,
			});
			if (!result.ok) {
				// Already contacted this attorney: keep the modal open and show the
				// "continue in your messages" prompt instead of failing silently.
				if (result.reason === "already_exists" && result.conversationId) {
					setExistingThreadId(result.conversationId);
				} else {
					toast.error(result.error);
				}
				return;
			}
			router.push(`/messages/${result.conversationId}`);
		});
	}
	return (
		<>
			<Button
				size={size}
				className={className}
				onClick={() => {
					if (existingConversationId) {
						if (promptOnExisting) {
							setExistingThreadId(existingConversationId);
							setOpen(true);
						} else {
							router.push(`/messages/${existingConversationId}`);
						}
					} else {
						openCompose();
					}
				}}
			>
				<MessageSquare data-icon="inline-start" aria-hidden="true" />
				{existingConversationId && !promptOnExisting
					? "Open messages"
					: "Message this attorney"}
			</Button>
			{open && (
				<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
					<button
						aria-label="Close compose message"
						type="button"
						className="absolute inset-0 bg-ink/40"
						onClick={() => setOpen(false)}
					/>
					<section
						role="dialog"
						aria-modal="true"
						aria-describedby={descriptionId}
						className="relative w-full max-w-[560px] rounded-[var(--radius-card-lg)] border border-border bg-surface p-8 shadow-[var(--shadow-modal)]"
					>
						{existingThreadId ? (
							<>
								<div className="flex items-center justify-between gap-4">
									<h2 className="font-extrabold text-[22px] text-ink">
										You already have a conversation
									</h2>
									<button
										type="button"
										aria-label="Close"
										onClick={() => setOpen(false)}
										className="flex size-11 items-center justify-center rounded-full border border-border"
									>
										<X className="size-4" />
									</button>
								</div>
								<p className="mt-4 text-[14px] text-ink-soft leading-relaxed">
									You've already been in touch with {attorneyName.split(" ")[0]}
									. Continue in your existing conversation, where the whole
									thread lives, rather than starting a new one.
								</p>
								<div className="mt-6 flex justify-end gap-2">
									<Button variant="outline" onClick={() => setOpen(false)}>
										Close
									</Button>
									<Button
										onClick={() => router.push(`/messages/${existingThreadId}`)}
									>
										<MessageSquare
											data-icon="inline-start"
											aria-hidden="true"
										/>
										Go to conversation
									</Button>
								</div>
							</>
						) : (
							<>
								<div className="flex items-center justify-between gap-4">
									<h2 className="font-extrabold text-[22px] text-ink">
										Compose a message
									</h2>
									<button
										type="button"
										aria-label="Close"
										onClick={() => setOpen(false)}
										className="flex size-11 items-center justify-center rounded-full border border-border"
									>
										<X className="size-4" />
									</button>
								</div>
								<label
									htmlFor="first-message"
									className="mt-6 block font-semibold text-[14px] text-ink"
								>
									Message <span className="text-destructive">*</span>
								</label>
								<textarea
									id="first-message"
									value={body}
									onChange={(event) => setBody(event.target.value)}
									maxLength={2000}
									className="mt-2 min-h-40 w-full rounded-[var(--radius-control)] border border-line-strong bg-surface p-3 text-[14px] text-ink outline-none focus:border-brass-deep"
									placeholder={`Introduce yourself and tell ${attorneyName.split(" ")[0]} why you are reaching out.`}
								/>
								<p className="mt-1 text-right text-[12px] text-muted-foreground">
									{body.length}/2000
								</p>
								<p
									id={descriptionId}
									className="mt-5 rounded-[var(--radius-card-sm)] border border-border bg-paper-alt p-4 text-[13px] text-ink-soft leading-relaxed"
								>
									Messaging a JustUs attorney does not create an attorney-client
									relationship and is not privileged until representation is
									agreed.
								</p>
								<div className="mt-4 flex items-start gap-2.5 text-[13px] text-ink-soft">
									<Checkbox
										checked={acknowledged}
										onCheckedChange={(checked) =>
											setAcknowledged(checked === true)
										}
										aria-labelledby={acknowledgmentId}
										className="mt-0.5 size-5 after:-inset-3"
									/>
									<span id={acknowledgmentId}>
										I acknowledge that I have read and understand the statement
										above.
									</span>
								</div>
								<div className="mt-6 flex justify-end gap-2">
									<Button
										variant="outline"
										onClick={() => setOpen(false)}
										disabled={pending}
									>
										Cancel
									</Button>
									<Button
										disabled={!acknowledged || !body.trim() || pending}
										onClick={send}
									>
										{pending ? "Sending…" : "Send message"}
									</Button>
								</div>
							</>
						)}
					</section>
				</div>
			)}
		</>
	);
}
