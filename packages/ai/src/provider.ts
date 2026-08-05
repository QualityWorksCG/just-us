/**
 * Which model the in-app assistant talks to, and how it authenticates.
 *
 * Two paths, one shape. With `AI_GATEWAY_API_KEY` set we hand `streamText` a
 * plain `"openai/<model>"` string, which the AI Gateway bundled in `ai` resolves
 * — it reads the key from the environment itself, so there is no credential to
 * pass here. Without a gateway key we build a direct OpenAI provider from
 * `OPENAI_API_KEY`, the same key the case-wizard helpers already use.
 */

import { createOpenAI } from "@ai-sdk/openai";
import { env } from "@just-us/env/server";
import type { LanguageModel } from "ai";

/**
 * The cheapest current-generation OpenAI chat model that still does reliable
 * tool calling — $0.20 / $1.20 per 1M tokens, which is what makes a per-user
 * monthly spend ceiling workable. Set `AI_CHAT_MODEL` to override.
 */
export const DEFAULT_CHAT_MODEL = "gpt-5.6-luna";

/** Whether the assistant has a way to reach a model at all. */
export function isAiConfigured(): boolean {
	return Boolean(env.AI_GATEWAY_API_KEY || env.OPENAI_API_KEY);
}

/** The model id in use, without any provider prefix. */
export function chatModelId(): string {
	return env.AI_CHAT_MODEL ?? DEFAULT_CHAT_MODEL;
}

/**
 * The model to hand `streamText`. Throws when neither key is configured —
 * callers should check `isAiConfigured()` first and fall back to the static
 * help text rather than surfacing an error.
 */
export function chatModel(): LanguageModel {
	const modelId = chatModelId();
	if (env.AI_GATEWAY_API_KEY) return `openai/${modelId}`;
	if (!env.OPENAI_API_KEY) throw new Error("AI is not configured.");
	return createOpenAI({ apiKey: env.OPENAI_API_KEY })(modelId);
}
