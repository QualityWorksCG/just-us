import { ChevronLeft } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

/**
 * Consistent return control for a detail view that has a list or directory
 * immediately above it in the information hierarchy.
 */
export function DetailBackLink({
	href,
	label,
}: {
	href: Route;
	label: string;
}) {
	return (
		<Link
			href={href}
			className="inline-flex h-11 items-center gap-2 px-4 font-semibold text-base text-ink-soft transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass-deep focus-visible:ring-offset-2"
		>
			<ChevronLeft className="size-5" aria-hidden="true" />
			{label}
		</Link>
	);
}
