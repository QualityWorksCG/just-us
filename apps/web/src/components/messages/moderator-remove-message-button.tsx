"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { removeConversationMessageAction } from "@/app/(app)/moderation/actions";

/** Take a single message down from within a conversation review. */
export function ModeratorRemoveMessageButton({
	messageId,
	conversationId,
}: {
	messageId: string;
	conversationId: string;
}) {
	const router = useRouter();
	const [pending, startTransition] = useTransition();

	return (
		<button
			type="button"
			disabled={pending}
			onClick={() =>
				startTransition(async () => {
					const res = await removeConversationMessageAction({
						messageId,
						conversationId,
					});
					if (res.ok) {
						toast.success("Message removed.");
						router.refresh();
					} else {
						toast.error(res.error);
					}
				})
			}
			className="inline-flex shrink-0 items-center gap-1 text-[12px] text-muted-foreground transition-colors hover:text-danger disabled:opacity-50"
		>
			<Trash2 className="size-3.5" aria-hidden="true" />
			{pending ? "Removing…" : "Remove"}
		</button>
	);
}
