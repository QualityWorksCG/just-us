"use server";

import { env } from "@just-us/env/server";
import { requireRole } from "@/lib/auth-server";
import { CASE_CATEGORIES } from "@/lib/case-categories";

type ChatMessage = { role: "system" | "user"; content: string };

async function chat(
	messages: ChatMessage[],
	opts: { jsonObject?: boolean; temperature?: number } = {},
): Promise<string> {
	const key = env.OPENAI_API_KEY;
	if (!key) throw new Error("AI is not configured.");

	const res = await fetch("https://api.openai.com/v1/chat/completions", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${key}`,
		},
		body: JSON.stringify({
			model: "gpt-4o-mini",
			temperature: opts.temperature ?? 0.5,
			messages,
			...(opts.jsonObject ? { response_format: { type: "json_object" } } : {}),
		}),
	});
	if (!res.ok) throw new Error(`OpenAI request failed (${res.status})`);
	const data = (await res.json()) as {
		choices?: { message?: { content?: string } }[];
	};
	return data.choices?.[0]?.message?.content?.trim() ?? "";
}

export type RefineStoryResult =
	| { ok: true; kind: "refined"; text: string }
	| { ok: true; kind: "need_more"; message: string }
	| { ok: false; error: string };

/** Tighten the plaintiff's account for clarity — never inventing facts. */
export async function refineStoryAction(
	story: string,
): Promise<RefineStoryResult> {
	await requireRole("plaintiff");
	if (story.trim().length < 20)
		return { ok: false, error: "Write a bit more of your story first." };

	try {
		const raw = await chat(
			[
				{
					role: "system",
					content: [
						"You are a light copy editor for a litigation crowdfunding platform.",
						"Your ONLY job is to refine the plaintiff's own words for clarity, grammar, and readability — or ask for more detail when you cannot refine without inventing facts.",
						"",
						"Hard rules:",
						"- Stick strictly to what the plaintiff wrote. Do not add, invent, infer, or guess any facts, details, events, motives, emotions, outcomes, people, places, dates, amounts, or legal claims.",
						"- Do not expand a short or vague statement into a longer story.",
						"- Do not invent filler such as timelines, prior relationships, specific wrongdoing, attempts to resolve conflict, or goals like seeking justice.",
						"- Keep first person and the plaintiff's voice/tone when refining.",
						"- You may fix grammar, spelling, punctuation, awkward phrasing, and sentence order. You may slightly tighten wording. Keep roughly the same length.",
						"",
						"When to ask for more information (status need_more):",
						"- The account is too vague or thin to refine meaningfully without inventing content (e.g. only a feeling or one-liner with no who/what/when).",
						"- Concrete facts are missing that a reader would need (who was involved, what happened, roughly when).",
						"- In that case, do NOT refine. Write a short, helpful message naming what to add. Speak as the editor to the plaintiff (second person). Do not invent examples as if they happened.",
						"",
						"When to refine (status refined):",
						"- There is enough concrete content to polish without inventing anything.",
						"",
						"Return strict JSON only, one of:",
						'{"status":"refined","text":"<revised first-person account>"}',
						'{"status":"need_more","message":"<short ask for more detail>"}',
					].join("\n"),
				},
				{ role: "user", content: story.trim() },
			],
			{ jsonObject: true, temperature: 0.2 },
		);
		if (!raw) return { ok: false, error: "AI returned nothing. Try again." };

		const parsed = JSON.parse(raw) as {
			status?: unknown;
			text?: unknown;
			message?: unknown;
		};
		if (parsed.status === "need_more") {
			const message =
				typeof parsed.message === "string" ? parsed.message.trim() : "";
			if (!message)
				return { ok: false, error: "AI returned nothing. Try again." };
			return { ok: true, kind: "need_more", message };
		}
		if (parsed.status === "refined") {
			const text = typeof parsed.text === "string" ? parsed.text.trim() : "";
			if (!text) return { ok: false, error: "AI returned nothing. Try again." };
			return { ok: true, kind: "refined", text };
		}
		return { ok: false, error: "AI returned nothing. Try again." };
	} catch {
		return { ok: false, error: "Couldn't reach the AI. Please try again." };
	}
}

export type SuggestCategoryResult =
	| { ok: true; category: (typeof CASE_CATEGORIES)[number] }
	| { ok: false; error: string };

/**
 * Read the plaintiff's story and pick the single best-fitting case category.
 *
 * The wizard used to default the category to "Employment" for everyone, which was
 * wrong for every non-employment case and quietly mis-filed them. Here the model
 * chooses from the canonical list only — with "Other" as its catch-all — and any
 * reply that somehow lands off the list yields no suggestion (the field is left
 * for the plaintiff to pick) rather than an invented category the filters can't
 * reach.
 */
export async function suggestCategoryAction(
	story: string,
): Promise<SuggestCategoryResult> {
	await requireRole("plaintiff");
	if (story.trim().length < 20)
		return { ok: false, error: "Write a bit more of your story first." };

	const allowed = CASE_CATEGORIES.join(", ");
	try {
		const raw = await chat(
			[
				{
					role: "system",
					content: [
						"You classify a litigation crowdfunding case into exactly one category, based only on the plaintiff's account.",
						`Choose the single best fit from this fixed list: ${allowed}.`,
						'Use "Other" only when none of the specific categories clearly fit.',
						"Do not invent categories or return anything outside the list.",
						'Return strict JSON: {"category":"<one of the list>"}.',
					].join("\n"),
				},
				{ role: "user", content: story.trim() },
			],
			{ jsonObject: true, temperature: 0 },
		);
		const parsed = JSON.parse(raw) as { category?: unknown };
		const picked =
			typeof parsed.category === "string" ? parsed.category.trim() : "";
		const match = CASE_CATEGORIES.find(
			(c) => c.toLowerCase() === picked.toLowerCase(),
		);
		if (!match)
			return { ok: false, error: "Couldn't classify the case. Try again." };
		return { ok: true, category: match };
	} catch {
		return {
			ok: false,
			error: "Couldn't classify the case. Please try again.",
		};
	}
}

export type SuggestTitlesResult =
	| { ok: true; titles: string[] }
	| { ok: false; error: string };

/** Draft a few concise campaign titles from the plaintiff's story. */
export async function suggestTitlesAction(
	story: string,
): Promise<SuggestTitlesResult> {
	await requireRole("plaintiff");
	if (story.trim().length < 20)
		return {
			ok: false,
			error: "Write a bit more of your story so I can draft titles.",
		};

	try {
		const raw = await chat(
			[
				{
					role: "system",
					content:
						'You write concise, specific, non-clickbait titles for litigation crowdfunding campaigns. Based on the plaintiff\'s story, propose 3 title options, each at most 9 words, plain and dignified, no quotation marks. Return strict JSON: {"titles": ["...", "...", "..."]}.',
				},
				{ role: "user", content: story.trim() },
			],
			{ jsonObject: true, temperature: 0.7 },
		);
		const parsed = JSON.parse(raw) as { titles?: unknown };
		const titles = Array.isArray(parsed.titles)
			? parsed.titles
					.filter((t): t is string => typeof t === "string")
					.map((t) => t.trim())
					.filter(Boolean)
					.slice(0, 3)
			: [];
		if (!titles.length)
			return { ok: false, error: "AI returned no titles. Try again." };
		return { ok: true, titles };
	} catch {
		return { ok: false, error: "Couldn't draft titles. Please try again." };
	}
}
