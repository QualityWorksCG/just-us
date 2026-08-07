import type {
	CaseStatus,
	MatchOrigin,
	RequestStatus,
} from "../prisma/generated/enums";
import { type CaseEvidence, caseEvidence } from "./cases";
import prisma from "./index";

/**
 * The attorney-facing "Seeking Representation" queue, the expression of interest
 * it produces (JUS-25), and the cases an attorney ends up representing.
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
	/**
	 * What the plaintiff filed — **names and sizes only, deliberately**.
	 *
	 * An attorney browsing the queue is deciding whether to put themselves
	 * forward, not yet acting on the matter, and the screen tells them the
	 * documents are shared once they are representing it. So neither the storage
	 * URL nor the app's own evidence route reaches this view: the promise is kept
	 * by there being nothing here to open, rather than by a component choosing not
	 * to render a link. The representing attorney gets the files — see
	 * `getAttorneyCase`.
	 */
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
		// Normalised, then stripped back to name and size: whatever the stored row
		// carries, a browsing attorney is handed no way to reach a document.
		evidence: caseEvidence(evidence, row.id).map((file) => ({
			name: file.name,
			size: file.size ?? 0,
		})),
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
 * The cases an attorney is actually acting on — their "My cases" screen.
 *
 * Two routes attach an attorney to a case, and both count, because both can fund:
 * an accepted expression of interest writes a `Match`, and the bring-your-own path
 * (JUS-23) writes only the plaintiff's chosen `attorneyEmail`. The same pair is
 * what the payout layer binds money on, so a case that can pay this attorney is a
 * case that appears here.
 *
 * Drafts are excluded. A draft is private to the plaintiff — it is not published
 * to anyone, including an attorney named in it — and there is nothing an attorney
 * can do about a case that has not been sent out.
 *
 * What is withheld is the same line the queue draws, moved: the plaintiff's *name*
 * and account id come back, because this is their client and messaging needs the
 * id, but their email and phone never do. An attorney still cannot open the
 * conversation — `startConversationAction` is plaintiff-only — so what the id buys
 * is the ability to open a thread the client already started.
 */
function myCasesWhere(userId: string, email: string) {
	return {
		deletedAt: null,
		status: { in: ["seeking", "live", "closed"] as CaseStatus[] },
		OR: [
			{ match: { attorneyId: userId } },
			{ attorneyEmail: { equals: email, mode: "insensitive" as const } },
		],
	};
}

const myCaseSelect = {
	id: true,
	title: true,
	category: true,
	location: true,
	summary: true,
	status: true,
	goalCents: true,
	raisedCents: true,
	donorsCount: true,
	coverImageUrl: true,
	publishedAt: true,
	createdAt: true,
	// Whether the plaintiff has opened donations against the account — their step,
	// not the attorney's, and worth telling them apart.
	payoutAccountId: true,
	payoutAccountForCase: {
		select: {
			userId: true,
			detailsSubmitted: true,
			transfersEnabled: true,
			payoutsEnabled: true,
		},
	},
	owner: { select: { id: true, name: true } },
	match: { select: { attorneyId: true, origin: true, createdAt: true } },
} as const;

/** How far this case's own Stripe account has got. Every flag is a cache of
 *  Stripe's view — see `syncPayoutAccount`. */
export type AttorneyCasePayout = {
	/** The plaintiff has opened donations against this account. */
	bound: boolean;
	hasAccount: boolean;
	detailsSubmitted: boolean;
	/** The donation gate: whether this case can accept money at all. */
	transfersEnabled: boolean;
	payoutsEnabled: boolean;
};

export type AttorneyCase = {
	id: string;
	title: string;
	category: string;
	/** The state the case is in — `Case.location`. */
	state: string;
	summary: string;
	status: CaseStatus;
	/** The agreed fee in cents — the funding goal. 0 until a fee is agreed. */
	goalCents: number;
	raisedCents: number;
	donorsCount: number;
	coverImageUrl: string | null;
	publishedAt: Date | null;
	createdAt: Date;
	/** The client. Their name and account id — never a way to contact them
	 *  directly. */
	plaintiffName: string;
	plaintiffId: string;
	/** How this attorney came to be on the case. Null when the plaintiff named
	 *  them by email rather than matching through JustUs. */
	origin: MatchOrigin | null;
	matchedAt: Date | null;
	payout: AttorneyCasePayout;
};

