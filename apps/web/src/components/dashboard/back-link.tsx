import { cn } from "@just-us/ui/lib/utils";
import { ArrowLeft } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

/** A subtle "← Back to …" link, meant to sit just above a page title. */
export function BackLink({
	href,
	label,
	className,
}: {
	href: Route;
	label: string;
	className?: string;
}) {
	return (
		<Link
			href={href}
			className={cn(
				"inline-flex items-center gap-1.5 font-semibold text-[13px] text-muted-foreground transition-colors hover:text-ink",
				className,
			)}
		>
			<ArrowLeft className="size-4" aria-hidden="true" />
			{label}
		</Link>
	);
}
