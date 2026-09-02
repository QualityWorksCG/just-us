"use client";

import { Heart, Share2 } from "lucide-react";
import { toast } from "sonner";

/** Back / Share buttons on the public case page. Donations aren't wired up yet,
 *  so "Back this case" is a placeholder; Share copies the public link. */
export function PublicCaseActions({ sharePath }: { sharePath: string }) {
	function back() {
		toast("Donations are coming soon — check back shortly.");
	}
	function share() {
		const url =
			typeof window !== "undefined"
				? `${window.location.origin}${sharePath}`
				: "";
		navigator.clipboard?.writeText(url);
		toast.success("Link copied — thanks for sharing!");
	}
	return (
		<div className="flex flex-col gap-2.5">
			<button
				type="button"
				onClick={back}
				className="inline-flex h-12 items-center justify-center gap-2 rounded-[var(--radius-control)] bg-brass px-5 font-bold text-[15px] text-white transition-colors hover:bg-brass-deep"
			>
				<Heart className="size-[18px]" aria-hidden="true" />
				Back this case
			</button>
			<button
				type="button"
				onClick={share}
				className="inline-flex h-12 items-center justify-center gap-2 rounded-[var(--radius-control)] border border-border bg-surface px-5 font-semibold text-[14px] text-ink transition-colors hover:border-brass-deep"
			>
				<Share2 className="size-4" aria-hidden="true" />
				Share
			</button>
		</div>
	);
}
