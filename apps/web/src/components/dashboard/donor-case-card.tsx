// biome-ignore-all lint/performance/noImgElement: case covers are user-uploaded Blob URLs, not static assets
"use client";

import { cn } from "@just-us/ui/lib/utils";
import {
	Bookmark,
	HandCoins,
	Heart,
	Home,
	type LucideIcon,
	Megaphone,
	Plus,
	Scale,
	Share2,
	Wrench,
} from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { toggleSaveAction } from "@/app/(app)/donor-actions";
import type { DonorCase } from "@/components/dashboard/donor-case";

function money(n: number) {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		maximumFractionDigits: 0,
	}).format(n);
}

function initials(name: string) {
	return (
		name
			.trim()
			.split(/\s+/)
			.slice(0, 2)
			.map((p) => p[0]?.toUpperCase() ?? "")
			.join("") || "—"
	);
}

// Category → header tint + watermark icon for the fallback cover.
const CAT_STYLES: Record<string, { bg: string; fg: string; icon: LucideIcon }> =
	{
		Employment: { bg: "bg-brass-wash", fg: "text-brass-deep", icon: Scale },
		"Wage & hours": { bg: "bg-brass-wash", fg: "text-brass-deep", icon: Scale },
		Housing: { bg: "bg-green-soft", fg: "text-green-deep", icon: Home },
		"Elder care": {
			bg: "bg-gold-bright",
			fg: "text-gold-bright-ink",
			icon: Heart,
		},
		"Consumer fraud": {
			bg: "bg-brass-wash",
			fg: "text-brass-deep",
			icon: Wrench,
		},
		Medical: { bg: "bg-green-soft", fg: "text-green-deep", icon: Plus },
		"Civil rights": {
			bg: "bg-gold-bright",
			fg: "text-gold-bright-ink",
			icon: Scale,
		},
	};
const DEFAULT_CAT = { bg: "bg-brass-wash", fg: "text-brass-deep", icon: Scale };

// Case status → the frosted badge shown on the card cover.
const STATUS_BADGE: Record<string, { label: string; dot: string }> = {
	live: { label: "Live · Raising", dot: "bg-success" },
	seeking: { label: "Seeking attorney", dot: "bg-brass-deep" },
	closed: { label: "Resolved", dot: "bg-green-deep" },
	draft: { label: "Draft", dot: "bg-ink-soft" },
};

