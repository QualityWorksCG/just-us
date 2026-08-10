import { listCaseUpdates } from "@just-us/db/case-updates";
import { getPublicCase } from "@just-us/db/cases";
import { getCaseDonationSummary } from "@just-us/db/donations";
import {
	getFollowUpdatesSeenAt,
	isCaseFollowing,
	markCaseUpdatesSeenByFollower,
} from "@just-us/db/follows";
import type { Route } from "next";
import { notFound } from "next/navigation";

import { CaseUpdatesBoard } from "@/components/cases/case-updates-board";
import { requireRole } from "@/lib/auth-server";

/**
 * The full updates timeline for one case, as a signed-in donor reads it — inside
 * the dashboard shell (the capped list on `/discover/[id]` links here). Viewing
 * it marks the case seen for a follower, clearing their bell and card tag.
 */
export default async function DiscoverCaseUpdatesPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { session } = await requireRole("donor");
	const { id } = await params;

	const c = await getPublicCase(id);
	if (!c) notFound();

	const [updates, highlightSince, following, donation] = await Promise.all([
		listCaseUpdates(id),
		getFollowUpdatesSeenAt(session.user.id, id),
		isCaseFollowing(session.user.id, id),
		getCaseDonationSummary(session.user.id, id),
	]);
	await markCaseUpdatesSeenByFollower(session.user.id, id);

	return (
		<div className="w-full">
			<CaseUpdatesBoard
				caseId={id}
				caseTitle={c.title}
				plaintiffName={c.owner?.name ?? "the plaintiff"}
				status={c.status}
				raisedCents={c.raisedCents}
				goalCents={c.goalCents}
				donorsCount={c.donorsCount}
				updates={updates}
				viewerId={session.user.id}
				viewerFirstName={session.user.name.split(/\s+/)[0] ?? null}
				backHref={`/discover/${id}` as Route}
				backLabel="Back to case"
				headingLevel="h2"
				highlightSince={highlightSince}
				following={following}
				canFollow={session.user.id !== c.ownerId}
				donation={donation}
			/>
		</div>
	);
}
