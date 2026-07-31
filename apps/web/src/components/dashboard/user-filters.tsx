"use client";

import { ROLES } from "@just-us/auth/rbac";
import { ChevronDown, Search } from "lucide-react";
import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

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

export function UserFilters() {
	const router = useRouter();
	const pathname = usePathname();
	const params = useSearchParams();

	const q = params.get("q") ?? "";
	const role = params.get("role") ?? "";
	const verified = params.get("verified") ?? "";
	const blocked = params.get("blocked") ?? "";

	const [search, setSearch] = useState(q);

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
		router.push((qs ? `${pathname}?${qs}` : pathname) as Route);
	}

	// Debounce the free-text search so we don't push on every keystroke.
	// biome-ignore lint/correctness/useExhaustiveDependencies: intentionally runs on `search` only
	useEffect(() => {
		if (search === q) return;
		const t = setTimeout(() => apply({ q: search || null }), 350);
		return () => clearTimeout(t);
	}, [search, q]);

	return (
		<div className="flex flex-col gap-3 sm:flex-row">
			<form
				onSubmit={(e) => {
					e.preventDefault();
					apply({ q: search || null });
				}}
				className="relative flex-1"
			>
				<Search
					className="absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground"
					aria-hidden="true"
				/>
				<input
					type="search"
					value={search}
					onChange={(e) => setSearch(e.target.value)}
					placeholder="Search by name or email"
					aria-label="Search by name or email"
					className="h-11 w-full rounded-[var(--radius-pill)] border border-border bg-surface pr-4 pl-11 text-[14px] text-ink outline-none transition-colors placeholder:text-muted-foreground focus:border-brass-deep"
				/>
			</form>

			<div className="flex flex-wrap gap-3">
				<Dropdown
					label="Role"
					value={role}
					onChange={(v) => apply({ role: v || null })}
					options={[
						{ value: "", label: "All roles" },
						...ROLES.map((r) => ({
							value: r,
							label: r.charAt(0).toUpperCase() + r.slice(1),
						})),
					]}
				/>
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
