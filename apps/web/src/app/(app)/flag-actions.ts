"use server";

import { isFlagKey, setFlag } from "@just-us/flags";
import { revalidatePath } from "next/cache";

import { requireAdministrator } from "@/lib/auth-server";

export type ToggleFlagResult = { ok: true } | { ok: false; error: string };

/**
 * Toggle a feature flag. Administrator-only (JUS-13).
 *
 * The guard is the enforcement point: the Configuration screen is only reachable
 * by administrators, but a server action is a public endpoint, so it re-checks
 * rather than trusting that the caller came from that screen. The key is checked
 * against the registry too, so a crafted request can't create arbitrary rows.
 */
export async function toggleFlagAction(
	key: string,
	enabled: boolean,
): Promise<ToggleFlagResult> {
	const { session } = await requireAdministrator();

	if (!isFlagKey(key)) {
		return { ok: false, error: "Unknown feature flag." };
	}

	try {
		await setFlag(key, enabled, session.user.id);
	} catch {
		return {
			ok: false,
			error: "Could not save that change. Please try again.",
		};
	}

	// Flags gate the sidebar and the screens, so the whole dashboard subtree needs
	// to re-render rather than just this page.
	revalidatePath("/home", "layout");
	return { ok: true };
}
