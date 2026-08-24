"use client";

import { CheckCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { markAllUpdatesReadAction } from "@/app/(app)/update-actions";

/**
 * Clears every case's "new" marker in one press, from the Case updates page.
 * Disabled once there's nothing unread, so it never reads as a no-op.
 */
export function MarkAllUpdatesRead({ hasUnread }: { hasUnread: boolean }) {
	const router = useRouter();
	const [pending, start] = useTransition();

	function markAll() {
		start(async () => {
			await markAllUpdatesReadAction();
			toast.success("All caught up.");
			router.refresh();
		});
	}

	return (
		<button
			type="button"
			onClick={markAll}
			disabled={pending || !hasUnread}
			className="inline-flex shrink-0 items-center gap-1.5 font-semibold text-[13px] text-brass-deep transition-colors hover:text-brass disabled:cursor-not-allowed disabled:text-muted-foreground disabled:hover:text-muted-foreground"
		>
			<CheckCheck className="size-4" aria-hidden="true" />
			{pending ? "Marking…" : "Mark all as read"}
		</button>
	);
}
