"use server";

import {
	isValidJurisdiction,
	JURISDICTION_MESSAGE,
} from "@just-us/auth/jurisdiction";
import {
	getAttorneyProfile,
	recordVerification,
	updateAttorneyJurisdiction,
} from "@just-us/db/attorney-profile";
import { env } from "@just-us/env/server";
import { revalidatePath } from "next/cache";

import {
	decideStatus,
	RECHECK_COOLDOWN_MS,
	type VerificationEvidence,
	type VerificationSource,
	type VerificationStatus,
} from "@/lib/attorney-verification";
import { requireRole } from "@/lib/auth-server";

/**
 * Bar-standing verification via a web search.
 *
 * One question in, a report out — the model's determination is taken at face
 * value (see `decideStatus`). Sources are still captured on every check so a
 * person can check the working, and an administrator can override any result.
 */

// Web search runs on the Responses API, not chat/completions.
//
// Measured on a real Florida attorney, all reaching the same verdict:
//   gpt-4o, thorough prompt              1 search    failed to find him
//   gpt-5.5, thorough prompt, default    12 searches 82s
//   gpt-5.5, lean prompt, effort:low     2 searches  11s, bar number captured
//
// The prompt was doing most of the damage: asking it to exhaust the web and cite
// everything produced a dozen searches. Told to answer from the first good
// result, it lands in a couple — and extracts the bar number more reliably,
// because it isn't drowning in pages.
const MODEL = "gpt-5.5";
// Low effort is the difference between 11s and 82s. This is a lookup, not a
// reasoning problem: the judgement is "does this page say he's licensed".
const REASONING_EFFORT = "low";

/** Strict JSON schema: every property required, no extras. */
const RESULT_SCHEMA = {
	type: "object",
	additionalProperties: false,
	required: [
		"isLicensedAttorney",
		"inGoodStanding",
		"confidence",
		"matchedName",
		"matchedBarNumber",
		"matchedJurisdiction",
		"licenseStatusText",
		"officialRecordUrl",
		"disciplinaryNotes",
		"summary",
		"sources",
	],
	properties: {
		isLicensedAttorney: {
			type: ["boolean", "null"],
			description:
				"True only if a record shows this person admitted to practise law. Null if nothing conclusive was found.",
		},
		inGoodStanding: {
			type: ["boolean", "null"],
			description:
				"True only if the record shows an active licence in good standing. False if suspended, disbarred, inactive, or lapsed. Null if not stated.",
		},
		confidence: {
			type: "integer",
			description:
				"0-100. How confident you are that the record found is THIS person. Lower it sharply for common names or when the bar number could not be confirmed.",
		},
		matchedName: {
			type: ["string", "null"],
			description: "Name exactly as written on the record found.",
		},
		matchedBarNumber: {
			type: ["string", "null"],
			description: "Bar/licence number exactly as written on the record found.",
		},
		matchedJurisdiction: {
			type: ["string", "null"],
			description: "Licensing jurisdiction stated on the record.",
		},
		licenseStatusText: {
			type: ["string", "null"],
			description:
				'Status verbatim from the source, e.g. "Active" or "Suspended".',
		},
		officialRecordUrl: {
			type: ["string", "null"],
			description:
				"URL of the individual licensee record you actually opened and read on the licensing authority's own site. Null if you could not reach one — do NOT substitute the directory's search page, a commercial directory, or the attorney's own website.",
		},
		disciplinaryNotes: {
			type: ["string", "null"],
			description:
				"Any discipline, sanction, or suspension found. Null if the record explicitly shows none.",
		},
		summary: {
			type: "string",
			description:
				"2-4 sentences: what you searched, what you found, and what you could not confirm.",
		},
		sources: {
			type: "array",
			description:
				"Every page you relied on. Official bar or court registries first.",
			items: {
				type: "object",
				additionalProperties: false,
				required: ["url", "title"],
				properties: {
					url: { type: "string" },
					title: { type: "string" },
				},
			},
		},
	},
} as const;

