import { Prisma } from "../prisma/generated/client";
import type {
	FeeApproach,
	VerificationStatus,
} from "../prisma/generated/enums";
import {
	clearAdmissionStandings,
	currentBadge,
	ensureAdmission,
	recordAdmissionCheck,
} from "./admissions";
import { writeAudit } from "./audit";
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

/**
 * The signed-in attorney's own profile, with the account fields verification
 * needs (bar number and licensing state live on `User`, from sign-up) and the
 * newest check. Null until the first autosave creates a row.
 */
export async function getAttorneyProfile(userId: string) {
	return prisma.attorneyProfile.findUnique({
		where: { userId },
		include: {
			user: { select: { barNumber: true, jurisdiction: true, name: true } },
			verifications: { orderBy: { createdAt: "desc" }, take: 1 },
		},
	});
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

/** A recorded bar-standing check. `status` is decided by policy in the web app,
 *  not taken from the model — see `decideStatus`. */
export type VerificationRecord = {
	status: VerificationStatus;
	confidence: number;
	isLicensedAttorney: boolean | null;
	inGoodStanding: boolean | null;
	licenseStatusText: string | null;
	matchedName: string | null;
	matchedBarNumber: string | null;
	matchedJurisdiction: string | null;
	disciplinaryNotes: string | null;
	summary: string;
	/** The licensee record the model reported reading, or null. Decides the badge. */
	officialRecordUrl: string | null;
	sources: { url: string; title: string }[];
	checkedName: string | null;
	checkedJurisdiction: string | null;
	model: string;
	triggeredBy: string | null;
};

/**
 * Record a check and move both badges it decides to match, in one transaction.
 *
 * A check runs against one state, so it settles two things. The admission for
 * `checkedJurisdiction` takes the status directly — that is the record every
 * matching gate reads, and it is what says whether this attorney may act on a
 * case in that state. The profile badge is then re-derived from *all* the
 * attorney's admissions rather than set to this result: an attorney verified in
 * New York and refused in New Jersey is still a verified attorney, and a badge
 * that downgraded on the second check would say otherwise. See
 * `badgeFromAdmissions`.
 *
 * All of it in one transaction, because a badge that disagreed with its own
 * evidence would be worse than no badge. `verifiedAt` is only ever advanced,
 * never cleared, so a later downgrade still leaves a record of when this attorney
 * was last trusted.
 */
export async function recordVerification(
	profileId: string,
	record: VerificationRecord,
) {
	return prisma.$transaction(async (tx) => {
		const created = await tx.attorneyVerification.create({
			data: { profileId, ...record },
		});
		const profile = await tx.attorneyProfile.findUnique({
			where: { id: profileId },
			select: { userId: true },
		});
		if (profile && record.checkedJurisdiction) {
			await recordAdmissionCheck(
				tx,
				profile.userId,
				record.checkedJurisdiction,
				record.status,
			);
		}
		const badge = profile
			? await currentBadge(tx, profile.userId)
			: record.status;
		await tx.attorneyProfile.update({
			where: { id: profileId },
			data: {
				verificationStatus: badge,
				...(badge === "verified" ? { verifiedAt: new Date() } : {}),
			},
		});
		return created;
	});
}

export type AdminVerificationResult =
	| { ok: true; status: VerificationStatus }
	| { ok: false; reason: "not_attorney" };

/**
 * An administrator's manual bar-standing decision (JUS-13).
 *
 * The automatic check (`recordVerification`) is the usual path; this is the
 * override the model's own docs promise — "an administrator can override any
 * result". It writes the same two coupled rows every check does — an
 * `AttorneyVerification` for the evidence trail and the `AttorneyProfile` badge
 * cache — plus an audit entry, all in one transaction, so the badge, its history,
 * and who changed it can never drift apart.
 *
 * The verification row is stamped `overriddenBy`/`triggeredBy` with the admin and
 * `model: "admin-override"`, so a manual decision is always distinguishable from
 * one the model reached. A profile row is created if the attorney never saved one
 * — the badge is the gate for representing cases, and an attorney shouldn't have
 * to fill in a directory profile before an administrator can vouch for them.
 */
export async function adminSetVerification(
	userId: string,
	adminId: string,
	status: "verified" | "unverified",
	note?: string,
): Promise<AdminVerificationResult> {
	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: { role: true, name: true, jurisdiction: true },
	});
	if (user?.role !== "attorney") {
		return { ok: false, reason: "not_attorney" };
	}

	const verified = status === "verified";

	await prisma.$transaction(async (tx) => {
		// An administrator vouching for an attorney is vouching for one bar record,
		// so a grant reaches the primary state alone — the state the evidence row
		// below names. Withdrawing trust is a judgement about the person, so it
		// clears every state: leaving the others verified would keep a side door
		// open onto cases in them.
		if (verified) {
			if (user.jurisdiction) {
				await ensureAdmission(tx, userId, user.jurisdiction);
				await recordAdmissionCheck(tx, userId, user.jurisdiction, "verified");
			}
		} else {
			await clearAdmissionStandings(tx, userId);
		}

		const profile = await tx.attorneyProfile.upsert({
			where: { userId },
			// No bio to review on a bare row, so `approved` matches the "no bio =
			// approved" rule saveAttorneyProfile uses, keeping it out of moderation.
			create: {
				userId,
				verificationStatus: status,
				bioStatus: "approved",
				...(verified ? { verifiedAt: new Date() } : {}),
			},
			update: {
				verificationStatus: status,
				...(verified ? { verifiedAt: new Date() } : {}),
			},
			select: { id: true },
		});

		await tx.attorneyVerification.create({
			data: {
				profileId: profile.id,
				status,
				confidence: 0,
				isLicensedAttorney: verified ? true : null,
				inGoodStanding: verified ? true : null,
				summary: verified
					? "Bar standing marked verified by an administrator."
					: "Verification cleared by an administrator.",
				sources: [],
				checkedName: user.name,
				checkedJurisdiction: user.jurisdiction,
				model: "admin-override",
				triggeredBy: adminId,
				overriddenBy: adminId,
				...(note ? { overriddenReason: note } : {}),
			},
		});

		await writeAudit(tx, {
			actorId: adminId,
			action: verified ? "attorney.verified" : "attorney.verification_cleared",
			targetType: "user",
			targetId: userId,
			...(note ? { reason: note } : {}),
		});
	});

	return { ok: true, status };
}

