import prisma from "./index";

/**
 * The notification store behind both surfaces — the in-app bell/list and email
 * (JUS email-notifications). One row per (event, recipient). See
 * `notification.prisma` for the idempotency contract.
 */

export type NotificationType =
	| "case_update"
	| "expression_of_interest"
	| "case_status"
	| "donation"
	| "certificate"
	| "moderation";

export type NewNotification = {
	recipientId: string;
	type: NotificationType;
	caseId?: string | null;
	actorName?: string | null;
	title: string;
	body: string;
	href: string;
	/** Deterministic per event→recipient, so re-runs insert nothing new. */
	dedupeKey: string;
};

export type NotificationRow = {
	id: string;
	type: string;
	caseId: string | null;
	actorName: string | null;
	title: string;
	body: string;
	href: string;
	readAt: Date | null;
	createdAt: Date;
};

/** Insert notifications, skipping any whose `dedupeKey` already exists. Returns
 *  how many were newly created. */
export async function createNotifications(
	rows: NewNotification[],
): Promise<number> {
	if (rows.length === 0) return 0;
	const res = await prisma.notification.createMany({
		data: rows,
		skipDuplicates: true,
	});
	return res.count;
}

/** Recent notifications for the bell/list, newest first. */
export async function listNotifications(
	recipientId: string,
	take = 30,
): Promise<NotificationRow[]> {
	return prisma.notification.findMany({
		where: { recipientId },
		orderBy: { createdAt: "desc" },
		take,
		select: {
			id: true,
			type: true,
			caseId: true,
			actorName: true,
			title: true,
			body: true,
			href: true,
			readAt: true,
			createdAt: true,
		},
	});
}

/** Unread count — the bell badge. */
export async function countUnreadNotifications(
	recipientId: string,
): Promise<number> {
	return prisma.notification.count({ where: { recipientId, readAt: null } });
}

/** Mark one notification read (scoped to its recipient). */
export async function markNotificationRead(recipientId: string, id: string) {
	return prisma.notification.updateMany({
		where: { id, recipientId, readAt: null },
		data: { readAt: new Date() },
	});
}

/** Mark every unread notification read — "mark all as read". */
export async function markAllNotificationsRead(recipientId: string) {
	return prisma.notification.updateMany({
		where: { recipientId, readAt: null },
		data: { readAt: new Date() },
	});
}

/**
 * Claim the single email send for a notification. Stamps `emailedAt` only if it
 * was null, so exactly one caller wins under a race — the email idempotency
 * boundary. Returns true if this caller may send.
 */
export async function reserveNotificationEmail(
	dedupeKey: string,
): Promise<boolean> {
	const res = await prisma.notification.updateMany({
		where: { dedupeKey, emailedAt: null },
		data: { emailedAt: new Date() },
	});
	return res.count > 0;
}

/** Release a reservation after a failed send, so a later trigger can retry. */
export async function releaseNotificationEmail(dedupeKey: string) {
	return prisma.notification.updateMany({
		where: { dedupeKey },
		data: { emailedAt: null },
	});
}

/** Whether a user has email notifications on. Missing row = on (default true). */
export async function notificationEmailEnabled(
	userId: string,
): Promise<boolean> {
	const row = await prisma.notificationPreference.findUnique({
		where: { userId },
		select: { emailEnabled: true },
	});
	return row ? row.emailEnabled : true;
}

/** Read the raw preference (for the settings toggle). */
export async function getNotificationPreference(userId: string) {
	const row = await prisma.notificationPreference.findUnique({
		where: { userId },
		select: { emailEnabled: true },
	});
	return { emailEnabled: row ? row.emailEnabled : true };
}

/** Set a user's global email-notification switch. */
export async function setNotificationEmailEnabled(
	userId: string,
	emailEnabled: boolean,
) {
	return prisma.notificationPreference.upsert({
		where: { userId },
		update: { emailEnabled },
		create: { userId, emailEnabled },
	});
}

/** Resolve id → email/name for a set of notification recipients. */
export async function usersForNotification(
	ids: string[],
): Promise<{ id: string; email: string; name: string }[]> {
	if (ids.length === 0) return [];
	return prisma.user.findMany({
		where: { id: { in: ids } },
		select: { id: true, email: true, name: true },
	});
}

/** The case facts an event's notification copy + recipients are built from. */
export async function getCaseNotifyContext(caseId: string) {
	return prisma.case.findUnique({
		where: { id: caseId },
		select: {
			id: true,
			title: true,
			status: true,
			ownerId: true,
			attorneyName: true,
			owner: { select: { name: true, email: true } },
			match: { select: { attorneyId: true } },
		},
	});
}
