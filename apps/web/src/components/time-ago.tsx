"use client";

import { useEffect, useState } from "react";

/**
 * Relative time ("just now", "3m ago", "2d ago"), computed on the client so it
 * can't be baked into a cached server render and go stale. Falls back to the
 * absolute date past a week, where "9d ago" stops being the more legible form.
 *
 * The absolute date is the SSR/first-paint value; the relative form swaps in
 * right after mount. `suppressHydrationWarning` is required because the absolute
 * date is formatted with the *runtime's* locale and timezone — Node on the server
 * vs. the browser can legitimately produce different strings, which would
 * otherwise trip a hydration mismatch on a value that's client-owned anyway.
 */
export function TimeAgo({ date }: { date: Date | string }) {
	const iso = typeof date === "string" ? date : date.toISOString();
	const absolute = new Date(iso).toLocaleDateString(undefined, {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
	const [label, setLabel] = useState(absolute);

	useEffect(() => {
		setLabel(relative(new Date(iso), absolute));
	}, [iso, absolute]);

	return (
		<time dateTime={iso} title={absolute} suppressHydrationWarning>
			{label}
		</time>
	);
}

function relative(date: Date, absolute: string) {
	const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
	if (seconds < 60) return "just now";
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.floor(hours / 24);
	if (days < 7) return `${days}d ago`;
	return absolute;
}
