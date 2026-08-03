import { listMessageConversations } from "@just-us/db/messages";
import Link from "next/link";

import { requireRole } from "@/lib/auth-server";

export default async function MessagesPage() {
	const { session } = await requireRole("plaintiff", "attorney");
	const conversations = await listMessageConversations(session.user.id);
	return (
		<div className="mx-auto max-w-[1180px]">
			<p className="max-w-[640px] text-[14.5px] text-ink-soft leading-relaxed">
				Private one-to-one conversations with the attorneys or plaintiffs you
				message.
			</p>
			<section className="mt-8 rounded-[var(--radius-card-lg)] border border-border bg-surface p-5 shadow-[var(--shadow-rest)]">
				<h2 className="font-bold text-[18px] text-ink">Conversations</h2>
				{conversations.length ? (
					<div className="mt-4 divide-y divide-border">
						{conversations.map((conversation) => (
							<Link
								key={conversation.conversationId}
								href={`/messages/${conversation.conversationId}`}
								className="flex items-center gap-4 py-4 hover:bg-paper-alt"
							>
								<span className="flex size-11 items-center justify-center rounded-full bg-brass-wash font-bold text-brass-deep">
									{conversation.otherUser.name.slice(0, 1)}
								</span>
								<span className="min-w-0 flex-1">
									<span className="flex items-center justify-between gap-3">
										<strong className="text-[14px] text-ink">
											{conversation.otherUser.name}
										</strong>
										<span className="text-[12px] text-muted-foreground">
											{conversation.updatedAt.toLocaleDateString()}
										</span>
									</span>
									<span className="mt-1 block truncate text-[13px] text-muted-foreground">
										{conversation.latestMessage
											? conversation.latestMessage.deletedAt
												? "Message removed"
												: conversation.latestMessage.body
											: "No messages yet"}
									</span>
								</span>
								{conversation.unreadCount > 0 && (
									<span className="rounded-full bg-brass px-2 py-0.5 font-bold text-[12px] text-brass-ink">
										{conversation.unreadCount}
									</span>
								)}
							</Link>
						))}
					</div>
				) : (
					<div className="mt-5 rounded-[var(--radius-card)] border border-border border-dashed bg-paper-alt px-6 py-12 text-center">
						<p className="font-bold text-ink">No conversations yet</p>
						<p className="mt-2 text-[13px] text-muted-foreground">
							Find a verified attorney to send your first message.
						</p>
					</div>
				)}
			</section>
		</div>
	);
}
