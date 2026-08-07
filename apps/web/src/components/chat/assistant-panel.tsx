"use client";

import type { Role } from "@just-us/auth";
import { Skeleton } from "@just-us/ui/components/skeleton";
import type { UIMessage } from "ai";
import { MessageSquareOff } from "lucide-react";
import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { newChatAction } from "@/app/(app)/chat-actions";
import { AssistantChat } from "@/components/chat/assistant-chat";
import { AssistantSidebar } from "@/components/chat/assistant-sidebar";
import { ChatHistory } from "@/components/chat/chat-history";

type Thread = { chatId: string; messages: UIMessage[] };

type Load =
	| { state: "loading" }
	| { state: "ready"; thread: Thread }
	/** Signed out, not onboarded, or the flag went off between render and open. */
	| { state: "unavailable" };

/** Which half of the panel the user is looking at. */
type View = "thread" | "history";

const SWITCH_FAILED = "Couldn't open that conversation. Please try again.";

function ThreadSkeleton() {
	return (
		<div className="flex min-h-0 flex-1 flex-col gap-4 p-4" aria-hidden="true">
			<Skeleton className="h-14 w-3/4 rounded-[var(--radius-card)]" />
			<Skeleton className="h-10 w-1/2 self-end rounded-[var(--radius-card)]" />
			<Skeleton className="h-20 w-4/5 rounded-[var(--radius-card)]" />
		</div>
	);
}

function Unavailable() {
	return (
		<div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
			<MessageSquareOff
				className="size-6 text-muted-foreground"
				aria-hidden="true"
			/>
			<p className="font-bold text-[14px] text-ink">Assistant unavailable</p>
			<p className="max-w-[36ch] text-[12.5px] text-muted-foreground leading-relaxed">
				It isn't available on your account right now. Everything else on JustUs
				works as normal.
			</p>
		</div>
	);
}

/**
 * The assistant panel.
 *
 * Mounted by the shell on first open and left mounted from then on, so the
 * conversation survives closing the column. Nothing here runs until the user
 * actually opens it.
 *
 * Owns which thread is on screen, because that outlives the conversation
 * component: `AssistantChat` is keyed on the chat id, so starting a thread or
 * opening one from history is a remount, and the id has to be held above it.
 */
export function AssistantPanel({
	open,
	onOpenChange,
	role,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	role: Role;
}) {
	const [load, setLoad] = useState<Load>({ state: "loading" });
	const [view, setView] = useState<View>("thread");
	// The panel is fetched on first open, so it arrives already open and has no
	// closed frame to animate away from. One frame closed fixes that. It is held
	// here rather than in the column because the column is remounted whenever the
	// thread changes, and re-entering on every switch would collapse and reopen it.
	const [entered, setEntered] = useState(false);
	const [pending, startSwitch] = useTransition();
	// Bumped to re-read the list after a delete rotated the thread underneath it,
	// so the row marked as current is the thread the panel is actually on.
	const [historyEpoch, setHistoryEpoch] = useState(0);

	/**
	 * The active thread, opening one if the user has none.
	 *
	 * `no-store`, like every read here: which thread is active and what is in it
	 * both change while the panel is open, and the endpoint sends no freshness
	 * headers of its own — a cached copy would put the user back on a thread they
	 * just deleted, or show one without its latest turns.
	 */
	const loadActive = useCallback(async (signal?: AbortSignal) => {
		try {
			const res = await fetch("/api/chat", { signal, cache: "no-store" });
			if (!res.ok) return { ok: false as const };
			const data = (await res.json()) as Partial<Thread>;
			if (!data.chatId) return { ok: false as const };
			return {
				ok: true as const,
				thread: { chatId: data.chatId, messages: data.messages ?? [] },
			};
		} catch {
			return { ok: false as const };
		}
	}, []);

	useEffect(() => {
		// Two frames: the first gets the collapsed column measured and painted, the
		// second changes it, which is what the browser needs to see a transition
		// rather than a new element that was always this wide.
		let second = 0;
		const first = requestAnimationFrame(() => {
			second = requestAnimationFrame(() => setEntered(true));
		});
		return () => {
			cancelAnimationFrame(first);
			cancelAnimationFrame(second);
		};
	}, []);

	useEffect(() => {
		const controller = new AbortController();
		(async () => {
			const res = await loadActive(controller.signal);
			if (controller.signal.aborted) return;
			setLoad(
				res.ok
					? { state: "ready", thread: res.thread }
					: { state: "unavailable" },
			);
		})();
		return () => controller.abort();
	}, [loadActive]);

	/** Show a thread and get out of the list. The remount focuses the composer. */
	function show(thread: Thread) {
		setLoad({ state: "ready", thread });
		setView("thread");
	}

	function newChat() {
		startSwitch(async () => {
			const res = await newChatAction();
			if (!res.ok) {
				toast.error(res.error);
				return;
			}
			show({ chatId: res.chatId, messages: [] });
		});
	}

	function openChat(chatId: string) {
		if (load.state === "ready" && load.thread.chatId === chatId) {
			setView("thread");
			return;
		}
		startSwitch(async () => {
			try {
				const res = await fetch(
					`/api/chat?chatId=${encodeURIComponent(chatId)}`,
					{ cache: "no-store" },
				);
				if (!res.ok) throw new Error(SWITCH_FAILED);
				const data = (await res.json()) as Partial<Thread>;
				if (!data.chatId) throw new Error(SWITCH_FAILED);
				show({ chatId: data.chatId, messages: data.messages ?? [] });
			} catch {
				toast.error(SWITCH_FAILED);
			}
		});
	}

	/**
	 * Deleting the thread the panel is posting to leaves it with nowhere to send,
	 * so it moves to whatever is now the active thread — the next most recent, or a
	 * fresh one when that was the last. The user stays in the list they were
	 * pruning.
	 */
	function afterDelete(chatId: string) {
		if (load.state !== "ready" || load.thread.chatId !== chatId) return;
		startSwitch(async () => {
			const res = await loadActive();
			if (!res.ok) {
				toast.error(SWITCH_FAILED);
				return;
			}
			setLoad({ state: "ready", thread: res.thread });
			setHistoryEpoch((epoch) => epoch + 1);
		});
	}

	if (load.state === "ready") {
		return (
			<AssistantChat
				key={load.thread.chatId}
				open={open}
				entered={entered}
				onOpenChange={onOpenChange}
				role={role}
				chatId={load.thread.chatId}
				initialMessages={load.thread.messages}
				onNewChat={newChat}
				onHistory={() =>
					setView((current) => (current === "history" ? "thread" : "history"))
				}
				pending={pending}
				history={
					view === "history" ? (
						<ChatHistory
							// Remount is the refetch: a new epoch re-reads the list.
							key={historyEpoch}
							activeChatId={load.thread.chatId}
							onSelect={openChat}
							onDeleted={afterDelete}
							pending={pending}
						/>
					) : null
				}
			/>
		);
	}

	return (
		<AssistantSidebar open={open} entered={entered} onOpenChange={onOpenChange}>
			{load.state === "loading" ? <ThreadSkeleton /> : <Unavailable />}
		</AssistantSidebar>
	);
}
