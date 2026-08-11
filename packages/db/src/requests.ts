import type {
	CaseStatus,
	MatchOrigin,
	RequestStatus,
	VerificationStatus,
} from "../prisma/generated/enums";
import { averageRating } from "./attorney-directory";
import { pendingInvitationsForCases } from "./case-invitations";
import prisma from "./index";

/**
 * The plaintiff's side of representation: the inbox of attorneys who have
 * expressed interest in a seeking case, taking one of them forward (JUS-25), and
 * the standing view of who is acting on each of their cases afterwards.
 *
 * "Open" here means pending or viewed — an expression of interest still awaiting
 * the plaintiff's decision. `pending` and `viewed` differ only in whether the
 * plaintiff has laid eyes on it yet, which drives the "new" badge and nothing
 * else, so every listing works on both.
 */
const OPEN: RequestStatus[] = ["pending", "viewed"];

/**
 * The attorney's public profile as the inbox renders it.
 *
 * Read live on every request rather than copied onto the interest row when it was
 * created: bar standing can lapse, ratings move, and an attorney can change firm.
 * The plaintiff is choosing who represents them, so what they see has to be what
 * is true now.
 */
const attorneySelect = {
	name: true,
	jurisdiction: true,
	attorneyProfile: {
		select: {
			id: true,
			legalName: true,
			firmName: true,
			officeCity: true,
			officeState: true,
			headshotUrl: true,
			practiceAreas: true,
			admittedYear: true,
			acceptingNewCases: true,
			verificationStatus: true,
			reviews: { where: { published: true }, select: { rating: true } },
		},
	},
} as const;

export type CaseInterest = {
	id: string;
	caseId: string;
	attorneyName: string;
	/** AttorneyProfile id — what `/attorneys/[id]` takes. Null if the attorney has
	 *  no directory profile, in which case there is nothing to link to. */
	profileId: string | null;
	firm: string | null;
	practiceAreas: string[];
	/** Where they are licensed, preferring the account's jurisdiction over the
	 *  office address — the same precedence the directory uses. */
	location: string | null;
	headshotUrl: string | null;
	admittedYear: number | null;
	acceptingNewCases: boolean;
	/** Bar standing right now. Shown on the card, and re-checked before the
	 *  plaintiff can take this attorney forward. */
	verificationStatus: VerificationStatus | null;
	rating: number | null;
	reviewCount: number;
	/** True while the plaintiff hasn't seen it yet — drives the "new" badge. */
	isNew: boolean;
	createdAt: Date;
};

function toInterest(row: {
	id: string;
	caseId: string;
	status: string;
	createdAt: Date;
	attorney: {
		name: string;
		jurisdiction: string | null;
		attorneyProfile: {
			id: string;
			legalName: string | null;
			firmName: string | null;
			officeCity: string | null;
			officeState: string | null;
			headshotUrl: string | null;
			practiceAreas: string[];
			admittedYear: number | null;
			acceptingNewCases: boolean;
			verificationStatus: VerificationStatus;
			reviews: { rating: number }[];
		} | null;
	};
}): CaseInterest {
	const profile = row.attorney.attorneyProfile;
	return {
		id: row.id,
		caseId: row.caseId,
		// The bar-record name is what the directory shows and what verification was
		// run against; the account name is only a fallback.
		attorneyName: profile?.legalName ?? row.attorney.name,
		profileId: profile?.id ?? null,
		firm: profile?.firmName ?? null,
		practiceAreas: profile?.practiceAreas ?? [],
		location:
			row.attorney.jurisdiction ??
			profile?.officeState ??
			profile?.officeCity ??
			null,
		headshotUrl: profile?.headshotUrl ?? null,
		admittedYear: profile?.admittedYear ?? null,
		acceptingNewCases: profile?.acceptingNewCases ?? false,
		verificationStatus: profile?.verificationStatus ?? null,
		rating: averageRating(profile?.reviews ?? []),
		reviewCount: profile?.reviews.length ?? 0,
		isNew: row.status === "pending",
		createdAt: row.createdAt,
	};
}

/**
 * The match on a case, if an attorney has already been chosen. Its presence is
 * what proves a choice was made, independent of the case's status — a case sits
 * at `seeking` between "attorney accepted" and "published live", and the requests
 * screen relies on this so that limbo never reads as "no attorney chosen yet".
 */
export async function getCaseMatch(caseId: string, ownerId: string) {
	return prisma.match.findFirst({
		where: { caseId, case: { ownerId } },
		select: { attorneyId: true, createdAt: true },
	});
}

