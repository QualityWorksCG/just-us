"use client";

import type { CaseInterest } from "@just-us/db/requests";
import { buttonVariants } from "@just-us/ui/components/button";
import { cn } from "@just-us/ui/lib/utils";
import { ArrowRight, MapPin, ShieldCheck, X } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import {
	acceptInterestAction,
	declineInterestAction,
} from "@/app/cases/actions";
import {
	AvailabilityBadge,
	HeadshotFrame,
	Rating,
	yearsLicensed,
} from "@/components/attorneys/attorney-card";

/**
 * One attorney's expression of interest in the plaintiff's case (JUS-25).
 *
 * There is no message to read, because an attorney cannot send the plaintiff
 * anything — what they can do is put themselves forward, and this card is how the
 * plaintiff weighs that. So it shows the same things the directory does: bar
 * standing, rating from former clients, practice areas, how long they have been
 * licensed. Everything is read live from the attorney's profile, so a badge here
 * is current rather than whatever was true when they expressed interest.
 *
 * Taking one forward is the plaintiff initiating contact — the only way this path
 * can resolve.
 */
export function AttorneyInterestCard({ interest }: { interest: CaseInterest }) {
	const router = useRouter();
	const [accepting, startAccept] = useTransition();
	const [declining, startDecline] = useTransition();
	const busy = accepting || declining;

	const years = yearsLicensed(interest.admittedYear);
	const verified = interest.verificationStatus === "verified";
	const firstName = interest.attorneyName.trim().split(" ")[0];

	function accept() {
		startAccept(async () => {
			const res = await acceptInterestAction(interest.id);
			if (res.ok) {
				toast.success(`${interest.attorneyName} it is — now agree the fee.`);
				router.push(`/cases/new?draft=${res.caseId}` as Route);
			} else {
				toast.error(res.error);
			}
		});
	}

	function decline() {
		startDecline(async () => {
			const res = await declineInterestAction(interest.id, interest.caseId);
			if (res.ok) {
				toast.success("Passed on — they won't be able to ask again.");
				router.refresh();
			} else {
				toast.error(res.error);
			}
		});
	}

	return (
		<div
			className={cn(
				"rounded-[var(--radius-card-lg)] border bg-surface p-5 shadow-[var(--shadow-rest)]",
				interest.isNew ? "border-brass" : "border-border",
			)}
		>
			<div className="flex items-start gap-3.5">
				<HeadshotFrame
					url={interest.headshotUrl}
					name={interest.attorneyName}
					className="size-11 rounded-full"
				/>

				<div className="min-w-0 flex-1">
					<div className="flex flex-wrap items-center gap-x-2 gap-y-1">
						<p className="font-bold text-[15px] text-ink">
							{interest.attorneyName}
						</p>
						{interest.firm && (
							<span className="text-[13px] text-muted-foreground">
								{interest.firm}
							</span>
						)}
						{verified && (
							<span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] bg-brass-wash px-2 py-0.5 font-semibold text-[11.5px] text-brass-deep">
								<ShieldCheck className="size-3.5" aria-hidden="true" />
								Bar verified
							</span>
						)}
						{interest.isNew && (
							<span className="rounded-[var(--radius-pill)] bg-green-soft px-2 py-0.5 font-mono font-semibold text-[10px] text-green-deep uppercase tracking-[0.06em]">
								New
							</span>
						)}
						<span className="ml-auto shrink-0 text-[12px] text-muted-foreground">
							{ago(interest.createdAt)}
						</span>
					</div>

					<div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
						<Rating
							rating={interest.rating}
							reviewCount={interest.reviewCount}
						/>
						{years !== null && (
							<span className="text-[12.5px] text-muted-foreground">
								· {years} {years === 1 ? "year" : "years"} licensed
							</span>
						)}
						{interest.location && (
							<span className="inline-flex items-center gap-1 text-[12.5px] text-muted-foreground">
								<MapPin className="size-3.5" aria-hidden="true" />
								{interest.location}
							</span>
						)}
						<AvailabilityBadge accepting={interest.acceptingNewCases} />
					</div>

					{interest.practiceAreas.length > 0 && (
						<div className="mt-2 flex flex-wrap gap-1.5">
							{interest.practiceAreas.map((area) => (
								<span
									key={area}
									className="rounded-[var(--radius-chip)] border border-border bg-paper-alt px-2 py-0.5 font-semibold text-[11.5px] text-ink-soft"
								>
									{area}
								</span>
							))}
						</div>
					)}
				</div>
			</div>

			{!verified && (
				<p className="mt-3 rounded-[var(--radius-card)] border border-border bg-paper-alt px-3.5 py-2.5 text-[12.5px] text-ink-soft leading-relaxed">
					This attorney's bar standing isn't verified right now, so they can't
					take your case on yet. Nothing to do — you'll be able to choose them
					if it clears.
				</p>
			)}

			<div className="mt-4 flex flex-wrap items-center gap-3">
				<button
					type="button"
					onClick={accept}
					disabled={busy || !verified}
					className={cn(buttonVariants({ size: "lg" }), "h-10 px-4")}
				>
					{accepting ? "Setting up…" : `Choose ${firstName}`}
					<ArrowRight data-icon="inline-end" aria-hidden="true" />
				</button>
				{interest.profileId ? (
					<Link
						// Carry the case through so the profile's back link returns to this
						// case's requests, not the attorney directory the profile normally
						// belongs to.
						href={
							`/find-attorney/${interest.profileId}?fromCase=${interest.caseId}` as Route
						}
						className={cn(
							buttonVariants({ variant: "outline", size: "lg" }),
							"h-10 px-4",
						)}
					>
						View full profile
					</Link>
				) : null}
				<button
					type="button"
					onClick={decline}
					disabled={busy}
					className="ml-auto inline-flex items-center gap-1.5 font-semibold text-[13px] text-muted-foreground transition-colors hover:text-danger disabled:opacity-70"
				>
					<X className="size-4" aria-hidden="true" />
					{declining ? "Passing…" : "Pass"}
				</button>
			</div>
		</div>
	);
}

/** Relative time, computed on the client so it can't be baked into a cached
 *  server render and go stale. */
function ago(date: Date) {
	const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
	if (seconds < 60) return "just now";
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h ago`;
	return `${Math.floor(hours / 24)}d ago`;
}
