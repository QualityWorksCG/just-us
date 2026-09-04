import type { Prisma, VerificationStatus } from "../prisma/generated/client";
import prisma from "./index";

/**
 * Where an attorney may act, and how that is decided.
 *
 * A licence is per state. Until this module existed the platform held one
 * `User.jurisdiction` per attorney and never compared it to anything: the queue
 * offered every state's cases to everyone, and `expressInterest`,
 * `acceptInterest` and `confirmCaseInvitation` each let an attorney take a case
 * in a state they had never claimed, let alone been checked in. Both halves were
 * wrong — an attorney could act outside their jurisdiction, and one admitted in
 * two states could only ever record one.
 *
 * The rule now, applied in every one of those places:
 *
 *   **A case may only be taken by an attorney holding a `verified` admission in
 *   the case's own `location`.**
 *
 * Two strengths of claim, deliberately kept apart. An *admission* is what the
 * attorney says: it puts that state's cases in their queue and lets them fill in
 * a bar number. A *verified* admission is what a bar check established, and only
 * that unlocks representation. So adding a state is never enough on its own —
 * which is the whole reason admissions carry their own status rather than
 * borrowing the profile's single badge.
 */

/** One state an attorney is admitted in, as the app reads it. */
export type Admission = {
	state: string;
	barNumber: string | null;
	verificationStatus: VerificationStatus;
	verifiedAt: Date | null;
	/** The primary state, mirrored on `User.jurisdiction` — what the directory
	 *  leads with. Exactly one admission carries it, whenever any exist. */
	primary: boolean;
};

/** Accepts the transaction client as readily as the base one, so a gate can be
 *  re-applied inside the transaction that acts on it rather than before it. */
type Db = Prisma.TransactionClient | typeof prisma;

const byState = { state: "asc" } as const;

/**
 * Every state this attorney has claimed, whatever its standing.
 *
 * Ordered by state rather than by status: this is a list of facts about a person,
 * and re-ordering it as checks come and go would make it hard to read.
 */
export async function listAdmissions(userId: string): Promise<Admission[]> {
	const [rows, user] = await Promise.all([
		prisma.attorneyAdmission.findMany({
			where: { userId },
			orderBy: byState,
			select: {
				state: true,
				barNumber: true,
				verificationStatus: true,
				verifiedAt: true,
			},
		}),
		prisma.user.findUnique({
			where: { id: userId },
			select: { jurisdiction: true },
		}),
	]);
	return rows.map((row) => ({
		...row,
		primary: row.state === user?.jurisdiction,
	}));
}

/**
 * The states whose cases this attorney may *see*.
 *
 * Admission alone, not verification: an attorney who has claimed New York but is
 * still waiting on the check can read the New York queue and decide what they
 * want to put themselves forward for. What they cannot do is act — every action
 * gate below asks for `verified` instead. Splitting the two keeps a pending bar
 * check from looking like an empty platform.
 */
export async function admittedStates(userId: string): Promise<string[]> {
	const rows = await prisma.attorneyAdmission.findMany({
		where: { userId },
		orderBy: byState,
		select: { state: true },
	});
	return rows.map((row) => row.state);
}

/** The states this attorney may actually take a case in. */
export async function verifiedAdmittedStates(
	userId: string,
): Promise<string[]> {
	const rows = await prisma.attorneyAdmission.findMany({
		where: { userId, verificationStatus: "verified" },
		orderBy: byState,
		select: { state: true },
	});
	return rows.map((row) => row.state);
}

/**
 * One admission, or null if this attorney has never claimed the state.
 *
 * For the screens that have to tell an attorney *why* they cannot act on a case in
 * front of them, which is three different sentences: they have not claimed this
 * state, they have claimed it and no check has run, or a check ran and refused. A
 * boolean could only say the first.
 */
export async function getAdmission(
	userId: string,
	state: string,
): Promise<Admission | null> {
	const [row, user] = await Promise.all([
		prisma.attorneyAdmission.findUnique({
			where: { userId_state: { userId, state } },
			select: {
				state: true,
				barNumber: true,
				verificationStatus: true,
				verifiedAt: true,
			},
		}),
		prisma.user.findUnique({
			where: { id: userId },
			select: { jurisdiction: true },
		}),
	]);
	if (!row) return null;
	return { ...row, primary: row.state === user?.jurisdiction };
}

