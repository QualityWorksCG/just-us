"use client";

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
import { useTransition } from "react";

import {
	markAllNotificationsReadAction,
	markNotificationReadAction,
} from "@/app/(app)/notification-actions";
import { TimeAgo } from "@/components/time-ago";

/** A notification as rendered by the full-page list. */
export type ListNotification = {
	id: string;
	type: string;
	title: string;
	body: string;
	href: string;
	createdAt: Date | string;
	readAt: Date | string | null;
};

const ICONS: Record<string, typeof Bell> = {
	case_update: Megaphone,
	expression_of_interest: Scale,
	case_status: Flag,
	donation: HandCoins,
	certificate: Award,
	moderation: ShieldAlert,
};

/**
 * The `/notifications` list. Server-fetched rows rendered as deep links; clicking
 * one marks it read, and "Mark all read" clears the rest. Read state is written
 * through the same actions the bell uses, so both surfaces stay in step.
 */
export function NotificationList({ items }: { items: ListNotification[] }) {
	const [, startTransition] = useTransition();
	const hasUnread = items.some((n) => !n.readAt);

	function onItemClick(n: ListNotification) {
		if (n.readAt) return;
		startTransition(() => {
			void markNotificationReadAction(n.id);
		});
	}

	function onMarkAllRead() {
		startTransition(() => {
			void markAllNotificationsReadAction();
		});
	}

	if (items.length === 0) {
		return (
			<div className="flex flex-col items-center gap-3 rounded-xl border border-border border-dashed px-6 py-16 text-center">
				<span className="flex size-12 items-center justify-center rounded-full bg-surface-2 text-muted-foreground">
					<Bell className="size-6" aria-hidden="true" />
				</span>
				<p className="font-semibold text-[15px] text-ink">
					You're all caught up
				</p>
				<p className="max-w-[46ch] text-[13px] text-muted-foreground leading-relaxed">
					Case updates, attorney interest, status changes, and donation
					confirmations will show up here.
				</p>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-4">
			<div className="flex items-center justify-end">
				<button
					type="button"
					onClick={onMarkAllRead}
					disabled={!hasUnread}
					className="font-semibold text-[12.5px] text-brass-deep transition-colors hover:text-ink disabled:cursor-not-allowed disabled:text-muted-foreground disabled:hover:text-muted-foreground"
				>
					Mark all read
				</button>
			</div>
			<ul className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border">
				{items.map((n) => {
					const Icon = ICONS[n.type] ?? Bell;
					const unread = !n.readAt;
					return (
						<li key={n.id}>
							<Link
								href={n.href as Route}
								onClick={() => onItemClick(n)}
								className={cn(
									"flex gap-4 px-5 py-4 transition-colors hover:bg-surface-2",
									unread && "bg-brass-wash/40",
								)}
							>
								<span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-brass-wash text-brass-deep">
									<Icon className="size-4" aria-hidden="true" />
								</span>
								<span className="min-w-0 flex-1">
									<span className="block font-semibold text-[14px] text-ink leading-snug">
										{n.title}
									</span>
									<span className="mt-1 block text-[13px] text-ink-soft leading-relaxed">
										{n.body}
									</span>
									<span className="mt-1.5 block font-mono text-[10.5px] text-muted-foreground uppercase tracking-[0.06em]">
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
		</div>
	);
}
