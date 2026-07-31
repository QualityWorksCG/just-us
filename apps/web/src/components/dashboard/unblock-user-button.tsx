"use client";

import { ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { unblockUserAction } from "@/app/dashboard/users/actions";

export function UnblockUserButton({ userId }: { userId: string }) {
	const router = useRouter();
	const [pending, startTransition] = useTransition();

	function unblock() {
		startTransition(async () => {
			const res = await unblockUserAction(userId);
			if (res.ok) {
				toast.success("Account unblocked.");
				router.refresh();
			} else {
				toast.error(res.error);
			}
		});
	}

	return (
		<button
			type="button"
			onClick={unblock}
			disabled={pending}
			className="inline-flex items-center gap-1.5 font-semibold text-[13px] text-brass-deep transition-colors hover:text-brass disabled:opacity-60"
		>
			<ShieldCheck className="size-4" aria-hidden="true" />
			{pending ? "Unblocking…" : "Unblock"}
		</button>
	);
}
