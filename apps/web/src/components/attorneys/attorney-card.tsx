// biome-ignore-all lint/performance/noImgElement: user-uploaded Blob images aren't static assets next/image can optimize
import type { DirectoryAttorney } from "@just-us/db/attorney-directory";
import { buttonVariants } from "@just-us/ui/components/button";
import { cn } from "@just-us/ui/lib/utils";
import { Eye } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { ContactAttorneyButton } from "@/components/attorneys/contact-attorney-button";
import { MessageAttorneyButton } from "@/components/messages/message-attorney-button";
import { FEE_APPROACHES } from "@/lib/attorney-profile";

/** Years licensed, derived so it can't go stale. Null when we don't know. */
export function yearsLicensed(admittedYear: number | null): number | null {
	if (!admittedYear) return null;
	const years = new Date().getFullYear() - admittedYear;
	return years >= 0 ? years : null;
}

/** Availability badge. Only two states — the profile stores a boolean, and
 *  "Waitlist" is the honest reading of "not taking new cases right now". */
export function AvailabilityBadge({ accepting }: { accepting: boolean }) {
	return (
		<span
			className={cn(
				"inline-flex items-center rounded-[var(--radius-pill)] px-2.5 py-1 font-semibold text-[12px]",
				accepting
					? "bg-green-soft text-green-deep"
					: "bg-brass-wash text-brass-deep",
			)}
		>
			{accepting ? "Accepting cases" : "Waitlist"}
		</span>
	);
}

export function Rating({
	rating,
	reviewCount,
	reviewWord = "reviews",
}: {
	rating: number | null;
	reviewCount: number;
	reviewWord?: string;
}) {
	if (rating === null) {
		return (
			<span className="text-[13px] text-muted-foreground">No reviews yet</span>
		);
	}
	return (
		<>
			<span className="font-bold text-[14px] text-brass-deep tabular-nums">
				{rating.toFixed(1)} / 5
			</span>
			<span className="text-[13px] text-muted-foreground">
				{reviewCount}{" "}
				{reviewCount === 1 ? reviewWord.replace(/s$/, "") : reviewWord}
			</span>
		</>
	);
}

/** Square placeholder standing in for a headshot the attorney hasn't added. */
export function HeadshotFrame({
	url,
	name,
	className,
}: {
	url: string | null;
	name: string;
	className?: string;
}) {
	if (url) {
		return (
			<img
				src={url}
				alt={name}
				className={cn(
					"size-[60px] shrink-0 rounded-[var(--radius-card-sm)] object-cover",
					className,
				)}
			/>
		);
	}
	// Empty slot, not an error: a soft fill and an initial, no dashed outline.
	// The outline read as a broken image, and it framed every card in the list.
	return (
		<span
			className={cn(
				"flex size-[60px] shrink-0 items-center justify-center rounded-[var(--radius-card-sm)] bg-brass-wash font-bold text-[20px] text-brass-deep",
				className,
			)}
			aria-hidden="true"
		>
			{name.trim().charAt(0).toUpperCase() || "?"}
		</span>
	);
}

