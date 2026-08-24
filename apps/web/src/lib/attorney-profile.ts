/**
 * The attorney directory profile's controlled vocabularies and shared rules.
 *
 * Framework-agnostic and safe to import from client components, like
 * `@just-us/auth/jurisdiction`. The form constrains the choices and the server
 * action re-checks them against these same lists — the action can be called
 * directly, so the allowlist here is the contract, not the UI.
 */

/**
 * Practice areas an attorney can claim. Deliberately the same vocabulary the
 * case wizard uses for categories (plus the areas cases fall under), so an
 * attorney's areas can be matched against a case's category by string equality.
 * Add to this list rather than letting attorneys type their own.
 */
export const PRACTICE_AREAS = [
	"Employment",
	"Wage & hours",
	"Housing",
	"Consumer fraud",
	"Elder care",
	"Civil rights",
	"Personal injury",
	"Medical malpractice",
	"Family",
	"Immigration",
	"Criminal defense",
	"Contract disputes",
	"Insurance disputes",
	"Disability & benefits",
	"Estate & probate",
	"Small business",
] as const;

export type PracticeArea = (typeof PRACTICE_AREAS)[number];

/** Languages an attorney can offer to work in. */
export const LANGUAGES = [
	"English",
	"Spanish",
	"Mandarin",
	"Cantonese",
	"Tagalog",
	"Vietnamese",
	"Arabic",
	"French",
	"Haitian Creole",
	"Korean",
	"Russian",
	"Portuguese",
	"Hindi",
	"Urdu",
	"Bengali",
	"Polish",
	"German",
	"Japanese",
	"American Sign Language",
] as const;

export type Language = (typeof LANGUAGES)[number];

export const FEE_APPROACHES = [
	{
		value: "flat",
		label: "Flat fee",
		blurb: "One agreed price for the matter.",
	},
	{
		value: "hourly",
		label: "Hourly",
		blurb: "Billed by the hour against the raised fee.",
	},
	{
		value: "contingency",
		label: "Contingency",
		blurb: "A share of the recovery. No fee range needed.",
	},
	{
		value: "quoted_per_case",
		label: "Quoted per case",
		blurb: "Priced case by case after you review it.",
	},
] as const;

export type FeeApproach = (typeof FEE_APPROACHES)[number]["value"];

/** Spelled out as a tuple (rather than mapped from FEE_APPROACHES) so it can be
 *  handed straight to `z.enum` and stays in step with the Prisma enum. */
export const FEE_APPROACH_VALUES = [
	"flat",
	"hourly",
	"contingency",
	"quoted_per_case",
] as const satisfies readonly FeeApproach[];

/** Contingency work is a share of the recovery, so a fee range is meaningless
 *  there. Every other approach can carry an indicative range. */
export function feeRangeApplies(approach: FeeApproach | ""): boolean {
	return approach !== "" && approach !== "contingency";
}

export const BIO_MAX = 600;
export const BACKGROUND_MAX = 400;

export function isPracticeArea(value: string): value is PracticeArea {
	return (PRACTICE_AREAS as readonly string[]).includes(value);
}

export function isLanguage(value: string): value is Language {
	return (LANGUAGES as readonly string[]).includes(value);
}

export function isFeeApproach(value: string): value is FeeApproach {
	return (FEE_APPROACH_VALUES as readonly string[]).includes(value);
}

/**
 * Practice-area split rule: the shares are optional, but a partial split is
 * meaningless — so once *any* area has a share, every selected area must have
 * one and they must total 100.
 *
 * `shares` is keyed by practice area; blank/absent entries count as unset.
 * Returns null when valid, otherwise the message to show.
 *
 * Server-side only for now: the profile form no longer collects a split, so
 * nothing populates this in normal use. It stays as the guard on the action,
 * which still accepts the field (a direct call could supply one) and on the
 * `AttorneyProfile.practiceAreaShares` column that backs it.
 */
export function validatePracticeAreaShares(
	areas: readonly string[],
	shares: Readonly<Record<string, number | undefined>>,
): string | null {
	const set = areas.filter((a) => typeof shares[a] === "number");
	if (set.length === 0) return null;

	if (set.length !== areas.length) {
		return "Give every practice area a share, or clear them all.";
	}
	if (areas.some((a) => (shares[a] as number) <= 0)) {
		return "Each share must be greater than 0%.";
	}
	const total = areas.reduce((sum, a) => sum + (shares[a] as number), 0);
	if (total !== 100) {
		return `Shares must total 100%. They currently total ${total}%.`;
	}
	return null;
}
