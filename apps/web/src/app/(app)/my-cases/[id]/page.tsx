import { getOwnedCase } from "@just-us/db/cases";
import { getCasePayoutOptions } from "@just-us/db/payouts";
import { cn } from "@just-us/ui/lib/utils";
import type { Route } from "next";
import { notFound } from "next/navigation";

import { BackLink } from "@/components/dashboard/back-link";
import { CasePayout } from "@/components/dashboard/case-payout";
import {
	ManageCase,
	type ManageCaseData,
} from "@/components/dashboard/manage-case";
import { requireRole } from "@/lib/auth-server";

export default async function ManageCasePage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { session } = await requireRole("plaintiff");
	const { id } = await params;
	const c = await getOwnedCase(id, session.user.id);
	if (!c || c.deletedAt) notFound();

	// Who this case pays out to. Both candidates' onboarding state is read, because
	// a recipient the plaintiff can pick but not use has to explain itself.
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
						recipient: payout.recipient,
						bound: payout.bound,
						plaintiff: payout.plaintiff,
						attorney: payout.attorney,
					}}
				/>
			)}
		</div>
	);
}
