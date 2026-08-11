import prisma from ".";

export const FIRST_CONTACT_LIMIT = 10;
export const ACTIVE_THREAD_WINDOW_MS = 60_000;

export type ConversationParticipantRole = "plaintiff" | "attorney";

export type MessageSummary = {
	conversationId: string;
	otherUser: { id: string; name: string; image: string | null; role: string };
	caseTitle: string | null;
	latestMessage: {
		body: string;
		createdAt: Date;
		deletedAt: Date | null;
		authorId: string;
	} | null;
	unreadCount: number;
	updatedAt: Date;
};

function participantRole(
	conversation: { plaintiffId: string; attorneyId: string },
	userId: string,
): ConversationParticipantRole | null {
	if (conversation.plaintiffId === userId) return "plaintiff";
	if (conversation.attorneyId === userId) return "attorney";
	return null;
}

export async function unreadMessageCount(userId: string) {
	return prisma.message.count({
		where: {
			readAt: null,
			authorId: { not: userId },
			conversation: {
				OR: [{ plaintiffId: userId }, { attorneyId: userId }],
			},
		},
	});
}

export async function listMessageConversations(userId: string) {
	const conversations = await prisma.conversation.findMany({
		where: { OR: [{ plaintiffId: userId }, { attorneyId: userId }] },
		orderBy: { updatedAt: "desc" },
		include: {
			plaintiff: { select: { id: true, name: true, image: true, role: true } },
			attorney: { select: { id: true, name: true, image: true, role: true } },
			case: { select: { title: true } },
			messages: {
				orderBy: { createdAt: "desc" },
				take: 1,
				select: {
					body: true,
					createdAt: true,
					deletedAt: true,
					authorId: true,
				},
			},
		},
	});

	const ids = conversations.map((conversation) => conversation.id);
	const unread = ids.length
		? await prisma.message.groupBy({
				by: ["conversationId"],
				where: {
					conversationId: { in: ids },
					authorId: { not: userId },
					readAt: null,
				},
				_count: { _all: true },
			})
		: [];
	const unreadByConversation = new Map(
		unread.map((entry) => [entry.conversationId, entry._count._all]),
	);

	return conversations.map(
		(conversation): MessageSummary => ({
			conversationId: conversation.id,
			otherUser:
				conversation.plaintiffId === userId
					? conversation.attorney
					: conversation.plaintiff,
			caseTitle: conversation.case?.title ?? null,
			latestMessage: conversation.messages[0] ?? null,
			unreadCount: unreadByConversation.get(conversation.id) ?? 0,
			updatedAt: conversation.updatedAt,
		}),
	);
}

export async function getConversationForParticipant(
	conversationId: string,
	userId: string,
) {
	const conversation = await prisma.conversation.findUnique({
		where: { id: conversationId },
		include: {
			plaintiff: { select: { id: true, name: true, image: true, role: true } },
			attorney: { select: { id: true, name: true, image: true, role: true } },
			case: { select: { id: true, title: true, ownerId: true } },
			messages: {
				orderBy: { createdAt: "asc" },
				include: { author: { select: { id: true, name: true, role: true } } },
			},
		},
	});
	if (!conversation || !participantRole(conversation, userId)) return null;
	return conversation;
}

export async function getConversationForModeration(conversationId: string) {
	return prisma.conversation.findUnique({
		where: { id: conversationId },
		include: {
			plaintiff: { select: { id: true, name: true, email: true } },
			attorney: { select: { id: true, name: true, email: true } },
			messages: {
				orderBy: { createdAt: "asc" },
				include: { author: { select: { id: true, name: true, role: true } } },
				// `deletedAt` drives the "Message removed" state + hides the remove button.
			},
			reports: {
				orderBy: { createdAt: "desc" },
				include: { reporter: { select: { id: true, name: true } } },
			},
		},
	});
}

