"use client";

import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@just-us/ui/components/popover";
import { cn } from "@just-us/ui/lib/utils";
import { Bell, Megaphone, Scale } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { TimeAgo } from "@/components/time-ago";

/** How often the bell re-checks the server for new notifications. They trickle
 *  in on human timescales, so a slow poll keeps it feeling live without hammering
 *  the server; a tab regaining focus refreshes immediately regardless. */
const POLL_MS = 30_000;

/** One item in the bell — something new on a case the viewer is part of:
 *  `request` is an attorney expressing interest (plaintiff), `update` is a new
 *  case update (plaintiff on their case, or a donor on a case they follow). The
 *  `href` is where clicking goes — it differs by role, so the caller sets it.
 *  `createdAt` may arrive as a Date (server prop) or ISO string. */
export type BellNotification = {
	id: string;
	kind: "request" | "update";
	caseTitle: string;
	actorName: string | null;
	href: Route;
	createdAt: Date | string;
};

/**
 * The header notification bell. Surfaces what's new on cases the viewer is part
 * of — for a plaintiff, attorney requests and their attorney's updates; for a
 * donor, updates on cases they follow. The count is visible everywhere, and each
 * item deep-links to where it lives (which is where it gets marked seen).
 *
 * `emptyHint` says what *would* appear here, so it must match the viewer's role
 * (a donor never gets attorney requests).
 */
export function NotificationBell({
	items = [],
	poll = false,
	emptyHint = "New notifications will show up here.",
}: {
	items?: BellNotification[];
	/** Re-fetch on an interval and on tab focus, so something that arrives while
	 *  the viewer sits on a screen shows up without a manual reload. */
	poll?: boolean;
	/** Role-appropriate empty-state text — set by the caller, which knows the role. */
	emptyHint?: string;
}) {
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const count = items.length;
	const hasNew = count > 0;

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

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger
				render={
					<button
						type="button"
						aria-label={
							hasNew
								? `Notifications — ${count} new`
								: "Notifications — none new"
						}
						className="relative flex size-9 items-center justify-center rounded-full border border-border text-ink-soft transition-colors hover:border-brass-deep hover:text-ink"
					>
						<Bell className="size-[17px]" aria-hidden="true" />
						{hasNew && (
							<span
								className="absolute -top-1 -right-1 flex min-w-[18px] items-center justify-center rounded-full bg-brass px-1 py-0.5 font-bold text-[10px] text-brass-ink leading-none ring-2 ring-surface"
								aria-hidden="true"
							>
								{count > 9 ? "9+" : count}
							</span>
						)}
					</button>
				}
			/>
			<PopoverContent
				align="end"
				className="w-[320px] gap-0 p-0"
				aria-label="Notifications"
			>
				<div className="flex items-center justify-between border-border border-b px-4 py-3">
					<p className="font-bold text-[13.5px] text-ink">Notifications</p>
					{hasNew && (
						<span className="rounded-full bg-brass-wash px-2 py-0.5 font-semibold text-[11px] text-brass-deep">
							{count} new
						</span>
					)}
				</div>

				{hasNew ? (
					<ul className="max-h-[360px] overflow-y-auto py-1">
						{items.map((n) => {
							const actor = n.actorName?.trim() || "Someone";
							const Icon = n.kind === "request" ? Scale : Megaphone;
							return (
								<li key={n.id}>
									<Link
										href={n.href}
										onClick={() => setOpen(false)}
										className={cn(
											"flex gap-3 px-4 py-3 transition-colors hover:bg-surface-2",
										)}
									>
										<span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-brass-wash text-brass-deep">
											<Icon className="size-4" aria-hidden="true" />
										</span>
										<span className="min-w-0 flex-1">
											<span className="block text-[13px] text-ink leading-snug">
												<span className="font-bold">{actor}</span>{" "}
												{n.kind === "request"
													? "asked to represent you"
													: "posted a case update"}
											</span>
											<span className="mt-0.5 block truncate text-[12px] text-muted-foreground">
												{n.caseTitle}
											</span>
											<span className="mt-0.5 block font-mono text-[10.5px] text-muted-foreground uppercase tracking-[0.06em]">
												<TimeAgo date={n.createdAt} />
											</span>
										</span>
									</Link>
								</li>
							);
						})}
					</ul>
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