/**
 * An administrator's ruling on **one state** an attorney claims — the manual
 * counterpart to a bar scan, for when the automatic check couldn't reach a clear
 * answer and the attorney's request lands in review.
 *
 * A licence is per state (see `admissions`), so this grants or clears trust for a
 * single admission rather than the whole account. It ensures the admission exists
 * (the attorney claimed it, but an admin can also vouch for one they haven't yet),
 * records the check on that state, then recomputes the profile's coarse badge from
 * *all* the attorney's admissions — one verified state is enough to make the
 * account a verified attorney, so the badge follows the best standing. The
 * evidence row names the state, so the trail shows exactly what was decided.
 */
export async function adminSetAdmissionVerification(
	userId: string,
	adminId: string,
	state: string,
	status: "verified" | "unverified",
	note?: string,
): Promise<AdminVerificationResult> {
	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: { role: true, name: true },
	});
	if (user?.role !== "attorney") {
		return { ok: false, reason: "not_attorney" };
	}

	await prisma.$transaction(async (tx) => {
		await ensureAdmission(tx, userId, state);
		await recordAdmissionCheck(tx, userId, state, status);

		// The profile badge is the coarse "is this a checked attorney at all" cache
		// the directory and queue banner read; it is whatever the attorney's
		// admissions add up to (best standing wins), never just this one state.
		const badge = await currentBadge(tx, userId);
		const profile = await tx.attorneyProfile.upsert({
			where: { userId },
			create: {
				userId,
				verificationStatus: badge,
				bioStatus: "approved",
				...(badge === "verified" ? { verifiedAt: new Date() } : {}),
			},
			update: {
				verificationStatus: badge,
				...(badge === "verified" ? { verifiedAt: new Date() } : {}),
			},
			select: { id: true },
		});

		const verified = status === "verified";
		await tx.attorneyVerification.create({
			data: {
				profileId: profile.id,
				status,
				confidence: 0,
				isLicensedAttorney: verified ? true : null,
				inGoodStanding: verified ? true : null,
				summary: verified
					? `${state} bar standing marked verified by an administrator.`
					: `${state} verification cleared by an administrator.`,
				sources: [],
				checkedName: user.name,
				checkedJurisdiction: state,
				model: "admin-override",
				triggeredBy: adminId,
				overriddenBy: adminId,
				...(note ? { overriddenReason: note } : {}),
			},
		});

		await writeAudit(tx, {
			actorId: adminId,
			action: verified ? "attorney.verified" : "attorney.verification_cleared",
			targetType: "user",
			targetId: userId,
			reason: note ? `${state}: ${note}` : state,
		});
	});

	return { ok: true, status };
}

/**
 * The newest check that ran against one state.
 *
 * The cooldown is held per state — an attorney adding New Jersey should not be
 * told to wait because New York was checked ten minutes ago — and this is what
 * that reads. Matched on `checkedJurisdiction`, which every check records for
 * exactly this reason.
 */
export async function lastVerificationForState(
	profileId: string,
	state: string,
) {
	return prisma.attorneyVerification.findFirst({
		where: { profileId, checkedJurisdiction: state },
		orderBy: { createdAt: "desc" },
		select: { status: true, createdAt: true },
	});
}

/** Every check for a profile, newest first — the evidence trail behind a badge. */
export async function listVerifications(profileId: string, take = 10) {
	return prisma.attorneyVerification.findMany({
		where: { profileId },
		orderBy: { createdAt: "desc" },
		take,
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
