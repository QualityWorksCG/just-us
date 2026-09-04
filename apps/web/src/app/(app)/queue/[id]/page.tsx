import { getAdmission } from "@just-us/db/admissions";
import { getAttorneyProfile } from "@just-us/db/attorney-profile";
import { getQueueCase } from "@just-us/db/representation";
import type { Route } from "next";
import { notFound } from "next/navigation";

import { BackLink } from "@/components/dashboard/back-link";
import { QueueCaseDetailView } from "@/components/dashboard/queue-case-detail";
import { requireRole } from "@/lib/auth-server";

/**
 * The attorney's view of one case in the Seeking Representation queue (JUS-25).
 *
 * A static segment, so it takes precedence over `dashboard/[...slug]` — which
 * means the RBAC check that catch-all would have done has to happen here instead
 * (the same arrangement as `dashboard/attorneys`). Only attorneys reach this.
 *
 * `getQueueCase` applies the queue's own predicate rather than looking the id up
 * directly, so a case that has been matched, gone live, or been withdrawn 404s
 * here even for an attorney holding the link.
 */
export default async function QueueCasePage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { session } = await requireRole("attorney");
	const { id } = await params;

	const item = await getQueueCase(id, session.user.id);
	if (!item) notFound();

	// The gate turns on the case's jurisdiction. For a state case it is the
	// attorney's admission in *this case's* state (not claimed / claimed but
	// unverified / verified), so the page can say exactly what's outstanding. For a
	// federal case it is their federal-court standing instead.
	const federal = item.jurisdiction === "federal";
	const [admission, profile] = await Promise.all([
		federal ? Promise.resolve(null) : getAdmission(session.user.id, item.state),
		federal ? getAttorneyProfile(session.user.id) : Promise.resolve(null),
	]);

	return (
		// Full-bleed, like the other app screens: the shell's content column already
		// supplies the gutters, and a centred max-width here stranded the case in a
		// narrow strip with the rest of the screen empty. Line length is held where
		// it matters instead — on the prose itself.
		<div className="flex w-full flex-col gap-5">
			<BackLink
				href={"/queue?tab=open" as Route}
				label="Back to the queue"
				className="mb-1"
			/>
			<QueueCaseDetailView
				item={item}
				admissionStatus={admission?.verificationStatus ?? null}
				federalStatus={profile?.federalVerificationStatus ?? null}
			/>
		</div>
	);
}
