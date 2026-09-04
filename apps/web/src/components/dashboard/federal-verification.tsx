"use client";

import { Button } from "@just-us/ui/components/button";
import { cn } from "@just-us/ui/lib/utils";
import {
	BadgeCheck,
	Clock,
	Landmark,
	ShieldX,
	TriangleAlert,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { verifyAttorneyAction } from "@/app/(app)/profile/verification-actions";

type Status =
	| "unverified"
	| "pending"
	| "verified"
	| "needs_review"
	| "rejected";

const BADGE: Record<
	Status,
	{ label: string; cls: string; icon: typeof Clock }
> = {
	verified: {
		label: "Federal standing verified",
		cls: "bg-green-soft text-green-deep",
		icon: BadgeCheck,
	},
	pending: {
		label: "Federal check in progress",
		cls: "bg-brass-wash text-brass-deep",
		icon: Clock,
	},
	needs_review: {
		label: "Federal check needs review",
		cls: "bg-gold-bright/20 text-gold-bright-ink",
		icon: TriangleAlert,
	},
	rejected: {
		label: "Federal standing not confirmed",
		cls: "bg-destructive/10 text-destructive",
		icon: ShieldX,
	},
	unverified: {
		label: "Federal standing not checked yet",
		cls: "bg-surface-2 text-ink-soft",
		icon: Landmark,
	},
};

/**
 * The federal-court analogue of the per-state bar check, shown under the "I
 * practise in federal court" toggle. Runs the same AI verification against
 * federal admission records and records the result on the profile's federal
 * status — only a verified result lets the attorney take federal cases.
 */
export function FederalVerification({ status }: { status: Status }) {
	const router = useRouter();
	const [pending, start] = useTransition();
	const badge = BADGE[status];

	function verify() {
		start(async () => {
			const res = await verifyAttorneyAction({ federal: true });
			if (res.ok) {
				toast.success(
					res.status === "verified"
						? "Your federal standing is verified."
						: res.status === "rejected"
							? "We couldn't confirm your federal standing."
							: "Federal check saved — it needs a closer look.",
				);
				router.refresh();
			} else {
				toast.error(res.error);
			}
		});
	}

	return (
		<div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-card)] border border-border bg-surface px-4 py-3">
			<span
				className={cn(
					"inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] px-2.5 py-1 font-semibold text-[12.5px]",
					badge.cls,
				)}
			>
				<badge.icon className="size-3.5" aria-hidden="true" />
				{badge.label}
			</span>
			<Button
				type="button"
				variant="outline"
				size="sm"
				onClick={verify}
				disabled={pending}
			>
				{pending
					? "Checking…"
					: status === "verified"
						? "Re-check"
						: "Verify federal standing"}
			</Button>
		</div>
	);
}
