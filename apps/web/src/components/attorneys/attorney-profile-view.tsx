import type { DirectoryProfile } from "@just-us/db/attorney-directory";
import { cn } from "@just-us/ui/lib/utils";
import { FileText, Globe, Lock, Mail, Phone, ShieldCheck } from "lucide-react";
import type { Route } from "next";

import {
	AvailabilityBadge,
	HeadshotFrame,
	Rating,
	yearsLicensed,
} from "@/components/attorneys/attorney-card";
import { ContactAttorneyButton } from "@/components/attorneys/contact-attorney-button";
import { DetailBackLink } from "@/components/detail-back-link";
import { MessageAttorneyButton } from "@/components/messages/message-attorney-button";
import { FEE_APPROACHES } from "@/lib/attorney-profile";

/**
 * One attorney's public profile.
 *
 * Shared by the public `/attorneys/[id]` page and the in-app
 * `/find-attorney/[id]` screen, for the same reason `AttorneyDirectory` is: the
 * claims on this page — bar standing verified, ratings from former clients, past
 * results not a guarantee — have to read identically wherever it appears, and a
 * copy would drift.
 *
 * Two routes rather than one because the in-app screen has to stay inside the
 * dashboard shell. Sending a signed-in plaintiff to the public page dropped them
 * out of the app with no sidebar and no way back.
 *
 * The page chrome around this — `<main>`, gutters, any max-width — belongs to the
 * route, since the shell already supplies its own.
 */
/** Whole dollars — the profile stores cents, and a fee range has no use for
 *  pennies. */
function dollars(cents: number): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		maximumFractionDigits: 0,
	}).format(cents / 100);
}

/**
 * Fee approach plus its range, e.g. "Flat fee · $2,500–$9,000".
 *
 * Contingency never carries a range — it's a share of the recovery — so the
 * approach stands alone there even if stale numbers linger in the columns.
 */
function feeSummary(
	approach: string,
	range: { min: number | null; max: number | null },
): string {
	const label =
		FEE_APPROACHES.find((f) => f.value === approach)?.label ?? approach;
	if (approach === "contingency") return label;

	const { min, max } = range;
	if (min !== null && max !== null) {
		return `${label} · ${dollars(min)}–${dollars(max)}`;
	}
	if (min !== null) return `${label} · from ${dollars(min)}`;
	if (max !== null) return `${label} · up to ${dollars(max)}`;
	return label;
}

/** Hostname only: the full URL is noise beside an icon that already says "web". */
function prettyHost(url: string): string {
	try {
		return new URL(url).hostname.replace(/^www\./, "");
	} catch {
		return url;
	}
}

const OUTCOME_STYLES: Record<string, string> = {
	won: "bg-green-soft text-green-deep",
	settled: "bg-brass-wash text-brass-deep",
	ongoing: "bg-paper-alt text-ink-soft",
	other: "bg-paper-alt text-ink-soft",
};

function Card({
	children,
	className,
}: {
	children: React.ReactNode;
	className?: string;
}) {
	return (
		<section
			className={cn(
				"rounded-[var(--radius-card-lg)] border border-border bg-surface p-6 shadow-[var(--shadow-rest)]",
				className,
			)}
		>
			{children}
		</section>
	);
}

/** Small labelled tile used for education, bar number, and languages. */
function Tile({ label, value }: { label: string; value: string }) {
	return (
		<div className="rounded-[var(--radius-card-sm)] border border-border bg-paper-alt px-4 py-3">
			<p className="font-mono font-semibold text-[10.5px] text-muted-foreground uppercase tracking-[0.08em]">
				{label}
			</p>
			<p className="mt-1 font-semibold text-[13.5px] text-ink">{value}</p>
		</div>
	);
}

