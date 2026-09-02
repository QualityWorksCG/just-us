import { getConversationForModeration } from "@just-us/db/messages";
import { notFound } from "next/navigation";

import { DetailBackLink } from "@/components/detail-back-link";
import { ConversationModerationActions } from "@/components/messages/conversation-moderation-actions";
import { ModeratorRemoveMessageButton } from "@/components/messages/moderator-remove-message-button";
import { requirePermission } from "@/lib/auth-server";

const CATEGORY_LABELS: Record<string, string> = {
	spam: "Spam",
	fraud: "Fraud or scam",
	harassment: "Harassment or abuse",
	inappropriate: "Inappropriate content",
	other: "Something else",
};

export default async function ModerationConversationPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	await requirePermission("moderation:review");
	const { id } = await params;
	const conversation = await getConversationForModeration(id);
	if (!conversation) notFound();

	const openReport = conversation.reports.find(
		(report) => report.status === "open",
	);

	// The account that would be restricted is whichever participant didn't report.
	const reportedName = openReport
		? openReport.reporterId === conversation.plaintiff.id
			? conversation.attorney.name
			: conversation.plaintiff.name
		: null;

	return (
		<div className="mx-auto max-w-[980px]">
			<DetailBackLink href="/moderation" label="Back to moderation" />
			<div className="mt-4 rounded-[var(--radius-card-lg)] border border-border bg-surface p-6 shadow-[var(--shadow-rest)]">
				<header className="border-border border-b pb-5">
					<h2 className="font-bold text-[20px] text-ink">
						Conversation review
					</h2>
					<p className="mt-2 text-[13.5px] text-ink-soft">
						Administrators can review this conversation but cannot reply as
						either participant. Remove individual messages below, or rule on the
						report.
					</p>
				</header>

				{openReport ? (
					<div className="mt-5 rounded-[var(--radius-card)] border border-brass/30 bg-brass-wash px-4 py-4">
						<div className="flex flex-wrap items-center gap-2">
							<p className="font-semibold text-ink">Reported conversation</p>
							<span className="rounded-full bg-danger/10 px-2 py-0.5 font-semibold text-[11px] text-danger">
								{CATEGORY_LABELS[openReport.category] ?? openReport.category}
							</span>
							<span className="text-[12.5px] text-ink-soft">
								by {openReport.reporter.name}
							</span>
						</div>
						{openReport.reason ? (
							<p className="mt-2 text-[14px] text-ink-soft">
								“{openReport.reason}”
							</p>
						) : null}
						<div className="mt-4">
							<ConversationModerationActions
								reportId={openReport.id}
								conversationId={conversation.id}
								otherName={reportedName ?? "this account"}
							/>
						</div>
					</div>
				) : (
					<div className="mt-5 rounded-[var(--radius-card)] border border-border bg-paper-alt px-4 py-3 text-[13.5px] text-muted-foreground">
						No open report on this conversation. You can still remove messages
						below.
					</div>
				)}

				<div className="mt-6 flex flex-col gap-5">
					{conversation.messages.map((message) => (
						<article key={message.id}>
							<div className="flex items-center justify-between gap-3">
								<p className="font-semibold text-[13px] text-ink">
									{message.author.name}{" "}
									<span className="font-normal text-muted-foreground">
										· {message.createdAt.toLocaleString()}
									</span>
								</p>
								{!message.deletedAt && (
									<ModeratorRemoveMessageButton
										messageId={message.id}
										conversationId={conversation.id}
									/>
								)}
							</div>
							<div className="mt-2 rounded-[var(--radius-card)] bg-paper-alt px-4 py-3 text-[14px] text-ink-soft">
								{message.deletedAt ? (
									<span className="text-muted-foreground italic">
										Message removed
									</span>
								) : (
									message.body
								)}
							</div>
						</article>
					))}
				</div>
			</div>
		</div>
	);
}
