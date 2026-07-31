"use client";

import {
	Combobox,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxInput,
	ComboboxItem,
	ComboboxList,
} from "@just-us/ui/components/combobox";
import { cn } from "@just-us/ui/lib/utils";
import { MapPin, X } from "lucide-react";
import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useId } from "react";

/**
 * Filters for the Seeking Representation queue, driven entirely by the URL — the
 * same approach as the attorney directory's controls, so a filtered queue is
 * shareable and the server does the filtering.
 *
 * Nothing is filtered unless the attorney asks for it. The queue could plausibly
 * default to their own jurisdiction, but a filter applied on their behalf hides
 * cases they were never told about, and an attorney licensed in more than one
 * state would silently lose half the queue. The "Licensed in" shortcut makes it
 * one click instead, and it is visible in the URL when it's on.
 */

const CONTROL_CLASS =
	"h-11 rounded-[var(--radius-control)] border-line-strong bg-surface text-[14px]";

const SORTS = [
	{ value: "newest", label: "Newest first" },
	{ value: "oldest", label: "Longest waiting" },
] as const;

export function QueueControls({
	categories,
	states,
	jurisdiction,
}: {
	/** Only categories and states that actually have a queued case. */
	categories: string[];
	states: string[];
	/** The attorney's own licensing jurisdiction, for the one-click shortcut.
	 *  Null when their account has none on record. */
	jurisdiction: string | null;
}) {
	const router = useRouter();
	const pathname = usePathname();
	const params = useSearchParams();

	const category = params.get("category") ?? "";
	const state = params.get("state") ?? "";
	const sort = params.get("sort") ?? "newest";
	const ids = { category: useId(), state: useId() };

	function apply(next: Record<string, string | null>) {
		const sp = new URLSearchParams(params.toString());
		for (const [key, value] of Object.entries(next)) {
			if (value) sp.set(key, value);
			else sp.delete(key);
		}
		const qs = sp.toString();
		router.push((qs ? `${pathname}?${qs}` : pathname) as Route);
	}

	const hasFilters = !!(category || state);
	// Only offered when there is actually something to find there — a shortcut
	// that returns an empty queue reads as a bug.
	const showJurisdiction = !!jurisdiction && states.includes(jurisdiction);
	const jurisdictionActive = !!jurisdiction && state === jurisdiction;

	return (
		<div className="flex flex-col gap-5">
			<div className="grid gap-4 rounded-[var(--radius-card-lg)] border border-border bg-paper-alt p-5 sm:grid-cols-2">
				<Field label="Category" htmlFor={ids.category}>
					<Dropdown
						id={ids.category}
						value={category}
						anyLabel="All categories"
						options={categories}
						onChange={(value) => apply({ category: value })}
					/>
				</Field>

				<Field label="State" htmlFor={ids.state}>
					<Dropdown
						id={ids.state}
						value={state}
						anyLabel="All states"
						options={states}
						onChange={(value) => apply({ state: value })}
					/>
				</Field>
			</div>

			<div className="flex flex-wrap items-center gap-2">
				<span className="mr-1 font-mono font-semibold text-[11px] text-muted-foreground uppercase tracking-[0.1em]">
					Sort by
				</span>
				{SORTS.map((option) => {
					const active = sort === option.value;
					return (
						<button
							key={option.value}
							type="button"
							aria-pressed={active}
							onClick={() =>
								apply({ sort: option.value === "newest" ? null : option.value })
							}
							className={cn(
								"rounded-[var(--radius-pill)] border px-4 py-1.5 font-semibold text-[13px] transition-colors",
								active
									? "border-ink bg-ink text-paper"
									: "border-border bg-surface text-ink-soft hover:border-brass-deep hover:text-ink",
							)}
						>
							{option.label}
						</button>
					);
				})}

				{showJurisdiction && (
					<button
						type="button"
						aria-pressed={jurisdictionActive}
						onClick={() =>
							apply({ state: jurisdictionActive ? null : jurisdiction })
						}
						className={cn(
							"inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] border px-3 py-1.5 font-semibold text-[13px] transition-colors",
							jurisdictionActive
								? "border-brass-deep bg-brass-wash text-brass-deep"
								: "border-border bg-surface text-ink-soft hover:border-brass-deep hover:text-ink",
						)}
					>
						<MapPin className="size-3.5" aria-hidden="true" />
						Licensed in {jurisdiction}
					</button>
				)}

				{hasFilters && (
					<button
						type="button"
						onClick={() => apply({ category: null, state: null })}
						className="ml-auto inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] px-3 py-1.5 font-semibold text-[13px] text-ink-soft transition-colors hover:bg-brass-wash hover:text-brass-deep"
					>
						<X className="size-3.5" aria-hidden="true" />
						Clear filters
					</button>
				)}
			</div>
		</div>
	);
}

function Field({
	label,
	htmlFor,
	children,
}: {
	label: string;
	htmlFor: string;
	children: React.ReactNode;
}) {
	return (
		<div className="flex flex-col gap-1.5">
			<label htmlFor={htmlFor} className="font-semibold text-[13px] text-ink">
				{label}
			</label>
			{children}
		</div>
	);
}

/** A searchable single-select. Clearing the text clears the filter, so the empty
 *  field is the "all" state — matching the directory's controls. */
function Dropdown({
	id,
	value,
	options,
	anyLabel,
	onChange,
}: {
	id: string;
	value: string;
	options: string[];
	anyLabel: string;
	onChange: (value: string | null) => void;
}) {
	return (
		<Combobox
			items={options}
			value={value}
			onValueChange={(next: string | null) => onChange(next || null)}
		>
			<ComboboxInput id={id} placeholder={anyLabel} className={CONTROL_CLASS} />
			<ComboboxContent>
				<ComboboxEmpty>No matches</ComboboxEmpty>
				<ComboboxList>
					{(option: string) => (
						<ComboboxItem key={option} value={option}>
							{option}
						</ComboboxItem>
					)}
				</ComboboxList>
			</ComboboxContent>
		</Combobox>
	);
}