/** Open expressions of interest on a case the plaintiff owns, newest first.
 *
 *  Ordered by date alone. The old ordering put the best-rated first, which is a
 *  ranking of attorneys for a specific case — the one thing the directory's own
 *  copy promises JustUs never does. */
export async function listCaseInterests(
	caseId: string,
	ownerId: string,
): Promise<CaseInterest[]> {
	const rows = await prisma.attorneyRequest.findMany({
		where: { caseId, case: { ownerId }, status: { in: OPEN } },
		orderBy: { createdAt: "desc" },
		select: {
			id: true,
			caseId: true,
			status: true,
			createdAt: true,
			attorney: { select: attorneySelect },
		},
	});
	return rows.map(toInterest);
}

/** How many open expressions of interest a case has, and how many the plaintiff
 *  hasn't seen yet (for badges and counts). */
export async function countCaseInterests(caseId: string, ownerId: string) {
	const [open, unseen] = await Promise.all([
		prisma.attorneyRequest.count({
			where: { caseId, case: { ownerId }, status: { in: OPEN } },
		}),
		prisma.attorneyRequest.count({
			where: { caseId, case: { ownerId }, status: "pending" },
		}),
	]);
	return { open, unseen };
}

/**
 * Open-interest counts for every case a plaintiff owns, in one round-trip.
 *
 * Returned as a map keyed by case id so the dashboard can show each case's own
 * count without a query per row.
 */
export async function interestCountsByCase(
	ownerId: string,
): Promise<Record<string, { open: number; unseen: number }>> {
	const rows = await prisma.attorneyRequest.groupBy({
		by: ["caseId", "status"],
		where: { case: { ownerId, deletedAt: null }, status: { in: OPEN } },
		_count: { _all: true },
	});

	const counts: Record<string, { open: number; unseen: number }> = {};
	for (const row of rows) {
		const entry = counts[row.caseId] ?? { open: 0, unseen: 0 };
		entry.open += row._count._all;
		if (row.status === "pending") entry.unseen += row._count._all;
		counts[row.caseId] = entry;
	}
	return counts;
}

export type PlaintiffNewInterest = {
	id: string;
	caseId: string;
	caseTitle: string;
	attorneyName: string;
	createdAt: Date;
};

/**
 * A plaintiff's *unseen* expressions of interest across all their live cases,
 * newest first — the feed behind the header notification bell (JUS-25).
 *
 * Scoped to `pending`, the same "hasn't laid eyes on it yet" status the per-case
 * "N new" badge uses: opening a case's requests flips its rows to `viewed`
 * (see `markCaseInterestsViewed`), which is what clears the bell for that case.
 * So the bell answers exactly "requests you haven't looked at yet", and reaching
 * the inbox is what dismisses them — no separate read-tracking to drift.
 */
export async function listNewInterestsForPlaintiff(
	ownerId: string,
	take = 15,
): Promise<PlaintiffNewInterest[]> {
	const rows = await prisma.attorneyRequest.findMany({
		where: { status: "pending", case: { ownerId, deletedAt: null } },
		orderBy: { createdAt: "desc" },
		take,
		select: {
			id: true,
			caseId: true,
			createdAt: true,
			case: { select: { title: true } },
			attorney: {
				select: {
					name: true,
					attorneyProfile: { select: { legalName: true } },
				},
			},
		},
	});
	return rows.map((r) => ({
		id: r.id,
		caseId: r.caseId,
		caseTitle: r.case.title || "Untitled case",
		// The bar-record name where there is one, matching the requests inbox.
		attorneyName: r.attorney.attorneyProfile?.legalName ?? r.attorney.name,
		createdAt: r.createdAt,
	}));
}

/**
 * Mark a case's unseen expressions of interest as viewed — the `viewed` status
 * JUS-25 defines. Called when the plaintiff opens the inbox, which is the only
 * moment we can honestly claim they have seen them.
 *
 * Returns how many were newly marked, so the caller can render the "N new" badge
 * from what was true on arrival rather than after the flip.
 */
export async function markCaseInterestsViewed(
	caseId: string,
	ownerId: string,
): Promise<number> {
	const res = await prisma.attorneyRequest.updateMany({
		where: { caseId, case: { ownerId }, status: "pending" },
		data: { status: "viewed", viewedAt: new Date() },
	});
	return res.count;
}

export type AcceptInterestResult =
	| { ok: true; caseId: string }
	| { ok: false; reason: "not_found" | "not_verified" | "already_matched" };

