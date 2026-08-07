import prisma from "./index";

/**
 * A donor's giving on one case — total and most recent date — for the "Your
 * support" panel. Null when they haven't donated (payments aren't wired yet, so
 * that's the honest common case).
 */
export async function getCaseDonationSummary(
	donorId: string,
	caseId: string,
): Promise<{ totalCents: number; latestAt: Date } | null> {
	const agg = await prisma.donation.aggregate({
		where: { donorId, caseId },
		_sum: { amountCents: true },
		_max: { createdAt: true },
		_count: { _all: true },
	});
	if (agg._count._all === 0 || !agg._max.createdAt) return null;
	return {
		totalCents: agg._sum.amountCents ?? 0,
		latestAt: agg._max.createdAt,
	};
}

/** A donor's donations, newest first, with the case + owner name for display.
 *  Pass `take` to cap the list. */
export async function listDonations(donorId: string, take?: number) {
	return prisma.donation.findMany({
		where: { donorId, case: { deletedAt: null } },
		orderBy: { createdAt: "desc" },
		take,
		include: { case: { include: { owner: { select: { name: true } } } } },
	});
}

/** Aggregate donor giving stats: total given, distinct cases, given this year. */
export async function donorStats(donorId: string, year: number) {
	const [all, thisYear, cases] = await Promise.all([
		prisma.donation.aggregate({
			where: { donorId },
			_sum: { amountCents: true },
		}),
		prisma.donation.aggregate({
			where: { donorId, createdAt: { gte: new Date(year, 0, 1) } },
			_sum: { amountCents: true },
		}),
		prisma.donation.findMany({
			where: { donorId },
			distinct: ["caseId"],
			select: { caseId: true },
		}),
	]);
	return {
		totalCents: all._sum.amountCents ?? 0,
		thisYearCents: thisYear._sum.amountCents ?? 0,
		casesBacked: cases.length,
	};
}

/** The cases a donor is currently backing (distinct), with their giving total
 *  per case and the case data. Empty until donations exist. */
export async function listBackedCases(donorId: string, take?: number) {
	const grouped = await prisma.donation.groupBy({
		by: ["caseId"],
		where: { donorId, case: { deletedAt: null } },
		_sum: { amountCents: true },
		orderBy: { _max: { createdAt: "desc" } },
		take,
	});
	if (grouped.length === 0) return [];
	const cases = await prisma.case.findMany({
		where: { id: { in: grouped.map((g) => g.caseId) } },
		include: { owner: { select: { name: true } } },
	});
	const byId = new Map(cases.map((c) => [c.id, c]));
	return grouped
		.map((g) => {
			const c = byId.get(g.caseId);
			return c ? { case: c, givenCents: g._sum.amountCents ?? 0 } : null;
		})
		.filter(
			(x): x is { case: (typeof cases)[number]; givenCents: number } => !!x,
		);
}
