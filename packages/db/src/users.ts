import type { Prisma } from "../prisma/generated/client";
import { writeAudit } from "./audit";
import prisma from "./index";

export type UserListFilter = {
	q?: string;
	role?: string;
	verified?: boolean;
	blocked?: boolean;
	/** Attorney-only facet: "federal" for attorneys who practise in federal court,
	 *  "state" for the rest. It reads `AttorneyProfile.practicesFederal`, so it only
	 *  ever narrows attorney rows — the admin table exposes it under the attorney
	 *  role. */
	jurisdiction?: "state" | "federal";
};

/** Where-fragment for "blocked right now": banned with no expiry or a future one. */
export function activeBlockWhere(at: Date): Prisma.UserWhereInput {
	return {
		banned: true,
		OR: [{ banExpires: null }, { banExpires: { gt: at } }],
	};
}

/**
 * Explicit complement of activeBlockWhere. Never-blocked accounts have
 * banned = NULL (the column has no default), and NOT (banned = true AND ...)
 * evaluates to NULL for them under SQL three-valued logic — a Prisma NOT would
 * silently exclude every such row from "not blocked".
 */
export function notActiveBlockWhere(at: Date): Prisma.UserWhereInput {
	return {
		OR: [{ banned: null }, { banned: false }, { banExpires: { lte: at } }],
	};
}

function whereForUsers(
	filter: UserListFilter,
	at: Date,
): Prisma.UserWhereInput {
	// Composed as an AND of independent conditions so a facet that needs its own
	// OR (the search across name/email, the "state" case below) can't overwrite
	// another's.
	const and: Prisma.UserWhereInput[] = [];
	if (filter.q) {
		and.push({
			OR: [
				{ name: { contains: filter.q, mode: "insensitive" } },
				{ email: { contains: filter.q, mode: "insensitive" } },
			],
		});
	}
	if (filter.role) {
		and.push({ role: filter.role });
	}
	if (filter.verified !== undefined) {
		and.push({ emailVerified: filter.verified });
	}
	if (filter.blocked !== undefined) {
		and.push(filter.blocked ? activeBlockWhere(at) : notActiveBlockWhere(at));
	}
	if (filter.jurisdiction === "federal") {
		// Practises federally — the notable, non-default case.
		and.push({ attorneyProfile: { is: { practicesFederal: true } } });
	} else if (filter.jurisdiction === "state") {
		// State-only: not federal, or no directory profile started yet (a profile
		// defaults to non-federal, and a bare attorney account has no row at all).
		and.push({
			OR: [
				{ attorneyProfile: { is: { practicesFederal: false } } },
				{ attorneyProfile: { is: null } },
			],
		});
	}
	return and.length ? { AND: and } : {};
}

export async function listUsers(
	filter: UserListFilter,
	opts?: { skip?: number; take?: number },
) {
	return prisma.user.findMany({
		where: whereForUsers(filter, new Date()),
		orderBy: { createdAt: "desc" },
		skip: opts?.skip,
		take: opts?.take,
		select: {
			id: true,
			name: true,
			email: true,
			role: true,
			jurisdiction: true,
			emailVerified: true,
			banned: true,
			banReason: true,
			banExpires: true,
			lockedUntil: true,
			createdAt: true,
			lastSignInAt: true,
			// Bar-standing badge for attorney rows — the status the admin table shows
			// for a lawyer, distinct from `emailVerified`. Null for other roles.
			// `practicesFederal` drives the Federal/State jurisdiction badge, and
			// `federalVerificationStatus` is here so that badge can say whether the
			// federal standing has actually been checked.
			attorneyProfile: {
				select: {
					verificationStatus: true,
					practicesFederal: true,
					federalVerificationStatus: true,
				},
			},
			// States this attorney has claimed but not had checked yet. Surfaced
			// separately because the badge above reads "verified" as soon as one
			// licence clears, so it alone would never tell the admin a second state
			// is still waiting — they'd only find it by opening the attorney.
			_count: {
				select: {
					admissions: {
						where: {
							verificationStatus: {
								in: ["unverified", "pending", "needs_review"],
							},
						},
					},
				},
			},
		},
	});
}

export async function countUsers(filter: UserListFilter) {
	return prisma.user.count({ where: whereForUsers(filter, new Date()) });
}

/**
 * Counts for the role facet row: for each role, how many accounts you'd get by
 * picking it — with the search and the other filters still applied, but *not*
 * the role filter itself. Leaving the active role out is the whole point: with
 * it applied every other role would read 0, so the counts would stop being a
 * preview of where each pill leads and the row couldn't be used to navigate.
 *
 * `total` is counted rather than summed from the groups so the All pill stays
 * right even if a row's role is null.
 */
