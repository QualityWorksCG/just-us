"use client";

import { cn } from "@just-us/ui/lib/utils";
import { BadgeCheck, ShieldOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { setAttorneyVerificationAction } from "@/app/(app)/users/actions";

/**
 * Administrator control to mark an attorney's bar standing verified — or clear
 * it. Verification is what lets an attorney represent cases and express interest,
 * so until the request-a-verification flow exists, this is the manual switch
 * (JUS-13).
 */
export function VerifyAttorneyControl({
	userId,
	verified,
}: {
	userId: string;
	/** Whether the attorney currently holds the verified badge. */
	verified: boolean;
}) {
	const router = useRouter();
	const [pending, startTransition] = useTransition();

	function set(nextVerified: boolean) {
		startTransition(async () => {
			const res = await setAttorneyVerificationAction({
				userId,
				verified: nextVerified,
			});
			if (res.ok) {
				toast.success(
					nextVerified
						? "Attorney marked as verified."
						: "Verification cleared.",
				);
				router.refresh();
			} else {
				toast.error(res.error);
			}
		});
	}

	if (verified) {
		return (
			<button
				type="button"
				onClick={() => set(false)}
				disabled={pending}
				className="inline-flex items-center gap-1.5 font-semibold text-[13px] text-danger transition-colors hover:text-danger/80 disabled:opacity-60"
			>
				<ShieldOff className="size-4" aria-hidden="true" />
				{pending ? "Clearing…" : "Clear verification"}
			</button>
		);
	}

	return (
		<button
			type="button"
			onClick={() => set(true)}
			disabled={pending}
			className={cn(
				"inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-control)] bg-brass px-4 py-2 font-bold text-[13px] text-white transition-colors hover:bg-brass-deep disabled:opacity-60",
			)}
		>
			<BadgeCheck className="size-4" aria-hidden="true" />
			{pending ? "Verifying…" : "Mark as verified"}
		</button>
	);
}
