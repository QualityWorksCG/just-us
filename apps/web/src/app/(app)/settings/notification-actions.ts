"use server";

import { setNotificationEmailEnabled } from "@just-us/db/notifications";
import { revalidatePath } from "next/cache";

import { requireOnboarded } from "@/lib/auth-server";

/**
 * The email-notification preference behind the settings toggle. Scoped to the
 * signed-in user — the id comes from the session, never the client — so no one
 * can flip another account's switch. In-app notifications are always recorded;
 * this governs only whether the matching email is sent.
 */
export async function setEmailNotificationsAction(
	enabled: boolean,
): Promise<{ ok: true }> {
	const session = await requireOnboarded();
	await setNotificationEmailEnabled(session.user.id, enabled);
	revalidatePath("/settings");
	return { ok: true };
}
