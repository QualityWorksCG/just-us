"use client";

import { cn } from "@just-us/ui/lib/utils";
import { Bell, HandCoins, Share2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { toggleFollowAction } from "@/app/(app)/follow-actions";
import { donateHref } from "@/lib/donate-link";

/** The Follow/Following pill in the donor updates banner. */
export function FollowToggle({
	caseId,
	canFollow,
	initialFollowing,
}: {
	caseId: string;
	canFollow: boolean;
	initialFollowing: boolean;
}) {
	const router = useRouter();
	const [following, setFollowing] = useState(initialFollowing);
	const [, start] = useTransition();

	function toggle() {
		if (!canFollow) {
			toast("Sign in to follow this case.");
			router.push("/login?mode=create");
			return;
		}
		const next = !following;
		setFollowing(next);
		start(async () => {
			const res = await toggleFollowAction({ caseId, follow: next });
			if (!res.ok) {
				setFollowing(!next);
				toast.error(res.error);
			} else {
				toast.success(
					next ? "Following — you'll see every update." : "Unfollowed.",
				);
			}
		});
	}

	return (
		<button
			type="button"
			onClick={toggle}
			aria-pressed={following}
			className={cn(
				"inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[var(--radius-pill)] border px-3.5 font-semibold text-[13px] transition-colors",
				following
					? "border-green-deep bg-surface text-green-deep"
					: "border-border bg-surface text-ink hover:border-brass-deep",
			)}
		>
			<Bell
				className={cn("size-4", following && "fill-green-deep")}
				aria-hidden="true"
			/>
			{following ? "Following" : "Follow"}
		</button>
	);
}

/**
 * "Give again" / "Back this case" — links at the case page's donate panel, which
 * owns the amount picker and the fee breakdown (see `donateHref`). `caseHref` is
 * the case screen matching this route: the in-app one for a signed-in donor, the
 * public one otherwise.
 */
export function BackCaseButton({
	label,
	caseHref,
}: {
	label: string;
	caseHref: string;
}) {
	return (
		<Link
			href={donateHref(caseHref)}
			className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[var(--radius-control)] bg-brass px-4 font-bold text-[14px] text-white transition-colors hover:bg-brass-deep"
		>
			<HandCoins className="size-4" aria-hidden="true" />
			{label}
		</Link>
	);
}

/** Copy the case's public link. */
export function ShareCaseButton({ sharePath }: { sharePath: string }) {
	function share() {
		const url =
			typeof window !== "undefined"
				? `${window.location.origin}${sharePath}`
				: "";
		navigator.clipboard?.writeText(url);
		toast.success("Link copied — thanks for sharing!");
	}
	return (
		<button
			type="button"
			onClick={share}
			className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[var(--radius-control)] border border-border bg-surface px-4 font-semibold text-[14px] text-ink transition-colors hover:border-brass-deep"
		>
			<Share2 className="size-4" aria-hidden="true" />
			Share this case
		</button>
	);
}
