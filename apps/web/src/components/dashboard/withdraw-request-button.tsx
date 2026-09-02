"use client";

import { Button } from "@just-us/ui/components/button";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { withdrawInviteAction } from "@/app/cases/actions";

/**
 * Take back a pending request to a named attorney, from the case's requests page.
 *
 * The plaintiff shouldn't have to wait out the invitation's week if their chosen
 * attorney is slow or they've changed their mind. Withdrawing returns the case to
 * a private draft and drops them into the directory to pick someone else — the
 * same `withdrawInviteAction` the wizard and directory use. Asks once, because it
 * invalidates the emailed link.
 */
export function WithdrawRequestButton({
	caseId,
	attorneyFirstName,
}: {
	caseId: string;
	attorneyFirstName: string;
}) {
	const router = useRouter();
	const [confirming, setConfirming] = useState(false);
	const [pending, start] = useTransition();

	function withdraw() {
		start(async () => {
			const res = await withdrawInviteAction(caseId);
			if (res.ok) {
				toast.success("Request withdrawn", {
					description: `${attorneyFirstName}'s link no longer works. Your case is a private draft — pick another attorney whenever you're ready.`,
				});
				router.push(`/find-attorney?draft=${caseId}`);
			} else {
				toast.error(res.error);
			}
		});
	}

	if (!confirming) {
		return (
			<Button
				variant="outline"
				size="lg"
				onClick={() => setConfirming(true)}
				className="px-5"
			>
				Withdraw &amp; choose someone else
			</Button>
		);
	}

	return (
		<div className="flex flex-wrap items-center gap-2.5">
			<Button
				variant="outline"
				size="lg"
				onClick={() => setConfirming(false)}
				disabled={pending}
				className="px-5"
			>
				Keep waiting
			</Button>
			<Button
				size="lg"
				className="bg-danger px-5 text-white hover:bg-danger/90"
				onClick={withdraw}
				disabled={pending}
			>
				{pending ? "Withdrawing…" : "Yes, withdraw request"}
			</Button>
		</div>
	);
}
