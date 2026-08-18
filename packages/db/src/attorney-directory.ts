import type { FeeApproach } from "../prisma/generated/enums";
import prisma from "./index";

/**
 * The public attorney directory.
 *
 * Two rules the product copy makes explicit, enforced here rather than in the UI:
 *
 *   1. Only bar-verified profiles are listed. "An open directory of bar-verified
 *      attorneys" has to be true, so an unverified or under-review profile does
 *      not appear at all.
 *   2. Ordering is only ever what the visitor asked for. There is no relevance
 *      score, no boost, and no per-case ranking — the footer promises attorneys
 *      are "never ranked for your case", and the only way to keep that promise is
 *      to have no such ranking to apply.
 */

export type DirectorySort = "name" | "rating" | "availability";

export type DirectoryFilters = {
	/** One of PRACTICE_AREAS, or undefined for all. */
	practiceArea?: string;
	/** A US state. Matched against the states the attorney is *admitted* in, so an
	 *  attorney licensed in three states is found under all three. */
	state?: string;
	/** Free text over name, firm, and practice areas. */
	keyword?: string;
	sort?: DirectorySort;
};

/** A profile is listed only once its bar standing is confirmed and it has the
 *  fields a visitor needs to choose. */
function listableWhere(filters: DirectoryFilters) {
	const keyword = filters.keyword?.trim();
	return {
		verificationStatus: "verified" as const,
		legalName: { not: null },
		...(filters.practiceArea
			? { practiceAreas: { has: filters.practiceArea } }
			: {}),
		// The filter is labelled "Licensed in", so it matches an admission rather than
		// the office address — and `some`, because a licence is per state and an
		// attorney holding several must be findable under each. Only their verified
		// admissions count: the directory's whole promise is that a listed attorney
		// can actually take the work, and a state they have merely claimed cannot.
		...(filters.state
			? {
					user: {
						is: {
							admissions: {
								some: {
									state: filters.state,
									verificationStatus: "verified" as const,
								},
							},
						},
					},
				}
			: {}),
		...(keyword
			? {
					OR: [
						{ legalName: { contains: keyword, mode: "insensitive" as const } },
						{ firmName: { contains: keyword, mode: "insensitive" as const } },
						{ practiceAreas: { has: keyword } },
						{ bio: { contains: keyword, mode: "insensitive" as const } },
					],
				}
			: {}),
	};
}

const listSelect = {
	id: true,
	legalName: true,
	firmName: true,
	officeCity: true,
	officeState: true,
	headshotUrl: true,
	practiceAreas: true,
	languages: true,
	admittedYear: true,
	acceptingNewCases: true,
	virtualConsultation: true,
	feeApproach: true,
	bio: true,
	user: {
		select: {
			id: true,
			jurisdiction: true,
			// Verified only — see `listableWhere`. These are the states a plaintiff can
			// actually engage this attorney in.
			admissions: {
				where: { verificationStatus: "verified" as const },
				select: { state: true },
				orderBy: { state: "asc" as const },
			},
		},
	},
	reviews: {
		where: { published: true },
		select: { rating: true, quote: true, byline: true },
		orderBy: { createdAt: "desc" as const },
	},
} as const;

/** Average of published review ratings, or null when there are none. Rounded to
 *  one decimal, which is the precision the directory displays.
 *
 *  Exported because the representation inbox shows the same attorneys (JUS-25) —
 *  two copies of this could round differently and show one attorney two ratings
 *  in two places. */
export function averageRating(reviews: { rating: number }[]): number | null {
	if (!reviews.length) return null;
	const total = reviews.reduce((sum, r) => sum + r.rating, 0);
	return Math.round((total / reviews.length) * 10) / 10;
}

export type DirectoryAttorney = {
	/** Account id used for actions such as opening a one-to-one conversation. */
	userId: string;
	/** Directory profile id, used only in the public profile route. */
	id: string;
	legalName: string;
	firmName: string | null;
	/** The primary state — the one the card leads with. */
	state: string | null;
	/** Every state this attorney is verified in, alphabetically. Includes the
	 *  primary; empty only for a legacy row with no admissions. */
	states: string[];
	headshotUrl: string | null;
	practiceAreas: string[];
	bio: string | null;
	/** Revealed on the card's hover strip rather than in the always-visible rows —
	 *  useful for comparing a shortlist, but not what you scan by. */
	officeCity: string | null;
	languages: string[];
	admittedYear: number | null;
	acceptingNewCases: boolean;
	virtualConsultation: boolean;
	feeApproach: FeeApproach | null;
	rating: number | null;
	reviewCount: number;
	/** Newest published review, shown as a pull-quote on the card. */
	topReview: { quote: string; byline: string } | null;
};

