import prisma from "./index";

/**
 * The administrator dashboard's read model (JUS admin dashboard).
 *
 * Every query here is deliberately narrow about what it selects. Administrators
 * oversee the platform; they are **not** entitled to donor payment credentials,
 * Stripe account credentials, or raw identity-verification material, so those
 * columns are never selected into an admin-facing shape:
 *
 *   - donor identity on the activity feed is a display label only — a name or
 *     "Guest donor" — never the email, the Checkout session, the payment intent,
 *     or the connected-account id;
 *   - payout/Stripe account rows (`payout_account`) are not read here at all;
 *   - attorney oversight lives in `users`/`attorney-profile`, which expose a
 *     verification *status*, not the evidence behind it.
 *
 * Money is reported straight off the `donation` ledger so the figures reconcile
 * with the individual records by construction — the platform-fee total is the
 * sum of the very `feeCents` column the per-donation rows show. See
 * `platformRevenue`.
 */

/** Donations the platform counts as realised revenue: money actually captured. */
const REALISED = { status: "succeeded" as const };

/** Headline counts for the overview screen, in one round trip. */
export async function adminOverviewStats() {
	const [
		userCount,
		usersByRole,
		casesByStatus,
		realised,
		openReports,
		attorneysPending,
	] = await Promise.all([
		prisma.user.count(),
		prisma.user.groupBy({ by: ["role"], _count: { _all: true } }),
		prisma.case.groupBy({
			by: ["status"],
			where: { deletedAt: null },
			_count: { _all: true },
		}),
		prisma.donation.aggregate({
			where: REALISED,
			_sum: { amountCents: true, feeCents: true, netCents: true },
			_count: { _all: true },
		}),
		prisma.conversationReport.count({ where: { status: "open" } }),
		prisma.attorneyProfile.count({
			where: { verificationStatus: { in: ["pending", "needs_review"] } },
		}),
	]);

	const roles: Record<string, number> = {};
	for (const r of usersByRole) roles[r.role] = r._count._all;
	const statuses: Record<string, number> = {};
	for (const s of casesByStatus) statuses[s.status] = s._count._all;

	return {
		userCount,
		roles,
		caseStatuses: statuses,
		liveCampaigns: statuses.live ?? 0,
		grossCents: realised._sum.amountCents ?? 0,
		platformFeeCents: realised._sum.feeCents ?? 0,
		netToFirmsCents: realised._sum.netCents ?? 0,
		donationCount: realised._count._all,
		openReports,
		attorneysPending,
	};
}

export type AdminCampaignFilter = {
	/** One of the case statuses, or undefined for all. */
	status?: string;
	/** Case-insensitive match on the title. */
	q?: string;
};

function campaignWhere(filter: AdminCampaignFilter) {
	return {
		deletedAt: null,
		...(filter.status ? { status: filter.status as never } : {}),
		...(filter.q
			? { title: { contains: filter.q, mode: "insensitive" as const } }
			: {}),
	};
}

/**
 * Every campaign on the platform for the oversight table, newest first. Carries
 * funding progress and the platform fee it has generated — no payout destination,
 * no Stripe account, nothing about where the money physically sits.
 */
export async function listAdminCampaigns(
	filter: AdminCampaignFilter,
	opts?: { skip?: number; take?: number },
) {
	const cases = await prisma.case.findMany({
		where: campaignWhere(filter),
		orderBy: { createdAt: "desc" },
		skip: opts?.skip,
		take: opts?.take,
		select: {
			id: true,
			title: true,
			status: true,
			category: true,
			location: true,
			goalCents: true,
			raisedCents: true,
			donorsCount: true,
			createdAt: true,
			owner: { select: { id: true, name: true } },
		},
	});

	// Platform fee generated per case — summed from the ledger for just this page's
	// cases, so the column reconciles with the donation records behind it.
	const ids = cases.map((c) => c.id);
	const feeByCase = new Map<string, number>();
	if (ids.length > 0) {
		const grouped = await prisma.donation.groupBy({
			by: ["caseId"],
			where: { caseId: { in: ids }, ...REALISED },
			_sum: { feeCents: true },
		});
		for (const g of grouped) feeByCase.set(g.caseId, g._sum.feeCents ?? 0);
	}

	return cases.map((c) => ({
		...c,
		platformFeeCents: feeByCase.get(c.id) ?? 0,
	}));
}

export async function countAdminCampaigns(filter: AdminCampaignFilter) {
	return prisma.case.count({ where: campaignWhere(filter) });
}

/** Counts per status for the oversight filter pills (soft-deleted excluded). */
export async function adminCampaignStatusCounts() {
	const [total, byStatus] = await Promise.all([
		prisma.case.count({ where: { deletedAt: null } }),
		prisma.case.groupBy({
			by: ["status"],
			where: { deletedAt: null },
			_count: { _all: true },
		}),
	]);
	const statuses: Record<string, number> = {};
	for (const s of byStatus) statuses[s.status] = s._count._all;
	return { total, statuses };
}

/**
 * Platform-fee revenue, reported straight off the donation ledger.
 *
 * `platformFeeCents` is `SUM(feeCents)` over realised (succeeded) donations —
 * the exact same rows and column the donation activity feed lists — so the
 * headline figure reconciles with the individual records by construction, not by
 * a parallel tally that could drift. `amount = fee + net` holds per row, so the
 * three totals reconcile with each other too. Refunds are reported separately
 * rather than folded in, so "revenue" stays a sum of concrete records.
 */
export async function platformRevenue() {
	const [realised, refunded] = await Promise.all([
		prisma.donation.aggregate({
			where: REALISED,
			_sum: { amountCents: true, feeCents: true, netCents: true },
			_count: { _all: true },
		}),
		prisma.donation.aggregate({
			where: { status: "refunded" },
			_sum: { amountCents: true, feeCents: true },
			_count: { _all: true },
		}),
	]);
	return {
		grossCents: realised._sum.amountCents ?? 0,
		platformFeeCents: realised._sum.feeCents ?? 0,
		netToFirmsCents: realised._sum.netCents ?? 0,
		donationCount: realised._count._all,
		refundedCount: refunded._count._all,
		refundedAmountCents: refunded._sum.amountCents ?? 0,
		refundedFeeCents: refunded._sum.feeCents ?? 0,
	};
}

/**
 * Recent donation activity for oversight. The donor is a **display label only**
 * — their given name or "Guest donor" — never the email, the Stripe references,
 * or anything a payment could be reconstructed from. The money columns are the
 * ledger's own, so an admin summing this feed arrives at the reported revenue.
 */
export async function listDonationActivity(opts?: {
	take?: number;
	status?: string;
}) {
	const rows = await prisma.donation.findMany({
		where: {
			case: { deletedAt: null },
			// A specific status when asked; otherwise the whole activity stream.
			...(opts?.status ? { status: opts.status as never } : {}),
		},
		orderBy: { createdAt: "desc" },
		take: opts?.take ?? 50,
		select: {
			id: true,
			status: true,
			amountCents: true,
			feeCents: true,
			netCents: true,
			createdAt: true,
			donorId: true,
			donorName: true,
			case: { select: { id: true, title: true } },
		},
	});
	return rows.map((r) => ({
		id: r.id,
		status: r.status,
		amountCents: r.amountCents,
		feeCents: r.feeCents,
		netCents: r.netCents,
		createdAt: r.createdAt,
		caseId: r.case.id,
		caseTitle: r.case.title,
		// Identity reduced to a label; never the email or any payment reference.
		donorLabel:
			r.donorName?.trim() || (r.donorId ? "Account donor" : "Guest donor"),
	}));
}