export function AttorneyCard({
	attorney,
	profileBasePath = "/attorneys",
	showMessageAction = false,
}: {
	attorney: DirectoryAttorney;
	/**
	 * Where this card's "View profile" link points, without the id.
	 *
	 * The public directory sends visitors to `/attorneys/<id>`; the in-app
	 * directory has to send a signed-in plaintiff to `/find-attorney/<id>`, which
	 * is the same profile inside the dashboard shell. Linking them to the public
	 * page dropped them out of the app with no sidebar and no way back.
	 */
	profileBasePath?: string;
	showMessageAction?: boolean;
}) {
	const years = yearsLicensed(attorney.admittedYear);

	// Where they practise, which is a list now. The office city pairs with the
	// primary state as the address line; the rest are named after it, because
	// "New York" about an attorney also licensed in New Jersey and Connecticut sends
	// a plaintiff in either of those looking elsewhere.
	const otherStates = attorney.states.filter(
		(state) => state !== attorney.state,
	);

	const details = [
		[attorney.officeCity, attorney.state].filter(Boolean).join(", "),
		otherStates.length > 0
			? `Also licensed in ${otherStates.join(", ")}`
			: null,
		attorney.languages.length > 0 ? attorney.languages.join(", ") : null,
		attorney.feeApproach
			? (FEE_APPROACHES.find((f) => f.value === attorney.feeApproach)?.label ??
				null)
			: null,
		attorney.virtualConsultation ? "Meets remotely" : null,
	].filter((detail): detail is string => !!detail);

	return (
		<article className="group rounded-[var(--radius-card-lg)] border border-border bg-surface p-4 shadow-[var(--shadow-rest)] transition-colors hover:border-brass-deep hover:shadow-[var(--shadow-hover)]">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
				<HeadshotFrame url={attorney.headshotUrl} name={attorney.legalName} />

				<div className="min-w-0 flex-1">
					<div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
						<h3 className="font-bold text-[15px] text-ink">
							{attorney.legalName}
						</h3>
						{attorney.firmName && (
							<span className="text-[13px] text-muted-foreground">
								{attorney.firmName}
							</span>
						)}
					</div>

					<div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
						<Rating
							rating={attorney.rating}
							reviewCount={attorney.reviewCount}
						/>
						{years !== null && (
							<span className="text-[12.5px] text-muted-foreground">
								· {years} {years === 1 ? "year" : "years"} licensed
							</span>
						)}
						<AvailabilityBadge accepting={attorney.acceptingNewCases} />
					</div>

					{attorney.practiceAreas.length > 0 && (
						<div className="mt-2 flex flex-wrap gap-1.5">
							{attorney.practiceAreas.map((area) => (
								<span
									key={area}
									className="rounded-[var(--radius-chip)] border border-border bg-paper-alt px-2 py-0.5 font-semibold text-[11.5px] text-ink-soft"
								>
									{area}
								</span>
							))}
						</div>
					)}

					{/* Bio and quote are clamped to one line each: the card is for
					    scanning a shortlist, and the full text is a click away. Without
					    the clamp a long bio makes one row twice the height of its
					    neighbours and the list stops being comparable. */}
					{attorney.bio && (
						<p className="mt-2 line-clamp-1 text-[13px] text-ink-soft">
							{attorney.bio}
						</p>
					)}

					{attorney.topReview && (
						<p className="mt-1 line-clamp-1 text-[12.5px]">
							<span className="text-ink-soft italic">
								“{attorney.topReview.quote}”
							</span>{" "}
							<span className="text-muted-foreground">
								— {attorney.topReview.byline}
							</span>
						</p>
					)}

					{/* Extra detail on hover, and on keyboard focus so it isn't
					    mouse-only. Animated via grid rows rather than max-height, so it
					    expands to whatever the content needs without a magic number.
					    Nothing here is exclusive to the hover — it's all on the profile
					    too, which is what makes it safe to hide on touch. */}
					{details.length > 0 && (
						<div className="grid grid-rows-[0fr] transition-[grid-template-rows] duration-200 ease-out group-focus-within:grid-rows-[1fr] group-hover:grid-rows-[1fr]">
							<div className="overflow-hidden">
								<p className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-2 text-[12px] text-muted-foreground">
									{details.map((detail, index) => (
										<span key={detail} className="flex items-center gap-2">
											{index > 0 && (
												<span aria-hidden="true" className="text-line-strong">
													·
												</span>
											)}
											{detail}
										</span>
									))}
								</p>
							</div>
						</div>
					)}
				</div>

				<div className="flex shrink-0 flex-col gap-2 sm:w-56">
					<Link
						href={`${profileBasePath}/${attorney.id}` as Route}
						className={cn(
							buttonVariants({ variant: "outline", size: "lg" }),
							"w-full justify-center",
						)}
					>
						<Eye aria-hidden="true" />
						View profile
					</Link>
					{/* Contact routes through case submission: an attorney needs the case
					    to decide, so there is nothing to send them without one. The button
					    explains that before moving them, rather than dropping them into the
					    wizard unannounced. */}
					{showMessageAction ? (
						<MessageAttorneyButton
							attorneyId={attorney.userId}
							attorneyName={attorney.legalName}
							className="w-full justify-center"
						/>
					) : (
						<ContactAttorneyButton
							attorneyName={attorney.legalName}
							size="lg"
							className="w-full justify-center"
						/>
					)}
				</div>
			</div>
		</article>
	);
}
