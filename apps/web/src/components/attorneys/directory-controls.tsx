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
import { X } from "lucide-react";
import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useState } from "react";

/**
 * Directory filters, driven entirely by the URL.
 *
 * State in the query string rather than the component means a filtered view is
 * shareable and survives the back button, and the server does the filtering — so
 * the page never renders one set of results and then swaps them.
 */

/** Every field in the filter row shares this, so a change to one can't leave the
 *  others a different height. The combobox defaults to h-9 like Select; the row
 *  wants h-11 to match the app's form controls. */
const CONTROL_CLASS =
	"h-11 rounded-[var(--radius-control)] border-line-strong bg-surface text-[14px]";

const SORTS = [
	{ value: "name", label: "A to Z" },
	{ value: "rating", label: "Highest rated" },
	{ value: "availability", label: "Availability" },
] as const;

export function DirectoryControls({
	practiceAreas,
	states,
}: {
	/** Only areas and states that actually have a listed attorney. */
	practiceAreas: string[];
	states: string[];
}) {
	const router = useRouter();
	const pathname = usePathname();
	const params = useSearchParams();

	const area = params.get("area") ?? "";
	const state = params.get("state") ?? "";
	const q = params.get("q") ?? "";
	const sort = params.get("sort") ?? "name";

	const [keyword, setKeyword] = useState(q);
	const ids = { area: useId(), state: useId(), keyword: useId() };

	// Keep the field in step when the URL changes elsewhere (back button, a link).
	useEffect(() => {
		setKeyword(q);
	}, [q]);

	function apply(next: Record<string, string | null>) {
		const sp = new URLSearchParams(params.toString());
		for (const [key, value] of Object.entries(next)) {
			if (value) sp.set(key, value);
			else sp.delete(key);
		}
		const qs = sp.toString();
		router.push((qs ? `${pathname}?${qs}` : pathname) as Route);
	}

	const hasFilters = !!(area || state || q);

	/** Back to the unfiltered list. The keyword input holds its own state, so it
	 *  has to be cleared directly — otherwise the debounce effect sees text that
	 *  the URL no longer has and immediately re-applies it. */
	function clearFilters() {
		setKeyword("");
		apply({ area: null, state: null, q: null });
	}

	// Debounced so typing doesn't push a history entry per keystroke.
	// biome-ignore lint/correctness/useExhaustiveDependencies: runs on `keyword` only
	useEffect(() => {
		if (keyword === q) return;
		const timer = setTimeout(() => apply({ q: keyword || null }), 350);
		return () => clearTimeout(timer);
	}, [keyword, q]);

	return (
		<div className="flex flex-col gap-5">
			<div className="grid gap-4 rounded-[var(--radius-card-lg)] border border-border bg-paper-alt p-5 sm:grid-cols-2 lg:grid-cols-3">
				<Field label="Practice area" htmlFor={ids.area}>
					<Dropdown
						id={ids.area}
						value={area}
						anyLabel="All practice areas"
						className={CONTROL_CLASS}
						onChange={(v) => apply({ area: v })}
						options={practiceAreas}
					/>
				</Field>

				<Field label="Licensed in" htmlFor={ids.state}>
					<Dropdown
						id={ids.state}
						value={state}
						anyLabel="All states"
						className={CONTROL_CLASS}
						onChange={(v) => apply({ state: v })}
						options={states}
					/>
				</Field>

				<Field label="Keyword" htmlFor={ids.keyword}>
					<form
						onSubmit={(e) => {
							e.preventDefault();
							apply({ q: keyword || null });
						}}
					>
						<input
							id={ids.keyword}
							type="search"
							value={keyword}
							onChange={(e) => setKeyword(e.target.value)}
							placeholder="Name, firm, or specialty…"
							className={cn(
								CONTROL_CLASS,
								"w-full border px-3 text-ink outline-none transition-colors placeholder:text-muted-foreground focus:border-brass-deep",
							)}
						/>
					</form>
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
								apply({ sort: option.value === "name" ? null : option.value })
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

				{/* Only shown when there's something to clear — a permanently-visible
				    reset invites a click that does nothing. */}
				{hasFilters && (
					<button
						type="button"
						onClick={clearFilters}
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

/**
 * A searchable single-select.
 *
 * Fifty states is too many to scroll past, so the field is typed into rather than
 * hunted through. Clearing the text clears the filter — the empty field *is* the
 * "all" state, which is why there's no separate "All states" option to pick.
 */
function Dropdown({
	id,
	value,
	options,
	anyLabel,
	onChange,
	className,
}: {
	id: string;
	/** Empty string means no filter. */
	value: string;
	options: string[];
	/** Placeholder, and what an empty field means, e.g. "All states". */
	anyLabel: string;
	/** Called with the chosen option, or null when the field is cleared. */
	onChange: (value: string | null) => void;
	className?: string;
}) {
	return (
		<Combobox
			items={options}
			value={value}
			onValueChange={(next: string | null) => onChange(next || null)}
		>
			<ComboboxInput id={id} placeholder={anyLabel} className={className} />
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
