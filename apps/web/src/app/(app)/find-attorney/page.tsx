import {
	attorneyIdForEmail,
	listDirectoryAttorneys,
	listedPracticeAreas,
	listedStates,
} from "@just-us/db/attorney-directory";
import { getPendingInvitationForCase } from "@just-us/db/case-invitations";
import { getOwnedCase } from "@just-us/db/cases";
import { listMessageConversations } from "@just-us/db/messages";
import { ArrowLeft } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

import {
	AttorneyDirectory,
	readDirectoryParams,
	toDirectorySort,
} from "@/components/attorneys/attorney-directory";
import { requireRole } from "@/lib/auth-server";
import { findScreen } from "@/lib/dashboard-nav";

/**
 * The plaintiff's "Find an attorney" screen — the same directory as the public
 * `/attorneys` page, inside the dashboard shell.
 *
 * This static segment takes precedence over `dashboard/[...slug]`, which was
 * serving a placeholder here. That catch-all does the RBAC check for the screens
 * it renders, so taking the route over means doing it here instead: only
 * plaintiffs have this item in their nav.
 */
export default async function DashboardAttorneysPage({
	searchParams,
}: {
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
	const { session } = await requireRole("plaintiff");

	const screen = findScreen("plaintiff", "attorneys");
	const params = await searchParams;
	const filters = readDirectoryParams(params);
	// Where to look first, until the plaintiff chooses otherwise.
	//
	// Their own `User.jurisdiction` used to fill this, which was wrong twice over:
	// the column is documented as not-a-plaintiff-field and may hold a stale value
	// from before jurisdiction became per case, and a plaintiff's own state is not
	// necessarily their case's. The case they arrived from is the honest default —
	// an attorney can only take a case in the state it falls under, so a directory
	// scoped to anything else lists attorneys they cannot engage. Resolved below,
	// once the draft has been read.

	// Arrived from the case wizard's "Search and reach out yourself". Their draft
	// was saved on the way out, so the only thing missing is the road back — and
	// without it this screen is a one-way door out of a half-written case.
	//
	// Ownership is re-checked rather than trusted from the query string: the id is
	// about to become a link, and `getOwnedCase` is scoped to this plaintiff, so a
	// stranger's id simply yields no banner.
	const draftId = Array.isArray(params.draft) ? params.draft[0] : params.draft;
	const draft = draftId ? await getOwnedCase(draftId, session.user.id) : null;
	const defaultState = draft?.location || undefined;

	// Which directory attorney the case's pending request went to, if any — so
	// that card shows as already requested with a way to withdraw. Only a seeking
	// case can hold a pending invitation; a draft has none.
	const pendingInvite =
		draft && draft.status === "seeking"
			? await getPendingInvitationForCase(draft.id)
			: null;
	const requestedAttorneyId = pendingInvite
		? await attorneyIdForEmail(pendingInvite.email)
		: null;

	// Where "back to your case" returns to, and what the banner says — it depends on
	// where the case actually is. The plaintiff reached this screen mid-flow from the
	// wizard, so while the case is still being built — draft, out to attorneys, or
	// committed-but-not-yet-published (any status short of live/closed) — "back"
	// returns to the wizard, which resumes at whatever step is unfinished (add the
	// attorney, agree the fee, publish). Only a case that is genuinely done — live or
	// closed — goes to the case itself; the wizard has nothing left to resume there.
	//
	// This is the fix for landing on a published-looking "awaiting firm" page: a
	// case that has an attorney but no agreed fee is NOT finished, so it must not be
	// sent to the case view that reads as if it were.
	const caseTitle = draft?.title?.trim() || "Your case";
	const inProgress =
		draft && draft.status !== "live" && draft.status !== "closed";
	const back = !draft
		? null
		: inProgress
			? {
					href: `/cases/new?draft=${draft.id}` as Route,
					title:
						draft.status === "draft"
							? `${caseTitle} is saved`
							: `${caseTitle} is in progress`,
					sub: "Find someone who fits, then head back to your case to finish it.",
				}
			: {
					href: `/my-cases/${draft.id}` as Route,
					title: `${caseTitle} is live`,
					sub: "You can still reach out to anyone here yourself — your case is already public.",
				};

	const [attorneys, practiceAreas, states, conversations] = await Promise.all([
		listDirectoryAttorneys({
			practiceArea: filters.area,
			state: filters.allStates ? undefined : (filters.state ?? defaultState),
			keyword: filters.keyword,
			sort: toDirectorySort(filters.sort),
			// An explicit Court filter wins; otherwise the case's own jurisdiction —
			// a federal case lists only federal-verified attorneys (state ignored),
			// a state case keeps the state-admission match.
			jurisdiction: filters.jurisdiction ?? draft?.jurisdiction,
		}),
		listedPracticeAreas(),
		listedStates(),
		// So a card whose attorney the plaintiff has already contacted sends them to
		// that thread rather than a compose box that has nowhere new to go.
		listMessageConversations(session.user.id),
	]);
	const conversationByAttorney: Record<string, string> = {};
	for (const c of conversations) {
		conversationByAttorney[c.otherUser.id] = c.conversationId;
	}

	return (
		<div>
			<p className="max-w-[640px] text-[14.5px] text-ink-soft leading-relaxed">
				{screen?.sub ??
					"Browse state bar-verified attorneys and connect with the one who fits."}
			</p>

			{back && (
				<div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-card)] border border-brass-deep/30 bg-brass-wash/60 px-5 py-4">
					<div className="min-w-0">
						<p className="font-bold text-[14px] text-ink">{back.title}</p>
						<p className="mt-0.5 text-[13px] text-ink-soft leading-relaxed">
							{back.sub}
						</p>
					</div>
					<Link
						href={back.href}
						className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[var(--radius-control)] bg-brass px-4 font-semibold text-[13px] text-white transition-colors hover:bg-brass-deep"
					>
						<ArrowLeft className="size-3.5" aria-hidden="true" />
						Back to your case
					</Link>
				</div>
			)}
			<div className="mt-8">
				<AttorneyDirectory
					attorneys={attorneys}
					practiceAreas={practiceAreas}
					states={states}
					filtered={filters.filtered}
					defaultState={defaultState}
					// Keep profile links inside the shell (see AttorneyCard).
					profileBasePath="/find-attorney"
					showMessageAction
					conversationByAttorney={conversationByAttorney}
					// Enable "Request to represent" only when they arrived with a case
					// that can still take one — a matched/live/closed case cannot.
					requestCaseId={
						draft && (draft.status === "draft" || draft.status === "seeking")
							? draft.id
							: undefined
					}
					// The one attorney (if any) this case already has an outstanding
					// request to — that card shows "Request sent" with a withdraw option.
					requestedAttorneyId={requestedAttorneyId}
				/>
			</div>
		</div>
	);
}
