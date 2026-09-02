"use client";

import { Button } from "@just-us/ui/components/button";
import { Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";

import { messagePlaintiffAction } from "@/app/(app)/campaigns/actions";

/**
 * Lets an administrator send a case's plaintiff a direct message from the
 * oversight page. It's delivered in-app and by email and logged to the case's
 * decision history, so `router.refresh()` after a send surfaces it there.
 */
export function AdminMessagePlaintiff({
	caseId,
	plaintiffName,
}: {
	caseId: string;
	/** First name (or full name) of the plaintiff, for the field label. */
	plaintiffName: string;
}) {
	const router = useRouter();
	const fieldId = useId();
	const [message, setMessage] = useState("");
	const [pending, startTransition] = useTransition();

	function send() {
		const trimmed = message.trim();
		if (!trimmed) return;
		startTransition(async () => {
			const res = await messagePlaintiffAction({ caseId, message: trimmed });
			if (res.ok) {
				toast.success(`Message sent to ${plaintiffName}.`);
				setMessage("");
				router.refresh();
			} else {
				toast.error(res.error);
			}
		});
	}

	return (
		<div className="rounded-[var(--radius-card-lg)] border border-border bg-surface p-5 shadow-[var(--shadow-rest)]">
			<div className="flex items-center gap-2">
				<span className="flex size-8 items-center justify-center rounded-full bg-brass-wash text-brass-deep">
					<Send className="size-4" aria-hidden="true" />
				</span>
				<h2 className="font-bold text-[15px] text-ink">
					Message the plaintiff
				</h2>
			</div>
			<p className="mt-2 text-[13px] text-ink-soft leading-relaxed">
				Reaches {plaintiffName} in-app and by email, with a link back to their
				case. Saved to this case's history.
			</p>

			<label htmlFor={fieldId} className="sr-only">
				Message to {plaintiffName}
			</label>
			<textarea
				id={fieldId}
				value={message}
				onChange={(e) => setMessage(e.target.value)}
				maxLength={2000}
				rows={4}
				placeholder={`Write to ${plaintiffName}…`}
				className="mt-3 w-full resize-y rounded-[var(--radius-control)] border border-line-strong bg-surface p-3 text-[14px] text-ink leading-relaxed outline-none focus:border-brass-deep focus:ring-1 focus:ring-brass-deep/30"
			/>

			<div className="mt-3 flex justify-end">
				<Button
					type="button"
					disabled={pending || !message.trim()}
					onClick={send}
				>
					<Send data-icon="inline-start" aria-hidden="true" />
					{pending ? "Sending…" : "Send message"}
				</Button>
			</div>
		</div>
	);
}
