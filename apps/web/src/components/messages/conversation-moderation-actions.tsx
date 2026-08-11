"use client";

import { Button } from "@just-us/ui/components/button";
import { cn } from "@just-us/ui/lib/utils";
import { Ban, Check, ShieldX } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
	blockReportedUserAction,
	resolveReportAction,
} from "@/app/(app)/moderation/actions";

/**
 * A moderator's ruling on a reported conversation.
 *
 * Three outcomes, each of which closes the report and tells the reporter what
 * happened: dismiss (no violation), close after removing a message, or restrict
 * the reported account. The block is two-step — one click arms it, the next
 * confirms — because it signs someone out and is not something to fire by
 * accident. `otherName` is the account that would be restricted, shown so the
 * moderator can see who that is before confirming.
 */
export function ConversationModerationActions({
	reportId,
	conversationId,
	otherName,
}: {
	reportId: string;
	conversationId: string;
	otherName: string;
}) {
	const router = useRouter();
	const [pending, startTransition] = useTransition();
	const [armedBlock, setArmedBlock] = useState(false);

	function run(
		action: () => Promise<{ ok: boolean; error?: string }>,
		success: string,
	) {
		startTransition(async () => {
			const res = await action();
			if (res.ok) {
				toast.success(success);
				router.refresh();
			} else {
				toast.error(res.error ?? "Something went wrong.");
			}
		});
	}

	return (
		<div className="flex flex-wrap items-center gap-2.5">
			<Button
				type="button"
				variant="outline"
				disabled={pending}
				onClick={() =>
					run(
						() => resolveReportAction({ reportId, resolution: "dismissed" }),
						"Report dismissed — no action taken.",
					)
				}
			>
				<Check data-icon="inline-start" aria-hidden="true" />
				Dismiss — no action
			</Button>

			<Button
				type="button"
				variant="outline"
				disabled={pending}
				onClick={() =>
					run(
						() =>
							resolveReportAction({ reportId, resolution: "message_removed" }),
						"Report closed — reporter notified a message was removed.",
					)
				}
			>
				<ShieldX data-icon="inline-start" aria-hidden="true" />
				Close as message removed
			</Button>

			<Button
				type="button"
				disabled={pending}
				onClick={() => {
					if (!armedBlock) {
						setArmedBlock(true);
						return;
					}
					run(
						() => blockReportedUserAction({ reportId }),
						`${otherName}'s account has been restricted.`,
					);
				}}
				className={cn("bg-danger text-white hover:bg-danger/90")}
			>
				<Ban data-icon="inline-start" aria-hidden="true" />
				{armedBlock ? `Confirm — restrict ${otherName}` : "Restrict account"}
			</Button>
			{armedBlock && (
				<button
					type="button"
					onClick={() => setArmedBlock(false)}
					disabled={pending}
					className="text-[13px] text-muted-foreground underline-offset-2 hover:underline"
				>
					Cancel
				</button>
			)}
		</div>
	);
}