export function AttorneyProfileView({
	attorney,
	backHref,
	backLabel,
	headingLevel = "h1",
	messagingEnabled = false,
}: {
	attorney: DirectoryProfile;
	/** Where "back" goes — the directory this profile was opened from. */
	backHref: Route;
	backLabel: string;
	/** "h2" inside the app shell, whose header bar is already the page's h1. */
	headingLevel?: "h1" | "h2";
	messagingEnabled?: boolean;
}) {
	const Heading = headingLevel;

	const years = yearsLicensed(attorney.admittedYear);
	const state = attorney.user.jurisdiction ?? attorney.officeState;
	const firstName = attorney.legalName?.trim().split(" ")[0] ?? "them";

	// Every profile field worth stating as a fact, in the order a visitor asks
	// about them. Absent fields drop out rather than showing an empty tile.
	const tiles = [
		attorney.education && { label: "Education", value: attorney.education },
		attorney.user.barNumber && {
			label: "Bar number",
			value: attorney.user.barNumber,
		},
		attorney.admittedYear && {
			label: "Admitted",
			value: String(attorney.admittedYear),
		},
		(attorney.officeCity || attorney.officeState) && {
			label: "Office",
			value: [attorney.officeCity, attorney.officeState]
				.filter(Boolean)
				.join(", "),
		},
		attorney.languages.length > 0 && {
			label: "Languages",
			value: attorney.languages.join(", "),
		},
		attorney.feeApproach && {
			label: "Fees",
			value: feeSummary(attorney.feeApproach, {
				min: attorney.feeRangeMinCents,
				max: attorney.feeRangeMaxCents,
			}),
		},
		{
			label: "Consultations",
			value: attorney.virtualConsultation ? "Remote or in person" : "In person",
		},
	].filter((tile): tile is { label: string; value: string } => !!tile);

	const hasAbout = !!attorney.bio || !!attorney.background || tiles.length > 0;

	return (
		<div>
			<DetailBackLink href={backHref} label={backLabel} />

			<div className="mt-4 grid gap-6 lg:grid-cols-[1fr_320px]">
				{/* Main column */}
				<div className="flex min-w-0 flex-col gap-6">
					<Card>
						<div className="flex flex-col gap-5 sm:flex-row sm:items-start">
							<HeadshotFrame
								url={attorney.headshotUrl}
								name={attorney.legalName ?? ""}
								className="size-[96px]"
							/>
							<div className="min-w-0">
								<Heading className="font-extrabold text-[26px] text-ink tracking-[-0.02em]">
									{attorney.legalName}
								</Heading>
								<p className="mt-1 text-[14px] text-muted-foreground">
									{[attorney.firmName, state].filter(Boolean).join(" · ")}
								</p>
								<div className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
									<Rating
										rating={attorney.rating}
										reviewCount={attorney.reviewCount}
										reviewWord="client reviews"
									/>
									{years !== null && (
										<span className="text-[13px] text-muted-foreground">
											· {years} {years === 1 ? "year" : "years"} licensed
										</span>
									)}
									<AvailabilityBadge accepting={attorney.acceptingNewCases} />
								</div>
								{attorney.practiceAreas.length > 0 && (
									<div className="mt-3 flex flex-wrap gap-1.5">
										{attorney.practiceAreas.map((area) => (
											<span
												key={area}
												className="rounded-[var(--radius-chip)] border border-border bg-paper-alt px-2.5 py-1 font-semibold text-[12px] text-ink-soft"
											>
												{area}
											</span>
										))}
									</div>
								)}
							</div>
						</div>
					</Card>

					{hasAbout && (
						<Card>
							<h2 className="font-bold text-[17px] text-ink">About</h2>

							{attorney.bio && (
								<p className="mt-3 max-w-[72ch] text-[14px] text-ink-soft leading-relaxed">
									{attorney.bio}
								</p>
							)}

							{/* Education and prior roles, as the attorney wrote them. Kept
							    separate from the bio: one is a pitch, the other is history. */}
							{attorney.background && (
								<div className="mt-4">
									<p className="font-mono font-semibold text-[10.5px] text-muted-foreground uppercase tracking-[0.08em]">
										Background
									</p>
									<p className="mt-1 max-w-[72ch] text-[13.5px] text-ink-soft leading-relaxed">
										{attorney.background}
									</p>
								</div>
							)}

							{tiles.length > 0 && (
								<div className="mt-5 grid gap-3 sm:grid-cols-3">
									{tiles.map((tile) => (
										<Tile
											key={tile.label}
											label={tile.label}
											value={tile.value}
										/>
									))}
								</div>
							)}

							{/* Published because the attorney chose to publish it — these are
							    the public contact fields from their profile. The Contact
							    button still routes through a case, since that's what they need
							    to give an answer. */}
							{(attorney.contactEmail ||
								attorney.contactPhone ||
								attorney.websiteUrl) && (
								<div className="mt-5 border-border border-t pt-4">
									<p className="font-mono font-semibold text-[10.5px] text-muted-foreground uppercase tracking-[0.08em]">
										Contact details
									</p>
									<div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2">
										{attorney.contactEmail && (
											<a
												href={`mailto:${attorney.contactEmail}`}
												className="inline-flex items-center gap-1.5 text-[13.5px] text-ink-soft transition-colors hover:text-brass-deep"
											>
												<Mail
													className="size-3.5 shrink-0"
													aria-hidden="true"
												/>
												{attorney.contactEmail}
											</a>
										)}
										{attorney.contactPhone && (
											<a
												href={`tel:${attorney.contactPhone.replace(/[^0-9+]/g, "")}`}
												className="inline-flex items-center gap-1.5 text-[13.5px] text-ink-soft transition-colors hover:text-brass-deep"
											>
												<Phone
													className="size-3.5 shrink-0"
													aria-hidden="true"
												/>
												{attorney.contactPhone}
											</a>
										)}
										{attorney.websiteUrl && (
											<a
												href={attorney.websiteUrl}
												target="_blank"
												rel="noopener noreferrer"
												className="inline-flex items-center gap-1.5 text-[13.5px] text-ink-soft transition-colors hover:text-brass-deep"
											>
												<Globe
													className="size-3.5 shrink-0"
													aria-hidden="true"
												/>
												{prettyHost(attorney.websiteUrl)}
											</a>
										)}
									</div>
								</div>
							)}
						</Card>
					)}

					{attorney.caseRecords.length > 0 && (
						<Card>
							<div className="flex flex-wrap items-baseline justify-between gap-2">
								<h2 className="font-bold text-[17px] text-ink">Case record</h2>
								<p className="text-[13px] text-muted-foreground">
									<span className="font-bold text-ink">
										{attorney.wonCount}
									</span>{" "}
									won ·{" "}
									<span className="font-bold text-ink">
										{attorney.settledCount}
									</span>{" "}
									settled
								</p>
							</div>

							<ul className="mt-4 flex flex-col">
								{attorney.caseRecords.map((record) => (
									<li
										key={record.id}
										className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-border border-t py-3.5 first:border-t-0 first:pt-0"
									>
										<span className="w-[42px] shrink-0 font-mono text-[12.5px] text-muted-foreground tabular-nums">
											{record.year}
										</span>
										<span className="min-w-0 flex-1">
											<span className="block font-bold text-[14px] text-ink">
												{record.title}
											</span>
											{record.amount && (
												<span className="block text-[13px] text-muted-foreground">
													{record.amount}
												</span>
											)}
										</span>
										<span
											className={cn(
												"shrink-0 rounded-[var(--radius-pill)] px-2.5 py-1 font-semibold text-[12px] capitalize",
												OUTCOME_STYLES[record.outcome] ?? OUTCOME_STYLES.other,
											)}
										>
											{record.outcome}
										</span>
									</li>
								))}
							</ul>

							{/* The disclaimer is not optional garnish: these figures are
								    attorney-supplied and only bar standing is checked. */}
							<p className="mt-4 rounded-[var(--radius-card-sm)] bg-paper-alt px-4 py-3 text-[12.5px] text-muted-foreground leading-relaxed">
								Past results don't guarantee an outcome in your case.
								Self-reported by the attorney; JustUs verifies bar standing, not
								case histories.
							</p>
						</Card>
					)}

					{attorney.reviews.length > 0 && (
						<Card>
							<h2 className="font-bold text-[17px] text-ink">Client reviews</h2>
							<ul className="mt-4 flex flex-col gap-3">
								{attorney.reviews.slice(0, 3).map((review) => (
									<li
										key={review.id}
										className="rounded-[var(--radius-card-sm)] border border-border bg-paper-alt px-4 py-3.5"
									>
										<p className="text-[13.5px] text-ink-soft italic leading-relaxed">
											“{review.quote}”
										</p>
										<p className="mt-1.5 text-[12.5px] text-muted-foreground">
											— {review.byline}
										</p>
									</li>
								))}
							</ul>
							<p className="mt-3 text-[12.5px] text-muted-foreground leading-relaxed">
								{attorney.reviews.length > 3
									? `Showing 3 of ${attorney.reviewCount} client reviews`
									: `${attorney.reviewCount} client ${attorney.reviewCount === 1 ? "review" : "reviews"}`}{" "}
								— ratings come from former clients, never from JustUs.
							</p>
						</Card>
					)}
				</div>

				{/* Sidebar */}
				<aside className="flex flex-col gap-6">
					<Card>
						<p className="font-mono font-semibold text-[11px] text-muted-foreground uppercase tracking-[0.1em]">
							Work with {attorney.legalName}
						</p>
						<p className="mt-3 text-[13.5px] text-ink-soft leading-relaxed">
							You make the first move — send your case and {firstName} decides
							whether to take it. If they accept, you agree a fee together and
							it becomes your funding goal.
						</p>
						{messagingEnabled ? (
							<MessageAttorneyButton
								attorneyId={attorney.user.id}
								attorneyName={attorney.legalName ?? ""}
								className="mt-4 w-full justify-center"
							/>
						) : (
							<ContactAttorneyButton
								attorneyName={attorney.legalName ?? ""}
								size="lg"
								className="mt-4 w-full justify-center"
							/>
						)}
					</Card>

					<Card>
						<p className="font-mono font-semibold text-[11px] text-muted-foreground uppercase tracking-[0.1em]">
							Verified by JustUs
						</p>
						<ul className="mt-3 flex flex-col gap-3">
							<li className="flex items-start gap-2.5 text-[13px] text-ink-soft leading-relaxed">
								<ShieldCheck
									className="mt-0.5 size-4 shrink-0 text-brass-deep"
									aria-hidden="true"
								/>
								<span>
									{state ? `${state} Bar` : "Bar standing"} ·{" "}
									<span className="font-semibold text-ink">verified</span>
								</span>
							</li>
							<li className="flex items-start gap-2.5 text-[13px] text-ink-soft leading-relaxed">
								<FileText
									className="mt-0.5 size-4 shrink-0 text-brass-deep"
									aria-hidden="true"
								/>
								<span>
									Chosen by plaintiffs on JustUs — case counts appear here once
									matters close.
								</span>
							</li>
							<li className="flex items-start gap-2.5 text-[13px] text-ink-soft leading-relaxed">
								<Lock
									className="mt-0.5 size-4 shrink-0 text-brass-deep"
									aria-hidden="true"
								/>
								<span>
									Funds settle to the recipient each case names — never to
									JustUs.
								</span>
							</li>
						</ul>
					</Card>
				</aside>
			</div>
		</div>
	);
}
