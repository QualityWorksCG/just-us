import type { CaseAuditEntry } from "@just-us/db/audit";
import { cn } from "@just-us/ui/lib/utils";
import { History, RotateCcw, Send, Trash2 } from "lucide-react";

const dateFmt = new Intl.DateTimeFormat("en-US", {
	month: "short",
	day: "numeric",
	year: "numeric",
	hour: "numeric",
	minute: "2-digit",
});

/** How each recorded admin action reads in the timeline. */
const ACTION_META: Record<
	string,
	{ label: string; icon: typeof Trash2; tone: string; noteLabel: string }
> = {
	"case.removed": {
		label: "Removed from site",
		icon: Trash2,
		tone: "bg-danger/10 text-danger",
		noteLabel: "Reason",
	},
	"case.restored": {
		label: "Restored to site",
		icon: RotateCcw,
		tone: "bg-green-soft text-green-deep",
		noteLabel: "Reason",
	},
	"case.messaged": {
		label: "Message sent to plaintiff",
		icon: Send,
		tone: "bg-brass-wash text-brass-deep",
		noteLabel: "Message",
	},
};

/**
 * The administrative decision trail for a case — take-downs, restores, and
 * messages, newest first. Read-only, so it stays a server component.
 */
export function AdminDecisionHistory({
	entries,
}: {
	entries: CaseAuditEntry[];
}) {
	return (
		<div className="rounded-[var(--radius-card-lg)] border border-border bg-surface p-5 shadow-[var(--shadow-rest)]">
			<div className="flex items-center gap-2">
				<span className="flex size-8 items-center justify-center rounded-full bg-surface-2 text-ink-soft">
					<History className="size-4" aria-hidden="true" />
				</span>
				<h2 className="font-bold text-[15px] text-ink">Decision history</h2>
			</div>

			{entries.length === 0 ? (
				<p className="mt-3 text-[13px] text-muted-foreground leading-relaxed">
					No admin actions on this case yet. Take-downs, restores, and messages
					you send will be logged here.
				</p>
			) : (
				<ul className="mt-4 flex flex-col gap-4">
					{entries.map((e) => {
						const meta = ACTION_META[e.action] ?? {
							label: e.action,
							icon: History,
							tone: "bg-surface-2 text-ink-soft",
							noteLabel: "Note",
						};
						const Icon = meta.icon;
						return (
							<li key={e.id} className="flex gap-3">
								<span
									className={cn(
										"flex size-7 shrink-0 items-center justify-center rounded-full",
										meta.tone,
									)}
								>
									<Icon className="size-3.5" aria-hidden="true" />
								</span>
								<div className="min-w-0 flex-1">
									<p className="font-semibold text-[13px] text-ink">
										{meta.label}
									</p>
									<p className="text-[11.5px] text-muted-foreground">
										{e.actorName ?? "An administrator"} ·{" "}
										{dateFmt.format(e.createdAt)}
									</p>
									{e.reason ? (
										<div className="mt-1.5 rounded-[var(--radius-card)] bg-paper-alt px-3 py-2">
											<p className="text-[10px] text-muted-foreground uppercase tracking-[0.07em]">
												{meta.noteLabel}
											</p>
											<p className="mt-0.5 whitespace-pre-wrap text-[12.5px] text-ink leading-relaxed">
												{e.reason}
											</p>
										</div>
									) : null}
								</div>
							</li>
						);
					})}
				</ul>
			)}
		</div>
	);
}
