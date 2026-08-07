import { listMessageConversations } from "@just-us/db/messages";
import { getCasePayoutOptions } from "@just-us/db/payouts";
import { listRepresentation } from "@just-us/db/requests";
import { buttonVariants } from "@just-us/ui/components/button";
import { cn } from "@just-us/ui/lib/utils";
import { FilePlus2, Scale } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

import {
	RepresentationCaseCard,
	type RepresentationView,
} from "@/components/dashboard/representation-case";
import { requireRole } from "@/lib/auth-server";
import { syncPendingDonationsForCase } from "@/lib/donation-sync";

/** Live cases whose totals are re-checked against Stripe before rendering.
 *  Bounded because this screen shows every case at once: the manage page can
 *  afford to reconcile the one case it is about, and this one must not turn a
 *  render into an unbounded fan-out of Stripe reads. Beyond the cap the webhook
 *  is the only path, which is what it is for. */
const SYNC_CASE_LIMIT = 3;

/** Represented and raising first — that is what this screen is about — then
 *  represented but not yet live, then cases still looking for an attorney (the
 *  ones needing the plaintiff), then drafts, and closed matters last. */
function rank(view: RepresentationView): number {
	if (view.status === "closed") return 5;
	if (view.attorney) return view.status === "live" ? 0 : 1;
	if (view.status === "seeking") return view.openInterest > 0 ? 2 : 3;
	return 4;
}

export default async function RepresentationPage() {
	const { session } = await requireRole("plaintiff");

	const cases = await listRepresentation(session.user.id);

	if (cases.length === 0) {
		return (
			<div className="flex flex-col gap-6">
				<p className="max-w-[640px] text-[14.5px] text-ink-soft leading-relaxed">
					Your attorney, the agreed fee, and where funding stands — all of it
					appears here once you've started a case.
				</p>
				<div className="flex flex-col items-center gap-3 rounded-[var(--radius-card-lg)] border border-border bg-surface px-6 py-16 text-center shadow-[var(--shadow-rest)]">
					<span className="flex size-12 items-center justify-center rounded-xl bg-brass-wash text-brass-deep">
						<Scale className="size-6" aria-hidden="true" />
					</span>
					<p className="font-bold text-[16px] text-ink">Nothing to show yet</p>
					<p className="max-w-[44ch] text-[13.5px] text-muted-foreground leading-relaxed">
						Start a case and choose who represents you — you'll see them here,
						with the fee you agreed and how the funding is going.
					</p>
					<Link
						href={"/my-cases/new" as Route}
						className={cn(buttonVariants({ size: "lg" }), "mt-2 px-5")}
					>
						<FilePlus2 data-icon="inline-start" aria-hidden="true" />
						Start a case
					</Link>
				</div>
			</div>
		);
	}

	// Fold in donations paid at Stripe whose webhook was late, lost, or (locally)
	// never sent — otherwise this screen reports a case as raising nothing while
	// its own manage page, which does the same reconcile, shows the money.
	const reconciled = await Promise.all(
		cases
			.filter((c) => c.status === "live")
			.slice(0, SYNC_CASE_LIMIT)
			.map((c) => syncPendingDonationsForCase(c.id)),
	);

	// Only re-read when the reconcile actually moved something, which is the rare
	// case — a second full read on every render to catch nothing would be waste.
	const [synced, conversations] = await Promise.all([
		reconciled.some((r) => r.applied > 0)
			? listRepresentation(session.user.id)
			: Promise.resolve(cases),
		listMessageConversations(session.user.id),
	]);
	const conversationByAttorney = new Map(
		conversations.map((conversation) => [
			conversation.otherUser.id,
			conversation.conversationId,
		]),
	);

	// Who receives, per case, from the payout layer rather than re-derived here:
	// it is the authority on which account a case's donations land in, and it
	// alone resolves the attorney a plaintiff named by email. Only cases that
	// could take a donation are asked — a draft has no destination to report.
	const payouts = await Promise.all(
		synced.map(async (c) =>
			c.attorney && c.status !== "draft"
				? getCasePayoutOptions(c.id, session.user.id)
				: null,
		),
	);

	const views: RepresentationView[] = synced
		.map((c, i) => {
			const payout = payouts[i]?.attorney ?? null;
			return {
				...c,
				conversationId: c.attorney?.userId
					? (conversationByAttorney.get(c.attorney.userId) ?? null)
					: null,
				payout: payout
					? {
							bound: payouts[i]?.bound ?? false,
							recipient: payout.firmName ?? payout.name,
							attorneyName: payout.name,
							attorneyEmail: payout.email,
							hasAccount: payout.hasAccount,
							detailsSubmitted: payout.detailsSubmitted,
							transfersEnabled: payout.transfersEnabled,
						}
					: null,
			};
		})
		.sort((a, b) => rank(a) - rank(b));

	const represented = views.filter((v) => v.attorney).length;

	return (
		<div className="flex flex-col gap-6">
			<p className="max-w-[680px] text-[14.5px] text-ink-soft leading-relaxed">
				{views.length === 1
					? "Your attorney, the agreed fee, and where funding stands."
					: `You have ${views.length} cases — ${
							represented === 0
								? "none of them with an attorney yet"
								: represented === views.length
									? "each with an attorney"
									: `${represented} with an attorney`
						}. Here's who's acting on each, what you agreed, and where the money is.`}
			</p>

			<div className="flex flex-col gap-5">
				{views.map((view) => (
					<RepresentationCaseCard key={view.id} view={view} />
				))}
			</div>

			{/* The promise this screen rests on. JustUs matches nobody and holds
			    nothing — both are worth restating where a plaintiff is looking at
			    their attorney and their money on the same page. */}
			<div className="flex items-start gap-2.5 rounded-[var(--radius-card)] border border-border bg-surface/60 px-5 py-3.5 text-[12.5px] text-ink-soft leading-relaxed">
				<Scale
					className="mt-0.5 size-4 shrink-0 text-brass-deep"
					aria-hidden="true"
				/>
				You choose your attorney — JustUs never assigns one, and never ranks
				them for your case. Donations are paid to your attorney's firm, into an
				account opened for your case alone, and applied to your fee under their
				state bar's trust rules. JustUs never holds the money.
			</div>
		</div>
	);
}
