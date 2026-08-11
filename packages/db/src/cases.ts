import type { CaseStatus } from "../prisma/generated/enums";
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
	/** The plaintiff's thank-you, sent to every donor with their acknowledgement.
	 *
	 *  Three states, not two: a string sets it, `null` clears it, and **absent
	 *  leaves whatever is already there** — see `toData`. */
	thankYouNote?: string | null;
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
		// Spread in only when the caller said something about it, unlike every field
		// above, which is defaulted. `saveDraft` and `publishCase` update in place, so
		// defaulting this to null would let a wizard save that never asked about the
		// note erase one written on the Manage page — a case published, edited there,
		// then re-run through the wizard would go public having silently dropped it.
		// On create, absent simply leaves the column at its own null.
		...(f.thankYouNote !== undefined ? { thankYouNote: f.thankYouNote } : {}),
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
		// Update the owner's own case in place. Deliberately NOT scoped to
		// `status: "draft"`: a case resumed in the wizard after it has moved on
		// (sent to its attorney — `seeking` — or committed — `pending_payout`) is
		// still theirs to save, and — the bug this guards — must never fall through
		// to `create`. It used to: scoped to drafts only, "Save & exit" on a
		// committed case matched nothing and quietly spawned a duplicate draft that
		// carried the attorney's *name* but neither the match nor its payout account,
		// which is what stranded plaintiffs on a fresh case that could never link a
		// payout. `toData` writes content columns only, so status, payout binding and
		// match stay untouched, and the wizard loads every content field, so a
		// round-trip blanks nothing.
		const res = await prisma.case.updateMany({
			where: {
				id: input.id,
				ownerId: input.ownerId,
				deletedAt: null,
				status: { in: ["draft", "seeking", "pending_payout"] },
			},
			data,
		});
		if (res.count > 0) return { id: input.id };
		// The id is one the owner holds but has already gone public or closed. It is
		// not the wizard's to rewrite from here, and must still never be duplicated —
		// return it as-is rather than creating a copy.
		const owned = await prisma.case.findFirst({
			where: { id: input.id, ownerId: input.ownerId, deletedAt: null },
			select: { id: true },
		});
		if (owned) return { id: owned.id };
	}
	const created = await prisma.case.create({
		data: { ownerId: input.ownerId, ...data, status: "draft" },
		select: { id: true },
	});
	return { id: created.id };
}

/**
 * Commit the finished case. It does **not** become public here.
 *
 * The case lands in `pending_payout`: everything the plaintiff owns is settled —
 * story, goal, attorney, agreed fee — and what remains is the one thing they
 * cannot do themselves, their attorney opening this case's Stripe account. Going
 * public before that would put up a campaign with a goal and a progress bar that
 * refuses every donation, which is what this state exists to prevent.
 *
 * `live` is reached from here by `goLiveCase`, and only once that account can
 * actually receive. The ordinary path still feels like one step: the publish
 * action calls `goLiveCase` straight after this, so a case whose firm is already
 * set up goes public in the same request and never visibly passes through here.
 *
 * Updates in place when `id` is given, otherwise creates the case outright.
 */
export async function publishCase(
	input: { ownerId: string; id?: string } & CaseFields,
) {
	const data = {
		...toData(input),
		status: "pending_payout" as const,
		// Stamped on every visibility change, not once — see `goLiveCase`, which
		// re-stamps it when the case actually reaches the public.
		publishedAt: new Date(),
	};
	if (input.id) {
		const res = await prisma.case.updateMany({
			where: {
				id: input.id,
				ownerId: input.ownerId,
				// A case that is already raising must not be walked backwards into a
				// private state by re-running the wizard against its id: donors are on
				// it. `closed` is likewise final. Only the pre-public states publish.
				status: { in: ["draft", "seeking", "pending_payout"] },
			},
			data,
		});
		if (res.count > 0) {
			return { id: input.id, status: "pending_payout" as const };
		}
		// Nothing updated. Either the id belongs to someone else — in which case
		// there is nothing to report and a fresh case is the right answer — or it is
		// this owner's case in a status that refuses to publish, and creating a
		// second copy of it would be the worst possible response.
		const existing = await prisma.case.findFirst({
			where: { id: input.id, ownerId: input.ownerId },
			select: { id: true, status: true },
		});
		if (existing) return existing;
	}
	const created = await prisma.case.create({
		data: { ownerId: input.ownerId, ...data },
		select: { id: true, status: true },
	});
	return created;
}