/**
 * Is this attorney cleared to act in this state?
 *
 * The single question every matching gate asks, and the reason it takes a `db`:
 * confirming an invitation, accepting an expression of interest and expressing
 * one all mutate inside a transaction, and a check made before that transaction
 * opened could have been true a moment ago and not now. An admission can be
 * removed, and a re-check can downgrade one, in between.
 */
export async function isAdmittedIn(
	db: Db,
	userId: string,
	state: string,
	options: { requireVerified?: boolean } = {},
): Promise<boolean> {
	const admission = await db.attorneyAdmission.findUnique({
		where: { userId_state: { userId, state } },
		select: { verificationStatus: true },
	});
	if (!admission) return false;
	return options.requireVerified === false
		? true
		: admission.verificationStatus === "verified";
}

/**
 * Does this attorney declare federal-court practice? The federal analogue of
 * `admittedStates` — a *visibility* signal (claimed, not necessarily checked), so
 * a federal case can appear in their queue while the federal check is pending, the
 * same way a claimed-but-unverified state case does.
 */
export async function practicesFederal(userId: string): Promise<boolean> {
	const profile = await prisma.attorneyProfile.findUnique({
		where: { userId },
		select: { practicesFederal: true },
	});
	return profile?.practicesFederal ?? false;
}

/**
 * Is this attorney cleared to *act* on a federal case? The federal analogue of
 * `isAdmittedIn` — a verified federal standing, checked transactionally at the
 * moment of expressing interest or confirming, for the same freshness reason.
 */
export async function isFederalVerified(
	db: Db,
	userId: string,
): Promise<boolean> {
	const profile = await db.attorneyProfile.findUnique({
		where: { userId },
		select: { federalVerificationStatus: true },
	});
	return profile?.federalVerificationStatus === "verified";
}

/**
 * Where the attorney behind an email address is admitted, if there is one.
 *
 * For the plaintiff's invite step, which needs to know before it sends whether
 * the person it is about to hold a case open for could ever confirm it. Returns
 * `null` when no attorney account holds the address — a stranger, who will pick
 * their states during onboarding — and the list otherwise, which may be empty for
 * an account that has claimed nowhere.
 *
 * Nothing here that the directory does not already publish: which states an
 * attorney practises in is the first thing a plaintiff searching for one is shown.
 * Matched case-insensitively, because the plaintiff typed one of these addresses
 * and the account holder typed the other.
 */
export async function admittedStatesForEmail(
	email: string,
): Promise<string[] | null> {
	const normalized = email.trim();
	if (!normalized) return null;

	const user = await prisma.user.findFirst({
		where: {
			email: { equals: normalized, mode: "insensitive" },
			role: "attorney",
		},
		select: { admissions: { orderBy: byState, select: { state: true } } },
	});
	if (!user) return null;
	return user.admissions.map((row) => row.state);
}

/** What an attorney submits for one state. */
export type AdmissionInput = {
	state: string;
	barNumber?: string | null;
};

export type SetAdmissionsResult = {
	added: string[];
	removed: string[];
	/** The state now mirrored on `User.jurisdiction`. */
	primary: string | null;
};

/**
 * Replace the set of states an attorney claims, in one transaction.
 *
 * Declarative rather than incremental — the caller sends the list as it should
 * end up — because that is the shape of the control the attorney is using, and a
 * diff computed here cannot get out of step with what they saw.
 *
 * Three rules hold it together:
 *
 *   1. **A state that stays, keeps its standing.** Re-submitting an unchanged
 *      list must not silently drop a verified badge, so existing rows are updated
 *      rather than replaced, and only the bar number can change.
 *   2. **A state that arrives, arrives unverified.** A claim is not a licence,
 *      and no check has run against this one yet.
 *   3. **`User.jurisdiction` always names one of these rows.** It is the primary
 *      state and nothing more (see auth.prisma), so when the state it points at
 *      is dropped, the earliest remaining admission takes over. Removing every
 *      admission leaves it null — an attorney who claims nowhere may act nowhere,
 *      which is the honest reading of an empty list.
 */
