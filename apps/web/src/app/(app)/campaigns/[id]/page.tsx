import { listCaseAuditEntries } from "@just-us/db/audit";
import { getCaseForAdmin } from "@just-us/db/cases";
import { countCaseDonations, listCaseBackers } from "@just-us/db/donations";
import type { Route } from "next";
import { notFound } from "next/navigation";

import { PublicCaseView } from "@/components/cases/public-case-view";
import { AdminCaseActions } from "@/components/dashboard/admin-case-actions";
import { AdminDecisionHistory } from "@/components/dashboard/admin-decision-history";
import { AdminMessagePlaintiff } from "@/components/dashboard/admin-message-plaintiff";
import { requireAdministrator } from "@/lib/auth-server";

/**
 * The administrator's in-dashboard view of a single case, opened from the
 * campaigns oversight table.
 *
 * It renders the very same `PublicCaseView` a donor reads — so an admin sees the
 * case exactly as the public does, without leaving the platform — but with the
 * donor donate/save/follow panel swapped for `AdminCaseActions` (take down /
 * restore). `getCaseForAdmin` applies no status or moderation filter, so this
 * reaches drafts, seeking, closed, and already-removed cases the public routes
 * would 404.
 */
export default async function AdminCampaignDetailPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	await requireAdministrator();
	const { id } = await params;

	const c = await getCaseForAdmin(id);
	if (!c) notFound();

	// Real supporter data for the sidebar, same as the public page — admins may see
	// who backed a case (only the names donors already chose to make public), never
	// any payment credentials.
	const [backers, donationCount, history] = await Promise.all([
		listCaseBackers(c.id),
		countCaseDonations(c.id),
		listCaseAuditEntries(c.id),
	]);

	const owner = c.owner?.name ?? "A plaintiff";
	const ownerFirst = owner.split(" ")[0];
	// The same per-case disclosure the public page states, built from the case's
	// own recipient + attorney fields (no payout-account read — not the admin's).
	const firmLabel = c.attorneyFirm ?? c.attorneyName ?? null;
	const fundsNote =
		c.payoutRecipient === "attorney"
			? firmLabel
				? `Funds go to ${firmLabel}, the law firm representing ${ownerFirst}, not to ${ownerFirst} and never to JustUs.`
				: `Funds go to the law firm representing ${ownerFirst}, never to JustUs.`
			: c.payoutRecipient === "plaintiff"
				? `Funds go to ${ownerFirst}'s account. ${ownerFirst} pays the attorney directly.`
				: "Funds go to the recipient this case designates, never to JustUs.";

	return (
		<div className="w-full">
			<PublicCaseView
				c={c}
				// Donor controls are replaced by the admin slot, so this config is only
				// here to satisfy the shared view — it never renders a donate button.
				donate={{
					presetsCents: [],
					minCents: 0,
					feeBps: 0,
					alreadyBacked: false,
					canDonate: false,
					blockedReason: null,
				}}
				fundsNote={fundsNote}
				backers={backers}
				donationCount={donationCount}
				backHref={"/campaigns" as Route}
				backLabel="Back to campaigns"
				headingLevel="h2"
				adminSlot={
					<div className="flex flex-col gap-4">
						<AdminCaseActions
							caseId={c.id}
							moderationStatus={c.moderationStatus}
						/>
						<AdminMessagePlaintiff caseId={c.id} plaintiffName={ownerFirst} />
						<AdminDecisionHistory entries={history} />
					</div>
				}
			/>
		</div>
	);
}
