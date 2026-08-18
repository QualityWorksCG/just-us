import type {
	CaseStatus,
	MatchOrigin,
	RequestStatus,
} from "../prisma/generated/enums";
import { admittedStates, isAdmittedIn } from "./admissions";
import { pendingCaseInvitationWhere } from "./case-invitations";
import {
	type CaseEvidence,
	caseEvidence,
	designatedAttorneyWhere,
} from "./cases";
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
 * A case is in the queue only while it is genuinely seeking representation, and
 * that is decided by two records: whether it has a `Match`, and whether an
 * invitation to a named attorney is still awaiting an answer.
 *
 * A match means the case is represented and settled. A *pending* invitation
 * means the plaintiff has asked someone specific and has not heard back — the
 * case is spoken for provisionally, and putting it in front of other attorneys
 * in the meantime would invite two of them to work on the same matter.
 *
 * The plaintiff's typed `attorneyName` used to stand in for the second test, and
 * it was the wrong record: a name is a label, and the attorney behind it may
 * never have been contacted, may have declined, or may never answer. Naming one
 * removed the case from the queue permanently, with nothing that could ever put
 * it back. Reading invitations instead makes the queue self-correcting — a
 * decline, a revoke, or a lapsed invitation stops being pending, and the case
 * returns here on its own with no write to the case at all. See
 * `pendingCaseInvitationWhere`.
 */
function queueWhere(filters: QueueFilters = {}, states?: string[]) {
	return {
		status: "seeking" as const,
		deletedAt: null,
		// A case held or removed by moderation is not offered to attorneys either
		// (Reg. & Ops §3–4) — the attorney queue is a visibility surface too.
		moderationStatus: "ok" as const,
		match: { is: null },
		invitations: { none: pendingCaseInvitationWhere(new Date()) },
		...(filters.category ? { category: filters.category } : {}),
		...locationWhere(filters.state, states),
	};
}

/**
 * The two things that decide which states' cases are in scope, resolved together.
 *
 * `states` is where the attorney is admitted and is not negotiable — a case they
 * cannot take has no business being offered to them. `filters.state` is the
 * attorney's own choice from the dropdown, which can only ever narrow that set.
 * Asking for a state they are not admitted in yields `in: []`, which matches
 * nothing: the honest answer, and the same one an attorney with no admissions at
 * all gets for the whole queue.
 */
