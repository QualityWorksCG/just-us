import type {
	RequestStatus,
	VerificationStatus,
} from "../prisma/generated/enums";
import { averageRating } from "./attorney-directory";
import prisma from "./index";

/**
 * The plaintiff's side of representation: the inbox of attorneys who have
 * expressed interest in a seeking case, and taking one of them forward (JUS-25).
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
