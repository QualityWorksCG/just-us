import type { RequestStatus } from "../prisma/generated/enums";
import prisma from "./index";

/**
 * The attorney-facing "Seeking Representation" queue and the expression of
 * interest it produces (JUS-25).
 *
 * Three rules live here rather than in the UI, because each of them is a promise
 * the product makes and a screen is not where a promise can be kept:
 *
 *   1. Only `seeking` cases that nobody is representing yet are in the queue. A
 *      case that is matched, funding, draft, closed, or deleted is not visible to
 *      a browsing attorney at all.
 *   2. An attorney sees the case as the plaintiff published it to attorneys —
 *      story, evidence, and who they are — but never a way to reach them. See
 *      `cardSelect` and `detailSelect` for exactly where that line falls.
 *   3. Expressing interest writes a bare record and stops. It opens no channel
 *      and carries no message; the plaintiff sees it on their dashboard and
 *      decides whether to make contact.
 *
 * Ordering is by date only. There is no relevance score and no per-attorney
 * ranking, for the same reason the directory has none the other way round.
 */

export type QueueSort = "newest" | "oldest";

export type QueueFilters = {
	/** A case category, or undefined for all. */
	category?: string;
	/** A US state, matched against the case's own location. */
	state?: string;
	sort?: QueueSort;
};

/**
 * What a queue *card* carries — enough to scan the list and decide what to open.
 *
 * Both selects here are allow-lists rather than omit-lists, so a column added to
 * `Case` later is withheld by default instead of silently reaching attorneys.
 *
 * The long-form `story`, the evidence, and the images are deliberately not here:
 * a list does not need them, and pulling every case's full narrative to render
 * summaries would be wasteful as well as needlessly broad. They live on
 * `detailSelect`, which one case at a time.
 */
const cardSelect = {
	id: true,
	title: true,
	category: true,
	location: true,
	summary: true,
	publishedAt: true,
	createdAt: true,
	// Who is asking for help. An attorney weighing whether to take a matter on is
	// entitled to know whose matter it is — the name, not a way to reach them.
	owner: { select: { name: true } },
} as const;

/**
 * What an attorney may see when they open one case.
 *
 * The plaintiff published this case *to attorneys*, so bar-verified attorneys see
 * the matter as it stands: the full account, the evidence attached to it, and the
 * plaintiff's name. An attorney cannot judge a case from a one-line summary, and
 * being asked to would either stop them putting themselves forward or have them
 * do it blind.
 *
 * What stays withheld is the means of contact, not the substance:
 * `attorneyEmail` and `attorneyPhone` (the plaintiff's own contact details, held
 * for an attorney they invite directly), `payoutType` and the funding figures.
 * The plaintiff's email and id are not selected either — only their name. The
 * plaintiff must be the one to open the conversation (JUS-25), and that rule is
 * kept by there being nothing here to reach them with.
 */
const detailSelect = {
	...cardSelect,
	story: true,
	evidence: true,
	coverImageUrl: true,
	images: true,
} as const;

/**
 * A case is in the queue only while it is genuinely seeking representation.
 *
 * Two independent checks stand for "not already matched", because there are two
 * ways a case can have an attorney: `match` is the record this story writes, and
 * `attorneyName` catches the bring-your-own path (JUS-23), which sets an attorney
 * on the case directly without one. Either one present means the case is spoken
 * for, and neither implies the other.
 */
function queueWhere(filters: QueueFilters = {}) {
	return {
		status: "seeking" as const,
		deletedAt: null,
		match: { is: null },
		attorneyName: null,
		...(filters.category ? { category: filters.category } : {}),
		...(filters.state ? { location: filters.state } : {}),
	};
}

/** This attorney's own expression of interest on a case, if they have made one.
 *  Lets a card or the detail view show where it stands instead of offering the
 *  action again — and it is scoped to the asking attorney, so it says nothing
 *  about who else is interested. How many other attorneys are competing is not
 *  the browsing attorney's business, and knowing would invite gaming the queue. */
export type MyInterestOnCase = {
	status: RequestStatus;
	createdAt: Date;
} | null;

export type QueueCase = {
	id: string;
	title: string;
	category: string;
	/** The state the case is in — `Case.location`. */
	state: string;
	summary: string;
	/** The plaintiff's name. Their name only — never a way to contact them. */
	plaintiffName: string;
	/** When the plaintiff published it out to attorneys. */
	publishedAt: Date | null;
	createdAt: Date;
	myInterest: MyInterestOnCase;
};