/**
 * Take an attorney forward: the plaintiff has decided, so record the match and
 * copy the attorney onto the case, ready for the fee to be agreed.
 *
 * This is the moment the expressed-interest path resolves, so it is where
 * `Match.origin` is recorded as `expressed_interest` (JUS-25) and where the
 * bar-standing gate applies (JUS-24 — verification at the point of matching for
 * this path). Standing is read now rather than trusted from when interest was
 * expressed, because a licence can lapse in between and this is the check that
 * catches it.
 *
 * The attorney's details are copied from their live profile in the same
 * transaction as the match, so the case can never name one attorney while the
 * match records another.
 */
export async function acceptInterest(
	interestId: string,
	ownerId: string,
): Promise<AcceptInterestResult> {
	const interest = await prisma.attorneyRequest.findFirst({
		where: { id: interestId, case: { ownerId }, status: { in: OPEN } },
		select: {
			id: true,
			caseId: true,
			attorneyId: true,
			case: { select: { match: { select: { id: true } } } },
			attorney: {
				select: {
					name: true,
					jurisdiction: true,
					attorneyProfile: {
						select: {
							legalName: true,
							firmName: true,
							officeState: true,
							practiceAreas: true,
							verificationStatus: true,
						},
					},
				},
			},
		},
	});
	if (!interest) return { ok: false, reason: "not_found" };
	// A case has one attorney. If the plaintiff already took someone forward, this
	// interest is moot — refused rather than overwriting the existing match.
	if (interest.case.match) return { ok: false, reason: "already_matched" };

	const profile = interest.attorney.attorneyProfile;
	if (profile?.verificationStatus !== "verified") {
		return { ok: false, reason: "not_verified" };
	}

	await prisma.$transaction([
		prisma.attorneyRequest.update({
			where: { id: interest.id },
			data: { status: "accepted" },
		}),
		prisma.case.update({
			where: { id: interest.caseId },
			data: {
				attorneyName: profile.legalName ?? interest.attorney.name,
				attorneyFirm: profile.firmName,
				attorneyArea: profile.practiceAreas[0] ?? null,
				attorneyLocation:
					interest.attorney.jurisdiction ?? profile.officeState ?? null,
			},
		}),
		prisma.match.create({
			data: {
				caseId: interest.caseId,
				attorneyId: interest.attorneyId,
				origin: "expressed_interest",
				requestId: interest.id,
			},
		}),
	]);

	return { ok: true, caseId: interest.caseId };
}

/** Decline an open expression of interest. Final — the unique constraint on
 *  (case, attorney) means the same attorney cannot express interest again.
 *  Returns the number of rows updated. */
export async function declineInterest(interestId: string, ownerId: string) {
	const res = await prisma.attorneyRequest.updateMany({
		where: { id: interestId, case: { ownerId }, status: { in: OPEN } },
		data: { status: "declined" },
	});
	return res.count;
}

/**
 * Who is representing the plaintiff, per case — the "My representation" screen.
 *
 * Two routes put an attorney on a case, and both are answers to "who is acting
 * for me", so both are read here:
 *
 *  - **Matched** — a `Match` naming a JustUs account. Their profile is read live,
 *    for the same reason the interest inbox reads it live: bar standing lapses,
 *    firms change, and this is the screen where a plaintiff checks who is acting
 *    for them. A snapshot taken at match time could show a badge that is no
 *    longer true.
 *  - **Named on the case** — the bring-your-own path (JUS-23) writes the
 *    attorney's details onto the case and no `Match` at all. The address on the
 *    case is looked up against registered attorney accounts, exactly as the
 *    payout layer does before binding a case's money: if it resolves, that
 *    account is the one that will receive, so it is the one to show and the one
 *    the plaintiff can message. If it resolves to nobody, what the plaintiff
 *    typed is what comes back — dropping them for want of a JustUs account would
 *    leave a represented plaintiff looking unrepresented on their own
 *    representation screen.
 *
 * Cases with neither are returned too, carrying their open-interest counts: a
 * case still looking for an attorney is part of where representation stands, and
 * it is the one that needs the plaintiff to act.
 */
