import prisma from "./index";

/**
 * Broadcast case-status updates posted to a case, read by every donor backing it
 * (JUS-33).
 *
 * The rule this module keeps — and the reason posting lives here rather than in a
 * form handler — is that **only the two people running a case may post to it**:
 * the plaintiff who owns it and the attorney matched to it. `postCaseUpdate`
 * writes nothing unless the author is one of those, so a hand-rolled request
 * naming another case, or anyone else's id, is refused at this boundary.
 *
 * The author's role is derived, not stored: `authorId === ownerId` is the
 * plaintiff, otherwise it's the matched attorney.
 */

export type CaseUpdateAuthorRole = "attorney" | "plaintiff";

/** An image or file attached to an update. Files live in Blob storage; only this
 *  metadata is stored on the row. */
export type UpdateAttachment = {
	url: string;
	name: string;
	contentType: string;
};

/** Coerce the stored JSON into a clean attachment list, dropping anything that
 *  doesn't have the shape we wrote. */
function parseAttachments(value: unknown): UpdateAttachment[] {
	if (!Array.isArray(value)) return [];
	return value.flatMap((a) => {
		if (a && typeof a === "object" && "url" in a && "name" in a) {
			const o = a as Record<string, unknown>;
			return [
				{
					url: String(o.url),
					name: String(o.name),
					contentType: String(o.contentType ?? ""),
				},
			];
		}
		return [];
	});
}

export type CaseUpdate = {
	id: string;
	body: string;
	createdAt: Date;
	editedAt: Date | null;
	authorId: string;
	authorRole: CaseUpdateAuthorRole;
	authorName: string;
	tag: string | null;
	attachments: UpdateAttachment[];
};

/** Resolve who wrote an update from the case's owner/attorney, since only those
 *  two can author. */
function resolveAuthor(
	authorId: string,
	ownerId: string,
	ownerName: string | null,
	attorneyName: string | null,
): { authorRole: CaseUpdateAuthorRole; authorName: string } {
	return authorId === ownerId
		? { authorRole: "plaintiff", authorName: ownerName || "Plaintiff" }
		: { authorRole: "attorney", authorName: attorneyName || "Your attorney" };
}

export type PostUpdateResult =
	| { ok: true; id: string }
	| { ok: false; reason: "empty" | "not_attached" };

/**
 * Post an update to a case as `authorId`. Succeeds only when `authorId` is the
 * case's owner (plaintiff) or the attorney matched to it; anyone else is refused
 * as `not_attached`. The body is trimmed and an empty one is refused rather than
 * stored. `tag` is an optional category slug.
 */
export async function postCaseUpdate(input: {
	caseId: string;
	authorId: string;
	body: string;
	tag?: string | null;
	attachments?: UpdateAttachment[];
}): Promise<PostUpdateResult> {
	const body = input.body.trim();
	if (!body) return { ok: false, reason: "empty" };

	const c = await prisma.case.findUnique({
		where: { id: input.caseId },
		select: { ownerId: true, match: { select: { attorneyId: true } } },
	});
	if (!c) return { ok: false, reason: "not_attached" };

	const isOwner = c.ownerId === input.authorId;
	const isAttorney = c.match?.attorneyId === input.authorId;
	if (!isOwner && !isAttorney) return { ok: false, reason: "not_attached" };

	const created = await prisma.caseUpdate.create({
		data: {
			caseId: input.caseId,
			authorId: input.authorId,
			body,
			tag: input.tag?.trim() || null,
			attachments: input.attachments?.length ? input.attachments : undefined,
		},
		select: { id: true },
	});
	return { ok: true, id: created.id };
}

export type EditUpdateResult =
	| { ok: true }
	| { ok: false; reason: "empty" | "not_found" };

/**
 * Edit an update's body and tag. Only its author can — the `authorId` in the
 * `where` means someone else's id matches no row and comes back `not_found`.
 * Authorship, timestamps, and attachments are never changed; `editedAt` is
 * stamped so readers can see it was revised.
 */
export async function editCaseUpdate(input: {
	updateId: string;
	authorId: string;
	body: string;
	tag?: string | null;
}): Promise<EditUpdateResult> {
	const body = input.body.trim();
	if (!body) return { ok: false, reason: "empty" };

	const res = await prisma.caseUpdate.updateMany({
		where: { id: input.updateId, authorId: input.authorId },
		data: { body, tag: input.tag?.trim() || null, editedAt: new Date() },
	});
	if (res.count === 0) return { ok: false, reason: "not_found" };
	return { ok: true };
}