/**
 * The queue as one attorney sees it, filtered and ordered as asked.
 *
 * `attorneyId` is required rather than optional: every read of the queue is on
 * behalf of a specific attorney, and it is what scopes `myInterest` to them.
 */
export async function listSeekingQueue(
	attorneyId: string,
	filters: QueueFilters = {},
): Promise<QueueCase[]> {
	const rows = await prisma.case.findMany({
		where: queueWhere(filters),
		select: {
			...cardSelect,
			requests: {
				where: { attorneyId },
				select: { status: true, createdAt: true },
			},
		},
		orderBy: [
			{ publishedAt: filters.sort === "oldest" ? "asc" : "desc" },
			{ createdAt: filters.sort === "oldest" ? "asc" : "desc" },
		],
		take: 60,
	});

	return rows.map(({ requests, location, owner, ...row }) => ({
		...row,
		state: location,
		plaintiffName: owner.name,
		myInterest: requests[0] ?? null,
	}));
}

export type QueueCaseDetail = QueueCase & {
	/** The plaintiff's full account of what happened. */
	story: string;
	/** Attached evidence as `[{ name, size }]` — metadata only; the files
	 *  themselves aren't stored yet (see `Case.evidence`). */
	evidence: { name: string; size: number }[];
	coverImageUrl: string | null;
	images: string[];
};

/**
 * One queued case in full, for the attorney case view.
 *
 * Gated on the same `queueWhere` predicate as the list rather than on the id
 * alone, so a case that has since been matched, published live, withdrawn, or
 * deleted stops being readable at the moment it leaves the queue — including for
 * an attorney who already had the link. Returns null in that case, which the
 * route turns into a 404.
 */
export async function getQueueCase(
	caseId: string,
	attorneyId: string,
): Promise<QueueCaseDetail | null> {
	const row = await prisma.case.findFirst({
		where: { ...queueWhere(), id: caseId },
		select: {
			...detailSelect,
			requests: {
				where: { attorneyId },
				select: { status: true, createdAt: true },
			},
		},
	});
	if (!row) return null;

	const { requests, location, owner, evidence, ...rest } = row;
	return {
		...rest,
		state: location,
		plaintiffName: owner.name,
		// Stored as Json, so its shape is asserted here rather than trusted.
		evidence: Array.isArray(evidence)
			? (evidence as { name: string; size: number }[])
			: [],
		myInterest: requests[0] ?? null,
	};
}

/** Categories that actually have a queued case, so the filter never offers a
 *  choice that returns nothing. Derived from the queue rather than a hardcoded
 *  list, which is also what keeps it in step with whatever the wizard offers. */
export async function queueCategories(): Promise<string[]> {
	const rows = await prisma.case.groupBy({
		by: ["category"],
		where: queueWhere(),
	});
	return rows
		.map((row) => row.category)
		.filter(Boolean)
		.sort();
}

/** States that actually have a queued case. */
export async function queueStates(): Promise<string[]> {
	const rows = await prisma.case.groupBy({
		by: ["location"],
		where: queueWhere(),
	});
	return rows
		.map((row) => row.location)
		.filter(Boolean)
		.sort();
}

/**
 * Why an expression of interest was refused. Returned rather than thrown so the
 * caller can say something true to the attorney — "that case has been taken" and
 * "your bar standing isn't verified yet" need different words and different
 * next steps.
 */
export type ExpressInterestFailure =
	| "not_verified"
	| "unavailable"
	| "already_expressed";

export type ExpressInterestResult =
	| { ok: true; interestId: string }
	| { ok: false; reason: ExpressInterestFailure };

/**
 * Record an attorney's interest in representing a seeking case.
 *
 * There is no message parameter, and adding one later would break the promise
 * this whole path rests on: the plaintiff must be the one to initiate contact,
 * so an attorney has no way to say anything to them here. What the plaintiff
 * sees is that this attorney is interested, plus their public directory profile.
 *
 * Verified bar standing is required to express interest at all. JUS-24 only
 * demands the check at the point of matching for this path, and `acceptInterest`
 * still makes it there — standing can lapse in between, which is exactly why
 * that check exists. Checking here as well is the stricter reading, and it keeps
 * a plaintiff from being shown an expression of interest they would not be
 * allowed to accept.
 */
