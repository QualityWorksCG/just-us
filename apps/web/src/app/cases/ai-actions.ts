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
	| { ok: true; text: string }
	| { ok: false; error: string };

/** Tighten the plaintiff's account for clarity — never inventing facts. */
export async function refineStoryAction(
	story: string,
): Promise<RefineStoryResult> {
	await requireRole("plaintiff");
	if (story.trim().length < 20)
		return { ok: false, error: "Write a bit more of your story first." };

	try {
		const text = await chat(
			[
				{
					role: "system",
					content:
						"You are an editor for a litigation crowdfunding platform. Revise the plaintiff's first-person account for clarity, flow, and structure. Keep it first person and preserve every fact — never invent names, dates, amounts, or events. Keep the plaintiff's voice. Keep it under 140 words. Return only the revised account, no preamble.",
				},
				{ role: "user", content: story.trim() },
			],
			{ temperature: 0.4 },
		);
		if (!text) return { ok: false, error: "AI returned nothing — try again." };
		return { ok: true, text };
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