function toAttorneyCase(
	row: {
		id: string;
		title: string;
		category: string;
		location: string;
		summary: string;
		status: CaseStatus;
		goalCents: number;
		raisedCents: number;
		donorsCount: number;
		coverImageUrl: string | null;
		publishedAt: Date | null;
		createdAt: Date;
		payoutAccountId: string | null;
		payoutAccountForCase: {
			userId: string;
			detailsSubmitted: boolean;
			transfersEnabled: boolean;
			payoutsEnabled: boolean;
		} | null;
		owner: { id: string; name: string };
		match: { attorneyId: string; origin: MatchOrigin; createdAt: Date } | null;
	},
	userId: string,
): AttorneyCase {
	// Only *this* attorney's account is theirs to finish. A case that changed
	// counsel keeps the previous firm's account row, and reporting it here would
	// show the new attorney a setup they cannot reach and tell them they were done.
	const account =
		row.payoutAccountForCase?.userId === userId
			? row.payoutAccountForCase
			: null;
	return {
		id: row.id,
		title: row.title,
		category: row.category,
		state: row.location,
		summary: row.summary,
		status: row.status,
		goalCents: row.goalCents,
		raisedCents: row.raisedCents,
		donorsCount: row.donorsCount,
		coverImageUrl: row.coverImageUrl,
		publishedAt: row.publishedAt,
		createdAt: row.createdAt,
		plaintiffName: row.owner.name,
		plaintiffId: row.owner.id,
		origin: row.match?.origin ?? null,
		matchedAt: row.match?.createdAt ?? null,
		payout: {
			bound: !!row.payoutAccountId,
			hasAccount: !!account,
			detailsSubmitted: account?.detailsSubmitted ?? false,
			transfersEnabled: account?.transfersEnabled ?? false,
			payoutsEnabled: account?.payoutsEnabled ?? false,
		},
	};
}

/** Every case this attorney represents, newest publication first. */
export async function listAttorneyCases(input: {
	userId: string;
	email: string;
}): Promise<AttorneyCase[]> {
	const rows = await prisma.case.findMany({
		where: myCasesWhere(input.userId, input.email),
		orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
		select: myCaseSelect,
	});
	return rows.map((row) => toAttorneyCase(row, input.userId));
}

export type AttorneyCaseDetail = AttorneyCase & {
	/** The plaintiff's full account of what happened. */
	story: string;
	/**
	 * What the plaintiff filed, openable. This is the attorney acting on the case,
	 * which is the point at which the queue's promise says the documents are
	 * shared — so `href` is present here where the queue view has none.
	 *
	 * For a stored document that href is the app's own authorized route, never the
	 * blob URL: see `caseEvidence`.
	 */
	evidence: CaseEvidence[];
	images: string[];
};

/**
 * One represented case in full.
 *
 * Gated on the same predicate as the list rather than on the id alone, so an
 * attorney who is taken off a case — or was never on it — gets nothing, including
 * one holding the link. Returns null in that case, which the route turns into a
 * 404.
 */
export async function getAttorneyCase(input: {
	userId: string;
	email: string;
	caseId: string;
}): Promise<AttorneyCaseDetail | null> {
	const row = await prisma.case.findFirst({
		where: { ...myCasesWhere(input.userId, input.email), id: input.caseId },
		select: {
			...myCaseSelect,
			story: true,
			evidence: true,
			images: true,
		},
	});
	if (!row) return null;

	const { story, evidence, images, ...rest } = row;
	return {
		...toAttorneyCase(rest, input.userId),
		story,
		evidence: caseEvidence(evidence, row.id),
		images,
	};
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
