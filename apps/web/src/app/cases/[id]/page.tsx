import type { Role } from "@just-us/auth";
import { getPublicCase } from "@just-us/db/cases";
import { isCaseFollowing } from "@just-us/db/follows";
import { isCaseSaved } from "@just-us/db/saves";
import type { Metadata, Route } from "next";
import { notFound } from "next/navigation";

import { PublicCaseView } from "@/components/cases/public-case-view";
import { getSession } from "@/lib/auth-server";

/**
 * The public case page — what a share link opens.
 *
 * The case itself is `PublicCaseView`, shared with the in-app `/discover/[id]`
 * screen. This route owns what is specific to being a public page: the metadata
 * for search and link previews, and the standalone page chrome (a centred column,
 * since there's no sidebar to sit beside).
 */
export async function generateMetadata({
	params,
}: {
	params: Promise<{ id: string }>;
}): Promise<Metadata> {
	const { id } = await params;
	const c = await getPublicCase(id);
	if (!c) return { title: "Case not found" };
	return {
		title: `${c.title} · JustUs Financial`,
		description: c.summary || c.story.slice(0, 155),
	};
}

export default async function PublicCasePage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;
	const c = await getPublicCase(id);
	if (!c) notFound();

	// Saving is a donor action; a signed-in donor can save straight from here.
	const session = await getSession();
	const role = (session?.user as { role?: Role } | undefined)?.role;
	const canSave = role === "donor" && !!session?.user;
	// Anyone signed in who isn't the case's own team can follow for updates.
	const canFollow = !!session?.user && session.user.id !== c.ownerId;
	const [initialSaved, initialFollowing] = await Promise.all([
		canSave ? isCaseSaved(session.user.id, c.id) : Promise.resolve(false),
		session?.user
			? isCaseFollowing(session.user.id, c.id)
			: Promise.resolve(false),
	]);

	return (
		<main className="h-full overflow-y-auto bg-paper">
			<div className="mx-auto max-w-[1100px] px-6 pt-5 pb-12 sm:pt-6">
				<PublicCaseView
					c={c}
					backHref={"/cases" as Route}
					backLabel="Back to cases"
					canSave={canSave}
					initialSaved={initialSaved}
					canFollow={canFollow}
					initialFollowing={initialFollowing}
					updatesHref={`/cases/${c.id}/updates` as Route}
				/>
			</div>
		</main>
	);
}
