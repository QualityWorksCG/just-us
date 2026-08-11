import prisma from "./index";

/**
 * Following a case (JUS-33) — a public "notify me" that anyone but the case's own
 * team uses to get its updates without donating. Distinct from a donor's private
 * `SavedCase` bookmark and from donations; the plaintiff's update audience counts
 * followers alongside backers.
 */

/** Follow a case. Idempotent. */
export async function followCase(userId: string, caseId: string) {
	return prisma.caseFollow.upsert({
		where: { userId_caseId: { userId, caseId } },
		update: {},
		create: { userId, caseId },
	});
}

/** Stop following a case. */
export async function unfollowCase(userId: string, caseId: string) {
	return prisma.caseFollow.deleteMany({ where: { userId, caseId } });
}

/** Whether a user currently follows a case. */
export async function isCaseFollowing(
	userId: string,
	caseId: string,
): Promise<boolean> {
	const row = await prisma.caseFollow.findUnique({
		where: { userId_caseId: { userId, caseId } },
		select: { id: true },
	});
	return !!row;
}

/** How many followers a case has — shown in the plaintiff's update audience. */
export async function countCaseFollowers(caseId: string): Promise<number> {
	return prisma.caseFollow.count({ where: { caseId } });
}

/** The user ids following a case — a notification audience. */
export async function listCaseFollowerUserIds(
	caseId: string,
): Promise<string[]> {
	const rows = await prisma.caseFollow.findMany({
		where: { caseId },
		select: { userId: true },
	});
	return rows.map((r) => r.userId);
}

/** A user's followed cases (live, newest-followed first), with the case data +
 *  owner name — the "Following" tab. */
/** The ids of every case a user follows — for marking follow state across a list
 *  of cards in one query, the follow counterpart to `listSavedCaseIds`. */
export async function listFollowedCaseIds(userId: string): Promise<string[]> {
	const rows = await prisma.caseFollow.findMany({
		where: { userId },
		select: { caseId: true },
	});
	return rows.map((r) => r.caseId);
}

export async function listFollowedCases(userId: string) {
	const rows = await prisma.caseFollow.findMany({
		where: { userId, case: { deletedAt: null, status: "live" } },
		orderBy: { createdAt: "desc" },
		include: { case: { include: { owner: { select: { name: true } } } } },
	});
	return rows.map((r) => r.case);
}

/** Mark a followed case's updates as seen by this follower — clears their bell
 *  and card tag for it. No-op if they don't follow the case. */
export async function markCaseUpdatesSeenByFollower(
	userId: string,
	caseId: string,
) {
	return prisma.caseFollow.updateMany({
		where: { userId, caseId },
		data: { updatesSeenAt: new Date() },
	});
}

/** The follower's last-seen time for a case (for highlighting new updates), or
 *  `undefined` when they don't follow it (no highlighting). */
export async function getFollowUpdatesSeenAt(
	userId: string,
	caseId: string,
): Promise<Date | null | undefined> {
	const row = await prisma.caseFollow.findUnique({
		where: { userId_caseId: { userId, caseId } },
		select: { updatesSeenAt: true },
	});
	return row ? row.updatesSeenAt : undefined;
}

export type FollowerUpdateNotice = {
	id: string;
	caseId: string;
	caseTitle: string;
	authorName: string;
	createdAt: Date;
};

/** Build the per-case "unseen updates" predicate from a user's follows. */
async function followsWithContext(userId: string) {
	return prisma.caseFollow.findMany({
		where: { userId, case: { deletedAt: null, status: "live" } },
		select: {
			caseId: true,
			updatesSeenAt: true,
			case: {
				select: {
					title: true,
					ownerId: true,
					attorneyName: true,
					owner: { select: { name: true } },
				},
			},
		},
	});
}

/**
 * A follower's *unseen* updates across the cases they follow, newest first — the
 * "new update" items in their header bell (JUS-33). Unseen means newer than that
 * follow's `updatesSeenAt` (or any update if they've never opened it).
 */
export async function listNewUpdatesForFollower(
	userId: string,
	take = 15,
): Promise<FollowerUpdateNotice[]> {
	const follows = await followsWithContext(userId);
	if (follows.length === 0) return [];

	const rows = await prisma.caseUpdate.findMany({
		where: {
			OR: follows.map((f) =>
				f.updatesSeenAt
					? { caseId: f.caseId, createdAt: { gt: f.updatesSeenAt } }
					: { caseId: f.caseId },
			),
		},
		orderBy: { createdAt: "desc" },
		take,
		select: { id: true, caseId: true, createdAt: true, authorId: true },
	});

	const meta = new Map(follows.map((f) => [f.caseId, f]));
	return rows.map((r) => {
		const f = meta.get(r.caseId);
		const isOwner = f ? r.authorId === f.case.ownerId : false;
		return {
			id: r.id,
			caseId: r.caseId,
			caseTitle: f?.case.title || "Untitled case",
			authorName: isOwner
				? (f?.case.owner?.name ?? "Plaintiff")
				: (f?.case.attorneyName ?? "Attorney"),
			createdAt: r.createdAt,
		};
	});
}

/** Which followed cases have updates the user hasn't seen — for tagging cards on
 *  the "Following" tab. */
export async function followedCaseIdsWithUnseenUpdates(
	userId: string,
): Promise<Set<string>> {
	const follows = await followsWithContext(userId);
	if (follows.length === 0) return new Set();

	const rows = await prisma.caseUpdate.findMany({
		where: {
			OR: follows.map((f) =>
				f.updatesSeenAt
					? { caseId: f.caseId, createdAt: { gt: f.updatesSeenAt } }
					: { caseId: f.caseId },
			),
		},
		distinct: ["caseId"],
		select: { caseId: true },
	});
	return new Set(rows.map((r) => r.caseId));
}
