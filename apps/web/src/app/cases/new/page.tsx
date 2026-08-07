import { getOwnedCase } from "@just-us/db/cases";
import { getCaseMatch } from "@just-us/db/requests";

import { CaseWizard, type WizardInitial } from "@/components/cases/case-wizard";
import { requireOnboarded, requireRole } from "@/lib/auth-server";

// Full-page case-creation wizard. A plaintiff can run several cases, so this
// only resumes a draft when `?draft=<id>` is given; otherwise it starts fresh.
export default async function NewCasePage({
	searchParams,
}: {
	searchParams: Promise<{ draft?: string }>;
}) {
	await requireRole("plaintiff");
	const session = await requireOnboarded();

	const draftId = (await searchParams)?.draft;
	const source = draftId ? await getOwnedCase(draftId, session.user.id) : null;

	// An attorney matched through the request/accept flow is settled — the wizard
	// shows them as confirmed rather than asking to invite one again.
	const attorneyConfirmed = source
		? !!(await getCaseMatch(source.id, session.user.id))
		: false;

	const initial: WizardInitial | null = source
		? {
				id: source.id,
				title: source.title,
				category: source.category,
				location: source.location,
				story: source.story,
				goalCents: source.goalCents,
				payoutType: source.payoutType,
				attorney: source.attorneyName
					? {
							name: source.attorneyName,
							firm: source.attorneyFirm ?? "",
							area: source.attorneyArea ?? "",
							location: source.attorneyLocation ?? "",
							email: source.attorneyEmail ?? "",
							phone: source.attorneyPhone ?? "",
						}
					: null,
				evidence: Array.isArray(source.evidence)
					? (source.evidence as {
							name: string;
							size?: number;
							url?: string;
						}[])
					: [],
				coverImageUrl: source.coverImageUrl,
				images: source.images ?? [],
				attorneyConfirmed,
			}
		: null;

	return <CaseWizard name={session.user.name} initial={initial} />;
}
