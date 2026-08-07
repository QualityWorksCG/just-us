"use client";

import { cn } from "@just-us/ui/lib/utils";
import { Bell, Bookmark, HandCoins, Share2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { toggleSaveAction } from "@/app/(app)/donor-actions";
import { toggleFollowAction } from "@/app/(app)/follow-actions";

/** Back / Save / Follow / Share buttons on the public case page. Donations aren't
 *  wired up yet, so "Back this case" is a placeholder; Save bookmarks the case
 *  for a signed-in donor; Follow subscribes any signed-in user to its updates;
 *  Share copies the public link. */
export function PublicCaseActions({
	caseId,
	sharePath,
	canSave,
	initialSaved,
	canFollow,
	initialFollowing,
}: {
	caseId: string;
	sharePath: string;
	/** True only for a signed-in donor — the role that can save cases. */
	canSave: boolean;
	initialSaved: boolean;
	/** True for a signed-in user who isn't the case's own team. */
	canFollow: boolean;
	initialFollowing: boolean;
}) {
	const router = useRouter();
	const [saved, setSaved] = useState(initialSaved);
	const [, startSave] = useTransition();
	const [following, setFollowing] = useState(initialFollowing);
	const [, startFollow] = useTransition();

	function back() {
		toast("Donations are coming soon — check back shortly.");
	}

	function toggleFollow() {
		if (!canFollow) {
			toast("Sign in to follow this case.");
			router.push("/login?mode=create");
			return;
		}
		const next = !following;
		setFollowing(next);
		startFollow(async () => {
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

	function share() {
		const url =
			typeof window !== "undefined"
				? `${window.location.origin}${sharePath}`
				: "";
		navigator.clipboard?.writeText(url);
		toast.success("Link copied — thanks for sharing!");
	}

	function toggleSave() {
		if (!canSave) {
			toast("Sign in as a donor to save cases.");
			router.push("/login?mode=create");
			return;
		}
		const next = !saved;
		setSaved(next);
		startSave(async () => {
			const res = await toggleSaveAction(caseId, next);
			if (!res.ok) {
				setSaved(!next);
				toast.error("Couldn't update saved cases.");
			} else {
				toast.success(next ? "Saved for later." : "Removed from saved.");
			}
		});
	}

	return (
		<div className="flex flex-col gap-2.5">
			<button
				type="button"
				onClick={back}
				className="inline-flex h-12 items-center justify-center gap-2 rounded-[var(--radius-control)] bg-brass px-5 font-bold text-[15px] text-white transition-colors hover:bg-brass-deep"
			>
				<HandCoins className="size-[18px]" aria-hidden="true" />
				Back this case
			</button>
			<button
				type="button"
				onClick={toggleFollow}
				aria-pressed={following}
				className={cn(
					"inline-flex h-12 items-center justify-center gap-2 rounded-[var(--radius-control)] border px-4 font-semibold text-[14px] transition-colors",
					following
						? "border-green-deep bg-green-soft text-green-deep"
						: "border-border bg-surface text-ink hover:border-brass-deep",
				)}
			>
				<Bell
					className={cn("size-4", following && "fill-green-deep")}
					aria-hidden="true"
				/>
				{following ? "Following" : "Follow for updates"}
			</button>
			<div className="flex gap-2.5">
				<button
					type="button"
					onClick={toggleSave}
					aria-pressed={saved}
					className={cn(
						"inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-[var(--radius-control)] border px-4 font-semibold text-[14px] transition-colors",
						saved
							? "border-brass bg-brass-wash text-brass-deep"
							: "border-border bg-surface text-ink hover:border-brass-deep",
					)}
				>
					<Bookmark
						className={cn("size-4", saved && "fill-brass-deep")}
						aria-hidden="true"
					/>
					{saved ? "Saved" : "Save"}
				</button>
				<button
					type="button"
					onClick={share}
					className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-[var(--radius-control)] border border-border bg-surface px-4 font-semibold text-[14px] text-ink transition-colors hover:border-brass-deep"
				>
					<Share2 className="size-4" aria-hidden="true" />
					Share
				</button>
			</div>
		</div>
	);
}
