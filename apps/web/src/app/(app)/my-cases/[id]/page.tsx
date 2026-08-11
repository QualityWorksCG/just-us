import {
	listCaseUpdates,
	markCaseUpdatesSeenByOwner,
} from "@just-us/db/case-updates";
import { getOwnedCase } from "@just-us/db/cases";
import { listMessageConversations } from "@just-us/db/messages";
import { bindReadyLiveCase, getCasePayoutOptions } from "@just-us/db/payouts";
import { getAttorneyCase } from "@just-us/db/representation";
import { isPaymentsConfigured } from "@just-us/payments";
import { buttonVariants } from "@just-us/ui/components/button";
import { cn } from "@just-us/ui/lib/utils";
import { ArrowRight, ExternalLink } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { CaseUpdates } from "@/components/cases/case-updates";
import { AttorneyCaseDetailView } from "@/components/dashboard/attorney-case-detail";
import { BackLink } from "@/components/dashboard/back-link";
import { CasePayout } from "@/components/dashboard/case-payout";
import { CasePayoutSetup } from "@/components/dashboard/case-payout-setup";
import { CaseUpdateComposer } from "@/components/dashboard/case-update-composer";
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
	searchParams,
}: {
	params: Promise<{ id: string }>;
	searchParams: Promise<{ tab?: string }>;
}) {
	// Both roles land here from their own "My cases": the plaintiff manages the
	// case they own; the attorney acts on it, holds the payout account, and posts
	// the progress updates.
	const { session, role } = await requireRole("plaintiff", "attorney");
	const { id } = await params;
	// `?tab=edit` opens straight on the editor — how the case list's edit control
	// arrives here. Anything else falls back to the overview rather than erroring:
	// it is a view preference in a URL people share and re-type.
	const tab = (await searchParams)?.tab === "edit" ? "edit" : "overview";

	// Before reading the case: fold in any donation that was paid at Stripe but is
	// still pending here because its webhook was late, lost, or never forwarded.
	// Without this, whoever is looking sees the money in the Stripe dashboard and a
	// stale `raisedCents` here, which reads as the platform losing it.
	await syncPendingDonationsForCase(id);
	// And bind a live case whose account has since cleared, so both sides of this
	// screen report the same thing the donate button will. No-ops otherwise.
	await bindReadyLiveCase(id);

	if (role === "attorney") {
		return <AttorneyView caseId={id} session={session} />;
	}

	const c = await getOwnedCase(id, session.user.id);
	if (!c || c.deletedAt) notFound();

	// Two independent reads for the owner's view, so they overlap rather than
	// queue:
	//
	//   payout  — where this case's donations land, the representing firm's
	//             account. The attorney's own onboarding state comes back too: the
	//             plaintiff is blocked by someone else's setup here, so the panel
	//             has to name who and say what is outstanding rather than just
	//             look unfinished.
	//   updates — the attorney's progress posts, shown on the overview. Marking
	//             them seen is what clears the header bell, and it rides along
	//             here because reaching this page *is* the owner reading them.
	const [payout, updates] = await Promise.all([
		getCasePayoutOptions(id, session.user.id),
		listCaseUpdates(c.id),
		markCaseUpdatesSeenByOwner(c.id, session.user.id),
	]);

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
		thankYouNote: c.thankYouNote,
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
				: c.status === "pending_payout"
					? {
							text: "Awaiting firm",
							cls: "bg-gold-bright/20 text-gold-bright-ink",
							dot: "bg-gold-bright",
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
					{/* Once live, the case has a public fundraiser page — let the owner
					    open it to see exactly what donors see. Opens in a new tab so the
					    manage view stays put. Only live cases have a public page (the
					    public route 404s otherwise). */}
					{c.status === "live" && (
						<a
							href={`/cases/${c.id}`}
							target="_blank"
							rel="noopener noreferrer"
							className={cn(
								buttonVariants({ variant: "outline", size: "sm" }),
								"ml-auto h-9",
							)}
						>
							<ExternalLink data-icon="inline-start" aria-hidden="true" />
							View public page
						</a>
					)}
				</div>
				<p className="mt-1.5 text-[14.5px] text-ink-soft">
					{c.status === "live"
						? "Manage your case, or view how your public fundraiser page looks to donors."
						: c.status === "pending_payout"
							? "Your case is finished and private. It goes public as soon as your attorney's payout account can receive — publish it below."
							: "Manage your case — edit the details, update images, or remove it."}
				</p>
			</div>

			<ManageCase
				data={data}
				updates={updates}
				updatesHighlightSince={c.ownerUpdatesSeenAt}
				viewerId={session.user.id}
				initialTab={tab}
			/>

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
	session: { user: { id: string; email: string; name: string } };
}) {
	const [item, conversations, updates] = await Promise.all([
		getAttorneyCase({
			userId: session.user.id,
			email: session.user.email,
			caseId,
		}),
		listMessageConversations(session.user.id),
		listCaseUpdates(caseId),
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
				payoutsConfigured={isPaymentsConfigured()}
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
				updatesPanel={
					// No "Case updates" heading of its own — the tab that holds this is
					// already labelled, and the pair of headings read as two sections.
					<div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
						<CaseUpdateComposer
							caseId={item.id}
							authorName={session.user.name}
							authorTone="brass"
							placeholder={`Post an update for ${item.plaintiffName.split(/\s+/)[0]} and their backers…`}
						/>

						<div className="flex flex-col gap-3">
							<div className="flex items-center gap-2">
								<h3 className="flex items-center gap-2 font-bold text-[15px] text-ink">
									Posted updates
									{updates.length > 0 && (
										<span className="inline-flex min-w-5 items-center justify-center rounded-full bg-surface-2 px-1.5 py-0.5 font-bold text-[11px] text-ink-soft">
											{updates.length}
										</span>
									)}
								</h3>
								{updates.length > 0 && (
									<Link
										href={`/my-cases/${item.id}/updates` as Route}
										className="ml-auto inline-flex items-center gap-1.5 font-semibold text-[13px] text-brass-deep transition-colors hover:text-brass"
									>
										View all updates
										<ArrowRight className="size-3.5" aria-hidden="true" />
									</Link>
								)}
							</div>
							<CaseUpdates
								updates={updates}
								viewerId={session.user.id}
								viewerRole="attorney"
								caseId={item.id}
								emptyHint="No updates yet — your first post will appear here and reach every backer."
								limit={2}
							/>
						</div>
					</div>
				}
			/>
		</div>
	);
}
