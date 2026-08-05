import prisma from "./index";

export type CaseAttorney = {
	name?: string;
	firm?: string;
	area?: string;
	location?: string;
	email?: string;
	phone?: string;
};

/** Every field the wizard can capture. All optional so a half-finished draft is
 *  valid; required DB columns fall back to empty/zero via `toData`. */
export type CaseFields = {
	title?: string;
	category?: string;
	/** US state the case is in. */
	location?: string;
	summary?: string;
	story?: string;
	/** Agreed attorney fee — the funding goal — in whole cents. */
	goalCents?: number;
	/** How the plaintiff receives raised funds. */
	payoutType?: string | null;
	attorney?: CaseAttorney | null;
	/** Evidence: uploaded files (name + size) or links (name + url). Files aren't
	 *  stored yet — only their metadata. */
	evidence?: { name: string; size?: number; url?: string }[];
	/** Vercel Blob URL of the cover image. */
	coverImageUrl?: string | null;
	/** Vercel Blob URLs of the gallery images. */
	images?: string[];
};

function toData(f: CaseFields) {
	return {
		title: f.title ?? "",
		category: f.category ?? "",
		location: f.location ?? "",
		summary: f.summary ?? "",
		story: f.story ?? "",
		goalCents: f.goalCents ?? 0,
		payoutType: f.payoutType ?? null,
		attorneyName: f.attorney?.name ?? null,
		attorneyFirm: f.attorney?.firm ?? null,
		attorneyArea: f.attorney?.area ?? null,
		attorneyLocation: f.attorney?.location ?? null,
		attorneyEmail: f.attorney?.email ?? null,
		attorneyPhone: f.attorney?.phone ?? null,
		evidence: f.evidence ?? [],
		coverImageUrl: f.coverImageUrl ?? null,
		images: f.images ?? [],
	};
}

/**
 * Save the wizard's current fields as a draft, so "Save & exit" can be resumed.
 * Updates the existing draft when `id` is given (and still owned + a draft),
 * otherwise creates a fresh one. Returns the draft id.
 */
export async function saveDraft(
	input: { ownerId: string; id?: string } & CaseFields,
) {
	const data = toData(input);
	if (input.id) {
		const res = await prisma.case.updateMany({
			where: { id: input.id, ownerId: input.ownerId, status: "draft" },
			data,
		});
		if (res.count > 0) return { id: input.id };
	}
	const created = await prisma.case.create({
		data: { ownerId: input.ownerId, ...data, status: "draft" },
		select: { id: true },
	});
	return { id: created.id };
}

/**
 * Publish a case live — no human review step. Updates the draft in place when
 * `id` is given, otherwise creates the case outright. Returns id + status.
 */
export async function publishCase(
	input: { ownerId: string; id?: string } & CaseFields,
) {
	const data = {
		...toData(input),
		status: "live" as const,
		publishedAt: new Date(),
	};
	if (input.id) {
		const res = await prisma.case.updateMany({
			where: { id: input.id, ownerId: input.ownerId },
			data,
		});
		if (res.count > 0) return { id: input.id, status: "live" as const };
	}
	const created = await prisma.case.create({
		data: { ownerId: input.ownerId, ...data },
		select: { id: true, status: true },
	});
	return created;
}

/**
 * Publish a case out to attorneys (the "no attorney yet" path). The case
 * becomes `seeking` — visible to attorneys who can request it — without a
 * funding goal, which is set once an attorney is chosen. Updates in place when
 * `id` is given. Returns id + status.
 */
export async function publishForAttorneys(
	input: { ownerId: string; id?: string } & CaseFields,
) {
	const data = {
		...toData(input),
		status: "seeking" as const,
		publishedAt: new Date(),
	};
	if (input.id) {
		const res = await prisma.case.updateMany({
			where: { id: input.id, ownerId: input.ownerId },
			data,
		});
		if (res.count > 0) return { id: input.id, status: "seeking" as const };
	}
	const created = await prisma.case.create({
		data: { ownerId: input.ownerId, ...data },
		select: { id: true, status: true },
	});
	return created;
}

/** The plaintiff's most recent in-progress draft, if any, to resume. */
export async function getResumableDraft(ownerId: string) {
	return prisma.case.findFirst({
		where: { ownerId, status: "draft", deletedAt: null },
		orderBy: { updatedAt: "desc" },
	});
}

/** A specific case owned by the plaintiff — used to resume a chosen draft. */
export async function getOwnedCase(id: string, ownerId: string) {
	return prisma.case.findFirst({ where: { id, ownerId } });
}

/** Live, publicly-fundable cases for the landing page + directory. Most-funded
 *  first. Includes the plaintiff's name for display. */
export async function listLiveCases(take = 6) {
	return prisma.case.findMany({
		where: { status: "live", deletedAt: null },
		orderBy: [{ raisedCents: "desc" }, { publishedAt: "desc" }],
		take,
		include: { owner: { select: { name: true } } },
	});
}

/** A single live case for its public page. Null if not found or not live. */
export async function getPublicCase(id: string) {
	return prisma.case.findFirst({
		where: { id, status: "live", deletedAt: null },
		include: { owner: { select: { name: true } } },
	});
}

export type BrowseFilters = {
	q?: string;
	state?: string;
	category?: string;
	sort?: "trending" | "funded" | "newest";
};

/** Prisma `where` for the public "Browse cases" directory — live, non-deleted,
 *  matching the optional state/category/search filters. */
