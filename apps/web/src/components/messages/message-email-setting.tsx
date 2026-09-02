"use client";

import { Checkbox } from "@just-us/ui/components/checkbox";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { setMessageEmailPreferenceAction } from "@/app/(app)/message-actions";

export function MessageEmailSetting({ enabled }: { enabled: boolean }) {
	const [emailEnabled, setEmailEnabled] = useState(enabled);
	const [pending, startTransition] = useTransition();

	useEffect(() => setEmailEnabled(enabled), [enabled]);

	function updateEmailPreference(nextEnabled: boolean) {
		setEmailEnabled(nextEnabled);
		startTransition(async () => {
			const result = await setMessageEmailPreferenceAction(nextEnabled);
			if (!result.ok) {
				setEmailEnabled(!nextEnabled);
				toast.error(result.error);
			}
		});
	}

	return (
		<div className="mt-4 flex items-start gap-3 rounded-[var(--radius-card)] border border-border bg-paper-alt p-4 text-[14px] text-ink-soft">
			<Checkbox
				checked={emailEnabled}
				disabled={pending}
				onCheckedChange={(checked) => updateEmailPreference(checked === true)}
				aria-labelledby="message-email-preference-label"
				className="mt-0.5 size-5 after:-inset-3"
			/>
			<span>
				<strong id="message-email-preference-label" className="block text-ink">
					Email me about new messages
				</strong>
				<span className="mt-1 block text-[13px]">
					You can mute individual conversations separately from Messages.
				</span>
			</span>
		</div>
	);
}
