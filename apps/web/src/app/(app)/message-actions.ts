"use server";

import { sendNewMessageEmail } from "@just-us/auth/lib/email";
import {
	ACTIVE_THREAD_WINDOW_MS,
	createFirstMessage,
	createReply,
	getConversationForParticipant,
	markConversationReadAndActive,
	markMessageEmailFailed,
	markMessageEmailSent,
	messageEmailPreferences,
	recipientForMessage,
	removeOwnMessage,
	reportConversation,
	reserveMessageEmailDelivery,
	resolveConversationReport,
	setConversationMessageEmailPreference,
	setGlobalMessageEmailPreference,
} from "@just-us/db/messages";
import { env } from "@just-us/env/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
	requireOnboarded,
	requirePermission,
	requireRole,
} from "@/lib/auth-server";

const firstMessageSchema = z
	.object({
		attorneyId: z.string().min(1),
		body: z.string().trim().min(1).max(2000),
		caseId: z.string().min(1).optional(),
	})
	.strict();
const replySchema = z
	.object({
		conversationId: z.string().min(1),
		body: z.string().trim().min(1).max(4000),
	})
	.strict();
const conversationSchema = z
	.object({ conversationId: z.string().min(1) })
	.strict();
/** The categories a participant can report a conversation under. */
const REPORT_CATEGORIES = [
	"spam",
	"fraud",
	"harassment",
	"inappropriate",
	"other",
] as const;

const reportSchema = z
	.object({
		conversationId: z.string().min(1),
		category: z.enum(REPORT_CATEGORIES),
		// Detail is optional now — the category carries the signal. Trimmed, capped.
		reason: z.string().trim().max(1000).optional().default(""),
	})
	.strict();

type ActionResult = { ok: true } | { ok: false; error: string };

async function notifyForMessage(messageId: string) {
	const message = await recipientForMessage(messageId);
	if (!message) return;
	const { conversation, author } = message;
	const recipient =
		conversation.plaintiffId === author.id
			? conversation.attorney
			: conversation.plaintiff;
	const activeAt =
		conversation.plaintiffId === recipient.id
			? conversation.plaintiffActiveAt
			: conversation.attorneyActiveAt;
	const preferences = await messageEmailPreferences(
		recipient.id,
		conversation.id,
	);
	const inactive =
		!activeAt || Date.now() - activeAt.getTime() > ACTIVE_THREAD_WINDOW_MS;
	const reason = !preferences.globalEmailEnabled
		? "global_opt_out"
		: !preferences.conversationEmailEnabled
			? "conversation_opt_out"
			: !inactive
				? "recipient_active"
				: null;

	// Reserving the row first is the idempotency boundary: concurrent server
	// action retries cannot produce a second provider call for the same message.
	const reserved = await reserveMessageEmailDelivery({
		messageId,
		recipientId: recipient.id,
		status: reason ? "skipped" : "sent",
		reason: reason ?? undefined,
	});
	if (!reserved || reason) return;

	try {
		await sendNewMessageEmail({
			to: recipient.email,
			url: new URL(
				`/messages/${conversation.id}`,
				env.BETTER_AUTH_URL,
			).toString(),
			recipientName: recipient.name,
			senderName: author.name,
		});
		await markMessageEmailSent(messageId);
	} catch {
		await markMessageEmailFailed(messageId);
	}
}

export async function startConversationAction(
	input: unknown,
): Promise<ActionResult & { conversationId?: string }> {
	const { session } = await requireRole("plaintiff");
	const parsed = firstMessageSchema.safeParse(input);
	if (!parsed.success)
		return { ok: false, error: "Write a message of up to 2,000 characters." };

	const result = await createFirstMessage({
		plaintiffId: session.user.id,
		...parsed.data,
	});
	if (!result.ok) {
		if (result.reason === "already_exists") {
			return {
				ok: false,
				error: "You already have a conversation with this attorney.",
				conversationId: result.conversationId,
			};
		}
		if (result.reason === "contact_limit") {
			return {
				ok: false,
				error:
					"You have 10 unanswered first contacts. Wait for a reply before contacting another attorney.",
			};
		}
		return {
			ok: false,
			error: "This attorney is not available for messaging.",
		};
	}

	await notifyForMessage(result.messageId);
	revalidatePath("/messages");
	return { ok: true, conversationId: result.conversationId };
}

export async function sendMessageAction(input: unknown): Promise<ActionResult> {
	const { session } = await requireRole("plaintiff", "attorney");
	const parsed = replySchema.safeParse(input);
	if (!parsed.success)
		return { ok: false, error: "Write a message of up to 4,000 characters." };
	const result = await createReply({
		authorId: session.user.id,
		...parsed.data,
	});
	if (!result.ok)
		return { ok: false, error: "You cannot post to this conversation." };
	await notifyForMessage(result.messageId);
	revalidatePath(`/messages/${parsed.data.conversationId}`);
	revalidatePath("/messages");
	return { ok: true };
}

export async function markConversationActiveAction(
	input: unknown,
): Promise<ActionResult> {
	const { session } = await requireRole("plaintiff", "attorney");
	const parsed = conversationSchema.safeParse(input);
	if (!parsed.success) return { ok: false, error: "Invalid conversation." };
	const ok = await markConversationReadAndActive(
		parsed.data.conversationId,
		session.user.id,
	);
	if (!ok) return { ok: false, error: "You cannot access this conversation." };
	revalidatePath("/messages");
	return { ok: true };
}

export async function removeMessageAction(
	messageId: string,
): Promise<ActionResult> {
	const { session } = await requireRole("plaintiff", "attorney");
	const removed = await removeOwnMessage(messageId, session.user.id);
	if (!removed)
		return { ok: false, error: "Only the author can remove this message." };
	revalidatePath("/messages");
	return { ok: true };
}

export async function reportConversationAction(
	input: unknown,
): Promise<ActionResult> {
	const { session } = await requireRole("plaintiff", "attorney");
	const parsed = reportSchema.safeParse(input);
	if (!parsed.success)
		return {
			ok: false,
			error: "Choose a category for your report.",
		};
	const report = await reportConversation({
		reporterId: session.user.id,
		...parsed.data,
	});
	if (!report)
		return { ok: false, error: "You cannot report this conversation." };
	revalidatePath("/moderation");
	return { ok: true };
}

export async function setMessageEmailPreferenceAction(
	enabled: boolean,
): Promise<ActionResult> {
	const session = await requireOnboarded();
	await setGlobalMessageEmailPreference(session.user.id, enabled);
	revalidatePath("/settings");
	return { ok: true };
}

export async function setConversationEmailPreferenceAction(
	conversationId: string,
	enabled: boolean,
): Promise<ActionResult> {
	const { session } = await requireRole("plaintiff", "attorney");
	const conversation = await getConversationForParticipant(
		conversationId,
		session.user.id,
	);
	if (!conversation)
		return { ok: false, error: "You cannot change this conversation." };
	await setConversationMessageEmailPreference(
		conversationId,
		session.user.id,
		enabled,
	);
	revalidatePath(`/messages/${conversationId}`);
	return { ok: true };
}

export async function resolveConversationReportAction(
	reportId: string,
): Promise<ActionResult> {
	const { session } = await requirePermission("moderation:review");
	await resolveConversationReport(reportId, session.user.id);
	revalidatePath("/moderation");
	return { ok: true };
}
