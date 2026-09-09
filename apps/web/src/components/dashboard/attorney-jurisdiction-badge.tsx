import { cn } from "@just-us/ui/lib/utils";
import { Landmark } from "lucide-react";

/**
 * The one-glance answer to "state or federal?" for an attorney, used across the
 * admin surfaces (the users table and the attorney detail header).
 *
 * It reads the attorney's own declaration that they practise in federal court —
 * the notable, non-default case. Every attorney holds at least one state
 * admission, so "State" is the quiet default and "Federal" the one worth
 * flagging; the colours follow the same scheme the case queue uses (federal on
 * ink, state on brass) so the badge reads the same wherever it appears.
 */
export function AttorneyJurisdictionBadge({
	practicesFederal,
	long,
	className,
}: {
	practicesFederal: boolean;
	/** "Federal court" / "State court" rather than the compact "Federal" / "State". */
	long?: boolean;
	className?: string;
}) {
	return (
		<span
			className={cn(
				"inline-flex items-center gap-1 rounded-[var(--radius-pill)] px-2 py-0.5 font-semibold text-[11px]",
				practicesFederal
					? "bg-ink text-paper"
					: "bg-brass-wash text-brass-deep",
				className,
			)}
		>
			<Landmark className="size-3" aria-hidden="true" />
			{practicesFederal
				? long
					? "Federal court"
					: "Federal"
				: long
					? "State court"
					: "State"}
		</span>
	);
}