/** A case's updates, newest first, each attributed to its real author. */
export async function listCaseUpdates(caseId: string): Promise<CaseUpdate[]> {
	const c = await prisma.case.findUnique({
		where: { id: caseId },
		select: {
			ownerId: true,
			attorneyName: true,
			owner: { select: { name: true } },
		},
	});
	const rows = await prisma.caseUpdate.findMany({
		where: { caseId },
		orderBy: { createdAt: "desc" },
		select: {
			id: true,
			body: true,
			createdAt: true,
			editedAt: true,
			authorId: true,
			tag: true,
			attachments: true,
		},
	});
	return rows.map((r) => ({
		id: r.id,
		body: r.body,
		createdAt: r.createdAt,
		editedAt: r.editedAt,
		authorId: r.authorId,
		tag: r.tag,
		attachments: parseAttachments(r.attachments),
		...resolveAuthor(
			r.authorId,
			c?.ownerId ?? "",
			c?.owner?.name ?? null,
			c?.attorneyName ?? null,
		),
	}));
}

/** How many updates a case has — for a count beside the heading. */
export async function countCaseUpdates(caseId: string): Promise<number> {
	return prisma.caseUpdate.count({ where: { caseId } });
}

export type CaseUpdateNotice = {
	id: string;
	caseId: string;
	caseTitle: string;
	attorneyName: string | null;
	createdAt: Date;
};

/**
 * The plaintiff's *unseen* case updates across all their cases, newest first —
 * the "new update" items in the header bell (JUS-33).
 *
 * "Unseen" is per case: newer than the owner's `ownerUpdatesSeenAt` (or always,
 * if never opened since one landed). The plaintiff's *own* posts are excluded —
 * they don't need notifying about what they wrote — so the bell only ever
 * surfaces updates from their attorney.
 */
export async function listNewUpdatesForPlaintiff(
	ownerId: string,
	take = 15,
): Promise<CaseUpdateNotice[]> {
	const cases = await prisma.case.findMany({
		where: { ownerId, deletedAt: null },
		select: {
			id: true,
			title: true,
			attorneyName: true,
			ownerUpdatesSeenAt: true,
		},
	});
	if (cases.length === 0) return [];

	const rows = await prisma.caseUpdate.findMany({
		where: {
			authorId: { not: ownerId },
			OR: cases.map((c) =>
				c.ownerUpdatesSeenAt
					? { caseId: c.id, createdAt: { gt: c.ownerUpdatesSeenAt } }
					: { caseId: c.id },
			),
		},
		orderBy: { createdAt: "desc" },
		take,
		select: { id: true, caseId: true, createdAt: true },
	});

	const meta = new Map(cases.map((c) => [c.id, c]));
	return rows.map((r) => ({
		id: r.id,
		caseId: r.caseId,
		caseTitle: meta.get(r.caseId)?.title || "Untitled case",
		attorneyName: meta.get(r.caseId)?.attorneyName ?? null,
		createdAt: r.createdAt,
	}));
}

/**
 * Which of a plaintiff's cases have at least one update they haven't seen — for
 * tagging those cards in the My cases list (JUS-33). Excludes the plaintiff's own
 * posts, same as the bell.
 */
export async function caseIdsWithUnseenUpdates(
	ownerId: string,
): Promise<Set<string>> {
	const cases = await prisma.case.findMany({
		where: { ownerId, deletedAt: null },
		select: { id: true, ownerUpdatesSeenAt: true },
	});
	if (cases.length === 0) return new Set();

	const rows = await prisma.caseUpdate.findMany({
		where: {
			authorId: { not: ownerId },
			OR: cases.map((c) =>
				c.ownerUpdatesSeenAt
					? { caseId: c.id, createdAt: { gt: c.ownerUpdatesSeenAt } }
					: { caseId: c.id },
			),
		},
		distinct: ["caseId"],
		select: { caseId: true },
	});
	return new Set(rows.map((r) => r.caseId));
}

/** Mark a case's updates as seen by its owner — stamps `ownerUpdatesSeenAt` to
 *  now, clearing that case's updates from the bell. No-op for non-owners. */
export async function markCaseUpdatesSeenByOwner(
	caseId: string,
	ownerId: string,
) {
	return prisma.case.updateMany({
		where: { id: caseId, ownerId },
		data: { ownerUpdatesSeenAt: new Date() },
	});
}

/** Mark every one of a plaintiff's cases' updates as seen — for the aggregate
 *  "Case updates" screen, which shows all of them at once. */
export async function markAllCaseUpdatesSeenByOwner(ownerId: string) {
	return prisma.case.updateMany({
		where: { ownerId, deletedAt: null },
		data: { ownerUpdatesSeenAt: new Date() },
	});
}

export type BackerUpdate = CaseUpdate & {
	caseId: string;
	caseTitle: string;
};

/**
 * Every update across the cases a donor has backed, newest first — the donor's
 * "Updates" feed. Keyed on the donor's `Donation` rows.
 */
