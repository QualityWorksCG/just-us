"use client";

import { Button } from "@just-us/ui/components/button";
import { Skeleton } from "@just-us/ui/components/skeleton";
import { cn } from "@just-us/ui/lib/utils";
import { MessagesSquare, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
	type ChatSummary,
	deleteChatAction,
	listChatsAction,
} from "@/app/(app)/chat-actions";
import { ago, UNTITLED_CHAT } from "@/components/chat/chat-copy";

type List =
	| { state: "loading" }
	| { state: "ready"; chats: ChatSummary[] }
	| { state: "failed"; error: string };

/**
 * The panel's conversation list.
 *
 * Fetched on mount rather than kept in sync, because the caller only mounts this
 * while the history view is showing — opening the list is the refresh, so a
 * thread renamed or added since the last look is always there.
 *
 * Deleting is immediate and unconfirmed. There is no undo, but there is also
 * nothing here a user can destroy that they cannot ask again, and a confirm step
 * on every row would cost more than it protects.
 */
export function ChatHistory({
	activeChatId,
	onSelect,
	onDeleted,
	/** A thread switch is already in flight — one press at a time. */
	pending,
}: {
	activeChatId: string;
	onSelect: (chatId: string) => void;
	onDeleted: (chatId: string) => void;
	pending: boolean;
}) {
	const [list, setList] = useState<List>({ state: "loading" });
	const [deleting, setDeleting] = useState<string | null>(null);

	useEffect(() => {
		let live = true;
		(async () => {
			const res = await listChatsAction();
			if (!live) return;
			setList(
				res.ok
					? { state: "ready", chats: res.chats }
					: { state: "failed", error: res.error },
			);
		})();
		return () => {
			live = false;
		};
	}, []);

	async function remove(chatId: string) {
		setDeleting(chatId);
		const res = await deleteChatAction(chatId);
		setDeleting(null);
		if (!res.ok) {
			toast.error(res.error);
			return;
		}
		// Dropped locally rather than refetched: the row is gone either way, and the
		// list should not flicker back through a skeleton to say so.
		setList((prev) =>
			prev.state === "ready"
				? { ...prev, chats: prev.chats.filter((chat) => chat.id !== chatId) }
				: prev,
		);
		toast.success("Conversation deleted.");
		onDeleted(chatId);
	}

	if (list.state === "loading") {
		return (
			<div
				className="flex min-h-0 flex-1 flex-col gap-2 p-3"
				aria-hidden="true"
			>
				{[0, 1, 2, 3].map((row) => (
					<Skeleton
						key={row}
						className="h-12 w-full rounded-[var(--radius-control)]"
					/>
				))}
			</div>
		);
	}

	if (list.state === "failed") {
		return (
			<div
				role="alert"
				className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 p-8 text-center text-[12.5px] text-ink-soft"
			>
				{list.error}
			</div>
		);
	}

	if (list.chats.length === 0) {
		return (
			<div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
				<MessagesSquare
					className="size-6 text-muted-foreground"
					aria-hidden="true"
				/>
				<p className="font-bold text-[14px] text-ink">No conversations yet</p>
				<p className="max-w-[32ch] text-[12.5px] text-muted-foreground leading-relaxed">
					Ask the assistant something and it will show up here.
				</p>
			</div>
		);
	}

	return (
		<div className="min-h-0 flex-1 overflow-y-auto p-3">
			{/* Named, because a conversation on screen is full of list items too —
			    anything looking for these rows has to be able to say which it means. */}
			<ul data-slot="chat-history" className="flex flex-col gap-1">
				{list.chats.map((chat) => {
					const name = chat.title ?? UNTITLED_CHAT;
					const active = chat.id === activeChatId;
					const busy = deleting === chat.id;
					return (
						<li key={chat.id} className="flex items-center gap-1">
							<button
								type="button"
								onClick={() => onSelect(chat.id)}
								disabled={pending || busy}
								aria-current={active ? "true" : undefined}
								className={cn(
									"min-w-0 flex-1 rounded-[var(--radius-control)] px-3 py-2 text-left transition-colors",
									"hover:bg-paper-alt disabled:opacity-60",
									active && "bg-brass-wash/70 hover:bg-brass-wash",
								)}
							>
								<span
									className={cn(
										"block truncate font-semibold text-[13px] text-ink",
										active && "text-brass-deep",
									)}
								>
									{name}
								</span>
								<span className="block text-[11px] text-muted-foreground">
									{ago(chat.updatedAt)}
									{chat.messageCount > 0 &&
										` · ${chat.messageCount} message${chat.messageCount === 1 ? "" : "s"}`}
									{active && " · current"}
								</span>
							</button>
							<Button
								variant="ghost"
								size="icon-sm"
								onClick={() => void remove(chat.id)}
								disabled={busy || pending}
								aria-label={`Delete conversation: ${name}`}
								className="shrink-0 text-ink-soft hover:bg-danger/10 hover:text-danger"
							>
								<Trash2 className="size-4" aria-hidden="true" />
							</Button>
						</li>
					);
				})}
			</ul>
		</div>
	);
}