export async function setAdmissions(
	userId: string,
	entries: AdmissionInput[],
): Promise<SetAdmissionsResult> {
	// Deduplicated on the way in: two rows for one state cannot exist (the unique
	// index refuses it), and a caller sending the same state twice means it once.
	const wanted = new Map<string, string | null>();
	for (const entry of entries) {
		const state = entry.state.trim();
		if (!state) continue;
		const barNumber = entry.barNumber?.trim() || null;
		// A later entry with a number beats an earlier one without.
		if (!wanted.has(state) || barNumber) wanted.set(state, barNumber);
	}

	return prisma.$transaction(async (tx) => {
		const existing = await tx.attorneyAdmission.findMany({
			where: { userId },
			orderBy: { createdAt: "asc" },
			select: { id: true, state: true },
		});
		const have = new Set(existing.map((row) => row.state));

		const removed = existing
			.filter((row) => !wanted.has(row.state))
			.map((row) => row.state);
		const added = [...wanted.keys()].filter((state) => !have.has(state));

		if (removed.length > 0) {
			await tx.attorneyAdmission.deleteMany({
				where: { userId, state: { in: removed } },
			});
		}
		for (const [state, barNumber] of wanted) {
			if (have.has(state)) {
				await tx.attorneyAdmission.update({
					where: { userId_state: { userId, state } },
					data: { barNumber },
				});
			} else {
				await tx.attorneyAdmission.create({
					data: { userId, state, barNumber },
				});
			}
		}

		// Whichever admission is oldest leads, so the primary only moves when the
		// state it named is actually gone.
		const remaining = await tx.attorneyAdmission.findMany({
			where: { userId },
			orderBy: { createdAt: "asc" },
			select: { state: true },
		});
		const user = await tx.user.findUnique({
			where: { id: userId },
			select: { jurisdiction: true },
		});
		const stillThere =
			user?.jurisdiction &&
			remaining.some((row) => row.state === user.jurisdiction);
		const primary = stillThere
			? (user?.jurisdiction ?? null)
			: (remaining[0]?.state ?? null);
		if (primary !== user?.jurisdiction) {
			await tx.user.update({
				where: { id: userId },
				data: { jurisdiction: primary },
			});
		}

		return { added, removed, primary };
	});
}

export type AddAdmissionResult =
	| { ok: true }
	| { ok: false; reason: "already_admitted" };

/**
 * Claim one more state.
 *
 * Unverified, always: this is the attorney saying where they are admitted, and
 * saying it is not being checked. A bar check against the new state is a separate
 * act, and until it clears the only thing this buys them is that state's cases
 * appearing in their queue.
 *
 * The first admission also becomes the primary, so an attorney who reached this
 * point without one (a legacy account, or an invited attorney whose onboarding
 * predates admissions) ends up with `User.jurisdiction` pointing somewhere real.
 */
export async function addAdmission(
	userId: string,
	state: string,
	barNumber?: string | null,
): Promise<AddAdmissionResult> {
	return prisma.$transaction(async (tx) => {
		const { created } = await ensureAdmission(tx, userId, state, barNumber);
		if (!created) return { ok: false, reason: "already_admitted" as const };

		const user = await tx.user.findUnique({
			where: { id: userId },
			select: { jurisdiction: true },
		});
		if (!user?.jurisdiction) {
			await tx.user.update({
				where: { id: userId },
				data: { jurisdiction: state },
			});
		}
		return { ok: true as const };
	});
}

export type RemoveAdmissionResult = {
	removed: boolean;
	/** The state now mirrored on `User.jurisdiction` — moved only if the one it
	 *  named is the one that went. */
	primary: string | null;
};

/**
 * Give up a claim to a state.
 *
 * Only affects what this attorney may take on *from now*. A case they already
 * represent there keeps its `Match`: the gates run at the moment representation is
 * established, and quietly unseating a lawyer from a live matter because they
 * edited a list is not a thing this should be able to do. What it does stop is a
 * new one.
 */
export async function removeAdmission(
	userId: string,
	state: string,
): Promise<RemoveAdmissionResult> {
	return prisma.$transaction(async (tx) => {
		const deleted = await tx.attorneyAdmission.deleteMany({
			where: { userId, state },
		});
		const user = await tx.user.findUnique({
			where: { id: userId },
			select: { jurisdiction: true },
		});
		if (deleted.count === 0) {
			return { removed: false, primary: user?.jurisdiction ?? null };
		}

		if (user?.jurisdiction !== state) {
			return { removed: true, primary: user?.jurisdiction ?? null };
		}
		// The primary is gone: the oldest remaining admission takes over, and an
		// attorney left with none has no primary either.
		const next = await tx.attorneyAdmission.findFirst({
			where: { userId },
			orderBy: { createdAt: "asc" },
			select: { state: true },
		});
		const primary = next?.state ?? null;
		await tx.user.update({
			where: { id: userId },
			data: { jurisdiction: primary },
		});
		return { removed: true, primary };
	});
}

export type SetPrimaryResult =
	| { ok: true }
	| { ok: false; reason: "not_admitted" };

