"use client";

import { ROLES, type Role } from "@just-us/auth/rbac";
import { cn } from "@just-us/ui/lib/utils";
import { ChevronDown, LoaderCircle, Search } from "lucide-react";
import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { useFilterTransition } from "@/components/dashboard/filter-transition";

const VERIFICATION = [
	{ value: "", label: "All verification" },
	{ value: "yes", label: "Verified" },
	{ value: "no", label: "Unverified" },
];

const STATUS = [
	{ value: "", label: "All statuses" },
	{ value: "yes", label: "Blocked" },
	{ value: "no", label: "Not blocked" },
];

/**
 * Plural labels for the facet row. Roles are stored singular, and "Admins" is
 * deliberately short — "Administrators" is wide enough to wrap the row on a
 * laptop, and the pill is a filter, not a title.
 */
const ROLE_LABELS: Record<Role, string> = {
	plaintiff: "Plaintiffs",
	donor: "Donors",
	attorney: "Attorneys",
	administrator: "Admins",
};

export type UserRoleCounts = {
	total: number;
	roles: Record<string, number>;
};

export function UserFilters({ counts }: { counts: UserRoleCounts }) {
	const router = useRouter();
	const pathname = usePathname();
	const params = useSearchParams();

	const q = params.get("q") ?? "";
	const role = params.get("role") ?? "";
	const verified = params.get("verified") ?? "";
	const blocked = params.get("blocked") ?? "";

	const [search, setSearch] = useState(q);
	// True from the moment a filter is applied until the server sends the new
	// list. Shared with the results below, so one flag covers the search box, the
	// pills, the dropdowns and the list all at once.
	const { pending, start } = useFilterTransition();
	// Which pill was pressed, so it can look active before the URL says so. The
	// active pill is read from the URL, which only changes a round trip later —
	// without this the row ignores the press for as long as the load takes.
	const [pressed, setPressed] = useState<string | null>(null);
	const activeRole = pending && pressed !== null ? pressed : role;

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
		// Any filter change reshapes the result set, so the old offset is
		// meaningless — and page 4 of a narrower list is often empty.
		sp.delete("page");
		const qs = sp.toString();
		start(() => {
			router.push((qs ? `${pathname}?${qs}` : pathname) as Route);
		});
	}

	// Debounce the free-text search so we don't push on every keystroke.
	// biome-ignore lint/correctness/useExhaustiveDependencies: intentionally runs on `search` only
	useEffect(() => {
		if (search === q) return;
		const t = setTimeout(() => apply({ q: search || null }), 350);
		return () => clearTimeout(t);
	}, [search, q]);

	// The debounce means a keystroke isn't "loading" yet but isn't settled either.
	// Showing the spinner for that gap too keeps the box from looking idle while a
	// request is obviously coming.
	const busy = pending || search !== q;

	return (
		<div className="flex flex-col gap-4">
			{/* Role facets. Also the role filter's only control — a pill row and a
			    Role dropdown would be two ways to set one param. */}
			<fieldset className="-mx-1 flex flex-nowrap items-center gap-2 overflow-x-auto px-1 pb-1">
				<legend className="sr-only">Filter by role</legend>
				<RolePill
					label="All"
					count={counts.total}
					active={!activeRole}
					onClick={() => {
						setPressed("");
						apply({ role: null });
					}}
				/>
				{ROLES.map((r) => (
					<RolePill
						key={r}
						label={ROLE_LABELS[r]}
						count={counts.roles[r] ?? 0}
						active={activeRole === r}
						onClick={() => {
							setPressed(r);
							apply({ role: r });
						}}
					/>
				))}
			</fieldset>

			<div className="flex flex-col gap-3 sm:flex-row">
				<form
					onSubmit={(e) => {
						e.preventDefault();
						apply({ q: search || null });
					}}
					className="relative flex-1"
				>
					{busy ? (
						<LoaderCircle
							className="absolute top-1/2 left-4 size-4 -translate-y-1/2 animate-spin text-brass-deep"
							aria-hidden="true"
						/>
					) : (
						<Search
							className="absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground"
							aria-hidden="true"
						/>
					)}
					<input
						type="search"
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						placeholder="Search by name or email"
						aria-label="Search by name or email"
						className="h-11 w-full rounded-[var(--radius-pill)] border border-border bg-surface pr-4 pl-11 text-[14px] text-ink outline-none transition-colors placeholder:text-muted-foreground focus:border-brass-deep"
					/>
					{/* Announces the wait without moving anything on screen. */}
					<span aria-live="polite" className="sr-only">
						{busy ? "Loading accounts" : ""}
					</span>
				</form>

				<div className="flex flex-wrap gap-3">
					<Dropdown
						label="Verification"
						value={verified}
						onChange={(v) => apply({ verified: v || null })}
						options={VERIFICATION}
					/>
					<Dropdown
						label="Status"
						value={blocked}
						onChange={(v) => apply({ blocked: v || null })}
						options={STATUS}
					/>
				</div>
			</div>
		</div>
	);
}

function RolePill({
	label,
	count,
	active,
	onClick,
}: {
	label: string;
	count: number;
	active: boolean;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			aria-pressed={active}
			className={cn(
				"inline-flex h-10 shrink-0 items-center gap-2 rounded-[var(--radius-pill)] px-4 font-bold text-[13.5px] transition-colors",
				active
					? "bg-ink text-paper"
					: "bg-surface-2 text-ink hover:bg-brass-wash",
			)}
		>
			{label}
			<span
				className={cn(
					"font-semibold tabular-nums",
					active ? "text-paper/55" : "text-muted-foreground",
				)}
			>
				{count}
			</span>
		</button>
	);
}

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
		<div className="relative">
			<select
				value={value}
				onChange={(e) => onChange(e.target.value)}
				aria-label={label}
				className="h-11 cursor-pointer appearance-none rounded-[var(--radius-pill)] border border-border bg-surface pr-9 pl-4 font-semibold text-[13.5px] text-ink outline-none transition-colors focus:border-brass-deep"
			>
				{options.map((o) => (
					<option key={o.value} value={o.value}>
						{o.label}
					</option>
				))}
			</select>
			<ChevronDown
				className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
				aria-hidden="true"
			/>
		</div>
	);
}
