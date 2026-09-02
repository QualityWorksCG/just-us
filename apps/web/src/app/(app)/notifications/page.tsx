import { listNotifications } from "@just-us/db/notifications";

import {
	type ListNotification,
	NotificationList,
} from "@/components/dashboard/notification-list";
import { requireOnboarded } from "@/lib/auth-server";

/**
 * The full notification history, reached from the header bell's "View all". Every
 * role shares this page — it reads the unified `Notification` store, so it shows
 * whatever events concern the signed-in user (JUS email-notifications).
 */
export default async function NotificationsPage() {
	const session = await requireOnboarded();
	const rows = await listNotifications(session.user.id, 100);

	const items: ListNotification[] = rows.map((n) => ({
		id: n.id,
		type: n.type,
		title: n.title,
		body: n.body,
		href: n.href,
		createdAt: n.createdAt,
		readAt: n.readAt,
	}));

	return (
		<div className="flex flex-col gap-6">
			<p className="max-w-[640px] text-[14.5px] text-ink-soft leading-relaxed">
				Everything happening on your cases: updates, attorney interest, status
				changes, and donation confirmations.
			</p>
			<NotificationList items={items} />
		</div>
	);
}
