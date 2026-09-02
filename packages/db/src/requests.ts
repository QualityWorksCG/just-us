import prisma from "./index";

/** Pending attorney requests for a case the plaintiff owns, best-rated first. */
export async function listCaseRequests(caseId: string, ownerId: string) {
	return prisma.attorneyRequest.findMany({
		where: { caseId, case: { ownerId }, status: "pending" },
		orderBy: [{ rating: "desc" }, { createdAt: "desc" }],
	});
}

/** How many pending requests a case has (for badges/counts). */
export async function countPendingRequests(caseId: string, ownerId: string) {
	return prisma.attorneyRequest.count({
		where: { caseId, case: { ownerId }, status: "pending" },
	});
}

/**
 * Accept an attorney's request: mark it accepted and copy the attorney's details
 * onto the owned case so the plaintiff can go on to agree the fee and publish.
 * Returns the case id (or null if the request isn't found / not owned).
 */
export async function acceptRequest(requestId: string, ownerId: string) {
	const req = await prisma.attorneyRequest.findFirst({
		where: { id: requestId, case: { ownerId }, status: "pending" },
	});
	if (!req) return null;

	await prisma.$transaction([
		prisma.attorneyRequest.update({
			where: { id: requestId },
			data: { status: "accepted" },
		}),
		prisma.case.update({
			where: { id: req.caseId },
			data: {
				attorneyName: req.attorneyName,
				attorneyFirm: req.firm,
				attorneyArea: req.area,
				attorneyLocation: req.location,
			},
		}),
	]);
	return { caseId: req.caseId };
}

/** Decline a pending request. Returns the number of rows updated. */
export async function declineRequest(requestId: string, ownerId: string) {
	const res = await prisma.attorneyRequest.updateMany({
		where: { id: requestId, case: { ownerId }, status: "pending" },
		data: { status: "declined" },
	});
	return res.count;
}
