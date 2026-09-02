"use client";

import { cn } from "@just-us/ui/lib/utils";
import { useId, useRef, useState } from "react";

/**
 * A tab bar over server-rendered panels.
 *
 * Every panel's content is passed in already rendered and stays mounted — only its
 * visibility changes. That keeps the switch instant and, more importantly, keeps the
 * data fetching on the server page rather than turning a whole case screen into a
 * client component just to hide two thirds of it.
 *
 * Real `tab`/`tabpanel` roles rather than the plain pill buttons used for the
 * *filters* elsewhere in the dashboard: these genuinely control panels, so they owe
 * keyboard users arrow-key movement and a roving tabindex.
 */

export type CaseTab = {
	key: string;
	label: string;
	/** Shown beside the label when there's a number worth knowing up front. */
	count?: number;
	/** Marks the tab as holding something outstanding — a dot beside the label. */
	needsAttention?: boolean;
	content: React.ReactNode;
};

export function CaseTabs({
	tabs,
	initialKey,
	label,
}: {
	tabs: CaseTab[];
	/** Which tab opens first. Falls back to the first tab. */
	initialKey?: string;
	/** Names the tab list for screen readers — e.g. "Case sections". */
	label: string;
}) {
	const base = useId();
	const [active, setActive] = useState(initialKey ?? tabs[0]?.key ?? "");
	const buttons = useRef(new Map<string, HTMLButtonElement | null>());

	function select(key: string, moveFocus = false) {
		setActive(key);
		if (moveFocus) buttons.current.get(key)?.focus();
	}

	function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
		const current = tabs.findIndex((tab) => tab.key === active);
		if (current < 0) return;
		const last = tabs.length - 1;
		const next =
			event.key === "ArrowRight"
				? current === last
					? 0
					: current + 1
				: event.key === "ArrowLeft"
					? current === 0
						? last
						: current - 1
					: event.key === "Home"
						? 0
						: event.key === "End"
							? last
							: null;
		if (next === null) return;
		const target = tabs[next];
		if (!target) return;
		event.preventDefault();
		select(target.key, true);
	}

	return (
		<div className="flex flex-col gap-5">
			<div
				role="tablist"
				aria-label={label}
				onKeyDown={onKeyDown}
				className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5"
			>
				{tabs.map((tab) => {
					const selected = tab.key === active;
					return (
						<button
							key={tab.key}
							ref={(node) => {
								buttons.current.set(tab.key, node);
							}}
							type="button"
							role="tab"
							id={`${base}-tab-${tab.key}`}
							aria-selected={selected}
							aria-controls={`${base}-panel-${tab.key}`}
							tabIndex={selected ? 0 : -1}
							onClick={() => select(tab.key)}
							className={cn(
								"inline-flex shrink-0 items-center gap-2 rounded-[var(--radius-pill)] border px-4 py-2 font-semibold text-[13px] transition-colors",
								selected
									? "border-ink bg-ink text-paper"
									: "border-border bg-surface text-ink-soft hover:border-brass-deep hover:text-ink",
							)}
						>
							{tab.label}
							{tab.count !== undefined && tab.count > 0 && (
								<span
									className={cn(
										"inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 font-bold text-[11px] tabular-nums",
										selected
											? "bg-paper/15 text-paper"
											: "bg-surface-2 text-ink-soft",
									)}
								>
									{tab.count}
								</span>
							)}
							{tab.needsAttention && (
								<span
									className={cn(
										"size-1.5 rounded-full",
										selected ? "bg-gold-bright" : "bg-brass-deep",
									)}
								>
									<span className="sr-only">needs attention</span>
								</span>
							)}
						</button>
					);
				})}
			</div>

			{tabs.map((tab) => (
				<div
					key={tab.key}
					role="tabpanel"
					id={`${base}-panel-${tab.key}`}
					aria-labelledby={`${base}-tab-${tab.key}`}
					hidden={tab.key !== active}
				>
					{tab.content}
				</div>
			))}
		</div>
	);
}
