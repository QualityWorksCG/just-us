import type { Prisma } from "../prisma/generated/client";
import type { ChatMessageRole } from "../prisma/generated/enums";
import prisma from "./index";

/**
 * Persistence for the in-app assistant.
 *
 * Every function takes the owning user's id, and every read is scoped by it in
 * the where clause rather than checked after the fact — a thread that isn't
 * yours reads as absent, so a guessed id reveals nothing about whether it
 * exists. `getOwnedChat` is the one gate the routes go through for that reason.
 *
 * A user keeps every thread they start. The active one is simply the most recent
 * by `updatedAt`, so nothing here has to be marked, unmarked, or kept unique —
 * starting a thread, reopening one from history, and taking a turn in it all move
 * the same ordering.
 *
 * Message `parts` are stored and returned as opaque JSON. This package knows
 * nothing about the AI SDK's message shape on purpose: the assistant's part
 * types will grow, and none of that growth should reach a migration.
 */

/** A stored turn, as the transport re-hydrates it. */
export type StoredChatMessage = {
	id: string;
	role: ChatMessageRole;
	parts: Prisma.JsonValue;
};

/** A turn to persist. Ids come from the AI SDK, so they are the caller's. */
export type ChatMessageInput = {
	id: string;
	role: ChatMessageRole;
	parts: Prisma.InputJsonValue;
};

/**
 * The user's open thread, creating one if they have none.
 *
 * Scoped to `role` as well as the user: the role is snapshotted at thread open,
 * so reusing a thread opened under a role the user no longer holds would hand
 * them an assistant scoped to that old role. A role change starts a new thread
 * instead, and the returned `role` therefore always matches the one asked for.
 */
export async function getOrCreateActiveChat(userId: string, role: string) {
	const existing = await prisma.chat.findFirst({
		where: { userId, role },
		orderBy: { updatedAt: "desc" },
		select: { id: true, role: true, createdAt: true },
	});
	if (existing) return existing;
	return prisma.chat.create({
		data: { userId, role },
		select: { id: true, role: true, createdAt: true },
	});
}

/**
 * A thread the user starts deliberately, alongside whatever they already have.
 *
 * The counterpart to `getOrCreateActiveChat`: that one reopens, this one adds.
 * Because it is the newest by `updatedAt` the moment it exists, it also becomes
 * the thread the no-argument reads return.
 */
export async function createChat(userId: string, role: string) {
	return prisma.chat.create({
		data: { userId, role },
		select: { id: true, role: true, createdAt: true },
	});
}

/** A thread as the history list shows it. */
export type ChatListing = {
	id: string;
	title: string | null;
	updatedAt: Date;
	messageCount: number;
};

/**
 * This user's threads for a role, most recently active first — the same order,
 * and the same role scoping, that decides which one reopens.
 *
 * The count comes from the relation rather than a second pass over the messages:
 * the list needs how many turns a thread holds, never the turns themselves.
 */
export async function listChats(
	userId: string,
	role: string,
): Promise<ChatListing[]> {
	const rows = await prisma.chat.findMany({
		where: { userId, role },
		orderBy: { updatedAt: "desc" },
		select: {
			id: true,
			title: true,
			updatedAt: true,
			_count: { select: { messages: true } },
		},
	});
	return rows.map((row) => ({
		id: row.id,
		title: row.title,
		updatedAt: row.updatedAt,
		messageCount: row._count.messages,
	}));
}

/**
 * Name a thread, but only the first time.
 *
 * A title is derived from the opening question, so every later turn would
 * rewrite it under the user while they read the list. `title: null` in the where
 * makes the write happen once and turns every repeat into a no-op, which is why
 * this is an `updateMany` — a plain update on a row that no longer matches
 * throws, and naming a thread must never be able to fail a turn.
 */
export async function setChatTitle(chatId: string, title: string) {
	await prisma.chat.updateMany({
		where: { id: chatId, title: null },
		data: { title },
	});
}

/** A thread, but only if this user owns it. Null covers both "gone" and
 *  "someone else's", which is what keeps the two indistinguishable. */
export async function getOwnedChat(chatId: string, userId: string) {
	return prisma.chat.findFirst({
		where: { id: chatId, userId },
		select: { id: true, role: true, title: true, createdAt: true },
	});
}

/** A thread's turns in the order they were said. Call ownership-checked first. */
export async function listChatMessages(
	chatId: string,
): Promise<StoredChatMessage[]> {
	return prisma.chatMessage.findMany({
		where: { chatId },
		orderBy: { createdAt: "asc" },
		select: { id: true, role: true, parts: true },
	});
}

/**
 * Persist turns and mark the thread as the active one.
 *
 * Upsert rather than create because a stream can be resumed or retried and the
 * same message id come back with more parts on it; a create would either
 * duplicate the turn or throw on the second attempt. The touch shares the
 * transaction so a saved message can't leave `updatedAt` behind.
 */
export async function saveChatMessages(
	chatId: string,
	messages: ChatMessageInput[],
) {
	if (messages.length === 0) return;
	await prisma.$transaction(async (tx) => {
		for (const message of messages) {
			await tx.chatMessage.upsert({
				where: { id: message.id },
				update: { role: message.role, parts: message.parts },
				create: {
					id: message.id,
					chatId,
					role: message.role,
					parts: message.parts,
				},
			});
		}
		await tx.chat.update({
			where: { id: chatId },
			data: { updatedAt: new Date() },
		});
	});
}

/** Delete a thread if this user owns it; its messages cascade with it. Returns
 *  whether anything was deleted, so a foreign id is a false rather than a leak. */
export async function clearChat(
	userId: string,
	chatId: string,
): Promise<boolean> {
	const res = await prisma.chat.deleteMany({ where: { id: chatId, userId } });
	return res.count > 0;
}

/** How many messages this user has sent across all their threads since a given
 *  time — the input side of rate limiting, so only `user` turns count. */
export async function countUserChatMessagesSince(userId: string, since: Date) {
	return prisma.chatMessage.count({
		where: { role: "user", createdAt: { gte: since }, chat: { userId } },
	});
}
