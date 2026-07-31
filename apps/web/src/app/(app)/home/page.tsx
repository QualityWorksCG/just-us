import type { Role } from "@just-us/auth";
import { getAttorneyProfile } from "@just-us/db/attorney-profile";
import { listOwnedCases } from "@just-us/db/cases";
import { donorStats } from "@just-us/db/donations";
import {
	interestCounts,
	listMyInterests,
	listSeekingQueue,
	queueCategories,
	queueStates,
} from "@just-us/db/representation";
import { interestCountsByCase } from "@just-us/db/requests";
import { countSavedCases, listSavedCases } from "@just-us/db/saves";

import { toDonorCase } from "@/components/dashboard/donor-case";
import { DonorDashboard } from "@/components/dashboard/donor-dashboard";
import {
	type CaseSummary,
	PlaintiffDashboard,
} from "@/components/dashboard/plaintiff-dashboard";
import { ScreenPlaceholder } from "@/components/dashboard/screen-placeholder";
import {
	readQueueParams,
	SeekingQueue,
	toQueueSort,
} from "@/components/dashboard/seeking-queue";
import { requireOnboarded } from "@/lib/auth-server";
import { getRoleNav } from "@/lib/dashboard-nav";

export default async function DashboardHome({
	searchParams,
}: {
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
	const session = await requireOnboarded();
	const role = ((session.user as { role?: Role }).role ?? "donor") as Role;

	if (role === "plaintiff") {
		const [owned, interests] = await Promise.all([
			listOwnedCases(session.user.id),
			// Expressions of interest surface here, per case (JUS-25).
			interestCountsByCase(session.user.id),
		]);
		const cases: CaseSummary[] = owned.map((c) => ({
			id: c.id,
			title: c.title,
			category: c.category,
			location: c.location,
			status: c.status,
			goalCents: c.goalCents,
			raisedCents: c.raisedCents,
			donorsCount: c.donorsCount,
			storyLength: c.story.trim().length,
			hasCover: !!c.coverImageUrl,
			evidenceCount: Array.isArray(c.evidence) ? c.evidence.length : 0,
			attorneyName: c.attorneyName,
			attorneyFirm: c.attorneyFirm,
			attorneyArea: c.attorneyArea,
			attorneyLocation: c.attorneyLocation,
			createdAt: c.createdAt.toISOString(),
			interestCount: interests[c.id]?.open ?? 0,
			newInterestCount: interests[c.id]?.unseen ?? 0,
		}));
		return <PlaintiffDashboard name={session.user.name} cases={cases} />;
	}

	if (role === "donor") {
		const [stats, savedCount, saved] = await Promise.all([
			donorStats(session.user.id, new Date().getFullYear()),
			countSavedCases(session.user.id),
			listSavedCases(session.user.id, 3),
		]);
		return (
			<DonorDashboard
				data={{
					firstName: session.user.name.trim().split(" ")[0] || "there",
					totalCents: stats.totalCents,
					casesBacked: stats.casesBacked,
					savedCount,
					helpedFund: 0,
					saved: saved.map(toDonorCase),
				}}
			/>
		);
	}

	const home = getRoleNav(role).items[0];

	// The attorney's home is the Seeking Representation queue (JUS-25).
	if (role === "attorney") {
		const filters = readQueueParams(await searchParams);
		const [cases, categories, states, tally, interests, profile] =
			await Promise.all([
				listSeekingQueue(session.user.id, {
					category: filters.category,
					state: filters.state,
					sort: toQueueSort(filters.sort),
				}),
				queueCategories(),
				queueStates(),
				interestCounts(session.user.id),
				listMyInterests(session.user.id),
				getAttorneyProfile(session.user.id),
			]);

		return (
			<div>
				<p className="max-w-[640px] text-[14.5px] text-ink-soft leading-relaxed">
					{home.sub}
				</p>
				<div className="mt-8">
					<SeekingQueue
						cases={cases}
						categories={categories}
						states={states}
						jurisdiction={profile?.user.jurisdiction ?? null}
						filtered={filters.filtered}
						tally={tally}
						interests={interests}
						canExpressInterest={profile?.verificationStatus === "verified"}
					/>
				</div>
			</div>
		);
	}

	return <ScreenPlaceholder sub={home.sub} />;
}