export async function expressInterest(
	caseId: string,
	attorneyId: string,
): Promise<ExpressInterestResult> {
	const profile = await prisma.attorneyProfile.findUnique({
		where: { userId: attorneyId },
		select: { verificationStatus: true },
	});
	if (profile?.verificationStatus !== "verified") {
		return { ok: false, reason: "not_verified" };
	}

	// Re-checked against the queue predicate rather than trusting the id the
	// client sent: the case may have been matched, funded, or withdrawn since the
	// page rendered, and a stale button must not be able to reach it.
	const target = await prisma.case.findFirst({
		where: { ...queueWhere(), id: caseId },
		select: { id: true },
	});
	if (!target) return { ok: false, reason: "unavailable" };

	const existing = await prisma.attorneyRequest.findUnique({
		where: { caseId_attorneyId: { caseId, attorneyId } },
		select: { id: true },
	});
	if (existing) return { ok: false, reason: "already_expressed" };

	try {
		const created = await prisma.attorneyRequest.create({
			data: { caseId, attorneyId },
			select: { id: true },
		});
		return { ok: true, interestId: created.id };
	} catch {
		// Unique violation — two clicks racing each other. The second one is a
		// no-op, and the attorney's interest is on record either way.
		return { ok: false, reason: "already_expressed" };
	}
}

/**
 * An attorney's own expressions of interest, newest first, with the public shape
 * of each case.
 *
 * This is the only place a matched case stays visible to the attorney who was
 * chosen — the queue itself drops it the moment it is matched, so without this
 * an attorney would watch their interest disappear without being told what came
 * of it.
 */
export type MyInterest = Awaited<ReturnType<typeof listMyInterests>>[number];

export async function listMyInterests(attorneyId: string) {
	const rows = await prisma.attorneyRequest.findMany({
		where: { attorneyId },
		orderBy: { createdAt: "desc" },
		select: {
			id: true,
			status: true,
			createdAt: true,
			case: { select: cardSelect },
		},
	});

	return rows.map((row) => ({
		id: row.id,
		status: row.status,
		createdAt: row.createdAt,
		case: {
			id: row.case.id,
			title: row.case.title,
			category: row.case.category,
			state: row.case.location,
			summary: row.case.summary,
			plaintiffName: row.case.owner.name,
		},
	}));
}

/**
 * The cases an attorney is representing, newest match first.
 *
 * Scoped to the asking attorney, and unlike the queue it carries the funding
 * figures: `queueWhere` withholds them from an attorney who is only browsing,
 * while an attorney matched to a case is entitled to know how its fee is coming
 * along. Contact details stay withheld either way — `cardSelect` has none.
 */
export async function listAttorneyMatches(attorneyId: string, take?: number) {
	const rows = await prisma.match.findMany({
		where: { attorneyId, case: { deletedAt: null } },
		orderBy: { createdAt: "desc" },
		take,
		select: {
			id: true,
			origin: true,
			createdAt: true,
			case: {
				select: {
					...cardSelect,
					status: true,
					goalCents: true,
					raisedCents: true,
					donorsCount: true,
				},
			},
		},
	});

	return rows.map((row) => ({
		matchId: row.id,
		origin: row.origin,
		matchedAt: row.createdAt,
		case: {
			id: row.case.id,
			title: row.case.title,
			category: row.case.category,
			state: row.case.location,
			summary: row.case.summary,
			status: row.case.status,
			plaintiffName: row.case.owner.name,
			goalCents: row.case.goalCents,
			raisedCents: row.case.raisedCents,
			donorsCount: row.case.donorsCount,
		},
	}));
}

/** An attorney's interest tally by status, for the queue's summary row. */
export async function interestCounts(attorneyId: string) {
	const grouped = await prisma.attorneyRequest.groupBy({
		by: ["status"],
		where: { attorneyId },
		_count: { _all: true },
	});
	const by = (status: RequestStatus) =>
		grouped.find((row) => row.status === status)?._count._all ?? 0;
	return {
		total: grouped.reduce((sum, row) => sum + row._count._all, 0),
		// pending + viewed are both still awaiting the plaintiff's decision; the
		// split only matters to the plaintiff, so the attorney sees them as one.
		awaiting: by("pending") + by("viewed"),
		accepted: by("accepted"),
		declined: by("declined"),
	};
}
