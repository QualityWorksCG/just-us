/**
 * Bar-standing verification: shared vocabulary and status mapping.
 *
 * Deliberately thin. The model searches public records and reports what it found;
 * that report is taken at face value. There is no corroboration policy, no source
 * grading, and no name matching — an earlier version had all three and the effect
 * was that essentially nothing could ever be verified automatically, because bar
 * registries block automated access.
 *
 * The trade that buys: a badge means "a web search concluded this attorney is
 * licensed", not "the licensing authority confirmed it". Every check stores its
 * sources so a person can check the working, and an administrator can override.
 */

export type VerificationStatus =
	| "unverified"
	| "pending"
	| "verified"
	| "needs_review"
	| "rejected";

/** One citation backing a check. */
export type VerificationSource = {
	url: string;
	title: string;
};

export const STATUS_COPY: Record<
	VerificationStatus,
	{ label: string; blurb: string; tone: "neutral" | "good" | "warn" | "bad" }
> = {
	unverified: {
		label: "Unverified",
		blurb:
			"We haven't checked your bar standing yet. Run a check to get verified.",
		tone: "neutral",
	},
	pending: {
		label: "Checking…",
		blurb: "Searching public bar records. This takes about ten seconds.",
		tone: "neutral",
	},
	verified: {
		label: "Verified",
		blurb:
			"Public records show you're a licensed attorney. Plaintiffs see a verified badge on your listing.",
		tone: "good",
	},
	needs_review: {
		label: "Needs review",
		blurb:
			"The search couldn't reach a clear answer either way. An administrator will take a look, and no action is needed from you.",
		tone: "warn",
	},
	rejected: {
		label: "Not verified",
		blurb:
			"Public records didn't show an active licence for these details. Check your name and state, then try again.",
		tone: "bad",
	},
};

/** What a check reported. */
export type VerificationEvidence = {
	isLicensedAttorney: boolean | null;
	inGoodStanding: boolean | null;
};

/**
 * Map a report onto a status.
 *
 * Licensed means verified. An explicit "not licensed" or "not in good standing"
 * means rejected. Only a genuinely inconclusive answer — the model couldn't tell
 * either way — reaches a human.
 */
export function decideStatus(
	evidence: VerificationEvidence,
): VerificationStatus {
	if (evidence.isLicensedAttorney === false) return "rejected";
	if (evidence.inGoodStanding === false) return "rejected";
	if (evidence.isLicensedAttorney === true) return "verified";
	return "needs_review";
}

/**
 * How long before a completed check can be re-run, to bound search costs.
 *
 * TEMPORARILY 0 for testing — restore to `60 * 60 * 1000` (1 hour) before this
 * ships. At 0 every click spends a couple of web-search calls, so nothing limits
 * how much a single attorney can cost.
 */
export const RECHECK_COOLDOWN_MS = 0;
