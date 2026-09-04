"use server";

import {
	isValidJurisdiction,
	JURISDICTION_MESSAGE,
} from "@just-us/auth/jurisdiction";
import {
	addAdmission,
	listAdmissions,
	removeAdmission,
	setPrimaryJurisdiction,
} from "@just-us/db/admissions";
import {
	getAttorneyProfile,
	lastVerificationForState,
	recordFederalVerification,
	recordVerification,
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
import { notifyAdminsFederalReview } from "@/lib/notify";

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

// Federal admission is to a specific US federal court (a District Court, a Court
// of Appeals, or the Supreme Court), not a state — so the check asks a different
// question, though it reads the same `RESULT_SCHEMA` back.
const FEDERAL_SYSTEM_PROMPT = `Say whether this person is an attorney admitted to practise before a United States federal court (a US District Court, a US Court of Appeals, or the US Supreme Court), and whether that admission is active.

Do one or two web searches, then answer from what you find. Federal court attorney-admission rolls, PACER/CM-ECF attorney records, and established legal directories all count as evidence. Do not keep searching once you have a clear answer.

- isLicensedAttorney: true if sources show them admitted to a federal court bar, null if you find nothing credible.
- inGoodStanding: false only if a source says suspended, disbarred, inactive, or lapsed; otherwise true, or null if unaddressed.
- Report the admitting court and any bar/registration number verbatim, and cite the pages you used.`;

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

export type AdmissionActionResult = { ok: true } | { ok: false; error: string };

/**
 * The three things an attorney can do to the list of states they practise in.
 *
 * These live here rather than with the profile autosave because they are not
 * profile data: an admission decides which cases reach this attorney and which
 * they may take on, so it is written deliberately rather than swept up by a
 * draft save. Each one revalidates `/home` as well as `/profile`, because the
 * queue is scoped by exactly this list and would otherwise keep showing the
 * shape it had a moment ago.
 */
export async function addAdmissionAction(
	state: string,
): Promise<AdmissionActionResult> {
	const { session } = await requireRole("attorney");

	// The Select constrains the choice, but the action can be called directly and
	// the stored string is matched exactly against `Case.location` downstream.
	if (!isValidJurisdiction(state)) {
		return { ok: false, error: JURISDICTION_MESSAGE };
	}

	try {
		const res = await addAdmission(session.user.id, state);
		if (!res.ok) {
			return { ok: false, error: `You've already added ${state}.` };
		}
		revalidatePath("/profile");
		revalidatePath("/home");
		return { ok: true };
	} catch {
		return { ok: false, error: "Couldn't add that state. Please try again." };
	}
}

export async function removeAdmissionAction(
	state: string,
): Promise<AdmissionActionResult> {
	const { session } = await requireRole("attorney");

	try {
		await removeAdmission(session.user.id, state);
		revalidatePath("/profile");
		revalidatePath("/home");
		return { ok: true };
	} catch {
		return {
			ok: false,
			error: "Couldn't remove that state. Please try again.",
		};
	}
}

/** Which admission the directory leads with. Moves a label, nothing more — see
 *  `setPrimaryJurisdiction`. */
export async function setPrimaryAdmissionAction(
	state: string,
): Promise<AdmissionActionResult> {
	const { session } = await requireRole("attorney");

	try {
		const res = await setPrimaryJurisdiction(session.user.id, state);
		if (!res.ok) {
			return { ok: false, error: `Add ${state} to your states first.` };
		}
		revalidatePath("/profile");
		return { ok: true };
	} catch {
		return {
			ok: false,
			error: "Couldn't update your primary state. Please try again.",
		};
	}
}

export type VerifyResult =
	| { ok: true; status: VerificationStatus }
	| { ok: false; error: string };

/**
 * Run a check for one of the attorney's states and record the outcome.
 *
 * Per state, because a licence is per state: a bar record in New York says
 * nothing about New Jersey, and it is the admission for the state checked that
 * the matching gates read. `state` defaults to the primary one, which is what a
 * single-state attorney will always mean.
 *
 * Administrators can trigger one for another attorney by passing `userId`; an
 * attorney can only ever check themselves.
 */
export async function verifyAttorneyAction(
	input: { state?: string; userId?: string; federal?: boolean } = {},
): Promise<VerifyResult> {
	const { session, role } = await requireRole("attorney", "administrator");
	const targetId =
		role === "administrator" && input.userId ? input.userId : session.user.id;

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

	// ── Federal-court standing ──────────────────────────────────────────────────
	// No per-state admission to hang on: the check runs on the name (and firm /
	// website to disambiguate) and records straight onto the profile's federal
	// status via `recordFederalVerification`, leaving state admissions untouched.
	if (input.federal) {
		const question = [
			"Is this person admitted to practise before a United States federal court, and in good standing?",
			`Name: ${profile.legalName}`,
			profile.firmName ? `Firm: ${profile.firmName}` : null,
			profile.websiteUrl ? `Website: ${profile.websiteUrl}` : null,
		]
			.filter(Boolean)
			.join("\n");

		let fed: ModelResult;
		try {
			const res = await fetch("https://api.openai.com/v1/responses", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${env.OPENAI_API_KEY}`,
				},
				body: JSON.stringify({
					model: MODEL,
					instructions: FEDERAL_SYSTEM_PROMPT,
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
			const { text } = readResponse(await res.json());
			if (!text) {
				return {
					ok: false,
					error: "The check returned nothing. Please retry.",
				};
			}
			fed = JSON.parse(text) as ModelResult;
		} catch {
			return {
				ok: false,
				error: "Couldn't complete the check. Please try again.",
			};
		}

		const status = decideStatus({
			isLicensedAttorney: fed.isLicensedAttorney,
			inGoodStanding: fed.inGoodStanding,
		});
		await recordFederalVerification(targetId, status);
		// The check couldn't clear it either way — hand it to the admins who can
		// rule by hand. Swallowed so a notify hiccup can't undo the recorded result.
		if (status === "needs_review") {
			await notifyAdminsFederalReview(targetId).catch(() => {});
		}
		return { ok: true, status };
	}

	// Which state's records to search. Only ever one the attorney has actually
	// claimed: a check against a state they hold no admission in has nowhere to
	// record its result, and would read as verification of something they never
	// asserted.
	const admissions = await listAdmissions(targetId);
	if (admissions.length === 0) {
		return {
			ok: false,
			error: "Add the states you're admitted in before running a check.",
		};
	}
	const primary = admissions.find((row) => row.primary) ?? admissions[0];
	const state = input.state ?? primary?.state;
	if (!state || !admissions.some((row) => row.state === state)) {
		return {
			ok: false,
			error: "Add that state to your profile before checking it.",
		};
	}

	// Web search costs money per call, so a completed check has a cooldown — held
	// per state rather than per profile, or checking a second state would be
	// refused because the first was just checked. A result that needs human
	// attention is exempt: re-running it won't help.
	const last = await lastVerificationForState(profile.id, state);
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
		`Licensing jurisdiction: ${state}`,
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
		// The state this result belongs to. `recordVerification` reads it back to
		// decide which admission the outcome lands on, so it is not decoration.
		checkedJurisdiction: state,
		model: MODEL,
		triggeredBy: session.user.id,
	});

	return { ok: true, status };
}
