import prisma from "./index";

/**
 * The content-moderation service (Reg. & Ops §3–4; Moderation Flag entity).
 *
 * Two things move through here: flags (why something is under suspicion) and the
 * target's visibility (whether it is shown). They are kept separate on purpose —
 * a flag records a concern; only a target's `moderationStatus` hides anything —
 * so the rules about *when* a concern hides content live in one place:
 *
 *   - AI flags hold immediately. Screening runs at publication/post time, so a
 *     held target has not been seen yet and must not be until a human rules.
 *   - Public reports accumulate. One anonymous report cannot take a live campaign
 *     down; the target holds only once `REPORT_HOLD_THRESHOLD` open reports pile
 *     up (an administrator can hold or remove at any point regardless).
 *
 * Nothing here auto-rejects: AI flags hold for review, they never decide.
 */

export type ModerationTargetType = "case" | "update";
export type ModerationSource = "ai" | "report";
export type ModerationResolution = "cleared" | "removed";

/** How many open public reports it takes to auto-hide an already-visible target. */
export const REPORT_HOLD_THRESHOLD = 3;

/** Set a target's visibility gate. */
async function setTargetModeration(
	targetType: ModerationTargetType,
	targetId: string,
	status: "ok" | "held" | "removed",
): Promise<void> {
	if (targetType === "case") {
		await prisma.case.updateMany({
			where: { id: targetId },
			data: { moderationStatus: status },
		});
	} else {
		await prisma.caseUpdate.updateMany({
			where: { id: targetId },
			data: { moderationStatus: status },
		});
	}
}

/** Hold a target only if it is currently clear — never walk `removed` back to held. */
async function holdIfOk(
	targetType: ModerationTargetType,
	targetId: string,
): Promise<void> {
	if (targetType === "case") {
		await prisma.case.updateMany({
			where: { id: targetId, moderationStatus: "ok" },
			data: { moderationStatus: "held" },
		});
	} else {
		await prisma.caseUpdate.updateMany({
			where: { id: targetId, moderationStatus: "ok" },
			data: { moderationStatus: "held" },
		});
	}
}

/** Open flags on a target, optionally only from a given source. */
export async function openFlagCount(
	targetType: ModerationTargetType,
	targetId: string,
	source?: ModerationSource,
): Promise<number> {
	return prisma.moderationFlag.count({
		where: {
			targetType,
			targetId,
			status: "open",
			...(source ? { source } : {}),
		},
	});
}

export type ReportResult =
	| { ok: true; held: boolean }
	| { ok: false; reason: "target_not_found" };

/**
 * A public "report this campaign" (or update). Always records a flag routed to
 * the admin queue; hides the target only once enough open reports accumulate.
 * `reporterId` is set when a signed-in user reports, null when anonymous.
 */
export async function reportTarget(input: {
	targetType: ModerationTargetType;
	targetId: string;
	reason: string;
	reporterId?: string | null;
}): Promise<ReportResult> {
	// Resolve the owning case, and confirm the target exists, before writing.
	let caseId: string;
	if (input.targetType === "case") {
		const c = await prisma.case.findUnique({
			where: { id: input.targetId },
			select: { id: true },
		});
		if (!c) return { ok: false, reason: "target_not_found" };
		caseId = c.id;
	} else {
		const u = await prisma.caseUpdate.findUnique({
			where: { id: input.targetId },
			select: { caseId: true },
		});
		if (!u) return { ok: false, reason: "target_not_found" };
		caseId = u.caseId;
	}

	const reason = input.reason.trim().slice(0, 2000) || "No reason given.";
	await prisma.moderationFlag.create({
		data: {
			targetType: input.targetType,
			targetId: input.targetId,
			caseId,
			source: "report",
			aiGenerated: false,
			category: "report",
			detail: reason,
			reporterId: input.reporterId ?? null,
		},
	});

	// Auto-hide once enough independent reports accumulate — see the threshold note.
	const reports = await openFlagCount(
		input.targetType,
		input.targetId,
		"report",
	);
	if (reports >= REPORT_HOLD_THRESHOLD) {
		await holdIfOk(input.targetType, input.targetId);
		return { ok: true, held: true };
	}
	return { ok: true, held: false };
}

