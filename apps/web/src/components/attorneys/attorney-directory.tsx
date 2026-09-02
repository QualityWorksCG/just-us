import type {
	DirectoryAttorney,
	DirectorySort,
} from "@just-us/db/attorney-directory";
import { Users } from "lucide-react";

import { AttorneyCard } from "@/components/attorneys/attorney-card";
import { DirectoryControls } from "@/components/attorneys/directory-controls";

/**
 * The directory body: filters, result count, cards, and the standing disclaimer.
 *
 * Shared by the public `/attorneys` page and the plaintiff's
 * `/find-attorney` screen. One component rather than two, because the
 * promises in the footer — listed by your chosen sort, never ranked for your case
 * — have to hold identically in both places, and a copy would drift.
 */
export function AttorneyDirectory({
	attorneys,
	profileBasePath,
	practiceAreas,
	states,
	filtered,
	showMessageAction = false,
	defaultState,
	conversationByAttorney,
	requestCaseId,
}: {
	attorneys: DirectoryAttorney[];
	/** Passed to each card — see `AttorneyCard.profileBasePath`. */
	profileBasePath?: string;
	practiceAreas: string[];
	states: string[];
	/** Whether any filter is active, which changes the empty-state wording. */
	filtered: boolean;
	showMessageAction?: boolean;
	/** Plaintiff jurisdiction used until they deliberately choose a state. */
	defaultState?: string;
	/** Attorney user id → the plaintiff's existing conversation with them, so a
	 *  card whose attorney they've already messaged sends them to that thread. */
	conversationByAttorney?: Record<string, string>;
	/** The plaintiff's case, when they arrived from one — enables each card's
	 *  "Request to represent". */
	requestCaseId?: string | null;
}) {
	return (
		<div className="flex flex-col gap-6">
			<section className="rounded-[var(--radius-card-lg)] border border-border bg-surface p-5 shadow-[var(--shadow-rest)] sm:p-6">
				<DirectoryControls
					practiceAreas={practiceAreas}
					states={states}
					defaultState={defaultState}
				/>

				<div className="mt-5 flex items-center justify-between border-border border-t pt-4">
					<span className="font-mono font-semibold text-[11px] text-muted-foreground uppercase tracking-[0.1em]">
						{filtered ? "Results" : "All results"}
					</span>
					<span className="text-[13px] text-muted-foreground tabular-nums">
						{attorneys.length}{" "}
						{attorneys.length === 1 ? "attorney" : "attorneys"}
					</span>
				</div>

				{attorneys.length === 0 ? (
					<div className="mt-5 flex flex-col items-center gap-3 rounded-[var(--radius-card)] border border-border border-dashed bg-paper-alt px-6 py-14 text-center">
						<span className="flex size-11 items-center justify-center rounded-xl bg-brass-wash text-brass-deep">
							<Users className="size-5" aria-hidden="true" />
						</span>
						<p className="font-bold text-[15px] text-ink">
							{filtered
								? "No attorneys match those filters"
								: "No attorneys listed yet"}
						</p>
						<p className="max-w-[46ch] text-[13.5px] text-muted-foreground leading-relaxed">
							{filtered
								? "Try a broader practice area or state. The directory is still growing."
								: "Attorneys appear here once their bar standing is verified."}
						</p>
					</div>
				) : (
					<div className="mt-5 flex flex-col gap-4">
						{attorneys.map((attorney) => (
							<AttorneyCard
								key={attorney.id}
								attorney={attorney}
								profileBasePath={profileBasePath}
								showMessageAction={showMessageAction}
								existingConversationId={
									conversationByAttorney?.[attorney.userId]
								}
								requestCaseId={requestCaseId}
							/>
						))}
					</div>
				)}
			</section>

			<p className="rounded-[var(--radius-card)] border border-border bg-paper-alt px-5 py-3.5 text-[12.5px] text-muted-foreground leading-relaxed">
				JustUs is a directory, not a referral service. Attorneys are listed by
				the sort you choose (never ranked for your case), and you decide who to
				contact. Ratings and reviews come from former clients.
			</p>
		</div>
	);
}

const SORTS = new Set<DirectorySort>(["name", "rating", "availability"]);

/** Only the sorts the directory offers; anything else falls back to A–Z. */
export function toDirectorySort(value: string | undefined): DirectorySort {
	return value && SORTS.has(value as DirectorySort)
		? (value as DirectorySort)
		: "name";
}

/** Reads the filter values a directory route accepts out of its search params. */
export function readDirectoryParams(
	params: Record<string, string | string[] | undefined>,
) {
	const one = (key: string) => {
		const value = params[key];
		return Array.isArray(value) ? value[0] : value;
	};
	const area = one("area");
	const state = one("state");
	const keyword = one("q");
	const allStates = state === "all";
	return {
		area: area === "all" ? undefined : area,
		state: allStates ? undefined : state,
		allStates,
		keyword,
		sort: one("sort"),
		filtered: !!(
			(area && area !== "all") ||
			(state && state !== "all") ||
			keyword
		),
	};
}