export type RepresentationAttorney = {
	/** Their JustUs account. Null only for an attorney with no account here, which
	 *  is also what decides whether they can be messaged. */
	userId: string | null;
	/** AttorneyProfile id — what `/find-attorney/[id]` takes. Null when there is no
	 *  directory profile to open. */
	profileId: string | null;
	name: string;
	firm: string | null;
	practiceAreas: string[];
	location: string | null;
	headshotUrl: string | null;
	admittedYear: number | null;
	/** Bar standing right now. Null when they have no profile to check — an
	 *  attorney off-platform is unverified rather than failing verification, and
	 *  the two must not render the same. */
	verificationStatus: VerificationStatus | null;
	rating: number | null;
	reviewCount: number;
	/** The contact address on the case — what the plaintiff typed when they named
	 *  their own attorney. Not read from a matched attorney's account: a matched
	 *  attorney is reached through messaging, not by email. */
	email: string | null;
	/**
	 * How this attorney is attached to the case.
	 *
	 * `named_email` is the one the screen has to be careful about: the link rests
	 * on an address the plaintiff typed, so a mistyped one resolves to a real
	 * attorney who is not theirs. The card says so, for the same reason the bind
	 * step names the firm before the plaintiff confirms.
	 */
	linkedBy: "match" | "named_email";
};

export type RepresentationCase = {
	id: string;
	title: string;
	category: string;
	location: string;
	status: CaseStatus;
	/** The agreed fee in cents — the funding goal. 0 until a fee is agreed. */
	goalCents: number;
	raisedCents: number;
	donorsCount: number;
	createdAt: Date;
	publishedAt: Date | null;
	attorney: RepresentationAttorney | null;
	/** How the attorney came to represent this case. Null when the plaintiff named
	 *  them on the case rather than being matched through JustUs. */
	origin: MatchOrigin | null;
	matchedAt: Date | null;
	/** Attorneys awaiting the plaintiff's decision, and how many they haven't seen.
	 *  Only meaningful while the case has no attorney — once one is taken forward
	 *  the rest are moot, so they are reported as zero rather than as a decision
	 *  still owed. */
	openInterest: number;
	newInterest: number;
	/**
	 * The attorney the plaintiff named, who has yet to answer.
	 *
	 * Set only while the invitation is live. Its presence is the difference
	 * between "out to attorneys" and "out to exactly one attorney, and hidden from
	 * everyone else" — two states the plaintiff's screens read as one otherwise,
	 * and only one of which explains a week of silence.
	 */
	pendingInvitation: { email: string; expiresAt: Date } | null;
};

export async function listRepresentation(
	ownerId: string,
): Promise<RepresentationCase[]> {
	const [cases, interests] = await Promise.all([
		prisma.case.findMany({
			where: { ownerId, deletedAt: null },
			orderBy: { createdAt: "desc" },
			select: {
				id: true,
				title: true,
				category: true,
				location: true,
				status: true,
				goalCents: true,
				raisedCents: true,
				donorsCount: true,
				createdAt: true,
				publishedAt: true,
				// What the plaintiff typed — the fallback for the bring-your-own path,
				// and the only attorney detail an unmatched case has.
				attorneyName: true,
				attorneyFirm: true,
				attorneyArea: true,
				attorneyLocation: true,
				attorneyEmail: true,
				match: {
					select: {
						origin: true,
						createdAt: true,
						attorney: { select: { id: true, ...attorneySelect } },
					},
				},
			},
		}),
		interestCountsByCase(ownerId),
	]);

	// The addresses on cases nobody was matched to. Resolved in one query rather
	// than per case, and only for cases that need it.
	const [designated, invitations] = await Promise.all([
		designatedAttorneys(
			cases.filter((k) => !k.match).map((k) => k.attorneyEmail),
		),
		pendingInvitationsForCases(cases.filter((k) => !k.match).map((k) => k.id)),
	]);

	return cases.map((k) => {
		const invitation = invitations.get(k.id) ?? null;
		// An unanswered invitation is not representation. Reporting the typed name
		// as "your attorney" would tell the plaintiff they have one while the case
		// sits held back from every attorney, waiting on somebody who has agreed to
		// nothing — the two facts they most need told apart.
		const attorney = invitation
			? null
			: toRepresentationAttorney(
					k,
					designated.get(k.attorneyEmail?.trim().toLowerCase() ?? "") ?? null,
				);
		const counts = interests[k.id];
		return {
			id: k.id,
			title: k.title,
			category: k.category,
			location: k.location,
			status: k.status,
			goalCents: k.goalCents,
			raisedCents: k.raisedCents,
			donorsCount: k.donorsCount,
			createdAt: k.createdAt,
			publishedAt: k.publishedAt,
			attorney,
			origin: k.match?.origin ?? null,
			matchedAt: k.match?.createdAt ?? null,
			// Nobody can express interest in a case an invitation is holding back, so
			// the counts are zero for the same reason they are zero once an attorney
			// is settled: there is no decision owed.
			openInterest: attorney || invitation ? 0 : (counts?.open ?? 0),
			newInterest: attorney || invitation ? 0 : (counts?.unseen ?? 0),
			pendingInvitation: invitation
				? { email: invitation.email, expiresAt: invitation.expiresAt }
				: null,
		};
	});
}

