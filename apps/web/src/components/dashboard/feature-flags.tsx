"use client";

// Pure registry entry point — importing "@just-us/flags" here would pull Prisma
// into the client bundle.
import {
	FLAG_KEYS,
	FLAGS,
	type FlagKey,
	type FlagState,
} from "@just-us/flags/registry";
import { Switch } from "@just-us/ui/components/switch";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { toggleFlagAction } from "@/app/dashboard/flag-actions";

/**
 * Administrator control for feature flags (JUS-13).
 *
 * Rows come from the registry, not from the database, so a flag that has never
 * been toggled still appears (off) and a stale row for a deleted flag never shows
 * up. The switch updates optimistically and rolls back if the action fails.
 */
export function FeatureFlags({ initial }: { initial: FlagState }) {
	const [flags, setFlags] = useState(initial);
	const [pending, startTransition] = useTransition();

	function onToggle(key: FlagKey, next: boolean) {
		const previous = flags[key];
		setFlags((f) => ({ ...f, [key]: next }));

		startTransition(async () => {
			const result = await toggleFlagAction(key, next);
			if (result.ok) {
				toast.success(`${FLAGS[key].label} ${next ? "enabled" : "disabled"}.`);
			} else {
				setFlags((f) => ({ ...f, [key]: previous }));
				toast.error(result.error);
			}
		});
	}

	return (
		<div className="rounded-[var(--radius-card)] border border-border bg-card">
			<div className="border-border border-b px-5 py-4">
				<h2 className="font-bold text-[15px] text-ink">Feature flags</h2>
				<p className="mt-1 text-[13.5px] text-ink-soft leading-relaxed">
					Turn upcoming capabilities on or off. Changes take effect immediately
					— no deploy required — and apply to this environment only.
				</p>
			</div>

			<ul className="divide-y divide-border">
				{FLAG_KEYS.map((key) => (
					<li
						key={key}
						className="flex items-start justify-between gap-6 px-5 py-4"
					>
						<div className="min-w-0">
							<label
								htmlFor={`flag-${key}`}
								className="font-semibold text-[14px] text-ink"
							>
								{FLAGS[key].label}
							</label>
							<p className="mt-1 text-[13px] text-ink-soft leading-relaxed">
								{FLAGS[key].description}
							</p>
						</div>
						<Switch
							id={`flag-${key}`}
							checked={flags[key]}
							disabled={pending}
							onCheckedChange={(checked: boolean) => onToggle(key, checked)}
						/>
					</li>
				))}
			</ul>
		</div>
	);
}
