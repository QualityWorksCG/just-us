import { getPublicCase } from "@just-us/db/cases";
import type { Metadata, Route } from "next";
import { notFound } from "next/navigation";

import { PublicCaseView } from "@/components/cases/public-case-view";

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

	return (
		<main className="h-full overflow-y-auto bg-paper">
			<div className="mx-auto max-w-[1100px] px-6 py-10 sm:py-14">
				<PublicCaseView
					c={c}
					backHref={"/cases" as Route}
					backLabel="Back to cases"
				/>
			</div>
		</main>
	);
}
