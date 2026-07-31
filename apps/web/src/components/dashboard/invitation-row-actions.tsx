"use client";

import { Button } from "@just-us/ui/components/button";
import { RotateCw, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import {
	resendInviteAction,
	revokeInviteAction,
} from "@/app/(app)/users/invite-actions";

export function InvitationRowActions({ id }: { id: string }) {
	const router = useRouter();
	const [resending, startResend] = useTransition();
	const [revoking, startRevoke] = useTransition();
	const pending = resending || revoking;

	function resend() {
		startResend(async () => {
			const res = await resendInviteAction(id);
			if (res.ok) {
				toast.success("Invitation resent.");
				router.refresh();
			} else {
				toast.error(res.error);
			}
		});
	}

	function revoke() {
		startRevoke(async () => {
			const res = await revokeInviteAction(id);
			if (res.ok) {
				toast.success("Invitation revoked.");
				router.refresh();
			} else {
				toast.error(res.error);
			}
		});
	}

	return (
		<div className="flex items-center gap-2">
			<Button variant="outline" size="sm" disabled={pending} onClick={resend}>
				<RotateCw data-icon="inline-start" aria-hidden="true" />
				{resending ? "Resending…" : "Resend"}
			</Button>
			<Button
				variant="destructive"
				size="sm"
				disabled={pending}
				onClick={revoke}
			>
				<X data-icon="inline-start" aria-hidden="true" />
				{revoking ? "Revoking…" : "Revoke"}
			</Button>
		</div>
	);
}