export async function listUpdatesForBacker(
	donorId: string,
	take = 50,
): Promise<BackerUpdate[]> {
	const backed = await prisma.donation.findMany({
		where: { donorId },
		distinct: ["caseId"],
		select: { caseId: true },
	});
	const caseIds = backed.map((d) => d.caseId);
	if (caseIds.length === 0) return [];

	const rows = await prisma.caseUpdate.findMany({
		where: { caseId: { in: caseIds } },
		orderBy: { createdAt: "desc" },
		take,
		select: {
			id: true,
			body: true,
			createdAt: true,
			editedAt: true,
			authorId: true,
			tag: true,
			attachments: true,
			caseId: true,
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
	return rows.map((r) => ({
		id: r.id,
		body: r.body,
		createdAt: r.createdAt,
		editedAt: r.editedAt,
		authorId: r.authorId,
		tag: r.tag,
		attachments: parseAttachments(r.attachments),
		caseId: r.caseId,
		caseTitle: r.case.title || "Untitled case",
		...resolveAuthor(
			r.authorId,
			r.case.ownerId,
			r.case.owner?.name ?? null,
			r.case.attorneyName,
		),
	}));
}

/**
 * Every update across the plaintiff's own cases, newest first — the feed behind
 * the plaintiff's "Case updates" screen, keyed on ownership.
 */
export async function listUpdatesForOwner(
	ownerId: string,
	take = 50,
): Promise<BackerUpdate[]> {
	const rows = await prisma.caseUpdate.findMany({
		where: { case: { ownerId, deletedAt: null } },
		orderBy: { createdAt: "desc" },
		take,
		select: {
			id: true,
			body: true,
			createdAt: true,
			editedAt: true,
			authorId: true,
			tag: true,
			attachments: true,
			caseId: true,
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
	return rows.map((r) => ({
		id: r.id,
		body: r.body,
		createdAt: r.createdAt,
		editedAt: r.editedAt,
		authorId: r.authorId,
		tag: r.tag,
		attachments: parseAttachments(r.attachments),
		caseId: r.caseId,
		caseTitle: r.case.title || "Untitled case",
		...resolveAuthor(
			r.authorId,
			r.case.ownerId,
			r.case.owner?.name ?? null,
			r.case.attorneyName,
		),
	}));
}

export type CaseUpdateGroup = {
	caseId: string;
	title: string;
	category: string;
	location: string;
	status: string;
	attorneyName: string | null;
	coverImageUrl: string | null;
	/** Total updates on the case; `updates` holds only the most recent `perCase`. */
	total: number;
	updates: CaseUpdate[];
};

/**
 * The plaintiff's updates grouped by case — the shape the "Case updates" screen
 * renders, since a plaintiff can run several cases. Each group carries the case's
 * details plus its most recent `perCase` updates and a total. Ordered by
 * most-recent activity.
 */
export async function listCaseUpdateGroupsForOwner(
	ownerId: string,
	perCase = 3,
): Promise<CaseUpdateGroup[]> {
	const [owner, cases] = await Promise.all([
		prisma.user.findUnique({ where: { id: ownerId }, select: { name: true } }),
		prisma.case.findMany({
			where: { ownerId, deletedAt: null, updates: { some: {} } },
			select: {
				id: true,
				title: true,
				category: true,
				location: true,
				status: true,
				attorneyName: true,
				coverImageUrl: true,
				_count: { select: { updates: true } },
				updates: {
					orderBy: { createdAt: "desc" },
					take: perCase,
					select: {
						id: true,
						body: true,
						createdAt: true,
						editedAt: true,
						authorId: true,
						tag: true,
						attachments: true,
					},
				},
			},
		}),
	]);

	return (
		cases
			.map((c) => ({
				caseId: c.id,
				title: c.title || "Untitled case",
				category: c.category,
				location: c.location,
				status: c.status,
				attorneyName: c.attorneyName,
				coverImageUrl: c.coverImageUrl,
				total: c._count.updates,
				updates: c.updates.map((u) => ({
					id: u.id,
					body: u.body,
					createdAt: u.createdAt,
					editedAt: u.editedAt,
					authorId: u.authorId,
					tag: u.tag,
					attachments: parseAttachments(u.attachments),
					...resolveAuthor(
						u.authorId,
						ownerId,
						owner?.name ?? null,
						c.attorneyName,
					),
				})),
			}))
			// Prisma can't order by a related row's field, so sort by each case's newest
			// update in memory — the group list is small (one entry per case).
			.sort(
				(a, b) =>
					(b.updates[0]?.createdAt.getTime() ?? 0) -
					(a.updates[0]?.createdAt.getTime() ?? 0),
			)
	);
}
