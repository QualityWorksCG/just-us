/**
 * Applies the ceilings defined in limits.ts. Lives apart from the constants so
 * client code can import the numbers without dragging Prisma into the bundle.
 */

import type { Role } from "@just-us/auth/rbac";
import {
	monthlyGlobalSpendMicroUsd,
	monthlyUserSpendMicroUsd,
} from "@just-us/db/ai-usage";
import { countUserChatMessagesSince } from "@just-us/db/chat";
import {
	ENTITLEMENTS,
	MONTHLY_GLOBAL_CEILING_MICRO_USD,
	MONTHLY_USER_CEILING_MICRO_USD,
} from "./limits";

/**
 * Why a turn may not run. `rate` is the user's own doing and clears on its own;
 * the two ceilings are budget and want the static help text instead of an error,
 * so the caller can tell them apart rather than treating every refusal alike.
 */
export type LimitVerdict =
	| { ok: true }
	| {
			ok: false;
			kind: "rate" | "user-ceiling" | "global-ceiling";
			message: string;
	  };

/** Start of the current calendar month in UTC — the window both ceilings sum over. */
function monthStartUtc(now: Date): Date {
	return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/**
 * Whether this user may take another turn.
 *
 * All three reads are independent, so they go out together — the gate sits in
 * front of every message and three sequential round-trips would be felt. Order
 * of the checks is deliberate: the rate limit is reported first because it is
 * the only one the user can do something about.
 */
export async function checkLimits(
	userId: string,
	role: Role,
): Promise<LimitVerdict> {
	const now = new Date();
	const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
	const monthStart = monthStartUtc(now);

	const [messagesThisHour, userSpend, globalSpend] = await Promise.all([
		countUserChatMessagesSince(userId, oneHourAgo),
		monthlyUserSpendMicroUsd(userId, monthStart),
		monthlyGlobalSpendMicroUsd(monthStart),
	]);

	if (messagesThisHour >= ENTITLEMENTS[role].maxMessagesPerHour) {
		return {
			ok: false,
			kind: "rate",
			message:
				"You've reached the assistant's hourly message limit. Please try again later.",
		};
	}

	if (userSpend >= MONTHLY_USER_CEILING_MICRO_USD) {
		return {
			ok: false,
			kind: "user-ceiling",
			message: "You've used up your assistant allowance for this month.",
		};
	}

	if (globalSpend >= MONTHLY_GLOBAL_CEILING_MICRO_USD) {
		return {
			ok: false,
			kind: "global-ceiling",
			message:
				"The assistant has reached the platform's budget for this month.",
		};
	}

	return { ok: true };
}