const SYSTEM_PROMPT = `Say whether this person is a licensed attorney in the given US state, and whether the licence is active.

Do one or two web searches, then answer from what you find. State bar directories and established legal directories both count as evidence. Do not keep searching once you have a clear answer.

- isLicensedAttorney: true if sources show them admitted to practise there, null if you find nothing credible.
- inGoodStanding: false only if a source says suspended, disbarred, inactive, or lapsed; otherwise true, or null if unaddressed.
- Report the bar number and status wording verbatim, and cite the pages you used.`;

type ModelResult = {
	isLicensedAttorney: boolean | null;
	inGoodStanding: boolean | null;
	confidence: number;
	matchedName: string | null;
	matchedBarNumber: string | null;
	matchedJurisdiction: string | null;
	licenseStatusText: string | null;
	officialRecordUrl: string | null;
	disciplinaryNotes: string | null;
	summary: string;
	sources: { url: string; title: string }[];
};

/** Message text plus any url_citation annotations from the Responses output. */
function readResponse(payload: unknown): {
	text: string;
	citations: { url: string; title: string }[];
} {
	const output =
		(payload as { output?: unknown[] })?.output ?? ([] as unknown[]);
	let text = "";
	const citations: { url: string; title: string }[] = [];

	for (const item of output) {
		const entry = item as {
			type?: string;
			content?: {
				type?: string;
				text?: string;
				annotations?: { type?: string; url?: string; title?: string }[];
			}[];
		};
		if (entry.type !== "message") continue;
		for (const part of entry.content ?? []) {
			if (part.type === "output_text" && part.text) text += part.text;
			for (const note of part.annotations ?? []) {
				if (note.type === "url_citation" && note.url) {
					citations.push({ url: note.url, title: note.title ?? note.url });
				}
			}
		}
	}
	return { text, citations };
}

/** Dedupe by URL. Model-reported first — those are the ones it says it relied
 *  on; annotations then fill in anything it cited but left out of the answer. */
function toSources(
	reported: { url: string; title: string }[],
	citations: { url: string; title: string }[],
): VerificationSource[] {
	const byUrl = new Map<string, VerificationSource>();
	for (const { url, title } of [...reported, ...citations]) {
		if (!url || byUrl.has(url)) continue;
		byUrl.set(url, { url, title: title || url });
	}
	return [...byUrl.values()];
}

export type UpdateJurisdictionResult =
	| { ok: true; badgeCleared: boolean }
	| { ok: false; error: string };

/**
 * Change the licensing jurisdiction a check runs against.
 *
 * Lives here rather than with the profile autosave because it isn't profile
 * data — it's on the account from sign-up, and it's the input that decides which
 * state's bar records get searched.
 */
export async function updateJurisdictionAction(
	jurisdiction: string,
): Promise<UpdateJurisdictionResult> {
	const { session } = await requireRole("attorney");

	// The Select constrains the choice, but the action can be called directly and
	// the stored string is matched exactly downstream.
	if (!isValidJurisdiction(jurisdiction)) {
		return { ok: false, error: JURISDICTION_MESSAGE };
	}

	try {
		const res = await updateAttorneyJurisdiction(session.user.id, jurisdiction);
		revalidatePath("/dashboard/profile");
		return { ok: true, badgeCleared: res.badgeCleared };
	} catch {
		return {
			ok: false,
			error: "Couldn't update your jurisdiction. Please try again.",
		};
	}
}

export type VerifyResult =
	| { ok: true; status: VerificationStatus }
	| { ok: false; error: string };

/**
 * Run a check for the signed-in attorney and record the outcome.
 *
 * Administrators can trigger one for another attorney by passing `userId`; an
 * attorney can only ever check themselves.
 */