function browseWhere(opts?: BrowseFilters) {
	const q = opts?.q?.trim();
	return {
		status: "live" as const,
		deletedAt: null,
		...(opts?.state ? { location: opts.state } : {}),
		...(opts?.category ? { category: opts.category } : {}),
		...(q
			? {
					OR: [
						{ title: { contains: q, mode: "insensitive" as const } },
						{ summary: { contains: q, mode: "insensitive" as const } },
						{ story: { contains: q, mode: "insensitive" as const } },
						{ location: { contains: q, mode: "insensitive" as const } },
						{ category: { contains: q, mode: "insensitive" as const } },
						{ attorneyName: { contains: q, mode: "insensitive" as const } },
					],
				}
			: {}),
	};
}

/** Filtered/sorted live cases for the "Browse"/"Discover" directory. Pass
 *  skip/take to paginate (defaults to the first 60). */
export async function browseLiveCases(
	opts?: BrowseFilters & { skip?: number; take?: number },
) {
	return prisma.case.findMany({
		where: browseWhere(opts),
		orderBy:
			opts?.sort === "funded"
				? { raisedCents: "desc" as const }
				: opts?.sort === "newest"
					? { publishedAt: "desc" as const }
					: { donorsCount: "desc" as const },
		skip: opts?.skip,
		take: opts?.take ?? 60,
		include: { owner: { select: { name: true } } },
	});
}

/** Total live cases matching the filters — for the Discover result count + pagination. */
export async function countLiveCases(opts?: BrowseFilters) {
	return prisma.case.count({ where: browseWhere(opts) });
}

/** The tabs on the My cases page. */
export type CaseFilter = "all" | "active" | "draft" | "seeking" | "deleted";

/** Prisma `where` for a given filter — "all" and the status tabs exclude
 *  soft-deleted rows; "deleted" shows only them. */
function whereForFilter(ownerId: string, filter: CaseFilter) {
	if (filter === "deleted") return { ownerId, deletedAt: { not: null } };
	const base = { ownerId, deletedAt: null };
	if (filter === "active") return { ...base, status: "live" as const };
	if (filter === "draft") return { ...base, status: "draft" as const };
	if (filter === "seeking") return { ...base, status: "seeking" as const };
	return base;
}

/** A plaintiff's own cases, newest first. Excludes deleted unless the filter is
 *  "deleted". Pass skip/take to paginate. */
export async function listOwnedCases(
	ownerId: string,
	opts?: { skip?: number; take?: number; filter?: CaseFilter },
) {
	return prisma.case.findMany({
		where: whereForFilter(ownerId, opts?.filter ?? "all"),
		orderBy: { createdAt: "desc" },
		include: { match: { select: { attorneyId: true } } },
		skip: opts?.skip,
		take: opts?.take,
	});
}

/** Number of a plaintiff's cases matching a filter — for pagination. */
export async function countOwnedCases(
	ownerId: string,
	filter: CaseFilter = "all",
) {
	return prisma.case.count({ where: whereForFilter(ownerId, filter) });
}

/** Case totals per filter tab, in one round-trip (+ the deleted count). */
export async function caseCounts(ownerId: string) {
	const [grouped, deleted] = await Promise.all([
		prisma.case.groupBy({
			by: ["status"],
			where: { ownerId, deletedAt: null },
			_count: { _all: true },
		}),
		prisma.case.count({ where: { ownerId, deletedAt: { not: null } } }),
	]);
	const by = (status: string) =>
		grouped.find((g) => g.status === status)?._count._all ?? 0;
	const all = grouped.reduce((sum, g) => sum + g._count._all, 0);
	return {
		all,
		active: by("live"),
		draft: by("draft"),
		seeking: by("seeking"),
		deleted,
	};
}

/** Fields editable from the Manage-case page (status/attorney/fee unchanged). */
export type CaseEditFields = {
	title?: string;
	category?: string;
	location?: string;
	summary?: string;
	story?: string;
	coverImageUrl?: string | null;
	images?: string[];
};

/** Update editable fields on an owned, non-deleted case, preserving its status.
 *  Only the keys provided are written. Returns count. */
export async function updateOwnedCase(
	id: string,
	ownerId: string,
	fields: CaseEditFields,
) {
	const data: Record<string, unknown> = {};
	if (fields.title !== undefined) data.title = fields.title;
	if (fields.category !== undefined) data.category = fields.category;
	if (fields.location !== undefined) data.location = fields.location;
	if (fields.summary !== undefined) data.summary = fields.summary;
	if (fields.story !== undefined) data.story = fields.story;
	if (fields.coverImageUrl !== undefined)
		data.coverImageUrl = fields.coverImageUrl;
	if (fields.images !== undefined) data.images = fields.images;
	return prisma.case.updateMany({
		where: { id, ownerId, deletedAt: null },
		data,
	});
}

/** Soft-delete an owned draft (sets deletedAt). Only drafts are removable this
 *  way. Returns count. */
export async function deleteDraft(id: string, ownerId: string) {
	return prisma.case.updateMany({
		where: { id, ownerId, status: "draft", deletedAt: null },
		data: { deletedAt: new Date() },
	});
}

/** Bump an owned case's share counter (owner shared it). Returns count. */
export async function incrementShareCount(id: string, ownerId: string) {
	return prisma.case.updateMany({
		where: { id, ownerId, deletedAt: null },
		data: { sharesCount: { increment: 1 } },
	});
}

/** Soft-delete any owned case regardless of status — used by the Manage page. */
export async function softDeleteCase(id: string, ownerId: string) {
	return prisma.case.updateMany({
		where: { id, ownerId, deletedAt: null },
		data: { deletedAt: new Date() },
	});
}

/** Restore a previously soft-deleted case. Returns count. */
export async function restoreCase(id: string, ownerId: string) {
	return prisma.case.updateMany({
		where: { id, ownerId, deletedAt: { not: null } },
		data: { deletedAt: null },
	});
}