/**
 * Publish a case out to attorneys. The case becomes `seeking` — no attorney is
 * committed to it, so it is visible to every bar-verified attorney browsing the
 * queue, unless an invitation to a named attorney is still awaiting an answer.
 *
 * Two paths land here: "no attorney yet" (no fee, no attorney fields) and the
 * bring-your-own path, which carries the agreed fee and the plaintiff's typed
 * attorney details and pairs this with an invitation.
 *
 * Updates in place when `id` is given. Returns id + status — **and the caller has
 * to read that status**, because a case that refuses to move is reported rather
 * than duplicated.
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
			where: {
				id: input.id,
				ownerId: input.ownerId,
				// The same allow-list `publishCase` applies, and for the same reason:
				// `seeking` is a *less* public state than `live` and a less committed one
				// than `pending_payout`. Re-running the wizard against the id of a case
				// that is already raising, or already handed to its attorney, must not
				// walk it backwards — donors are on the first and a firm is set up on the
				// second. `closed` is final, and can never reopen.
				status: { in: ["draft", "seeking"] },
			},
			data,
		});
		if (res.count > 0) return { id: input.id, status: "seeking" as const };
		// Nothing updated. Either the id belongs to someone else, in which case a
		// fresh case is the right answer, or it is this owner's case in a status that
		// refuses to publish — and creating a second copy of it would be the worst
		// possible response.
		const existing = await prisma.case.findFirst({
			where: { id: input.id, ownerId: input.ownerId },
			select: { id: true, status: true },
		});
		if (existing) return existing;
	}
	const created = await prisma.case.create({
		data: { ownerId: input.ownerId, ...data },
		select: { id: true, status: true },
	});
	return created;
}

/**
 * Undo a `seeking` publish that never completed — back to a private draft.
 *
 * The bring-your-own path publishes the case and then writes its invitation, and
 * those cannot be one statement. If the second half fails, the case is sitting in
 * a queue every bar-verified attorney reads, with its story and the plaintiff's
 * name, at the moment the screen is telling them nothing was sent. This is how
 * that gets taken back.
 *
 * Refuses anything that has moved on: a match, a bound payout account, or any
 * status other than `seeking`. `publishedAt` is left where it was — the case has
 * been published before and pretending otherwise would rewrite history.
 * Returns whether it took.
 */
export async function revertSeekingToDraft(id: string, ownerId: string) {
	const res = await prisma.case.updateMany({
		where: {
			id,
			ownerId,
			status: "seeking",
			deletedAt: null,
			match: { is: null },
			payoutAccountId: null,
		},
		data: { status: "draft" },
	});
	return res.count > 0;
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
 * The one narrow circumstance in which the plaintiff's typed `attorneyEmail` is
 * enough to reach a case — **an authorization fragment**, not a lookup.
 *
 * `attorneyEmail` is free text the plaintiff entered. It is an assertion about who
 * they intend to instruct, and on its own it proves nothing: the address may be
 * mistyped, the person behind it may never have agreed, may have declined, or may
 * have been replaced. Treating it as a key by itself would hand the story, the
 * evidence and the case's Stripe onboarding to whoever holds that address.
 *
 * So two conditions travel with it everywhere it is used:
 *
 *   - **the case has no `Match`.** A match is settled representation and names a
 *     `User`; where one exists it is the only answer, and the previous designee
 *     must lose access the moment the plaintiff takes someone else forward.
 *     `acceptInterest` overwrites the typed attorney *name* but not the address,
 *     so without this the old one would keep it forever.
 *   - **the case is already committed to that attorney** — `pending_payout`,
 *     `live`, or `closed`. A `draft` is private, and a `seeking` case is one the
 *     plaintiff has published *asking* for representation. Since the invitation
 *     flow, a `seeking` case can carry the typed address while the named attorney
 *     has yet to answer; access before that answer is exactly what the invitation
 *     exists to withhold. Confirming writes the `Match` and moves the case on, and
 *     from there the first branch carries them.
 *
 * Pre-invitation cases keep working: they reached `pending_payout` through
 * `publishCase` with no match, which is precisely what this describes.
 */
export function designatedAttorneyWhere(email: string) {
	return {
		match: { is: null },
		status: { in: ["pending_payout", "live", "closed"] as CaseStatus[] },
		attorneyEmail: { equals: email, mode: "insensitive" as const },
	};
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
 * rather than trusted from the request. Neither an attorney *browsing* the queue
 * nor one who has merely been *named* on a case they have not confirmed is among
 * them — the queue view says documents are shared once you are representing the
 * matter, and this is where that holds. See `designatedAttorneyWhere`.
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
				designatedAttorneyWhere(input.viewerEmail),
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
		where: { status: "live", deletedAt: null, moderationStatus: "ok" },
		orderBy: [{ raisedCents: "desc" }, { publishedAt: "desc" }],
		take,
		include: { owner: { select: { name: true } } },
	});
}

/** A single live case for its public page. Null if not found or not live.
 *  Includes the broadcast updates (newest first) so every donor reading the case
 *  sees the same progress the plaintiff and attorney posted (JUS-33). */
export async function getPublicCase(id: string) {
	return prisma.case.findFirst({
		where: { id, status: "live", deletedAt: null, moderationStatus: "ok" },
		include: {
			// `image` powers the plaintiff's avatar; the matched attorney's photo comes
			// from their directory headshot, falling back to their account avatar.
			owner: { select: { name: true, image: true } },
			match: {
				select: {
					attorney: {
						select: {
							name: true,
							image: true,
							attorneyProfile: { select: { headshotUrl: true } },
						},
					},
				},
			},
			updates: {
				// Held/removed updates are withheld from the public page (Reg. & Ops §3–4).
				where: { moderationStatus: "ok" },
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
			},
		},
	});
}

