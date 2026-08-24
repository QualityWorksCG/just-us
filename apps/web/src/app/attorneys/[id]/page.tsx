import { getDirectoryAttorney } from "@just-us/db/attorney-directory";
import type { Metadata, Route } from "next";
import { notFound } from "next/navigation";

import { AttorneyProfileView } from "@/components/attorneys/attorney-profile-view";

/**
 * The public attorney profile.
 *
 * The profile itself is `AttorneyProfileView`, shared with the in-app
 * `/find-attorney/[id]` screen. This route owns what is specific to being a
 * public page: the metadata for search and link previews, and the standalone page
 * chrome (a centred column, since there's no sidebar to sit beside).
 */
export async function generateMetadata({
	params,
}: {
	params: Promise<{ id: string }>;
}): Promise<Metadata> {
	const { id } = await params;
	const attorney = await getDirectoryAttorney(id);
	if (!attorney) return { title: "Attorney not found" };
	return {
		title: `${attorney.legalName}, attorney profile`,
		description:
			attorney.bio ??
			`${attorney.legalName} is a bar-verified attorney listed on JustUs.`,
	};
}

export default async function AttorneyProfilePage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;
	const attorney = await getDirectoryAttorney(id);

	// Unlisted and unknown are the same answer on purpose: a profile that isn't
	// bar-verified shouldn't be reachable by guessing its id.
	if (!attorney) notFound();

	return (
		<main className="min-h-full overflow-y-auto px-6 py-10 sm:px-10">
			<div className="mx-auto max-w-[1080px]">
				<AttorneyProfileView
					attorney={attorney}
					backHref={"/attorneys" as Route}
					backLabel="Back to directory"
				/>
			</div>
		</main>
	);
}