/**
 * Choose which admission the directory leads with.
 *
 * All this moves is the label on `User.jurisdiction`. It used to do far more —
 * when an attorney had exactly one state, changing it meant trading one licence
 * for another, so the badge had to be dropped with it. Admissions took that job:
 * a state is added and removed on its own, carrying its own standing, and none of
 * that is disturbed by deciding which one to show first.
 *
 * Refused for a state the attorney holds no admission in. "Primarily admitted
 * somewhere you have not claimed" is not a state of affairs worth representing.
 */
export async function setPrimaryJurisdiction(
	userId: string,
	state: string,
): Promise<SetPrimaryResult> {
	const admission = await prisma.attorneyAdmission.findUnique({
		where: { userId_state: { userId, state } },
		select: { id: true },
	});
	if (!admission) return { ok: false, reason: "not_admitted" };
	await prisma.user.update({
		where: { id: userId },
		data: { jurisdiction: state },
	});
	return { ok: true };
}

/**
 * Move one admission's standing to match a check that just ran against it.
 *
 * The per-state twin of the `AttorneyProfile.verificationStatus` cache, and
 * written in the same transaction as the evidence for the same reason: a badge
 * that disagrees with its own evidence is worse than no badge. `verifiedAt` is
 * only ever advanced, so a later downgrade still records when this state was last
 * trusted.
 *
 * A no-op when the attorney holds no admission for that state — a check can be
 * triggered against a state, and the admission dropped, before it returns.
 */
export async function recordAdmissionCheck(
	db: Db,
	userId: string,
	state: string,
	status: VerificationStatus,
) {
	await db.attorneyAdmission.updateMany({
		where: { userId, state },
		data: {
			verificationStatus: status,
			...(status === "verified" ? { verifiedAt: new Date() } : {}),
		},
	});
}

/**
 * The profile-wide badge that a set of admissions adds up to.
 *
 * The directory shows one badge per attorney, and it has to survive an attorney
 * being verified in one state and refused in another — which is not a
 * contradiction but the normal case for someone who claimed a state they turn out
 * not to be admitted in. So the best standing wins: one verified licence makes a
 * verified attorney.
 *
 * This is why `AttorneyProfile.verificationStatus` can no longer simply mirror
 * the newest check. It stays as the coarse "is this a checked attorney at all"
 * signal the directory and the queue banner read; whether they may take a
 * *particular* case is only ever answered per state, by `isAdmittedIn`.
 */
const BADGE_ORDER: VerificationStatus[] = [
	"verified",
	"pending",
	"needs_review",
	"rejected",
	"unverified",
];

export function badgeFromAdmissions(
	statuses: VerificationStatus[],
): VerificationStatus {
	for (const candidate of BADGE_ORDER) {
		if (statuses.includes(candidate)) return candidate;
	}
	return "unverified";
}

/** The badge this attorney's admissions currently add up to, read fresh. */
export async function currentBadge(
	db: Db,
	userId: string,
): Promise<VerificationStatus> {
	const rows = await db.attorneyAdmission.findMany({
		where: { userId },
		select: { verificationStatus: true },
	});
	return badgeFromAdmissions(rows.map((row) => row.verificationStatus));
}

/**
 * Make sure an admission exists for this state, without disturbing one that does.
 *
 * For the paths that establish a state as a side effect rather than as the
 * attorney's own declaration — onboarding's first state, and an administrator
 * vouching for one. Returns whether it had to be created, which is what tells the
 * caller a claim was recorded rather than confirmed.
 */
export async function ensureAdmission(
	db: Db,
	userId: string,
	state: string,
	barNumber?: string | null,
): Promise<{ created: boolean }> {
	const existing = await db.attorneyAdmission.findUnique({
		where: { userId_state: { userId, state } },
		select: { id: true },
	});
	if (existing) return { created: false };
	await db.attorneyAdmission.create({
		data: { userId, state, barNumber: barNumber?.trim() || null },
	});
	return { created: true };
}

/**
 * Clear every admission's standing — an administrator withdrawing trust.
 *
 * Broad on purpose, and deliberately asymmetric with granting it: an
 * administrator vouching for an attorney is vouching for one bar record, so
 * `adminSetVerification` grants against the primary state alone. Withdrawing is a
 * judgement about the person, and leaving their other states verified would let
 * them keep taking cases through a side door.
 */
export async function clearAdmissionStandings(db: Db, userId: string) {
	await db.attorneyAdmission.updateMany({
		where: { userId, verificationStatus: { not: "unverified" } },
		data: { verificationStatus: "unverified" },
	});
}
