import { getOwnedCase } from "@just-us/db/cases";
import { listMessageConversations } from "@just-us/db/messages";
import { getCasePayoutOptions } from "@just-us/db/payouts";
import { getAttorneyCase } from "@just-us/db/representation";
import { isPaymentsConfigured } from "@just-us/payments";
import { cn } from "@just-us/ui/lib/utils";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { AttorneyCaseDetailView } from "@/components/dashboard/attorney-case-detail";
import { BackLink } from "@/components/dashboard/back-link";
import { CasePayout } from "@/components/dashboard/case-payout";
import { CasePayoutSetup } from "@/components/dashboard/case-payout-setup";
import {
	ManageCase,
	type ManageCaseData,
} from "@/components/dashboard/manage-case";
import { requireRole } from "@/lib/auth-server";
import { syncPendingDonationsForCase } from "@/lib/donation-sync";

/**
 * One case, to the two people it belongs to.
 *
 * The plaintiff owns it and manages it; the attorney acts on it and holds the
 * payout account it pays into. Same URL, because it is the same case — and because
 * Stripe's onboarding return URL points here, so the attorney lands back on the
 * matter they were setting up rather than on a settings page listing every client.
 */
export default async function CasePage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { session, role } = await requireRole("plaintiff", "attorney");
	const { id } = await params;

	// Before reading the case: fold in any donation that was paid at Stripe but is
	// still pending here because its webhook was late, lost, or never forwarded.
	// Without this, whoever is looking sees the money in the Stripe dashboard and a
	// stale `raisedCents` here, which reads as the platform losing it.
	await syncPendingDonationsForCase(id);

	if (role === "attorney") {
		return <AttorneyView caseId={id} session={session} />;
	}

	const c = await getOwnedCase(id, session.user.id);
	if (!c || c.deletedAt) notFound();

	// Where this case's donations land — the representing firm's account. The
	// attorney's own onboarding state is read too: the plaintiff is blocked by
	// someone else's setup here, so the panel has to name who and say what's
	// outstanding rather than just look unfinished.
	const payout = await getCasePayoutOptions(id, session.user.id);

	const data: ManageCaseData = {
		id: c.id,
		title: c.title,
		category: c.category,
		location: c.location,
		summary: c.summary,
		story: c.story,
		status: c.status,
		goalCents: c.goalCents,
		raisedCents: c.raisedCents,
		donorsCount: c.donorsCount,
		viewsCount: c.viewsCount,
		sharesCount: c.sharesCount,
		coverImageUrl: c.coverImageUrl,
		images: c.images ?? [],
		attorneyName: c.attorneyName,
		attorneyFirm: c.attorneyFirm,
		attorneyArea: c.attorneyArea,
		attorneyLocation: c.attorneyLocation,
	};

	const badge =
		c.status === "live"
			? {
					text: "Live · Raising",
					cls: "bg-green-soft text-green-deep",
					dot: "bg-success",
				}
			: c.status === "seeking"
				? {
						text: "Seeking attorney",
						cls: "bg-brass-wash text-brass-deep",
						dot: "bg-brass-deep",
					}
				: {
						text: "Draft",
						cls: "bg-surface-2 text-ink-soft",
						dot: "bg-ink-soft",
					};

	return (
		<div className="flex flex-col gap-6">
			<div>
				<BackLink
					href={"/my-cases" as Route}
					label="Back to my cases"
					className="mb-3"
				/>
				<div className="flex flex-wrap items-center gap-3">
					<h2 className="font-extrabold text-[30px] text-ink tracking-[-0.02em]">
						{c.title || "Untitled case"}
					</h2>
					<span
						className={cn(
							"inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] px-3 py-1 font-mono font-semibold text-[11px] uppercase tracking-[0.06em]",
							badge.cls,
						)}
					>
						<span className={cn("size-1.5 rounded-full", badge.dot)} />
						{badge.text}
					</span>
				</div>
				<p className="mt-1.5 text-[14.5px] text-ink-soft">
					Manage your case — edit the details, update images, or remove it.
				</p>
			</div>

			<ManageCase data={data} />

			{payout && (
				<CasePayout
					data={{
						caseId: c.id,
						status: payout.status,
						bound: payout.bound,
						attorney: payout.attorney,
						designatedEmail: payout.designatedEmail,
					}}
				/>
			)}
		</div>
	);
}

/**
 * The attorney's side of the same case.
 *
 * Gated on `getAttorneyCase`, which re-derives representation from the case row —
 * an attorney who is not on this case gets a 404, including one holding the link.
 */
async function AttorneyView({
	caseId,
	session,
}: {
	caseId: string;
	session: { user: { id: string; email: string } };
}) {
	const [item, conversations] = await Promise.all([
		getAttorneyCase({
			userId: session.user.id,
			email: session.user.email,
			caseId,
		}),
		listMessageConversations(session.user.id),
	]);
	if (!item) notFound();

	// Threads are found by the other participant: an attorney has one conversation
	// per client, and the client is the only person on the other side of this case.
	const conversationId =
		conversations.find(
			(conversation) => conversation.otherUser.id === item.plaintiffId,
		)?.conversationId ?? null;

	return (
		<div className="flex w-full flex-col gap-5">
			<BackLink
				href={"/my-cases" as Route}
				label="Back to my cases"
				className="mb-1"
			/>
			<AttorneyCaseDetailView
				item={item}
				conversationId={conversationId}
				payoutPanel={
					// CasePayoutSetup reads ?payout= to detect the return from Stripe's
					// hosted flow, and useSearchParams needs a Suspense boundary to
					// prerender.
					<Suspense fallback={null}>
						<CasePayoutSetup
							caseId={item.id}
							caseStatus={item.status}
							initial={item.payout}
							configured={isPaymentsConfigured()}
						/>
					</Suspense>
				}
			/>
		</div>
	);
}