export type ModerationQueueItem = {
	id: string;
	targetType: string;
	targetId: string;
	caseId: string;
	source: string;
	aiGenerated: boolean;
	category: string;
	detail: string;
	confidence: number | null;
	createdAt: Date;
	caseTitle: string;
	caseCategory: string;
	caseLocation: string;
	/** The plaintiff who owns the case. */
	ownerName: string;
	/** For an update flag, who posted the update; null for a campaign flag. */
	authorName: string | null;
	/** A short preview of what is flagged — the case summary or the update body. */
	targetSnippet: string;
	/** Current visibility of the target, so the queue can show held vs. still-live. */
	targetModerationStatus: string;
	caseStatus: string;
};

/** Open flags for the admin queue, newest first, with their target context. */
export async function listModerationQueue(): Promise<ModerationQueueItem[]> {
	const flags = await prisma.moderationFlag.findMany({
		where: { status: "open" },
		orderBy: { createdAt: "desc" },
		select: {
			id: true,
			targetType: true,
			targetId: true,
			caseId: true,
			source: true,
			aiGenerated: true,
			category: true,
			detail: true,
			confidence: true,
			createdAt: true,
		},
	});
	if (flags.length === 0) return [];

	const caseIds = [...new Set(flags.map((f) => f.caseId))];
	const updateIds = [
		...new Set(
			flags.filter((f) => f.targetType === "update").map((f) => f.targetId),
		),
	];
	const [cases, updates] = await Promise.all([
		prisma.case.findMany({
			where: { id: { in: caseIds } },
			select: {
				id: true,
				title: true,
				summary: true,
				category: true,
				location: true,
				status: true,
				moderationStatus: true,
				owner: { select: { name: true } },
			},
		}),
		updateIds.length > 0
			? prisma.caseUpdate.findMany({
					where: { id: { in: updateIds } },
					select: {
						id: true,
						body: true,
						moderationStatus: true,
						authorId: true,
					},
				})
			: Promise.resolve([]),
	]);
	const caseById = new Map(cases.map((c) => [c.id, c]));
	const updateById = new Map(updates.map((u) => [u.id, u]));

	// Resolve update authors' names (a plain id, no relation) in one query.
	const authorIds = [...new Set(updates.map((u) => u.authorId))];
	const authors =
		authorIds.length > 0
			? await prisma.user.findMany({
					where: { id: { in: authorIds } },
					select: { id: true, name: true },
				})
			: [];
	const authorNameById = new Map(authors.map((a) => [a.id, a.name]));

	const snippet = (s: string) =>
		s.length > 160 ? `${s.slice(0, 160).trimEnd()}…` : s;

	return flags.map((f) => {
		const c = caseById.get(f.caseId);
		const u =
			f.targetType === "update" ? updateById.get(f.targetId) : undefined;
		return {
			...f,
			caseTitle: c?.title || "Untitled case",
			caseCategory: c?.category ?? "",
			caseLocation: c?.location ?? "",
			ownerName: c?.owner?.name ?? "A plaintiff",
			authorName: u ? (authorNameById.get(u.authorId) ?? null) : null,
			caseStatus: c?.status ?? "unknown",
			targetSnippet: snippet(u?.body ?? c?.summary ?? ""),
			targetModerationStatus:
				(f.targetType === "update"
					? u?.moderationStatus
					: c?.moderationStatus) ?? "unknown",
		};
	});
}

export type ResolvedModerationItem = {
	id: string;
	targetType: string;
	source: string;
	aiGenerated: boolean;
	category: string;
	caseId: string;
	caseTitle: string;
	resolution: string | null;
	resolvedAt: Date | null;
};

/** Recently resolved flags, for the "Resolved" tab. */
export async function listResolvedModerationFlags(
	take = 30,
): Promise<ResolvedModerationItem[]> {
	const flags = await prisma.moderationFlag.findMany({
		where: { status: "resolved" },
		orderBy: { resolvedAt: "desc" },
		take,
		select: {
			id: true,
			targetType: true,
			source: true,
			aiGenerated: true,
			category: true,
			caseId: true,
			resolution: true,
			resolvedAt: true,
		},
	});
	if (flags.length === 0) return [];
	const cases = await prisma.case.findMany({
		where: { id: { in: [...new Set(flags.map((f) => f.caseId))] } },
		select: { id: true, title: true },
	});
	const titleById = new Map(cases.map((c) => [c.id, c.title]));
	return flags.map((f) => ({
		id: f.id,
		targetType: f.targetType,
		source: f.source,
		aiGenerated: f.aiGenerated,
		category: f.category,
		caseId: f.caseId,
		caseTitle: titleById.get(f.caseId) || "Untitled case",
		resolution: f.resolution,
		resolvedAt: f.resolvedAt,
	}));
}

