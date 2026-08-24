"use client";

import { Switch } from "@just-us/ui/components/switch";
import { EyeOff, LoaderCircle } from "lucide-react";
import { useId, useState, useTransition } from "react";

import { setDonationAnonymousAction } from "@/app/(app)/settings/privacy-actions";

/**
 * The donor-privacy switch on Profile & settings. "Show my name" (on by default)
 * means donations appear by name in a case's public supporter list; off means
 * they show as "Anonymous". Optimistic, with a revert on failure.
 */
export function DonationPrivacySettings({
	anonymous: initial,
}: {
	anonymous: boolean;
}) {
	const switchId = useId();
	// The switch is framed positively ("show my name"); anonymity is the inverse.
	const [showName, setShowName] = useState(!initial);
	const [pending, startTransition] = useTransition();
	const [failed, setFailed] = useState(false);

	function onChange(next: boolean) {
		setShowName(next);
		setFailed(false);
		startTransition(async () => {
			try {
				await setDonationAnonymousAction(!next);
			} catch {
				setShowName(!next);
				setFailed(true);
			}
		});
	}

	return (
		<section className="rounded-xl border border-border bg-surface p-6">
			<div className="flex items-start gap-4">
				<span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-brass-wash text-brass-deep">
					<EyeOff className="size-4" aria-hidden="true" />
				</span>
				<div className="min-w-0 flex-1">
					<div className="flex items-start justify-between gap-4">
						<div className="min-w-0">
							<label
								htmlFor={switchId}
								className="block font-bold text-[15px] text-ink"
							>
								Show my name on donations
							</label>
							<p className="mt-1 max-w-[52ch] text-[13px] text-ink-soft leading-relaxed">
								When on, your name appears in a case's public list of
								supporters. Turn it off to give anonymously. Your gift still
								counts, but you show as “Anonymous”.
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
								checked={showName}
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