export async function createFirstMessage(input: {
	plaintiffId: string;
	attorneyId: string;
	body: string;
	caseId?: string;
}) {
	return prisma.$transaction(async (tx) => {
		const attorney = await tx.user.findFirst({
			where: {
				id: input.attorneyId,
				role: "attorney",
				attorneyProfile: { is: { verificationStatus: "verified" } },
			},
			select: { id: true },
		});
		if (!attorney)
			return { ok: false as const, reason: "not_verified" as const };

		if (input.caseId) {
			const ownCase = await tx.case.findFirst({
				where: {
					id: input.caseId,
					ownerId: input.plaintiffId,
					deletedAt: null,
				},
				select: { id: true },
			});
			if (!ownCase)
				return { ok: false as const, reason: "invalid_case" as const };
		}

		const existing = await tx.conversation.findUnique({
			where: {
				plaintiffId_attorneyId: {
					plaintiffId: input.plaintiffId,
					attorneyId: input.attorneyId,
				},
			},
			select: { id: true },
		});
		if (existing) {
			return {
				ok: false as const,
				reason: "already_exists" as const,
				conversationId: existing.id,
			};
		}

		const unanswered = await tx.conversation.count({
			where: {
				plaintiffId: input.plaintiffId,
				messages: { none: { author: { is: { role: "attorney" } } } },
			},
		});
		if (unanswered >= FIRST_CONTACT_LIMIT) {
			return { ok: false as const, reason: "contact_limit" as const };
		}

		const conversation = await tx.conversation.create({
			data: {
				plaintiffId: input.plaintiffId,
				attorneyId: input.attorneyId,
				caseId: input.caseId,
				messages: { create: { authorId: input.plaintiffId, body: input.body } },
			},
			include: { messages: { select: { id: true } } },
		});
		return {
			ok: true as const,
			conversationId: conversation.id,
			messageId: conversation.messages[0]?.id ?? "",
			recipientId: input.attorneyId,
		};
	});
}

export async function createReply(input: {
	conversationId: string;
	authorId: string;
	body: string;
}) {
	return prisma.$transaction(async (tx) => {
		const conversation = await tx.conversation.findUnique({
			where: { id: input.conversationId },
			select: { plaintiffId: true, attorneyId: true },
		});
		if (!conversation)
			return { ok: false as const, reason: "not_found" as const };
		if (!participantRole(conversation, input.authorId)) {
			return { ok: false as const, reason: "forbidden" as const };
		}
		const recipientId =
			conversation.plaintiffId === input.authorId
				? conversation.attorneyId
				: conversation.plaintiffId;
		const message = await tx.message.create({
			data: {
				conversationId: input.conversationId,
				authorId: input.authorId,
				body: input.body,
			},
			select: { id: true },
		});
		await tx.conversation.update({
			where: { id: input.conversationId },
			data: { updatedAt: new Date() },
		});
		return { ok: true as const, messageId: message.id, recipientId };
	});
}

export async function markConversationReadAndActive(
	conversationId: string,
	userId: string,
) {
	return prisma.$transaction(async (tx) => {
		const conversation = await tx.conversation.findUnique({
			where: { id: conversationId },
			select: { plaintiffId: true, attorneyId: true },
		});
		if (!conversation) return false;
		const role = participantRole(conversation, userId);
		if (!role) return false;
		const now = new Date();
		await Promise.all([
			tx.message.updateMany({
				where: {
					conversationId,
					authorId: { not: userId },
					readAt: null,
				},
				data: { readAt: now },
			}),
			tx.conversation.update({
				where: { id: conversationId },
				data:
					role === "plaintiff"
						? { plaintiffActiveAt: now }
						: { attorneyActiveAt: now },
			}),
		]);
		return true;
	});
}

export async function removeOwnMessage(messageId: string, userId: string) {
	const result = await prisma.message.updateMany({
		where: { id: messageId, authorId: userId, deletedAt: null },
		data: { deletedAt: new Date() },
	});
	return result.count === 1;
}

export async function messageEmailPreferences(
	userId: string,
	conversationId: string,
) {
	const [global, conversation] = await Promise.all([
		prisma.messageNotificationPreference.findUnique({
			where: { userId },
			select: { emailEnabled: true },
		}),
		prisma.conversationNotificationSetting.findUnique({
			where: { conversationId_userId: { conversationId, userId } },
			select: { emailEnabled: true },
		}),
	]);
	return {
		globalEmailEnabled: global?.emailEnabled ?? true,
		conversationEmailEnabled: conversation?.emailEnabled ?? true,
	};
}

export async function setGlobalMessageEmailPreference(
	userId: string,
	enabled: boolean,
) {
	return prisma.messageNotificationPreference.upsert({
		where: { userId },
		create: { userId, emailEnabled: enabled },
		update: { emailEnabled: enabled },
	});
}

