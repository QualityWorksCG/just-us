"use server";

import { isValidJurisdiction } from "@just-us/auth/jurisdiction";
import {
	type AttorneyProfileDraft,
	saveAttorneyProfile,
} from "@just-us/db/attorney-profile";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
	BACKGROUND_MAX,
	BIO_MAX,
	FEE_APPROACH_VALUES,
	feeRangeApplies,
	isFeeApproach,
	isLanguage,
	isPracticeArea,
} from "@/lib/attorney-profile";
import { requireRole } from "@/lib/auth-server";
import { formatPhone, isValidPhone } from "@/lib/validation";

/**
 * What the form sends: everything optional, because the profile autosaves as a
 * draft from the first keystroke. Values are strings/arrays straight off the
 * form — this module is what turns them into something storable.
 */
const inputSchema = z.object({
	legalName: z.string().optional(),
	firmName: z.string().optional(),
	officeCity: z.string().optional(),
	officeState: z.string().optional(),
	contactEmail: z.string().optional(),
	contactPhone: z.string().optional(),
	websiteUrl: z.string().optional(),
	headshotUrl: z.string().nullish(),
	practiceAreas: z.array(z.string()).optional(),
	languages: z.array(z.string()).optional(),
	acceptingNewCases: z.boolean().optional(),
	virtualConsultation: z.boolean().optional(),
	feeApproach: z.string().optional(),
	feeRangeMinCents: z.number().int().nonnegative().nullish(),
	feeRangeMaxCents: z.number().int().nonnegative().nullish(),
	bio: z.string().optional(),
	background: z.string().optional(),
});

export type SaveAttorneyProfileInput = z.input<typeof inputSchema>;

/**
 * Draft rule for a free-text field.
 *
 * Empty means the attorney cleared it, so that's stored as null. A non-empty
 * value that isn't valid yet is *omitted* rather than stored or nulled — that's
 * what stops a half-typed email ("marcus@") from wiping a saved one when
 * autosave fires mid-keystroke. `undefined` in, `undefined` out.
 */
function draftText(
	raw: string | undefined,
	max: number,
	isValid?: (value: string) => boolean,
): string | null | undefined {
	if (raw === undefined) return undefined;
	const trimmed = raw.trim();
	if (!trimmed) return null;
	if (trimmed.length > max) return undefined;
	if (isValid && !isValid(trimmed)) return undefined;
	return trimmed;
}

function isEmail(value: string): boolean {
	return z.string().email().safeParse(value).success;
}

function isHttpUrl(value: string): boolean {
	const parsed = z.string().url().safeParse(value);
	return parsed.success && /^https?:\/\//.test(value);
}

/** Turn raw form input into a partial write, dropping anything not yet valid. */
function toDraft(input: z.infer<typeof inputSchema>): AttorneyProfileDraft {
	const feeApproach =
		input.feeApproach === undefined
			? undefined
			: input.feeApproach === ""
				? null
				: isFeeApproach(input.feeApproach)
					? input.feeApproach
					: undefined;

	// A fee range means nothing on contingency work, so it's cleared rather than
	// stored when that's the chosen approach.
	const keepRange = feeApproach ? feeRangeApplies(feeApproach) : true;

	return {
		legalName: draftText(input.legalName, 120),
		firmName: draftText(input.firmName, 160),
		officeCity: draftText(input.officeCity, 80),
		officeState: draftText(input.officeState, 60, isValidJurisdiction),
		contactEmail: draftText(input.contactEmail, 160, isEmail),
		// Stored in one shape whether it arrived masked from the form or as digits.
		contactPhone: (() => {
			const value = draftText(input.contactPhone, 32, isValidPhone);
			return typeof value === "string" ? formatPhone(value) : value;
		})(),
		websiteUrl: draftText(input.websiteUrl, 300, isHttpUrl),
		headshotUrl:
			input.headshotUrl === undefined
				? undefined
				: (draftText(input.headshotUrl ?? "", 500, isHttpUrl) ?? null),
		// Vocabulary is an allowlist, not a suggestion — unknown values are dropped
		// rather than stored, and the cap mirrors the form's.
		practiceAreas: input.practiceAreas
			?.filter(isPracticeArea)
			.filter((area, i, all) => all.indexOf(area) === i)
			.slice(0, 8),
		languages: input.languages
			?.filter(isLanguage)
			.filter((lang, i, all) => all.indexOf(lang) === i)
			.slice(0, 12),
		acceptingNewCases: input.acceptingNewCases,
		virtualConsultation: input.virtualConsultation,
		feeApproach,
		feeRangeMinCents: keepRange ? input.feeRangeMinCents : null,
		feeRangeMaxCents: keepRange ? input.feeRangeMaxCents : null,
		bio: draftText(input.bio, BIO_MAX),
		background: draftText(input.background, BACKGROUND_MAX),
	};
}

/**
 * What a profile needs to be shown in the directory — the "Required" fields from
 * the spec. This is no longer a gate on *saving* (autosave stores drafts), it's
 * the definition of ready, checked against what's actually stored so it can't
 * drift from the data.
 *
 * Bar verification is a separate gate on top of this.
 */
const directoryReadySchema = z.object({
	legalName: z.string().trim().min(2),
	officeCity: z.string().trim().min(1),
	officeState: z.string().refine(isValidJurisdiction),
	contactEmail: z.string().trim().email(),
	practiceAreas: z.array(z.string()).min(1),
	feeApproach: z.enum(FEE_APPROACH_VALUES),
});

export type SaveAttorneyProfileResult =
	| {
			ok: true;
			/** True once the stored profile has everything the directory needs. */
			directoryReady: boolean;
			/** True when the bio is awaiting moderation. */
			bioPending: boolean;
			savedAt: number;
	  }
	| { ok: false; error: string };

/**
 * Save the signed-in attorney's directory profile. Called both by autosave and
 * by the manual "Save now" button — there's one write path, so the two can't
 * diverge.
 */
export async function saveAttorneyProfileAction(
	input: SaveAttorneyProfileInput,
): Promise<SaveAttorneyProfileResult> {
	const { session } = await requireRole("attorney");

	const parsed = inputSchema.safeParse(input);
	if (!parsed.success) {
		return { ok: false, error: "Couldn't save your profile." };
	}

	try {
		const saved = await saveAttorneyProfile(
			session.user.id,
			toDraft(parsed.data),
		);
		revalidatePath("/dashboard/profile");
		return {
			ok: true,
			directoryReady: directoryReadySchema.safeParse(saved).success,
			bioPending: saved.bioStatus === "pending",
			savedAt: Date.now(),
		};
	} catch {
		return {
			ok: false,
			error: "Couldn't save your profile. Please try again.",
		};
	}
}
