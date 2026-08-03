import prisma from "./index";

/** Save (bookmark) a case for a donor. Idempotent. */
export async function saveCase(userId: string, caseId: string) {
	return prisma.savedCase.upsert({
		where: { userId_caseId: { userId, caseId } },
		update: {},
		create: { userId, caseId },
	});
}

/** Remove a donor's saved case. */
export async function unsaveCase(userId: string, caseId: string) {
	return prisma.savedCase.deleteMany({ where: { userId, caseId } });
}

/** The case ids a donor has saved (for marking cards as saved). */
export async function listSavedCaseIds(userId: string): Promise<string[]> {
	const rows = await prisma.savedCase.findMany({
		where: { userId },
		select: { caseId: true },
	});
	return rows.map((r) => r.caseId);
}

/** How many cases a donor has saved. */
export async function countSavedCases(userId: string) {
	return prisma.savedCase.count({ where: { userId } });
}

/** A donor's saved cases (newest first), with the live case data + owner name.
 *  Deleted or non-existent cases are filtered out. */
export async function listSavedCases(userId: string, take?: number) {
	const rows = await prisma.savedCase.findMany({
		where: { userId, case: { deletedAt: null } },
		orderBy: { createdAt: "desc" },
		take,
		include: { case: { include: { owner: { select: { name: true } } } } },
	});
	return rows.map((r) => r.case);
}