export async function setConversationMessageEmailPreference(
	conversationId: string,
	userId: string,
	enabled: boolean,
) {
	return prisma.conversationNotificationSetting.upsert({
		where: { conversationId_userId: { conversationId, userId } },
		create: { conversationId, userId, emailEnabled: enabled },
		update: { emailEnabled: enabled },
	});
}

export async function reserveMessageEmailDelivery(input: {
	messageId: string;
	recipientId: string;
	status: "sent" | "skipped" | "failed";
	reason?: string;
}) {
	try {
		return await prisma.messageEmailDelivery.create({
			data: input,
			select: { id: true },
		});
	} catch {
		return null;
	}
}

export async function markMessageEmailSent(messageId: string) {
	return prisma.messageEmailDelivery.update({
		where: { messageId },
		data: { status: "sent", sentAt: new Date(), reason: null },
	});
}

export async function markMessageEmailFailed(messageId: string) {
	return prisma.messageEmailDelivery.update({
		where: { messageId },
		data: { status: "failed", reason: "provider_error" },
	});
}

export async function recipientForMessage(messageId: string) {
	return prisma.message.findUnique({
		where: { id: messageId },
		include: {
			author: { select: { id: true, name: true } },
			conversation: {
				select: {
					id: true,
					plaintiffId: true,
					attorneyId: true,
					plaintiffActiveAt: true,
					attorneyActiveAt: true,
					plaintiff: { select: { id: true, email: true, name: true } },
					attorney: { select: { id: true, email: true, name: true } },
				},
			},
		},
	});
}

export async function reportConversation(input: {
	conversationId: string;
	reporterId: string;
	category: string;
	reason: string;
}) {
	const conversation = await prisma.conversation.findUnique({
		where: { id: input.conversationId },
		select: { plaintiffId: true, attorneyId: true },
	});
	if (!conversation || !participantRole(conversation, input.reporterId))
		return null;
	return prisma.conversationReport.create({
		data: input,
		select: { id: true },
	});
}

export async function listConversationReports() {
	return prisma.conversationReport.findMany({
		orderBy: [{ status: "asc" }, { createdAt: "desc" }],
		include: {
			conversation: {
				select: {
					id: true,
					plaintiff: { select: { name: true } },
					attorney: { select: { name: true } },
				},
			},
			reporter: { select: { name: true } },
		},
	});
}

export async function resolveConversationReport(
	reportId: string,
	resolverId: string,
	resolution:
		| "dismissed"
		| "message_removed"
		| "user_blocked"
		| "warned" = "dismissed",
) {
	return prisma.conversationReport.update({
		where: { id: reportId },
		data: {
			status: "resolved",
			resolution,
			resolvedAt: new Date(),
			resolvedById: resolverId,
		},
	});
}

/** Soft-remove any message in a conversation — the moderator's takedown, distinct
 *  from `removeOwnMessage` which only lets an author remove their own. Returns
 *  whether a still-visible message was removed. */
export async function removeMessageByModerator(
	messageId: string,
): Promise<boolean> {
	const res = await prisma.message.updateMany({
		where: { id: messageId, deletedAt: null },
		data: { deletedAt: new Date() },
	});
	return res.count === 1;
}

/**
 * Everything an admin action on a report needs: who reported, who was reported
 * (the *other* participant), and the report's category — so the action can block
 * the right account and notify both sides. Null if the report doesn't exist.
 */
export async function getConversationReportContext(reportId: string) {
	const report = await prisma.conversationReport.findUnique({
		where: { id: reportId },
		select: {
			id: true,
			category: true,
			reason: true,
			status: true,
			reporterId: true,
			conversation: {
				select: {
					id: true,
					plaintiff: { select: { id: true, name: true, email: true } },
					attorney: { select: { id: true, name: true, email: true } },
				},
			},
		},
	});
	if (!report) return null;
	const { plaintiff, attorney } = report.conversation;
	const reporterIsPlaintiff = report.reporterId === plaintiff.id;
	const reporter = reporterIsPlaintiff ? plaintiff : attorney;
	// The reported party is whichever participant did not file the report.
	const reported = reporterIsPlaintiff ? attorney : plaintiff;
	return {
		reportId: report.id,
		category: report.category,
		reason: report.reason,
		status: report.status,
		conversationId: report.conversation.id,
		reporter: { id: reporter.id, name: reporter.name, email: reporter.email },
		reported: { id: reported.id, name: reported.name, email: reported.email },
	};
}