/**
 * Listed attorneys, ordered as asked.
 *
 * Rating and availability sorts happen in memory: the rating is an average over a
 * relation Postgres can't order by directly, and the directory is small enough
 * that fetching then sorting is simpler — and honest — compared with a
 * denormalised score column that could drift from the reviews it summarises.
 */
export async function listDirectoryAttorneys(
	filters: DirectoryFilters = {},
): Promise<DirectoryAttorney[]> {
	const rows = await prisma.attorneyProfile.findMany({
		where: listableWhere(filters),
		select: listSelect,
		orderBy: { legalName: "asc" },
	});

	const attorneys: DirectoryAttorney[] = rows.map((row) => ({
		id: row.id,
		userId: row.user.id,
		// Non-null by the `legalName: { not: null }` filter above.
		legalName: row.legalName ?? "",
		firmName: row.firmName,
		// The primary state leads, for a card that has room for one. `states` carries
		// the rest, because "licensed in New York" about an attorney admitted in three
		// is a third of the truth.
		state: row.user.jurisdiction ?? row.officeState,
		states: row.user.admissions.map((a) => a.state),
		headshotUrl: row.headshotUrl,
		practiceAreas: row.practiceAreas,
		bio: row.bio,
		officeCity: row.officeCity,
		languages: row.languages,
		admittedYear: row.admittedYear,
		acceptingNewCases: row.acceptingNewCases,
		virtualConsultation: row.virtualConsultation,
		feeApproach: row.feeApproach,
		rating: averageRating(row.reviews),
		reviewCount: row.reviews.length,
		topReview: row.reviews[0]
			? { quote: row.reviews[0].quote, byline: row.reviews[0].byline }
			: null,
	}));

	if (filters.sort === "rating") {
		// Unrated attorneys sort last rather than as zero — a new listing isn't a
		// badly-reviewed one.
		attorneys.sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1));
	} else if (filters.sort === "availability") {
		attorneys.sort(
			(a, b) => Number(b.acceptingNewCases) - Number(a.acceptingNewCases),
		);
	}
	return attorneys;
}

export type DirectoryProfile = NonNullable<
	Awaited<ReturnType<typeof getDirectoryAttorney>>
>;

/**
 * One listed attorney's full public profile, or null when the id is unknown or
 * the profile isn't listed.
 *
 * The bio is withheld unless moderation approved it, matching
 * `getPublicAttorneyProfile` — an unreviewed bio must not reach the public via a
 * second route.
 */
export async function getDirectoryAttorney(id: string) {
	const profile = await prisma.attorneyProfile.findFirst({
		where: { id, verificationStatus: "verified", legalName: { not: null } },
		include: {
			user: { select: { id: true, jurisdiction: true, barNumber: true } },
			reviews: {
				where: { published: true },
				orderBy: { createdAt: "desc" },
			},
			caseRecords: { orderBy: { year: "desc" } },
			verifications: { orderBy: { createdAt: "desc" }, take: 1 },
		},
	});
	if (!profile) return null;

	return {
		...profile,
		bio: profile.bioStatus === "approved" ? profile.bio : null,
		rating: averageRating(profile.reviews),
		reviewCount: profile.reviews.length,
		wonCount: profile.caseRecords.filter((c) => c.outcome === "won").length,
		settledCount: profile.caseRecords.filter((c) => c.outcome === "settled")
			.length,
	};
}

/** Practice areas that actually have a listed attorney, so the filter never
 *  offers a choice that returns nothing. */
export async function listedPracticeAreas(): Promise<string[]> {
	const rows = await prisma.attorneyProfile.findMany({
		where: { verificationStatus: "verified" },
		select: { practiceAreas: true },
	});
	return [...new Set(rows.flatMap((r) => r.practiceAreas))].sort();
}

/** States that actually have a listed attorney — every state any listed attorney
 *  is verified in, not just the one their card leads with. */
export async function listedStates(): Promise<string[]> {
	const rows = await prisma.attorneyAdmission.findMany({
		where: {
			verificationStatus: "verified",
			user: {
				is: { attorneyProfile: { is: { verificationStatus: "verified" } } },
			},
		},
		distinct: ["state"],
		select: { state: true },
		orderBy: { state: "asc" },
	});
	return rows.map((row) => row.state);
}
