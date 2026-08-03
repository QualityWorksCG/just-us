import { getConversationForModeration } from "@just-us/db/messages";
import { notFound } from "next/navigation";

import { DetailBackLink } from "@/components/detail-back-link";
import { ResolveConversationReportButton } from "@/components/messages/resolve-conversation-report-button";
import { requirePermission } from "@/lib/auth-server";

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

	return (
		<div className="mx-auto max-w-[980px]">
			<DetailBackLink href="/moderation" label="Back to moderation" />
			<div className="mt-4 rounded-[var(--radius-card-lg)] border border-border bg-surface p-6 shadow-[var(--shadow-rest)]">
				<header className="flex flex-wrap items-start justify-between gap-4 border-border border-b pb-5">
					<div>
						<h2 className="font-bold text-[20px] text-ink">
							Conversation review
						</h2>
						<p className="mt-2 text-[13.5px] text-ink-soft">
							Administrators can review this conversation but cannot reply as
							either participant.
						</p>
					</div>
					{openReport ? (
						<ResolveConversationReportButton reportId={openReport.id} />
					) : null}
				</header>

				{openReport ? (
					<div className="mt-5 rounded-[var(--radius-card)] border border-brass/30 bg-brass-wash px-4 py-3 text-[14px] text-ink-soft">
						<p className="font-semibold text-ink">Reported conversation</p>
						<p className="mt-1">{openReport.reason}</p>
					</div>
				) : null}

				<div className="mt-6 flex flex-col gap-5">
					{conversation.messages.map((message) => (
						<article key={message.id}>
							<p className="font-semibold text-[13px] text-ink">
								{message.author.name}{" "}
								<span className="font-normal text-muted-foreground">
									· {message.createdAt.toLocaleString()}
								</span>
							</p>
							<div className="mt-2 rounded-[var(--radius-card)] bg-paper-alt px-4 py-3 text-[14px] text-ink-soft">
								{message.deletedAt ? "Message removed" : message.body}
							</div>
						</article>
					))}
				</div>
			</div>
		</div>
	);
}
