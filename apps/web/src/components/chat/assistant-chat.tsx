"use client";

import { useChat } from "@ai-sdk/react";
import type { Role } from "@just-us/auth";
import { Button } from "@just-us/ui/components/button";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@just-us/ui/components/empty";
import {
	MessageScroller,
	MessageScrollerButton,
	MessageScrollerContent,
	MessageScrollerItem,
	MessageScrollerProvider,
	MessageScrollerViewport,
} from "@just-us/ui/components/message-scroller";
import { cn } from "@just-us/ui/lib/utils";
import { DefaultChatTransport, type UIMessage } from "ai";
import { MessagesSquare, RotateCcw, TriangleAlert } from "lucide-react";
import { useMemo, useRef } from "react";

import { AssistantSidebar } from "@/components/chat/assistant-sidebar";
import { ChatComposer } from "@/components/chat/chat-composer";
import { STARTERS } from "@/components/chat/chat-copy";
import { ChatMessage, PendingMessage } from "@/components/chat/chat-message";

const GENERIC_ERROR =
	"The assistant couldn't answer that just now. Give it a moment and try again.";

/**
 * What to print for a failed turn.
 *
 * The transport throws with the response body as its message, so a rejected
 * request (a rate limit, say) arrives as the endpoint's own `{ error }` JSON.
 * Anything that isn't that — a network blip, an HTML error page — falls back to
 * copy a user can act on rather than a raw string.
 */
function errorNotice(error: Error) {
	const raw = error.message?.trim();
	if (!raw) return GENERIC_ERROR;
	if (raw.startsWith("{")) {
		try {
			const parsed = JSON.parse(raw) as { error?: unknown };
			if (typeof parsed.error === "string" && parsed.error.trim()) {
				return parsed.error.trim();
			}
		} catch {
			return GENERIC_ERROR;
		}
	}
	if (raw.startsWith("<") || raw.length > 180) return GENERIC_ERROR;
	return raw;
}

/**
 * The live conversation.
 *
 * Sits above the panel chrome on purpose: the column is only hidden when it
 * closes, and the hook has to outlive that so reopening the panel doesn't drop
 * the turns taken since the last history load. Keyed on `chatId` by the caller,
 * so switching or starting a thread remounts this with that chat.
 *
 * The history list arrives as a node rather than being rendered here, because the
 * threads it lists are the caller's business. While it shows, the conversation is
 * hidden instead of unmounted — a user who looks at the list mid-answer comes back
 * to the answer still streaming.
 */
export function AssistantChat({
	open,
	entered,
	onOpenChange,
	role,
	chatId,
	initialMessages,
	onNewChat,
	onHistory,
	history,
	pending,
}: {
	open: boolean;
	/** Passed straight through: the column's motion is not this component's. */
	entered: boolean;
	onOpenChange: (open: boolean) => void;
	role: Role;
	chatId: string;
	initialMessages: UIMessage[];
	onNewChat: () => void;
	onHistory: () => void;
	/** The conversation list, when the user is looking at it. */
	history: React.ReactNode | null;
	pending: boolean;
}) {
	const composerRef = useRef<HTMLTextAreaElement>(null);

	const transport = useMemo(
		() =>
			new DefaultChatTransport<UIMessage>({
				api: "/api/chat",
				// Only the newest message crosses the wire — the server owns the
				// thread and reloads the rest from it.
				prepareSendMessagesRequest: ({ messages: outgoing }) => ({
					body: { chatId, message: outgoing.at(-1) },
				}),
			}),
		[chatId],
	);

	const { messages, sendMessage, status, stop, error, clearError, regenerate } =
		useChat({ id: chatId, messages: initialMessages, transport });

	const busy = status === "submitted" || status === "streaming";
	const starters = STARTERS[role];
	const showingHistory = history !== null;

	return (
		<AssistantSidebar
			open={open}
			entered={entered}
			onOpenChange={onOpenChange}
			// Nothing to start from an untouched thread: it is already the new one.
			onNewChat={messages.length > 0 ? onNewChat : undefined}
			onHistory={onHistory}
			historyOpen={showingHistory}
			pending={pending}
			// The composer is behind the list while it shows, so opening the panel on
			// the history view must not reach past it for focus.
			initialFocus={showingHistory ? undefined : composerRef}
		>
			{history}
			<div
				className={cn(
					"flex min-h-0 flex-1 flex-col",
					showingHistory && "hidden",
				)}
			>
				{messages.length === 0 && !busy ? (
					<Empty className="justify-center gap-5 px-6 md:p-6">
						<EmptyHeader>
							<EmptyMedia
								variant="icon"
								className="size-11 rounded-xl bg-brass-wash text-brass-deep"
							>
								<MessagesSquare className="size-5" aria-hidden="true" />
							</EmptyMedia>
							<EmptyTitle className="font-bold text-[15px] text-ink">
								How can I help?
							</EmptyTitle>
							<EmptyDescription className="text-[13px] text-ink-soft">
								Ask about your own account, or how anything on JustUs works.
							</EmptyDescription>
						</EmptyHeader>
						<EmptyContent className="gap-2">
							{starters.map((starter) => (
								<Button
									key={starter}
									variant="outline"
									size="sm"
									onClick={() => sendMessage({ text: starter })}
									className="h-auto w-full whitespace-normal rounded-[var(--radius-control)] border-line-strong px-3 py-2 text-left text-[13px] text-ink-soft hover:text-ink"
								>
									{starter}
								</Button>
							))}
						</EmptyContent>
					</Empty>
				) : (
					<MessageScrollerProvider autoScroll>
						<MessageScroller className="flex-1">
							<MessageScrollerViewport className="px-4 py-4">
								<MessageScrollerContent className="gap-4">
									{messages.map((message) => (
										<MessageScrollerItem
											key={message.id}
											messageId={message.id}
											scrollAnchor={message.role === "user"}
										>
											<ChatMessage message={message} />
										</MessageScrollerItem>
									))}
									{status === "submitted" && (
										<MessageScrollerItem messageId={`${chatId}-pending`}>
											<PendingMessage />
										</MessageScrollerItem>
									)}
								</MessageScrollerContent>
							</MessageScrollerViewport>
							<MessageScrollerButton className="rounded-full border-border bg-surface text-ink-soft shadow-[var(--shadow-hover)]" />
						</MessageScroller>
					</MessageScrollerProvider>
				)}

				{error && (
					<div
						role="alert"
						className="flex shrink-0 items-start gap-2 border-border border-t bg-danger/10 px-4 py-3 text-[12.5px] text-ink-soft leading-relaxed"
					>
						<TriangleAlert
							className="mt-0.5 size-4 shrink-0 text-danger"
							aria-hidden="true"
						/>
						<span className="min-w-0 flex-1">{errorNotice(error)}</span>
						<span className="flex shrink-0 items-center gap-1">
							{messages.length > 0 && (
								<Button
									variant="ghost"
									size="xs"
									onClick={() => {
										clearError();
										void regenerate();
									}}
									className="text-brass-deep"
								>
									<RotateCcw data-icon="inline-start" aria-hidden="true" />
									Try again
								</Button>
							)}
							<Button
								variant="ghost"
								size="xs"
								onClick={clearError}
								className="text-ink-soft"
							>
								Dismiss
							</Button>
						</span>
					</div>
				)}

				<ChatComposer
					textareaRef={composerRef}
					busy={busy}
					onSend={(text) => {
						clearError();
						void sendMessage({ text });
					}}
					onStop={() => {
						void stop();
					}}
				/>
			</div>
		</AssistantSidebar>
	);
}
