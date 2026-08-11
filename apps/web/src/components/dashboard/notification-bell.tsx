"use client";

import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@just-us/ui/components/popover";
import { cn } from "@just-us/ui/lib/utils";
import {
	Award,
	Bell,
	Flag,
	HandCoins,
	Megaphone,
	Scale,
	ShieldAlert,
} from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import {
	markAllNotificationsReadAction,
	markNotificationReadAction,
} from "@/app/(app)/notification-actions";
import { TimeAgo } from "@/components/time-ago";

/** How often the bell re-checks the server for new notifications. They trickle
 *  in on human timescales, so a slow poll keeps it feeling live without hammering
 *  the server; a tab regaining focus refreshes immediately regardless. */
const POLL_MS = 30_000;

/** One item in the bell — a row from the `Notification` store. `title`/`body` are
 *  the copy the event recorded; `href` deep-links to where it lives; `readAt`
 *  drives the unread dot. `createdAt`/`readAt` may arrive as a Date (server prop)
 *  or ISO string. */
export type BellNotification = {
	id: string;
	type: string;
	title: string;
	body: string;
	actorName: string | null;
	href: Route;
	createdAt: Date | string;
	readAt: Date | string | null;
};

/** The glyph for each notification type. */
const ICONS: Record<string, typeof Bell> = {
	case_update: Megaphone,
	expression_of_interest: Scale,
	case_status: Flag,
	donation: HandCoins,
	certificate: Award,
	moderation: ShieldAlert,
};

/**
 * The header notification bell. Reads the viewer's own `Notification` rows and
 * shows the most recent, with the unread count on the badge. Clicking an item
 * marks it read and deep-links to it; "Mark all read" clears the badge; "View
 * all" opens the full `/notifications` page.
 *
 * `emptyHint` says what *would* appear here, so it must match the viewer's role.
 */
export function NotificationBell({
	items = [],
	unreadCount = 0,
	poll = false,
	emptyHint = "New notifications will show up here.",
}: {
	items?: BellNotification[];
	/** Total unread across the store — the badge count, independent of how many
	 *  rows are shown in the dropdown. */
	unreadCount?: number;
	/** Re-fetch on an interval and on tab focus, so something that arrives while
	 *  the viewer sits on a screen shows up without a manual reload. */
	poll?: boolean;
	/** Role-appropriate empty-state text — set by the caller, which knows the role. */
	emptyHint?: string;
}) {
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const [, startTransition] = useTransition();
	const hasItems = items.length > 0;
	const hasUnread = unreadCount > 0;

	useEffect(() => {
		if (!poll) return;
		// A refresh re-runs the layout's server fetch, so the bell reflects what's
		// new. Skip while a background tab to avoid pointless work.
		const tick = () => {
			if (document.visibilityState === "visible") router.refresh();
		};
		const id = setInterval(tick, POLL_MS);
		document.addEventListener("visibilitychange", tick);
		return () => {
			clearInterval(id);
			document.removeEventListener("visibilitychange", tick);
		};
	}, [poll, router]);

	function onItemClick(n: BellNotification) {
		setOpen(false);
		if (!n.readAt) {
			startTransition(() => {
				void markNotificationReadAction(n.id);
			});
		}
	}

	function onMarkAllRead() {
		startTransition(() => {
			void markAllNotificationsReadAction();
		});
	}

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger
				render={
					<button
						type="button"
						aria-label={
							hasUnread
								? `Notifications — ${unreadCount} new`
								: "Notifications — none new"
						}
						className="relative flex size-9 items-center justify-center rounded-full border border-border text-ink-soft transition-colors hover:border-brass-deep hover:text-ink"
					>
						<Bell className="size-[17px]" aria-hidden="true" />
						{hasUnread && (
							<span
								className="absolute -top-1 -right-1 flex min-w-[18px] items-center justify-center rounded-full bg-brass px-1 py-0.5 font-bold text-[10px] text-brass-ink leading-none ring-2 ring-surface"
								aria-hidden="true"
							>
								{unreadCount > 9 ? "9+" : unreadCount}
							</span>
						)}
					</button>
				}
			/>
			<PopoverContent
				align="end"
				className="w-[340px] gap-0 p-0"
				aria-label="Notifications"
			>
				<div className="flex items-center justify-between border-border border-b px-4 py-3">
					<p className="font-bold text-[13.5px] text-ink">Notifications</p>
					{hasUnread && (
						<button
							type="button"
							onClick={onMarkAllRead}
							className="font-semibold text-[11px] text-brass-deep transition-colors hover:text-ink"
						>
							Mark all read
						</button>
					)}
				</div>

				{hasItems ? (
					<>
						<ul className="max-h-[360px] overflow-y-auto py-1">
							{items.map((n) => {
								const Icon = ICONS[n.type] ?? Bell;
								const unread = !n.readAt;
								return (
									<li key={n.id}>
										<Link
											href={n.href}
											onClick={() => onItemClick(n)}
											className={cn(
												"flex gap-3 px-4 py-3 transition-colors hover:bg-surface-2",
												unread && "bg-brass-wash/40",
											)}
										>
											<span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-brass-wash text-brass-deep">
												<Icon className="size-4" aria-hidden="true" />
											</span>
											<span className="min-w-0 flex-1">
												<span className="block font-semibold text-[13px] text-ink leading-snug">
													{n.title}
												</span>
												<span className="mt-0.5 block text-[12px] text-muted-foreground leading-snug">
													{n.body}
												</span>
												<span className="mt-1 block font-mono text-[10.5px] text-muted-foreground uppercase tracking-[0.06em]">
													<TimeAgo date={n.createdAt} />
												</span>
											</span>
											{unread && (
												<span
													className="mt-1.5 size-2 shrink-0 rounded-full bg-brass"
													aria-hidden="true"
												/>
											)}
										</Link>
									</li>
								);
							})}
						</ul>
						<div className="border-border border-t px-4 py-2.5 text-center">
							<Link
								href={"/notifications" as Route}
								onClick={() => setOpen(false)}
								className="font-semibold text-[12px] text-brass-deep transition-colors hover:text-ink"
							>
								View all notifications
							</Link>
						</div>
					</>
				) : (
					<div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
						<span className="flex size-10 items-center justify-center rounded-full bg-surface-2 text-muted-foreground">
							<Bell className="size-5" aria-hidden="true" />
						</span>
						<p className="font-semibold text-[13.5px] text-ink">
							You're all caught up
						</p>
						<p className="max-w-[40ch] text-[12px] text-muted-foreground leading-relaxed">
							{emptyHint}
						</p>
					</div>
				)}
			</PopoverContent>
		</Popover>
	);
}
