"use server";

import type { Role } from "@just-us/auth";
import {
	clearChat,
	createChat,
	getOrCreateActiveChat,
	listChats,
} from "@just-us/db/chat";

import { getSession } from "@/lib/auth-server";
import { isEnabled } from "@/lib/flags-server";

/**
 * Managing the assistant's threads: starting one, listing them, deleting one.
 *
 * A server action is a public endpoint, so the gate here is the enforcement point
 * rather than a re-check of what the panel already decided. None of these
 * redirect: the callers are controls inside a rendered panel and need a denial
 * they can show, not a navigation.
 *
 * Every read and write is scoped by the session's user id in the data layer, so a
 * chat id belonging to someone else behaves exactly like one that never existed.
 */

export type NewChatResult =
	| { ok: true; chatId: string }
	| { ok: false; error: string };

/** A thread as the panel's history list renders it. Dates cross as strings —
 *  an action's result is serialized, and the list only ever formats them. */
export type ChatSummary = {
	id: string;
	title: string | null;
	updatedAt: string;
	messageCount: number;
};

export type ListChatsResult =
	| { ok: true; chats: ChatSummary[] }
	| { ok: false; error: string };

export type DeleteChatResult = { ok: true } | { ok: false; error: string };

const DENIED = "You are not permitted to do that.";

type Gate =
	| { ok: true; userId: string; role: Role }
	| { ok: false; error: string };

/**
 * Session, account state, and flag — the same order the transport gates on.
 *
 * Every denial is the one string: with the assistant switched off these actions
 * must not read differently from a user who was never allowed to call them.
 */
async function gate(): Promise<Gate> {
	const session = await getSession();
	const user = session?.user as
		| { role?: Role; onboarded?: boolean; emailVerified?: boolean }
		| undefined;
	if (!session?.user || !user?.emailVerified || !user.onboarded) {
		return { ok: false, error: DENIED };
	}
	if (!(await isEnabled("aiAssistant"))) {
		return { ok: false, error: DENIED };
	}
	return {
		ok: true,
		userId: session.user.id,
		role: (user.role ?? "donor") as Role,
	};
}

/**
 * Start a conversation.
 *
 * An empty active thread is handed back as-is rather than added to: pressing new
 * on a thread nobody has said anything in yet would otherwise leave a trail of
 * blank rows in the history list, one per press.
 */
export async function newChatAction(): Promise<NewChatResult> {
	const gated = await gate();
	if (!gated.ok) return { ok: false, error: gated.error };

	try {
		// Ordered by activity, so the first row is the thread the panel would reopen.
		const [active] = await listChats(gated.userId, gated.role);
		if (active?.messageCount === 0) return { ok: true, chatId: active.id };
		const fresh = await createChat(gated.userId, gated.role);
		return { ok: true, chatId: fresh.id };
	} catch {
		return {
			ok: false,
			error: "Couldn't start a new conversation. Please try again.",
		};
	}
}

export async function listChatsAction(): Promise<ListChatsResult> {
	const gated = await gate();
	if (!gated.ok) return { ok: false, error: gated.error };

	try {
		// Reading the list is also what guarantees the user has one to read: a first
		// open with no threads at all should show their own empty conversation, not
		// an empty list.
		await getOrCreateActiveChat(gated.userId, gated.role);
		const chats = await listChats(gated.userId, gated.role);
		return {
			ok: true,
			chats: chats.map((chat) => ({
				id: chat.id,
				title: chat.title,
				updatedAt: chat.updatedAt.toISOString(),
				messageCount: chat.messageCount,
			})),
		};
	} catch {
		return {
			ok: false,
			error: "Couldn't load your conversations. Please try again.",
		};
	}
}

/** Delete one thread and its messages. A thread that isn't this user's reads as
 *  already gone, which is the same answer a deleted one gives. */
export async function deleteChatAction(
	chatId: string,
): Promise<DeleteChatResult> {
	const gated = await gate();
	if (!gated.ok) return { ok: false, error: gated.error };

	try {
		const deleted = await clearChat(gated.userId, chatId);
		if (!deleted) {
			return { ok: false, error: "That conversation is no longer there." };
		}
		return { ok: true };
	} catch {
		return {
			ok: false,
			error: "Couldn't delete that conversation. Please try again.",
		};
	}
}
