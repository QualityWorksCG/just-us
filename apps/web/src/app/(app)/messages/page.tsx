import { listMessageConversations } from "@just-us/db/messages";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@just-us/ui/components/card";
import Link from "next/link";

import { requireRole } from "@/lib/auth-server";

export default async function MessagesPage() {
	const { session, role } = await requireRole("plaintiff", "attorney");
	const conversations = await listMessageConversations(session.user.id);
	const isAttorney = role === "attorney";
	return (
		<div className="flex min-h-0 flex-1 flex-col bg-paper">
			<p className="shrink-0 px-6 pt-5 pb-4 text-[14.5px] text-ink-soft leading-relaxed sm:px-10 lg:px-12">
				{isAttorney
					? "Private one-to-one conversations with the plaintiffs who've reached out to you."
					: "Private one-to-one conversations with the attorneys you've contacted."}
			</p>
			<div className="min-h-0 flex-1 overflow-y-auto px-6 pb-8 sm:px-10 lg:px-12">
				<Card className="rounded-[var(--radius-card-lg)] border border-border bg-surface py-0 shadow-[var(--shadow-rest)] ring-0">
					<CardHeader className="border-border border-b px-5 pt-5 pb-4">
						<CardTitle className="font-bold text-[18px] text-ink">
							Conversations
						</CardTitle>
					</CardHeader>
					<CardContent className="px-5 pb-5">
						{conversations.length ? (
							<div className="divide-y divide-border">
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
							<div className="mt-1 rounded-[var(--radius-card)] border border-border border-dashed bg-paper-alt px-6 py-12 text-center">
								<p className="font-bold text-ink">No conversations yet</p>
								<p className="mt-2 text-[13px] text-muted-foreground">
									{isAttorney
										? "When a plaintiff reaches out about an intake, your conversation with them shows up here."
										: "Find a verified attorney to send your first message."}
								</p>
							</div>
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
