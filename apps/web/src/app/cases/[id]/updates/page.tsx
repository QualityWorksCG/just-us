import { listCaseUpdates } from "@just-us/db/case-updates";
import { getPublicCase } from "@just-us/db/cases";
import { getCaseDonationSummary } from "@just-us/db/donations";
import { isCaseFollowing } from "@just-us/db/follows";
import type { Metadata, Route } from "next";
import { notFound } from "next/navigation";

import { CaseUpdatesBoard } from "@/components/cases/case-updates-board";
import { getSession } from "@/lib/auth-server";

export async function generateMetadata({
	params,
}: {
	params: Promise<{ id: string }>;
}): Promise<Metadata> {
	const { id } = await params;
	const c = await getPublicCase(id);
	if (!c) return { title: "Case not found" };
	return { title: `Updates · ${c.title} · JustUs Financial` };
}

/**
 * The full updates timeline for one case on the public site — where the capped
 * list on `/cases/[id]` links to. No sidebar, so it supplies its own centred
 * column. A signed-in visitor sees their own support/follow state; a signed-out
 * one sees the public prompts.
 */
export default async function PublicCaseUpdatesPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;
	const c = await getPublicCase(id);
	if (!c) notFound();

	const session = await getSession();
	const viewerId = session?.user?.id ?? "";
	const [updates, following, donation] = await Promise.all([
		listCaseUpdates(id),
		viewerId ? isCaseFollowing(viewerId, id) : Promise.resolve(false),
		viewerId ? getCaseDonationSummary(viewerId, id) : Promise.resolve(null),
	]);

	return (
		<main className="h-full overflow-y-auto bg-paper">
			<div className="mx-auto max-w-[1100px] px-6 pt-5 pb-12 sm:pt-6">
				<CaseUpdatesBoard
					caseId={id}
					caseTitle={c.title}
					plaintiffName={c.owner?.name ?? "the plaintiff"}
					status={c.status}
					raisedCents={c.raisedCents}
					goalCents={c.goalCents}
					donorsCount={c.donorsCount}
					updates={updates}
					viewerId={viewerId}
					viewerFirstName={session?.user?.name?.split(/\s+/)[0] ?? null}
					backHref={`/cases/${id}` as Route}
					backLabel="Back to case"
					caseHref={`/cases/${id}`}
					following={following}
					canFollow={!!viewerId && viewerId !== c.ownerId}
					donation={donation}
				/>
			</div>
		</main>
	);
}
