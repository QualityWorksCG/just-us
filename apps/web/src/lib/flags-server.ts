import "server-only";

import {
	type FlagKey,
	type FlagState,
	readFlags as readFlagsUncached,
} from "@just-us/flags";
import { notFound } from "next/navigation";
import { cache } from "react";

/**
 * Server-side feature-flag reads (JUS-13).
 *
 * `cache()` dedupes within a single request, so a layout, a page and a guard all
 * asking for flags cost one query rather than three. It is per-request by design:
 * a toggle takes effect on the next request, with no deploy and no cache to bust.
 */
export const getFlags = cache(
	async (): Promise<FlagState> => readFlagsUncached(),
);

/** Whether a flag is on, for conditional rendering in server components. */
export async function isEnabled(key: FlagKey): Promise<boolean> {
	return (await getFlags())[key];
}

/**
 * Server-side gate for a flagged capability. Hiding a link is presentation, not
 * enforcement — anything reachable by URL must call this too, or a disabled
 * feature stays reachable by typing the address.
 *
 * 404s rather than redirecting, so a flagged-off capability is indistinguishable
 * from one that doesn't exist.
 */
export async function requireFeature(key: FlagKey): Promise<void> {
	if (!(await isEnabled(key))) {
		notFound();
	}
}