export async function userRoleCounts(filter: UserListFilter) {
	const at = new Date();
	// Drop the role (so each pill previews where it leads) and the attorney-only
	// court facet (so it can't drag every other role's count to zero).
	const { role: _ignored, jurisdiction: _court, ...rest } = filter;
	const where = whereForUsers(rest, at);
	const [total, byRole] = await Promise.all([
		prisma.user.count({ where }),
		prisma.user.groupBy({ by: ["role"], where, _count: { _all: true } }),
	]);
	const roles: Record<string, number> = {};
	for (const row of byRole) {
		roles[row.role] = row._count._all;
	}
	return { total, roles };
}

/** Totals for the filter pills in one round trip. */
export async function userCounts() {
	const at = new Date();
	const [total, byRole, blocked] = await Promise.all([
		prisma.user.count(),
		prisma.user.groupBy({ by: ["role"], _count: { _all: true } }),
		prisma.user.count({ where: activeBlockWhere(at) }),
	]);
	const roles: Record<string, number> = {};
	for (const row of byRole) {
		roles[row.role] = row._count._all;
	}
	return { total, roles, blocked };
}

export async function getUserWithCases(id: string) {
	return prisma.user.findUnique({
		where: { id },
		include: {
			// Bar-standing badge for an attorney account, so the admin detail screen
			// can show it and verify from there (JUS-13). Null for every other role.
			attorneyProfile: {
				select: {
					verificationStatus: true,
					verifiedAt: true,
					practicesFederal: true,
					federalVerificationStatus: true,
				},
			},
			cases: {
				where: { deletedAt: null },
				orderBy: { createdAt: "desc" },
				take: 8,
				select: {
					id: true,
					title: true,
					status: true,
					raisedCents: true,
					donorsCount: true,
					createdAt: true,
				},
			},
		},
	});
}

export type BlockUserResult =
	| { ok: true }
	| {
			ok: false;
			code:
				| "not_found"
				| "self_block"
				| "already_blocked"
				| "last_administrator";
	  };

/**
 * Block + session revocation + audit entry commit atomically, and the
 * last-administrator count is read inside the same serializable transaction so
 * two concurrent blocks can't strand the platform with zero active admins.
 */
export async function blockUser(
	actorId: string,
	userId: string,
	reason: string,
	expiresAt?: Date | null,
): Promise<BlockUserResult> {
	return prisma.$transaction(
		async (tx): Promise<BlockUserResult> => {
			const at = new Date();
			const target = await tx.user.findUnique({
				where: { id: userId },
				select: { id: true, role: true, banned: true, banExpires: true },
			});
			if (!target) return { ok: false, code: "not_found" };
			if (target.id === actorId) return { ok: false, code: "self_block" };
			const activelyBlocked =
				target.banned === true &&
				(!target.banExpires || target.banExpires > at);
			if (activelyBlocked) return { ok: false, code: "already_blocked" };

			if (target.role === "administrator") {
				const activeAdmins = await tx.user.count({
					where: { role: "administrator", AND: [notActiveBlockWhere(at)] },
				});
				if (activeAdmins <= 1) {
					return { ok: false, code: "last_administrator" };
				}
			}

			await tx.user.update({
				where: { id: userId },
				data: {
					banned: true,
					banReason: reason,
					banExpires: expiresAt ?? null,
				},
			});
			await tx.session.deleteMany({ where: { userId } });
			await writeAudit(tx, {
				actorId,
				action: "user.blocked",
				targetType: "user",
				targetId: userId,
				reason,
				metadata: expiresAt ? { banExpires: expiresAt.toISOString() } : {},
			});
			return { ok: true };
		},
		{ isolationLevel: "Serializable" },
	);
}

export type UnblockUserResult =
	| { ok: true }
	| { ok: false; code: "not_found" | "not_blocked" };

export async function unblockUser(
	actorId: string,
	userId: string,
): Promise<UnblockUserResult> {
	return prisma.$transaction(async (tx): Promise<UnblockUserResult> => {
		const target = await tx.user.findUnique({
			where: { id: userId },
			select: { id: true, banned: true },
		});
		if (!target) return { ok: false, code: "not_found" };
		if (target.banned !== true) return { ok: false, code: "not_blocked" };

		await tx.user.update({
			where: { id: userId },
			data: { banned: false, banReason: null, banExpires: null },
		});
		await writeAudit(tx, {
			actorId,
			action: "user.unblocked",
			targetType: "user",
			targetId: userId,
		});
		return { ok: true };
	});
}
