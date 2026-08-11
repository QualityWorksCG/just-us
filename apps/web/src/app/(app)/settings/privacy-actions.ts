"use server";

import { setDonationAnonymous } from "@just-us/db/profile";
import { revalidatePath } from "next/cache";

import { requireOnboarded } from "@/lib/auth-server";

/**
 * The donor privacy switch on Profile & settings. Governs whether this account's
 * donations show by name on a case's public supporter list or as "Anonymous".
 * Scoped to the signed-in user — the id comes from the session, never the client.
 */
export async function setDonationAnonymousAction(
	anonymous: boolean,
): Promise<{ ok: true }> {
	const session = await requireOnboarded();
	await setDonationAnonymous(session.user.id, anonymous);
	revalidatePath("/settings");
	return { ok: true };
}
