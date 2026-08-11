"use server";

import {
	markAllNotificationsRead,
	markNotificationRead,
} from "@just-us/db/notifications";
import { revalidatePath } from "next/cache";

import { requireOnboarded } from "@/lib/auth-server";

/**
 * The read-state actions behind the bell and the `/notifications` page.
 *
 * Both scope every write to the signed-in user (`recipientId` from the session,
 * never the client) so one viewer can never flip another's notifications. They
 * revalidate the layout so the badge and list reflect the change on the next
 * render without a full reload.
 */

/** Mark a single notification read. No-op if it isn't the caller's or is already read. */
export async function markNotificationReadAction(id: string): Promise<void> {
	const session = await requireOnboarded();
	await markNotificationRead(session.user.id, id);
	revalidatePath("/notifications");
}

/** Mark every one of the caller's notifications read — the "mark all read" control. */
export async function markAllNotificationsReadAction(): Promise<void> {
	const session = await requireOnboarded();
	await markAllNotificationsRead(session.user.id);
	revalidatePath("/notifications");
}