/** An attorney account with the profile fields this screen reads. */
type AttorneyAccount = {
	id: string;
	name: string;
	jurisdiction: string | null;
	attorneyProfile: {
		id: string;
		legalName: string | null;
		firmName: string | null;
		officeCity: string | null;
		officeState: string | null;
		headshotUrl: string | null;
		practiceAreas: string[];
		admittedYear: number | null;
		verificationStatus: VerificationStatus;
		reviews: { rating: number }[];
	} | null;
};

/**
 * Registered attorneys behind the addresses plaintiffs typed on their cases,
 * keyed by lowercased email.
 *
 * Role-gated for the same reason `representingAttorney` gates the payout lookup:
 * only an attorney account can hold the firm's payout account, and resolving any
 * other role would put a stranger — a donor who happens to own that address — on
 * the plaintiff's representation screen as their counsel.
 */
async function designatedAttorneys(
	emails: (string | null)[],
): Promise<Map<string, AttorneyAccount>> {
	const wanted = [
		...new Set(
			emails
				.map((email) => email?.trim().toLowerCase())
				.filter((email): email is string => !!email),
		),
	];
	if (wanted.length === 0) return new Map();

	const users = await prisma.user.findMany({
		where: {
			role: "attorney",
			// Per-address rather than `in`, because addresses are compared without
			// case and `in` has no insensitive mode.
			OR: wanted.map((email) => ({
				email: { equals: email, mode: "insensitive" as const },
			})),
		},
		select: { id: true, email: true, ...attorneySelect },
	});
	return new Map(users.map((user) => [user.email.toLowerCase(), user]));
}

function toRepresentationAttorney(
	k: {
		attorneyName: string | null;
		attorneyFirm: string | null;
		attorneyArea: string | null;
		attorneyLocation: string | null;
		attorneyEmail: string | null;
		match: { attorney: AttorneyAccount } | null;
	},
	/** The account behind the address on the case, when one exists. Only consulted
	 *  where there is no match — a matched attorney is already an account. */
	designated: AttorneyAccount | null,
): RepresentationAttorney | null {
	const email = k.attorneyEmail?.trim() || null;
	const matched = k.match?.attorney;
	if (matched) return fromAccount(matched, k, email, "match");
	// Named on the case, and the address belongs to a registered attorney: that
	// account is the one the payout layer will bind this case's money to, so it is
	// the one to show — and the one the plaintiff can reach through messaging.
	if (designated) return fromAccount(designated, k, email, "named_email");
	if (!k.attorneyName) return null;
	// Named on the case, resolving to nobody: everything here is the plaintiff's
	// own entry, so there is no profile, no badge and no rating to claim.
	return {
		userId: null,
		profileId: null,
		name: k.attorneyName,
		firm: k.attorneyFirm,
		practiceAreas: k.attorneyArea ? [k.attorneyArea] : [],
		location: k.attorneyLocation,
		headshotUrl: null,
		admittedYear: null,
		verificationStatus: null,
		rating: null,
		reviewCount: 0,
		email,
		linkedBy: "named_email",
	};
}

function fromAccount(
	account: AttorneyAccount,
	k: {
		attorneyFirm: string | null;
		attorneyLocation: string | null;
	},
	email: string | null,
	linkedBy: "match" | "named_email",
): RepresentationAttorney {
	const profile = account.attorneyProfile;
	return {
		userId: account.id,
		profileId: profile?.id ?? null,
		// The bar-record name, as everywhere else — it is what verification ran
		// against. The account name is only a fallback.
		name: profile?.legalName ?? account.name,
		firm: profile?.firmName ?? k.attorneyFirm,
		practiceAreas: profile?.practiceAreas ?? [],
		location:
			account.jurisdiction ??
			profile?.officeState ??
			profile?.officeCity ??
			k.attorneyLocation,
		headshotUrl: profile?.headshotUrl ?? null,
		admittedYear: profile?.admittedYear ?? null,
		verificationStatus: profile?.verificationStatus ?? null,
		rating: averageRating(profile?.reviews ?? []),
		reviewCount: profile?.reviews.length ?? 0,
		email,
		linkedBy,
	};
}
