"use client";

import { Switch } from "@just-us/ui/components/switch";
import { LoaderCircle, Mail } from "lucide-react";
import { useId, useState, useTransition } from "react";

import { setEmailNotificationsAction } from "@/app/(app)/settings/notification-actions";

/**
 * The email-notification switch on Profile & settings. In-app notifications (the
 * header bell and `/notifications`) are always on; this governs only whether the
 * matching email goes out. Optimistic: the switch flips immediately and reverts
 * if the write fails, so the control never feels laggy on a human-paced toggle.
 */
export function NotificationSettings({
	emailEnabled: initial,
}: {
	emailEnabled: boolean;
}) {
	const switchId = useId();
	const [enabled, setEnabled] = useState(initial);
	const [pending, startTransition] = useTransition();
	const [failed, setFailed] = useState(false);

	function onChange(next: boolean) {
		setEnabled(next);
		setFailed(false);
		startTransition(async () => {
			try {
				await setEmailNotificationsAction(next);
			} catch {
				setEnabled(!next);
				setFailed(true);
			}
		});
	}

	return (
		<section className="rounded-xl border border-border bg-surface p-6">
			<div className="flex items-start gap-4">
				<span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-brass-wash text-brass-deep">
					<Mail className="size-4" aria-hidden="true" />
				</span>
				<div className="min-w-0 flex-1">
					<div className="flex items-start justify-between gap-4">
						<div className="min-w-0">
							<label
								htmlFor={switchId}
								className="block font-bold text-[15px] text-ink"
							>
								Email notifications
							</label>
							<p className="mt-1 max-w-[52ch] text-[13px] text-ink-soft leading-relaxed">
								Get an email for updates, status changes, and your
								contributions. The in-app bell always stays on.
							</p>
						</div>
						<span className="flex items-center gap-2 pt-0.5">
							{pending && (
								<LoaderCircle
									className="size-4 animate-spin text-muted-foreground"
									aria-hidden="true"
								/>
							)}
							<Switch
								id={switchId}
								checked={enabled}
								onCheckedChange={onChange}
								disabled={pending}
							/>
						</span>
					</div>
					{failed && (
						<p className="mt-3 text-[12.5px] text-destructive">
							Couldn't save that just now. Please try again.
						</p>
					)}
				</div>
			</div>
		</section>
	);
}
