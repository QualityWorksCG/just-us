"use client";

import { BadgeCheck, ShieldOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { setFederalVerificationAction } from "@/app/(app)/users/actions";

/**
 * Administrator control to verify — or clear — an attorney's federal-court
 * standing. Unlike state admissions this is one overall standing, not per state,
 * so it rules on the whole federal claim at once. Used to settle a federal check
 * that landed in review.
 */
export function FederalVerifyControl({
	userId,
	verified,
}: {
	userId: string;
	/** Whether federal standing is currently verified. */
	verified: boolean;
}) {
	const router = useRouter();
	const [pending, start] = useTransition();

	function set(nextVerified: boolean) {
		start(async () => {
			const res = await setFederalVerificationAction({
				userId,
				verified: nextVerified,
			});
			if (res.ok) {
				toast.success(
					nextVerified
						? "Federal standing verified."
						: "Federal standing cleared.",
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
				className="inline-flex shrink-0 items-center gap-1.5 font-semibold text-[13px] text-danger transition-colors hover:text-danger/80 disabled:opacity-60"
			>
				<ShieldOff className="size-4" aria-hidden="true" />
				{pending ? "Clearing…" : "Clear"}
			</button>
		);
	}

	return (
		<button
			type="button"
			onClick={() => set(true)}
			disabled={pending}
			className="inline-flex shrink-0 items-center gap-1.5 rounded-[var(--radius-control)] bg-brass px-3.5 py-1.5 font-bold text-[12.5px] text-white transition-colors hover:bg-brass-deep disabled:opacity-60"
		>
			<BadgeCheck className="size-4" aria-hidden="true" />
			{pending ? "Verifying…" : "Verify"}
		</button>
	);
}
