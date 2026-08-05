import type { Role } from "@just-us/auth";
import { getPublicCase } from "@just-us/db/cases";
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
	const initialSaved = canSave
		? await isCaseSaved(session.user.id, c.id)
		: false;

	return (
		<main className="h-full overflow-y-auto bg-paper">
			<div className="mx-auto max-w-[1100px] px-6 py-10 sm:py-14">
				<PublicCaseView
					c={c}
					backHref={"/cases" as Route}
					backLabel="Back to cases"
					canSave={canSave}
					initialSaved={initialSaved}
				/>
			</div>
		</main>
	);
}
