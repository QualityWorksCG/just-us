/**
 * The ceilings the assistant runs inside. Constants only — enforcement lives in
 * enforcement.ts so this module stays safe to import from client code.
 *
 * Spend is counted in micro-USD (millionths of a dollar) because a single turn
 * on a cheap model costs a fraction of a cent, and integers avoid accumulating
 * float error across a month of them.
 */

import type { Role } from "@just-us/auth/rbac";

/** Per-role message allowance, per rolling hour. */
export const ENTITLEMENTS: Record<Role, { maxMessagesPerHour: number }> = {
	plaintiff: { maxMessagesPerHour: 30 },
	donor: { maxMessagesPerHour: 30 },
	attorney: { maxMessagesPerHour: 40 },
	// Platform how-to only, and no data tools, so the cheapest turns on the
	// platform — and the people most likely to be exercising it deliberately.
	administrator: { maxMessagesPerHour: 60 },
};

/** Per-user model spend cap for a calendar month — $5. */
export const MONTHLY_USER_CEILING_MICRO_USD = 5_000_000;

/** Whole-platform model spend cap for a calendar month — $200. */
export const MONTHLY_GLOBAL_CEILING_MICRO_USD = 200_000_000;

/** Output token cap for one assistant turn. */
export const MAX_TURN_OUTPUT_TOKENS = 1_500;

/** How many tool round-trips one turn may take before it must answer. */
export const MAX_TOOL_STEPS = 5;

/**
 * Dollars per 1M tokens, in the shape evlog's `createAILogger({ cost })` expects,
 * so a wide event carries `ai.estimatedCost`.
 *
 * Prices are the Vercel AI Gateway's published per-token rates for these models.
 * Both the bare id and the gateway-prefixed id are keyed, because which one the
 * event reports depends on whether the request went direct or through the
 * gateway. Covers the default model plus the two other models the repo can end
 * up on via `AI_CHAT_MODEL` or the existing case-wizard helpers.
 */
export const PRICE_MAP: Record<string, { input: number; output: number }> = {
	"gpt-5.6-luna": { input: 0.2, output: 1.2 },
	"openai/gpt-5.6-luna": { input: 0.2, output: 1.2 },
	"gpt-5.4-mini": { input: 0.75, output: 4.5 },
	"openai/gpt-5.4-mini": { input: 0.75, output: 4.5 },
	"gpt-4o-mini": { input: 0.15, output: 0.6 },
	"openai/gpt-4o-mini": { input: 0.15, output: 0.6 },
};
