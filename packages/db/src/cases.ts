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
	/** Evidence: an uploaded document (`kind: "file"`, with the storage URL and
	 *  byte size) or an address the plaintiff pasted (`kind: "link"`). Rows written
	 *  before evidence was stored carry neither `kind` nor `url` — see
	 *  `caseEvidence`, which is the only thing that should read this shape. */
	evidence?: {
		name: string;
		size?: number;
		url?: string;
		kind?: "file" | "link";
	}[];
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

/**
 * Evidence as a screen should render it.
 *
 * `Case.evidence` is Json written by the wizard across three eras, so its shape is
 * normalised here rather than asserted at each of the half-dozen places that show
 * it:
 *
 *  - **file** — an uploaded document. `href` is the app's own authorized route,
 *    never the storage URL: a Vercel Blob URL is readable by anyone holding it, so
 *    the URL itself is the credential and it stays server-side. See
 *    `caseEvidenceFile`, which is what that route calls.
 *  - **link** — an address the plaintiff pasted. Theirs, external, and safe to
 *    hand out as-is.
 *  - **record** — filed before documents were stored, so there is a name and a
 *    size and nothing to open. Rendering it as a link would promise a file that
 *    was never kept.
 */
export type CaseEvidence = {
	name: string;
	/** Bytes, when it was an upload. */
	size: number | null;
	kind: "file" | "link" | "record";
	/** Where to send the viewer, or null for a `record`. */
	href: string | null;
};

type StoredEvidence = {
	name?: unknown;
	size?: unknown;
	url?: unknown;
	kind?: unknown;
};

/** The stored rows, filtered to the ones with a usable name. Index is preserved
 *  because it is what the serving route addresses a file by. */
function storedEvidence(json: unknown): { item: StoredEvidence; at: number }[] {
	if (!Array.isArray(json)) return [];
	return json
		.map((item, at) => ({ item: (item ?? {}) as StoredEvidence, at }))
		.filter(
			({ item }) => typeof item.name === "string" && item.name.length > 0,
		);
}

/**
 * Which of the three an entry is.
 *
 * `kind` is written explicitly from now on. Older rows are inferred, and the
 * inference is deliberately conservative: only an entry with a URL *and* no byte
 * size was a pasted link, because that is the one combination the wizard could
 * produce for a link. Anything else with a URL is a stored document, and anything
 * without one cannot be opened at all.
 */
function kindOf(item: StoredEvidence): CaseEvidence["kind"] {
	if (item.kind === "file" || item.kind === "link") return item.kind;
	if (typeof item.url !== "string" || !item.url) return "record";
	return typeof item.size === "number" ? "file" : "link";
}

export function caseEvidence(json: unknown, caseId: string): CaseEvidence[] {
	return storedEvidence(json).map(({ item, at }) => {
		const kind = kindOf(item);
		return {
			name: item.name as string,
			size: typeof item.size === "number" ? item.size : null,
			kind,
			href:
				kind === "link"
					? (item.url as string)
					: kind === "file"
						? `/api/cases/${caseId}/evidence/${at}`
						: null,
		};
	});
}

/**
 * One evidence document, for the route that serves it — **the authorization
 * check** for reading a plaintiff's filings.
 *
 * Two people may open a case's documents: the plaintiff who filed them, and the
 * attorney actually representing the case. Both are re-derived from the case row
 * rather than trusted from the request, and an attorney *browsing* the queue is
 * deliberately not among them — the queue view says documents are shared once you
 * are representing the matter, and this is where that holds.
 *
 * Returns null for every failure — wrong case, wrong viewer, no such entry, an
 * entry that is not a stored file — so the caller answers all of them with a 404
 * and nothing here reveals whether a case exists.
 */
export async function caseEvidenceFile(input: {
	caseId: string;
	index: number;
	viewerId: string;
	/** The viewer's account email, for the bring-your-own attorney link. */
	viewerEmail: string;
}): Promise<{ name: string; url: string } | null> {
	const kase = await prisma.case.findFirst({
		where: {
			id: input.caseId,
			deletedAt: null,
			OR: [
				{ ownerId: input.viewerId },
				{ match: { attorneyId: input.viewerId } },
				{ attorneyEmail: { equals: input.viewerEmail, mode: "insensitive" } },
			],
		},
		select: { evidence: true },
	});
	if (!kase) return null;

	const entry = storedEvidence(kase.evidence).find(
		({ at }) => at === input.index,
	);
	if (!entry || kindOf(entry.item) !== "file") return null;
	const url = entry.item.url;
	return typeof url === "string" && url
		? { name: entry.item.name as string, url }
		: null;
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

/** Filtered/sorted live cases for the public "Browse cases" directory. */
export async function browseLiveCases(opts?: {
	q?: string;
	state?: string;
	category?: string;
	sort?: "trending" | "funded" | "newest";
}) {
	const q = opts?.q?.trim();
	return prisma.case.findMany({
		where: {
			status: "live",
			deletedAt: null,
			...(opts?.state ? { location: opts.state } : {}),
			...(opts?.category ? { category: opts.category } : {}),
			...(q
				? {
						OR: [
							{ title: { contains: q, mode: "insensitive" } },
							{ summary: { contains: q, mode: "insensitive" } },
							{ story: { contains: q, mode: "insensitive" } },
							{ location: { contains: q, mode: "insensitive" } },
							{ category: { contains: q, mode: "insensitive" } },
							{ attorneyName: { contains: q, mode: "insensitive" } },
						],
					}
				: {}),
		},
		orderBy:
			opts?.sort === "funded"
				? { raisedCents: "desc" as const }
				: opts?.sort === "newest"
					? { publishedAt: "desc" as const }
					: { donorsCount: "desc" as const },
		take: 60,
		include: { owner: { select: { name: true } } },
	});
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
