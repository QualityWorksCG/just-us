import { getPendingInvitationForCase } from "@just-us/db/case-invitations";
import { getOwnedCase } from "@just-us/db/cases";
import { getCasePayoutOptions } from "@just-us/db/payouts";
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
	//
	// The payout readiness comes down with it so the payout step is right on first
	// paint. A plaintiff resuming a case that has been sitting with their attorney
	// is most often here to find out whether that attorney is done, and making
	// them press "Check again" to learn it would be a poor answer to the question
	// they arrived with.
	const [attorneyConfirmed, payout, pendingInvite] = source
		? await Promise.all([
				getCaseMatch(source.id, session.user.id).then(Boolean),
				getCasePayoutOptions(source.id, session.user.id),
				// A case seeking a *named* attorney has a pending invitation; one out to
				// the open queue does not. The invitation is what tells the wizard to
				// open on its "waiting on the attorney" screen rather than the editor.
				source.status === "seeking"
					? getPendingInvitationForCase(source.id)
					: null,
			])
		: [false, null, null];

	const initial: WizardInitial | null = source
		? {
				id: source.id,
				title: source.title,
				category: source.category,
				location: source.location,
				jurisdiction: source.jurisdiction,
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
				thankYouNote: source.thankYouNote,
				attorneyConfirmed,
				status: source.status,
				payout,
				// The address the invitation went to, when one is pending. Its presence
				// is what opens the wizard on the invitation-sent waiting screen.
				invitedEmail: pendingInvite?.email ?? null,
			}
		: null;

	return <CaseWizard name={session.user.name} initial={initial} />;
}