export function DonorCaseCard({
	c,
	initialSaved,
	variant = "full",
	hasNewUpdate = false,
}: {
	c: DonorCase;
	initialSaved: boolean;
	variant?: "full" | "compact";
	/** Show a "New update" tag — a followed case has updates the donor hasn't
	 *  seen. */
	hasNewUpdate?: boolean;
}) {
	const [saved, setSaved] = useState(initialSaved);
	const [, startSave] = useTransition();
	const pathname = usePathname();
	const pct =
		c.goal > 0 ? Math.min(100, Math.round((c.raised / c.goal) * 100)) : 0;
	const style = CAT_STYLES[c.category] ?? DEFAULT_CAT;
	const Icon = style.icon;
	// The in-app case screen, not the public `/cases/[id]` page: a signed-in donor
	// sent to the public page lost the sidebar and the marketing header at once,
	// leaving the case with no way back. `from` tells that screen which list to
	// return to, since these cards appear on three of them.
	const from = pathname?.startsWith("/saved")
		? "saved"
		: pathname?.startsWith("/home")
			? "home"
			: "discover";
	const href = `/discover/${c.id}?from=${from}` as Route;
	const compact = variant === "compact";
	const status = STATUS_BADGE[c.status] ?? STATUS_BADGE.live;

	function toggleSave() {
		const next = !saved;
		setSaved(next);
		startSave(async () => {
			const res = await toggleSaveAction(c.id, next);
			if (!res.ok) {
				setSaved(!next);
				toast.error("Couldn't update saved cases.");
			} else {
				toast.success(next ? "Saved for later." : "Removed from saved.");
			}
		});
	}

	function back() {
		toast("Donations are coming soon — check back shortly.");
	}

	function share() {
		const url =
			typeof window !== "undefined"
				? `${window.location.origin}/cases/${c.id}`
				: "";
		navigator.clipboard?.writeText(url);
		toast.success("Link copied — thanks for sharing!");
	}

	return (
		<div className="relative flex flex-col overflow-hidden rounded-[var(--radius-card-lg)] border border-border bg-surface shadow-[var(--shadow-rest)]">
			{/* Header — cover photo or category-tinted watermark */}
			<Link href={href} className="block">
				<div
					className={cn(
						"relative overflow-hidden",
						compact ? "h-24" : "aspect-[16/8]",
						style.bg,
					)}
				>
					{c.cover ? (
						<img src={c.cover} alt="" className="size-full object-cover" />
					) : (
						<span
							className={cn("absolute right-4 bottom-2 opacity-25", style.fg)}
						>
							<Icon className="size-20" aria-hidden="true" />
						</span>
					)}
				</div>
			</Link>
			{/* Status badge + optional "new update" tag */}
			<div className="absolute top-3 left-3 z-10 flex flex-wrap items-center gap-1.5">
				<span className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-surface/90 px-2.5 py-1 font-mono font-semibold text-[10px] text-ink uppercase tracking-[0.06em] backdrop-blur-sm">
					<span className={cn("size-1.5 rounded-full", status.dot)} />
					{status.label}
				</span>
				{hasNewUpdate && (
					<span className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-gold-bright px-2.5 py-1 font-mono font-semibold text-[10px] text-gold-bright-ink uppercase tracking-[0.06em] shadow-[var(--shadow-rest)]">
						<Megaphone className="size-3" aria-hidden="true" />
						New update
					</span>
				)}
			</div>
			<button
				type="button"
				onClick={toggleSave}
				aria-pressed={saved}
				aria-label={saved ? "Remove from saved" : "Save for later"}
				className="absolute top-3 right-3 z-10 flex size-9 items-center justify-center rounded-full border border-border bg-surface text-ink-soft shadow-[var(--shadow-rest)] transition-colors hover:text-brass-deep"
			>
				<Bookmark
					className={cn("size-4", saved && "fill-brass-deep text-brass-deep")}
					aria-hidden="true"
				/>
			</button>

			<div className={cn("flex flex-1 flex-col", compact ? "p-4" : "p-5")}>
				{variant === "full" && (
					<div className="mb-2 flex flex-wrap gap-1.5">
						<span className="rounded-[var(--radius-chip)] bg-brass-wash px-2 py-0.5 font-semibold text-[11.5px] text-brass-deep">
							{c.category || "Case"}
						</span>
						<span className="rounded-[var(--radius-chip)] border border-border px-2 py-0.5 text-[11.5px] text-ink-soft">
							{c.location || "—"}
						</span>
					</div>
				)}
				<Link href={href}>
					<h3 className="font-bold text-[15.5px] text-ink leading-snug hover:underline">
						{c.title || "Untitled case"}
					</h3>
				</Link>
				{variant === "full" && (
					<div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2.5">
						{/* Plaintiff — the person raising the case */}
						<div className="flex items-center gap-2">
							<span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-green-soft font-bold text-[10px] text-green-deep">
								{initials(c.owner)}
							</span>
							<div className="min-w-0 leading-tight">
								<p className="truncate font-bold text-[12.5px] text-ink">
									{c.owner}
								</p>
								<p className="font-mono text-[9.5px] text-muted-foreground uppercase tracking-[0.07em]">
									Plaintiff
								</p>
							</div>
						</div>
						{/* Attorney — their lawyer */}
						{c.attorney ? (
							<div className="flex items-center gap-2">
								<span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brass-wash font-bold text-[10px] text-brass-deep">
									{initials(c.attorney)}
								</span>
								<div className="min-w-0 leading-tight">
									<p className="truncate font-bold text-[12.5px] text-ink">
										{c.attorney}
									</p>
									<p className="font-mono text-[9.5px] text-muted-foreground uppercase tracking-[0.07em]">
										Attorney
									</p>
								</div>
							</div>
						) : (
							<div className="flex items-center gap-2">
								<span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-line-strong border-dashed text-muted-foreground">
									<Scale className="size-3.5" aria-hidden="true" />
								</span>
								<div className="leading-tight">
									<p className="font-semibold text-[12.5px] text-muted-foreground">
										Not yet chosen
									</p>
									<p className="font-mono text-[9.5px] text-muted-foreground uppercase tracking-[0.07em]">
										Attorney
									</p>
								</div>
							</div>
						)}
					</div>
				)}

				<div className={compact ? "mt-2.5" : "mt-3"}>
					<div className="h-2 overflow-hidden rounded-full bg-surface-2">
						<div
							className="h-full rounded-full bg-brass"
							style={{ width: `${Math.max(2, pct)}%` }}
						/>
					</div>
					{variant === "full" && (
						<div className="mt-2 flex items-center justify-between text-[12.5px]">
							<span className="font-bold text-ink tabular-nums">
								{money(c.raised)} of {money(c.goal)}
							</span>
							<span className="text-muted-foreground">
								{c.donors} {c.donors === 1 ? "donor" : "donors"}
							</span>
						</div>
					)}
				</div>

				<div
					className={cn("flex items-center gap-2", compact ? "mt-3" : "mt-4")}
				>
					<button
						type="button"
						onClick={back}
						className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-[var(--radius-control)] bg-brass px-4 font-semibold text-[13.5px] text-white transition-colors hover:bg-brass-deep"
					>
						<HandCoins className="size-4" aria-hidden="true" />
						Back this case
					</button>
					{variant === "full" && (
						<button
							type="button"
							onClick={share}
							aria-label="Share"
							className="flex size-10 items-center justify-center rounded-[var(--radius-control)] border border-border bg-surface text-ink-soft transition-colors hover:border-brass-deep hover:text-brass-deep"
						>
							<Share2 className="size-4" aria-hidden="true" />
						</button>
					)}
				</div>
			</div>
		</div>
	);
}
