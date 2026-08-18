"use client";

import { Button } from "@just-us/ui/components/button";
import { useState } from "react";
import { toast } from "sonner";

import {
	confirmCaseInviteAction,
	declineCaseInviteAction,
} from "@/app/case-invite/actions";
import type { CaseInviteRef } from "@/lib/case-invite-ref";

/**
 * The answer, and the way out of it.
 *
 * Both buttons settle the invitation for good and both redirect on success, so
 * anything that comes back from either action is a failure worth showing.
 * Declining asks twice: the invitation cannot be un-declined, and a stray click
 * on an email link would otherwise cost the plaintiff their chosen attorney.
 */

export function CaseInviteDecision({ invite }: { invite: CaseInviteRef }) {
	const [pending, setPending] = useState<"confirm" | "decline" | null>(null);

	async function confirm() {
		setPending("confirm");
		const result = await confirmCaseInviteAction(invite);
		if (!result.ok) {
			toast.error(result.error);
			setPending(null);
		}
	}

	return (
		<div className="flex flex-col gap-3">
			<Button
				type="button"
				size="lg"
				className="w-full"
				disabled={pending !== null}
				onClick={confirm}
			>
				{pending === "confirm"
					? "Confirming…"
					: "Confirm I represent this case"}
			</Button>
			<DeclineInviteButton
				invite={invite}
				label="Decline this case"
				disabled={pending === "confirm"}
				onBusyChange={(busy) => setPending(busy ? "decline" : null)}
			/>
			<p className="text-[12px] text-muted-foreground leading-relaxed">
				Confirming makes you the attorney of record on JustUs for this case and
				takes it off the queue. You'll be asked to open the payout account this
				case's donations are paid into before it can go live.
			</p>
		</div>
	);
}

/**
 * Declining on its own, for the screens where confirming is still blocked.
 *
 * Offered there deliberately: an attorney who isn't taking the case shouldn't
 * have to finish onboarding and bar verification just to say so, and leaving the
 * invitation pending keeps the plaintiff's case out of the queue for a week.
 */
export function DeclineInviteButton({
	invite,
	label = "Decline this case",
	disabled = false,
	onBusyChange,
}: {
	invite: CaseInviteRef;
	label?: string;
	disabled?: boolean;
	onBusyChange?: (busy: boolean) => void;
}) {
	const [asking, setAsking] = useState(false);
	const [pending, setPending] = useState(false);

	async function decline() {
		setPending(true);
		onBusyChange?.(true);
		const result = await declineCaseInviteAction(invite);
		if (!result.ok) {
			toast.error(result.error);
			setPending(false);
			onBusyChange?.(false);
			setAsking(false);
		}
	}

	if (!asking) {
		return (
			<Button
				type="button"
				variant="outline"
				size="lg"
				className="w-full"
				disabled={disabled}
				onClick={() => setAsking(true)}
			>
				{label}
			</Button>
		);
	}

	return (
		<div className="flex flex-col gap-2 rounded-[var(--radius-control)] border border-line-strong bg-paper p-3">
			<p className="text-[13px] text-ink-soft leading-relaxed">
				Decline for good? The case goes straight back in front of other
				attorneys, and this invitation stops working.
			</p>
			<div className="flex gap-2">
				<Button
					type="button"
					variant="destructive"
					className="flex-1"
					disabled={pending}
					onClick={decline}
				>
					{pending ? "Declining…" : "Yes, decline"}
				</Button>
				<Button
					type="button"
					variant="ghost"
					className="flex-1"
					disabled={pending}
					onClick={() => setAsking(false)}
				>
					Keep it for now
				</Button>
			</div>
		</div>
	);
}