export type ModerationWeeklyStats = {
	reported: number;
	resolved: number;
	/** Median hours from a report being raised to being ruled on, this week. */
	medianHours: number | null;
};

/**
 * Headline moderation activity over the last 7 days for the "This week" panel:
 * how many reports came in, how many were resolved, and the median time to a
 * ruling (computed in app code — Postgres has no simple median).
 */
export async function moderationWeeklyStats(
	now: Date,
): Promise<ModerationWeeklyStats> {
	const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
	const [reported, resolvedFlags] = await Promise.all([
		prisma.moderationFlag.count({
			where: { createdAt: { gte: weekAgo } },
		}),
		prisma.moderationFlag.findMany({
			where: { status: "resolved", resolvedAt: { gte: weekAgo } },
			select: { createdAt: true, resolvedAt: true },
		}),
	]);

	let medianHours: number | null = null;
	if (resolvedFlags.length > 0) {
		const hours = resolvedFlags
			.map((f) =>
				f.resolvedAt
					? (f.resolvedAt.getTime() - f.createdAt.getTime()) / 3_600_000
					: null,
			)
			.filter((h): h is number => h !== null && h >= 0)
			.sort((a, b) => a - b);
		if (hours.length > 0) {
			const mid = Math.floor(hours.length / 2);
			const lo = hours[mid - 1] ?? hours[mid] ?? 0;
			const hi = hours[mid] ?? 0;
			medianHours = hours.length % 2 === 0 ? (lo + hi) / 2 : hi;
		}
	}

	return {
		reported,
		resolved: resolvedFlags.length,
		medianHours,
	};
}

/** Open-flag count for the admin overview badge. */
export async function moderationQueueCount(): Promise<number> {
	return prisma.moderationFlag.count({ where: { status: "open" } });
}

export type ResolveResult =
	| { ok: true; targetStatus: "ok" | "removed" | "held" }
	| { ok: false; reason: "not_found" | "already_resolved" };

/**
 * An administrator's ruling on a flag. This is the only thing that clears or
 * takes down flagged content — the review the acceptance criteria require.
 *
 *   cleared — the content is fine. If nothing else is still open against the
 *             target, it goes visible again.
 *   removed — the content comes down for good; any other open flags on the same
 *             target are closed with it.
 */
export async function resolveModerationFlag(input: {
	flagId: string;
	adminId: string;
	resolution: ModerationResolution;
	note?: string | null;
}): Promise<ResolveResult> {
	const flag = await prisma.moderationFlag.findUnique({
		where: { id: input.flagId },
		select: { id: true, status: true, targetType: true, targetId: true },
	});
	if (!flag) return { ok: false, reason: "not_found" };
	if (flag.status !== "open") return { ok: false, reason: "already_resolved" };

	const targetType = flag.targetType as ModerationTargetType;
	const note = input.note?.trim() || null;

	await prisma.moderationFlag.update({
		where: { id: flag.id },
		data: {
			status: "resolved",
			resolution: input.resolution,
			resolutionNote: note,
			resolvedAt: new Date(),
			resolvedById: input.adminId,
		},
	});

	if (input.resolution === "removed") {
		// Taking it down closes everything else still open against it.
		await prisma.moderationFlag.updateMany({
			where: { targetType, targetId: flag.targetId, status: "open" },
			data: {
				status: "resolved",
				resolution: "removed",
				resolutionNote: note,
				resolvedAt: new Date(),
				resolvedById: input.adminId,
			},
		});
		await setTargetModeration(targetType, flag.targetId, "removed");
		return { ok: true, targetStatus: "removed" };
	}

	// Cleared: restore visibility only if nothing else is still open.
	const remaining = await openFlagCount(targetType, flag.targetId);
	if (remaining === 0) {
		await setTargetModeration(targetType, flag.targetId, "ok");
		return { ok: true, targetStatus: "ok" };
	}
	return { ok: true, targetStatus: "held" };
}

