import { Prisma } from "../prisma/generated/client";
import type { FeeApproach } from "../prisma/generated/enums";
import prisma from "./index";

/**
 * A partial write of the attorney's directory profile.
 *
 * `undefined` and `null` mean different things here, and the distinction is what
 * makes autosave safe:
 *   - `undefined` — leave the stored value alone. Used when a field is mid-edit
 *     and not yet valid, so a half-typed email never overwrites a good one.
 *   - `null` — clear the stored value. The attorney deleted it on purpose.
 */
export type AttorneyProfileDraft = {
	legalName?: string | null;
	firmName?: string | null;
	officeCity?: string | null;
	officeState?: string | null;
	contactEmail?: string | null;
	contactPhone?: string | null;
	websiteUrl?: string | null;
	headshotUrl?: string | null;
	practiceAreas?: string[];
	/** `{ "<area>": <pct> }`, or null to clear the split. */
	practiceAreaShares?: Record<string, number> | null;
	languages?: string[];
	acceptingNewCases?: boolean;
	virtualConsultation?: boolean;
	feeApproach?: FeeApproach | null;
	feeRangeMinCents?: number | null;
	feeRangeMaxCents?: number | null;
	bio?: string | null;
	background?: string | null;
};

/** The signed-in attorney's own profile, moderation state included. Null until
 *  the first autosave creates a row. */
export async function getAttorneyProfile(userId: string) {
	return prisma.attorneyProfile.findUnique({ where: { userId } });
}

/**
 * Create or update the attorney's profile, writing only the keys provided.
 *
 * Lenient by design — this is the draft save behind autosave, so it stores
 * whatever is filled in without insisting the profile be complete. Whether the
 * profile is complete enough to appear in the directory is derived from the
 * stored columns by the caller, not enforced here.
 *
 * Editing the bio sends it back through moderation: an approved bio that changes
 * returns to `pending`, so unreviewed text can never inherit an earlier
 * approval. An unchanged bio keeps its state, so autosaving an unrelated field
 * doesn't cost the attorney their approval.
 */
export async function saveAttorneyProfile(
	userId: string,
	fields: AttorneyProfileDraft,
) {
	const existing = await prisma.attorneyProfile.findUnique({
		where: { userId },
		select: { bio: true },
	});

	// Only the keys actually supplied — see the type's note on undefined vs null.
	const data: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(fields)) {
		if (value !== undefined) data[key] = value;
	}

	// Prisma separates a JSON `null` value from a NULL column; clearing the split
	// means the column is NULL.
	if (data.practiceAreaShares === null) {
		data.practiceAreaShares = Prisma.DbNull;
	}

	// Only reconsider moderation when the bio itself was part of this write.
	const bioTouched = fields.bio !== undefined;
	const bioChanged =
		bioTouched &&
		(!existing || (existing.bio ?? null) !== (fields.bio ?? null));
	const moderation = bioChanged
		? {
				// No bio needs no review; new text does.
				bioStatus: fields.bio ? ("pending" as const) : ("approved" as const),
				bioReviewedAt: null,
			}
		: {};

	return prisma.attorneyProfile.upsert({
		where: { userId },
		create: {
			userId,
			...data,
			bioStatus: fields.bio ? "pending" : "approved",
		},
		update: { ...data, ...moderation },
	});
}

/**
 * The public view of an attorney's profile: the bio is withheld until it has
 * been approved, so unreviewed text never reaches the directory even if a caller
 * forgets to check the status.
 */
export async function getPublicAttorneyProfile(userId: string) {
	const profile = await prisma.attorneyProfile.findUnique({
		where: { userId },
	});
	if (!profile) return null;
	return {
		...profile,
		bio: profile.bioStatus === "approved" ? profile.bio : null,
	};
}
