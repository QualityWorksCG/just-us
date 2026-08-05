import { listConversationReports } from "@just-us/db/messages";
import Link from "next/link";

import { requirePermission } from "@/lib/auth-server";

export default async function ModerationPage() {
	await requirePermission("moderation:review");
	const reports = await listConversationReports();
	return (
		<div className="max-w-[1100px]">
			<p className="text-[14.5px] text-ink-soft leading-relaxed">
				Review reported conversations. Administrators can read for moderation
				but cannot post as a participant.
			</p>
			<section className="mt-8 rounded-[var(--radius-card-lg)] border border-border bg-surface p-5 shadow-[var(--shadow-rest)]">
				<h2 className="font-bold text-[18px] text-ink">
					Reported conversations
				</h2>
				{reports.length ? (
					<div className="mt-4 divide-y divide-border">
						{reports.map((report) => (
							<Link
								key={report.id}
								href={`/moderation/conversations/${report.conversation.id}`}
								className="flex items-center justify-between gap-4 py-4 hover:bg-paper-alt"
							>
								<span>
									<strong className="block text-[14px] text-ink">
										{report.conversation.plaintiff.name} and{" "}
										{report.conversation.attorney.name}
									</strong>
									<span className="mt-1 block text-[13px] text-muted-foreground">
										{report.reason}
									</span>
								</span>
								<span className="rounded-full bg-brass-wash px-2.5 py-1 font-semibold text-[12px] text-brass-deep">
									{report.status}
								</span>
							</Link>
						))}
					</div>
				) : (
					<p className="mt-5 rounded-[var(--radius-card)] bg-paper-alt px-4 py-8 text-center text-[13px] text-muted-foreground">
						No reported conversations.
					</p>
				)}
			</section>
		</div>
	);
}
