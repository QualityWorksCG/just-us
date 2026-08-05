"use server";

import { env } from "@just-us/env/server";

import { requireRole } from "@/lib/auth-server";

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
		if (!raw) return { ok: false, error: "AI returned nothing — try again." };

		const parsed = JSON.parse(raw) as {
			status?: unknown;
			text?: unknown;
			message?: unknown;
		};
		if (parsed.status === "need_more") {
			const message =
				typeof parsed.message === "string" ? parsed.message.trim() : "";
			if (!message)
				return { ok: false, error: "AI returned nothing — try again." };
			return { ok: true, kind: "need_more", message };
		}
		if (parsed.status === "refined") {
			const text = typeof parsed.text === "string" ? parsed.text.trim() : "";
			if (!text)
				return { ok: false, error: "AI returned nothing — try again." };
			return { ok: true, kind: "refined", text };
		}
		return { ok: false, error: "AI returned nothing — try again." };
	} catch {
		return { ok: false, error: "Couldn't reach the AI. Please try again." };
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
			return { ok: false, error: "AI returned no titles — try again." };
		return { ok: true, titles };
	} catch {
		return { ok: false, error: "Couldn't draft titles. Please try again." };
	}
}