function locationWhere(filter: string | undefined, states?: string[]) {
	if (!states) return filter ? { location: filter } : {};
	return {
		location: { in: filter ? states.filter((s) => s === filter) : states },
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
	// Read here rather than taken as an argument, so no caller can render the queue
	// without the constraint. An attorney who has claimed no state sees nothing —
	// see `locationWhere`.
	const states = await admittedStates(attorneyId);
	const rows = await prisma.case.findMany({
		where: queueWhere(filters, states),
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
	// Scoped exactly as the list is: a case outside this attorney's admissions is
	// not theirs to read in full, link or no link.
	const states = await admittedStates(attorneyId);
	const row = await prisma.case.findFirst({
		where: { ...queueWhere({}, states), id: caseId },
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
export async function queueCategories(attorneyId: string): Promise<string[]> {
	const states = await admittedStates(attorneyId);
	const rows = await prisma.case.groupBy({
		by: ["category"],
		where: queueWhere({}, states),
	});
	return rows
		.map((row) => row.category)
		.filter(Boolean)
		.sort();
}

/** States that actually have a queued case *and* that this attorney is admitted
 *  in — the dropdown must not offer a state whose cases the queue withholds. */
export async function queueStates(attorneyId: string): Promise<string[]> {
	const states = await admittedStates(attorneyId);
	const rows = await prisma.case.groupBy({
		by: ["location"],
		where: queueWhere({}, states),
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
	| "not_admitted"
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
 *
 * Admission in the case's own state is required for the same reason, and is the
 * same rule the queue draws: an attorney cannot act on a matter in a state they
 * hold no verified licence in. The queue already withholds those cases, so
 * reaching this with `not_admitted` means the id came from somewhere else — a
 * stale tab, or a hand-made request.
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
	// page rendered, and a stale button must not be able to reach it. Unscoped by
	// state here so that a case in the wrong jurisdiction is refused as
	// `not_admitted` — the truthful reason — rather than as `unavailable`, which
	// would read as "somebody else got it".
	const target = await prisma.case.findFirst({
		where: { ...queueWhere(), id: caseId },
		select: { id: true, location: true },
	});
	if (!target) return { ok: false, reason: "unavailable" };

	const admitted = await isAdmittedIn(prisma, attorneyId, target.location);
	if (!admitted) return { ok: false, reason: "not_admitted" };

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

/** One expression of interest with the facts a plaintiff's notification needs:
 *  the case, its owner (recipient), and the interested attorney's display name. */
export async function getInterestForNotify(interestId: string) {
	const r = await prisma.attorneyRequest.findUnique({
		where: { id: interestId },
		select: {
			id: true,
			caseId: true,
			case: {
				select: {
					title: true,
					ownerId: true,
					owner: { select: { name: true, email: true } },
				},
			},
			attorney: {
				select: {
					name: true,
					attorneyProfile: { select: { legalName: true } },
				},
			},
		},
	});
	if (!r) return null;
	return {
		interestId: r.id,
		caseId: r.caseId,
		caseTitle: r.case.title || "your case",
		ownerId: r.case.ownerId,
		ownerName: r.case.owner?.name ?? null,
		ownerEmail: r.case.owner?.email ?? null,
		attorneyName: r.attorney.attorneyProfile?.legalName ?? r.attorney.name,
	};
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
 * an accepted expression of interest writes a `Match`, and older bring-your-own
 * cases carry only the plaintiff's typed `attorneyEmail`. The same pair is what the
 * payout layer binds money on, so a case that can pay this attorney is a case that
 * appears here.
 *
 * The email route is deliberately the narrow one — see `designatedAttorneyWhere`.
 * A typed address is the plaintiff's assertion, not an agreement, so it only reaches
 * a case that has already been committed to that attorney and has no `Match` of its
 * own. Every case published through the invitation flow is `seeking` until the
 * attorney confirms, and confirming writes the `Match` that the first branch reads.
 *
 * Drafts are excluded. A draft is private to the plaintiff — it is not published
 * to anyone, including an attorney named in it — and there is nothing an attorney
 * can do about a case that has not been sent out.
 *
 * `pending_payout` is **not** excluded, and that is the point of the state. Such a
 * case is finished and committed and waiting on exactly one thing: this attorney
 * opening its Stripe account. It is the only case status that is invisible to the
 * public and yet blocked on the person reading this list, so leaving it out would
 * park a plaintiff behind an attorney who was never told.
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
		status: {
			in: ["seeking", "pending_payout", "live", "closed"] as CaseStatus[],
		},
		OR: [{ match: { attorneyId: userId } }, designatedAttorneyWhere(email)],
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
	// How many progress updates the attorney has posted on this case (JUS-33).
	// Counted rather than fetched: the list only reports the number, and the posts
	// themselves belong to the case's own updates screen.
	_count: { select: { updates: true } },
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
	/** Progress updates posted on this case so far (JUS-33). */
	updatesCount: number;
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
		_count: { updates: number };
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
		updatesCount: row._count.updates,
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

/**
 * The cases an attorney is matched to — the "My cases" list on the attorney side
 * and the surface they post progress updates from (JUS-33).
 *
 * Keyed on `Match`, so a case appears the moment the plaintiff takes this
 * attorney forward and regardless of its funding status. Newest match first.
 */
export async function listMatchedCases(attorneyId: string) {
	const matches = await prisma.match.findMany({
		where: { attorneyId },
		orderBy: { createdAt: "desc" },
		select: {
			case: {
				select: {
					id: true,
					title: true,
					category: true,
					location: true,
					status: true,
					coverImageUrl: true,
					raisedCents: true,
					goalCents: true,
					donorsCount: true,
					owner: { select: { name: true } },
					_count: { select: { updates: true } },
				},
			},
		},
	});
	return matches.map((m) => ({
		id: m.case.id,
		title: m.case.title,
		category: m.case.category,
		location: m.case.location,
		status: m.case.status,
		coverImageUrl: m.case.coverImageUrl,
		raisedCents: m.case.raisedCents,
		goalCents: m.case.goalCents,
		donorsCount: m.case.donorsCount,
		plaintiffName: m.case.owner.name,
		updatesCount: m.case._count.updates,
	}));
}

/**
 * One case an attorney is matched to, or null. Looking it up through the match
 * (not by id alone) is the same guard `postCaseUpdate` applies: an attorney only
 * ever reaches the case they actually represent.
 */
export async function getMatchedCase(caseId: string, attorneyId: string) {
	const match = await prisma.match.findFirst({
		where: { caseId, attorneyId },
		select: {
			case: {
				select: {
					id: true,
					title: true,
					category: true,
					location: true,
					status: true,
					summary: true,
					story: true,
					coverImageUrl: true,
					images: true,
					raisedCents: true,
					goalCents: true,
					donorsCount: true,
					viewsCount: true,
					publishedAt: true,
					attorneyName: true,
					owner: { select: { name: true } },
				},
			},
		},
	});
	return match?.case ?? null;
}

/**
 * The same matches, shaped for the assistant's tool layer (JUS-68) rather than
 * the dashboard: it needs the match itself — id, origin, when it happened — not
 * just the case, and it caps the list via `take`.
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
