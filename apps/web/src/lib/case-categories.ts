/**
 * Canonical case categories shared by the submission wizard, manage-case
 * editor, and browse/directory filters. Keep these in sync — filters that
 * diverge from the wizard leave submitted categories unreachable.
 */
export const CASE_CATEGORIES = [
	"Employment",
	"Wage & hours",
	"Housing",
	"Consumer fraud",
	"Elder care",
	"Civil rights",
	"Personal injury",
	"Other",
] as const;

export type CaseCategory = (typeof CASE_CATEGORIES)[number];
