"use client";

import { US_STATES } from "@just-us/auth/jurisdiction";
import {
	Combobox,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxInput,
	ComboboxItem,
	ComboboxList,
} from "@just-us/ui/components/combobox";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@just-us/ui/components/select";
import { cn } from "@just-us/ui/lib/utils";
import { Search, X } from "lucide-react";
import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { CASE_CATEGORIES } from "@/lib/case-categories";

const CATEGORIES = CASE_CATEGORIES;

const SORTS = [
	{ value: "trending", label: "Trending" },
	{ value: "funded", label: "Most funded" },
	{ value: "newest", label: "Newest" },
];

const COURTS = [
	{ value: "all", label: "All courts" },
	{ value: "state", label: "State" },
	{ value: "federal", label: "Federal" },
] as const;

export function BrowseControls() {
	const router = useRouter();
	const pathname = usePathname();
	const params = useSearchParams();

	const q = params.get("q") ?? "";
	const state = params.get("state") ?? "";
	const category = params.get("category") ?? "";
	const sort = params.get("sort") ?? "trending";
	const courtParam = params.get("court");
	const court =
		courtParam === "state" || courtParam === "federal" ? courtParam : "all";

	const [search, setSearch] = useState(q);
	const hasFilters = !!(q || state || category || court !== "all");

	// Keep the input in sync if the URL changes elsewhere (e.g. back button).
	useEffect(() => {
		setSearch(q);
	}, [q]);

	function apply(next: Record<string, string | null>) {
		const sp = new URLSearchParams(params.toString());
		for (const [key, value] of Object.entries(next)) {
			if (value) sp.set(key, value);
			else sp.delete(key);
		}
		// Any filter/search change resets pagination to the first page.
		sp.delete("page");
		const qs = sp.toString();
		router.push((qs ? `${pathname}?${qs}` : pathname) as Route);
	}

	/** Back to the unfiltered list. The search input holds its own state, so it
	 *  has to be cleared directly — otherwise the debounce effect sees text that
	 *  the URL no longer has and immediately re-applies it. */
	function clearFilters() {
		setSearch("");
		apply({ q: null, state: null, category: null, court: null });
	}

	// Debounce the free-text search so we don't push on every keystroke.
	// biome-ignore lint/correctness/useExhaustiveDependencies: intentionally runs on `search` only
	useEffect(() => {
		if (search === q) return;
		const t = setTimeout(() => apply({ q: search || null }), 350);
		return () => clearTimeout(t);
	}, [search, q]);

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-col gap-3 sm:flex-row">
				<form
					onSubmit={(e) => {
						e.preventDefault();
						apply({ q: search || null });
					}}
					className="relative flex-1"
				>
					<Search
						className="absolute top-1/2 left-4 size-4.5 -translate-y-1/2 text-muted-foreground"
						aria-hidden="true"
					/>
					<input
						type="search"
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						placeholder="Search cases by keyword, employer, or location…"
						className="h-12 w-full rounded-[var(--radius-pill)] border border-border bg-surface pr-4 pl-11 text-[14px] text-ink outline-none transition-colors placeholder:text-muted-foreground focus:border-brass-deep"
					/>
				</form>

				<div className="flex gap-3 [&>*]:flex-1 sm:[&>*]:flex-none">
					<StateCombobox value={state} onChange={(v) => apply({ state: v })} />
					<Dropdown
						label={SORTS.find((s) => s.value === sort)?.label ?? "Trending"}
						value={sort}
						onChange={(v) => apply({ sort: v === "trending" ? null : v })}
						options={SORTS}
					/>
				</div>
			</div>

			{/* Court — state vs. federal jurisdiction. A segmented control, not a
			    two-way toggle, so "All courts" stays the default view rather than
			    forcing donors into one bucket. */}
			<div className="flex flex-wrap items-center gap-2">
				<span className="mr-1 font-mono font-semibold text-[11px] text-muted-foreground uppercase tracking-[0.1em]">
					Court
				</span>
				{COURTS.map((option) => (
					<Pill
						key={option.value}
						active={court === option.value}
						onClick={() =>
							apply({ court: option.value === "all" ? null : option.value })
						}
					>
						{option.label}
					</Pill>
				))}
			</div>

			{/* Category pills */}
			<div className="flex flex-wrap items-center gap-2">
				<Pill active={!category} onClick={() => apply({ category: null })}>
					All
				</Pill>
				{CATEGORIES.map((cat) => (
					<Pill
						key={cat}
						active={category === cat}
						onClick={() => apply({ category: category === cat ? null : cat })}
					>
						{cat}
					</Pill>
				))}

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

function Pill({
	active,
	onClick,
	children,
}: {
	active: boolean;
	onClick: () => void;
	children: React.ReactNode;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			aria-pressed={active}
			className={cn(
				"rounded-[var(--radius-pill)] border px-4 py-2 font-semibold text-[13px] transition-colors",
				active
					? "border-ink bg-ink text-paper"
					: "border-border bg-surface text-ink-soft hover:border-brass-deep hover:text-ink",
			)}
		>
			{children}
		</button>
	);
}

/** Fifty states is too many to scroll, so this one is typed into. Clearing the
 *  field clears the filter. */
function StateCombobox({
	value,
	onChange,
}: {
	value: string;
	onChange: (value: string | null) => void;
}) {
	return (
		<Combobox
			items={US_STATES as unknown as string[]}
			value={value}
			onValueChange={(next: string | null) => onChange(next || null)}
		>
			<ComboboxInput
				placeholder="All states"
				aria-label="Filter by state"
				className="h-12 w-full rounded-[var(--radius-pill)] border-border px-4 font-semibold text-[13.5px] sm:w-[190px]"
			/>
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

/** Sort has three fixed options — a menu is faster than a search field. */
function Dropdown({
	label,
	value,
	onChange,
	options,
}: {
	label: string;
	value: string;
	onChange: (value: string) => void;
	options: { value: string; label: string }[];
}) {
	return (
		<Select
			value={value}
			onValueChange={(next: string | null) => onChange(next ?? "")}
		>
			<SelectTrigger
				aria-label={label}
				className="h-12 w-full gap-2 rounded-[var(--radius-pill)] border-border px-4 font-semibold text-[13.5px] text-ink sm:w-auto"
			>
				<SelectValue />
			</SelectTrigger>
			<SelectContent className="max-h-[300px]">
				{options.map((option) => (
					<SelectItem
						key={option.value}
						value={option.value}
						className="text-[14px]"
					>
						{option.label}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}