export type CaseModerationReview = {
	case: {
		id: string;
		title: string;
		summary: string;
		story: string;
		category: string;
		location: string;
		status: string;
		moderationStatus: string;
		coverImageUrl: string | null;
		ownerName: string;
		createdAt: Date;
	};
	flags: {
		id: string;
		targetType: string;
		source: string;
		aiGenerated: boolean;
		category: string;
		detail: string;
		confidence: number | null;
		createdAt: Date;
		/** For an update-target flag, the body of the flagged update. */
		updateBody: string | null;
	}[];
};

/**
 * Everything the campaign review page shows: the case's own content and every
 * open flag against it (its own, plus any on its updates), with the flagged
 * update's text inlined so a moderator can rule without leaving the page.
 */
export async function getCaseModerationReview(
	caseId: string,
): Promise<CaseModerationReview | null> {
	const c = await prisma.case.findUnique({
		where: { id: caseId },
		select: {
			id: true,
			title: true,
			summary: true,
			story: true,
			category: true,
			location: true,
			status: true,
			moderationStatus: true,
			coverImageUrl: true,
			createdAt: true,
			owner: { select: { name: true } },
		},
	});
	if (!c) return null;

	const flags = await prisma.moderationFlag.findMany({
		where: { caseId, status: "open" },
		orderBy: { createdAt: "desc" },
		select: {
			id: true,
			targetType: true,
			targetId: true,
			source: true,
			aiGenerated: true,
			category: true,
			detail: true,
			confidence: true,
			createdAt: true,
		},
	});

	const updateIds = [
		...new Set(
			flags.filter((f) => f.targetType === "update").map((f) => f.targetId),
		),
	];
	const updates =
		updateIds.length > 0
			? await prisma.caseUpdate.findMany({
					where: { id: { in: updateIds } },
					select: { id: true, body: true },
				})
			: [];
	const bodyById = new Map(updates.map((u) => [u.id, u.body]));

	return {
		case: {
			id: c.id,
			title: c.title,
			summary: c.summary,
			story: c.story,
			category: c.category,
			location: c.location,
			status: c.status,
			moderationStatus: c.moderationStatus,
			coverImageUrl: c.coverImageUrl,
			ownerName: c.owner.name,
			createdAt: c.createdAt,
		},
		flags: flags.map((f) => ({
			id: f.id,
			targetType: f.targetType,
			source: f.source,
			aiGenerated: f.aiGenerated,
			category: f.category,
			detail: f.detail,
			confidence: f.confidence,
			createdAt: f.createdAt,
			updateBody:
				f.targetType === "update" ? (bodyById.get(f.targetId) ?? null) : null,
		})),
	};
}

/**
 * Rule on a whole campaign at once — the campaign review page's Keep / Remove.
 *
 * Resolves every open flag on the case (its own and its updates') with the same
 * outcome and the moderator's note, then sets visibility to match: "cleared"
 * makes the case and any held updates visible again; "removed" takes them down.
 * Returns how many flags were closed. A no-op (0) when nothing was open.
 */
export async function resolveCaseModeration(input: {
	caseId: string;
	adminId: string;
	resolution: ModerationResolution;
	note?: string | null;
}): Promise<{ resolved: number }> {
	const note = input.note?.trim() || null;
	const open = await prisma.moderationFlag.findMany({
		where: { caseId: input.caseId, status: "open" },
		select: { id: true, targetType: true, targetId: true },
	});

	await prisma.moderationFlag.updateMany({
		where: { caseId: input.caseId, status: "open" },
		data: {
			status: "resolved",
			resolution: input.resolution,
			resolutionNote: note,
			resolvedAt: new Date(),
			resolvedById: input.adminId,
		},
	});

	const targetStatus = input.resolution === "removed" ? "removed" : "ok";
	await prisma.case.updateMany({
		where: { id: input.caseId },
		data: { moderationStatus: targetStatus },
	});
	const updateIds = [
		...new Set(
			open.filter((f) => f.targetType === "update").map((f) => f.targetId),
		),
	];
	if (updateIds.length > 0) {
		await prisma.caseUpdate.updateMany({
			where: { id: { in: updateIds } },
			data: { moderationStatus: targetStatus },
		});
	}

	return { resolved: open.length };
}