/**
 * A case a donor can still *read* — live or closed — for looking back on one they
 * backed after it resolves. Same shape as `getPublicCase`, so it renders through
 * the same view; the caller disables donating for a closed case (it's no longer
 * raising). Draft/seeking/pending and moderated-away cases are still nothing here.
 */
export async function getViewableCase(id: string) {
	return prisma.case.findFirst({
		where: {
			id,
			status: { in: ["live", "closed"] },
			deletedAt: null,
			moderationStatus: "ok",
		},
		include: {
			// Same shape as `getPublicCase` (see there) so both render through
			// PublicCaseView — the plaintiff and matched-attorney avatars need images.
			owner: { select: { name: true, image: true } },
			match: {
				select: {
					attorney: {
						select: {
							name: true,
							image: true,
							attorneyProfile: { select: { headshotUrl: true } },
						},
					},
				},
			},
			updates: {
				where: { moderationStatus: "ok" },
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
			},
		},
	});
}

/**
 * Any case, for an administrator's in-dashboard preview from the campaigns table.
 *
 * Unlike `getPublicCase`/`getViewableCase`, this applies no status, moderation, or
 * deleted filter — oversight has to reach a draft, a removed campaign, or a
 * seeking case just the same. The shape is identical to `getPublicCase` so the
 * admin page renders through the very same `PublicCaseView` the donor sees; the
 * updates stay filtered to `ok` so the preview matches the public reading of it.
 */
export async function getCaseForAdmin(id: string) {
	return prisma.case.findFirst({
		where: { id },
		include: {
			owner: { select: { name: true, image: true } },
			match: {
				select: {
					attorney: {
						select: {
							name: true,
							image: true,
							attorneyProfile: { select: { headshotUrl: true } },
						},
					},
				},
			},
			updates: {
				where: { moderationStatus: "ok" },
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
			},
		},
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
		// Never surface content held or removed by moderation (Reg. & Ops §3–4).
		moderationStatus: "ok" as const,
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
		include: {
			owner: { select: { name: true, image: true } },
			// The matched attorney's account — its photo, when there is one.
			match: { select: { attorney: { select: { image: true } } } },
		},
	});
}

/** Total live cases matching the filters — for the Discover result count + pagination. */
export async function countLiveCases(opts?: BrowseFilters) {
	return prisma.case.count({ where: browseWhere(opts) });
}

/** The tabs on the My cases page. */
export type CaseFilter =
	| "all"
	| "active"
	| "draft"
	| "seeking"
	| "pending"
	| "deleted";

/** Prisma `where` for a given filter — "all" and the status tabs exclude
 *  soft-deleted rows; "deleted" shows only them. */
function whereForFilter(ownerId: string, filter: CaseFilter) {
	if (filter === "deleted") return { ownerId, deletedAt: { not: null } };
	const base = { ownerId, deletedAt: null };
	if (filter === "active") return { ...base, status: "live" as const };
	if (filter === "draft") return { ...base, status: "draft" as const };
	if (filter === "seeking") return { ...base, status: "seeking" as const };
	// Finished, private, waiting on the firm. Its own tab rather than folded into
	// "active": these need chasing, and a plaintiff who cannot find them cannot
	// chase them.
	if (filter === "pending") {
		return { ...base, status: "pending_payout" as const };
	}
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
		pending: by("pending_payout"),
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
	/** Null clears it, which sends acknowledgements as a plain confirmation. */
	thankYouNote?: string | null;
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
	if (fields.thankYouNote !== undefined)
		data.thankYouNote = fields.thankYouNote;
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

export type CloseCaseResult =
	| { ok: true }
	| { ok: false; reason: "case_not_found" | "not_live" | "already_closed" };

/**
 * Mark a live case Closed — the plaintiff's act, the counterpart to `goLiveCase`.
 *
 * Only a `live` case closes: closing is "this case has resolved / stopped
 * funding", which draft/seeking/pending_payout cases have never started. The
 * status-conditional `updateMany` (scoped to the owner) makes it idempotent, so a
 * double submit or a retried action closes exactly once — the count decides. It
 * deliberately does **not** touch money: closing acknowledges backers, it does
 * not refund them, and there is nothing here that could.
 */
export async function closeCase(
	id: string,
	ownerId: string,
): Promise<CloseCaseResult> {
	const current = await prisma.case.findFirst({
		where: { id, ownerId, deletedAt: null },
		select: { status: true },
	});
	if (!current) return { ok: false, reason: "case_not_found" };
	if (current.status === "closed")
		return { ok: false, reason: "already_closed" };
	if (current.status !== "live") return { ok: false, reason: "not_live" };

	const res = await prisma.case.updateMany({
		where: { id, ownerId, status: "live", deletedAt: null },
		data: { status: "closed" },
	});
	// Lost the race to a concurrent close — treat as already done, not an error.
	if (res.count === 0) return { ok: false, reason: "already_closed" };
	return { ok: true };
}