export async function verifyAttorneyAction(
	userId?: string,
): Promise<VerifyResult> {
	const { session, role } = await requireRole("attorney", "administrator");
	const targetId =
		role === "administrator" && userId ? userId : session.user.id;

	if (!env.OPENAI_API_KEY) {
		// Named only in the server log: the attorney can't act on a missing env var,
		// and naming server config in a user-facing message tells an attacker what
		// this deployment is missing.
		console.warn(
			"[verification] OPENAI_API_KEY is not set — bar verification is disabled.",
		);
		return {
			ok: false,
			error: "Verification isn't available right now. Please try again later.",
		};
	}

	const profile = await getAttorneyProfile(targetId);
	if (!profile?.legalName) {
		return {
			ok: false,
			error: "Add your legal name before running a check.",
		};
	}

	// The licensing state lives on the account from sign-up, not on the profile,
	// and decides whose records get searched.
	const account = profile.user;
	if (!account.jurisdiction) {
		return {
			ok: false,
			error: "Choose your licensing jurisdiction before running a check.",
		};
	}
	// Web search costs money per call, so a completed check has a cooldown. A
	// result that needs human attention is exempt: re-running it won't help.
	const last = profile.verifications[0];
	if (
		last &&
		last.status !== "needs_review" &&
		Date.now() - last.createdAt.getTime() < RECHECK_COOLDOWN_MS
	) {
		const minutes = Math.ceil(
			(RECHECK_COOLDOWN_MS - (Date.now() - last.createdAt.getTime())) / 60000,
		);
		return {
			ok: false,
			error: `Already checked recently. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
		};
	}

	// Name + jurisdiction only. A bar number isn't asked for: registries are
	// searchable by name, and any number found comes back as evidence instead.
	const question = [
		"Is this person a licensed attorney in good standing?",
		`Name: ${profile.legalName}`,
		`Licensing jurisdiction: ${account.jurisdiction}`,
		// Firm and website help identify the right person among namesakes. The
		// office city is deliberately withheld — registries list a bar address of
		// record, and narrowing by city loses real licensees.
		profile.firmName ? `Firm: ${profile.firmName}` : null,
		profile.websiteUrl ? `Website: ${profile.websiteUrl}` : null,
	]
		.filter(Boolean)
		.join("\n");

	let parsed: ModelResult;
	let sources: VerificationSource[];

	try {
		const res = await fetch("https://api.openai.com/v1/responses", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${env.OPENAI_API_KEY}`,
			},
			body: JSON.stringify({
				model: MODEL,
				instructions: SYSTEM_PROMPT,
				input: question,
				tools: [{ type: "web_search" }],
				reasoning: { effort: REASONING_EFFORT },
				text: {
					format: {
						type: "json_schema",
						name: "bar_verification",
						strict: true,
						schema: RESULT_SCHEMA,
					},
				},
			}),
		});

		if (!res.ok) {
			return {
				ok: false,
				error: "The verification service is unavailable. Please try again.",
			};
		}

		const payload = await res.json();
		const { text, citations } = readResponse(payload);
		if (!text) {
			return { ok: false, error: "The check returned nothing. Please retry." };
		}
		parsed = JSON.parse(text) as ModelResult;
		sources = toSources(parsed.sources ?? [], citations);
	} catch {
		return {
			ok: false,
			error: "Couldn't complete the check. Please try again.",
		};
	}

	const confidence = Math.max(
		0,
		Math.min(100, Math.round(parsed.confidence ?? 0)),
	);

	const evidence: VerificationEvidence = {
		isLicensedAttorney: parsed.isLicensedAttorney,
		inGoodStanding: parsed.inGoodStanding,
	};

	// The decision is ours, not the model's.
	const status = decideStatus(evidence);

	await recordVerification(profile.id, {
		status,
		confidence,
		isLicensedAttorney: evidence.isLicensedAttorney,
		inGoodStanding: evidence.inGoodStanding,
		licenseStatusText: parsed.licenseStatusText,
		matchedName: parsed.matchedName,
		matchedBarNumber: parsed.matchedBarNumber,
		matchedJurisdiction: parsed.matchedJurisdiction,
		disciplinaryNotes: parsed.disciplinaryNotes,
		summary: parsed.summary ?? "",
		officialRecordUrl: parsed.officialRecordUrl,
		sources,
		checkedName: profile.legalName,
		checkedJurisdiction: account.jurisdiction,
		model: MODEL,
		triggeredBy: session.user.id,
	});

	return { ok: true, status };
}
