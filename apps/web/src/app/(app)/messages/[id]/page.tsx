import {
	getConversationForParticipant,
	messageEmailPreferences,
} from "@just-us/db/messages";
import { notFound } from "next/navigation";

import { DetailBackLink } from "@/components/detail-back-link";
import { ConversationThread } from "@/components/messages/conversation-thread";
import { requireRole } from "@/lib/auth-server";

export default async function ConversationPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { session } = await requireRole("plaintiff", "attorney");
	const { id } = await params;
	const conversation = await getConversationForParticipant(id, session.user.id);
	if (!conversation) notFound();
	const other =
		conversation.plaintiffId === session.user.id
			? conversation.attorney
			: conversation.plaintiff;
	const preferences = await messageEmailPreferences(session.user.id, id);
	return (
		<div className="mx-auto max-w-[1180px]">
			<DetailBackLink href="/messages" label="Back to messages" />
			<div className="mt-4">
				<ConversationThread
					conversationId={id}
					currentUserId={session.user.id}
					otherName={other.name}
					emailEnabled={preferences.conversationEmailEnabled}
					messages={conversation.messages.map((message) => ({
						id: message.id,
						body: message.body,
						createdAt: message.createdAt.toISOString(),
						deletedAt: message.deletedAt?.toISOString() ?? null,
						authorId: message.authorId,
						authorName: message.author.name,
					}))}
				/>
			</div>
		</div>
	);
}
