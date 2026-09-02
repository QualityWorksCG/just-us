"use client";

import { Button } from "@just-us/ui/components/button";
import { cn } from "@just-us/ui/lib/utils";
import {
	BadgeCheck,
	CircleAlert,
	Clock3,
	ExternalLink,
	Landmark,
	Search,
	ShieldQuestion,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { verifyAttorneyAction } from "@/app/(app)/profile/verification-actions";
import {
	STATUS_COPY,
	type VerificationSource,
	type VerificationStatus,
} from "@/lib/attorney-verification";

/** The newest check, as the server renders it. */
export type VerificationCheck = {
	createdAt: Date;
	confidence: number;
	isLicensedAttorney: boolean | null;
	inGoodStanding: boolean | null;
	licenseStatusText: string | null;
	officialRecordUrl: string | null;
	matchedName: string | null;
	matchedBarNumber: string | null;
	matchedJurisdiction: string | null;
	disciplinaryNotes: string | null;
	summary: string;
	sources: VerificationSource[];
	checkedName: string | null;
	checkedJurisdiction: string | null;
};

export type VerificationView = {
	/** The profile-wide badge: the best standing across every admission, so one
	 *  verified licence makes a verified attorney (see `badgeFromAdmissions`). */
	status: VerificationStatus;
	verifiedAt: Date | null;
	latest: VerificationCheck | null;
	/** From the account, captured at sign-up. */
	barNumber: string | null;
	/** The primary state — what this card's own button checks. Null when the
	 *  attorney has claimed nowhere, which is when there is nothing to check. */
	jurisdiction: string | null;
};

const TONE_STYLES: Record<
	"neutral" | "good" | "warn" | "bad",
	{ chip: string; icon: typeof BadgeCheck }
> = {
	neutral: { chip: "bg-brass-wash text-brass-deep", icon: ShieldQuestion },
	good: { chip: "bg-green-soft text-green-deep", icon: BadgeCheck },
	warn: { chip: "bg-gold-bright text-gold-bright-ink", icon: Clock3 },
	bad: { chip: "bg-danger/10 text-danger", icon: CircleAlert },
};

/** Compact status pill, reused in the listing-status card. */
export function VerificationBadge({
	status,
	className,
}: {
	status: VerificationStatus;
	className?: string;
}) {
	const copy = STATUS_COPY[status];
	const tone = TONE_STYLES[copy.tone];
	return (
		<span
			className={cn(
				"inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] px-2.5 py-1 font-semibold text-[12px]",
				tone.chip,
				className,
			)}
		>
			<tone.icon className="size-3.5" aria-hidden="true" />
			{copy.label}
		</span>
	);
}

function Detail({
	label,
	value,
	muted,
}: {
	label: string;
	value: string;
	muted?: boolean;
}) {
	return (
		<div>
			<p className="font-mono font-semibold text-[10.5px] text-muted-foreground uppercase tracking-[0.08em]">
				{label}
			</p>
			<p
				className={cn(
					"mt-0.5 text-[13.5px]",
					muted ? "text-muted-foreground" : "text-ink",
				)}
			>
				{value}
			</p>
		</div>
	);
}

function formatWhen(date: Date): string {
	return new Intl.DateTimeFormat("en-US", {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(new Date(date));
}

export function AttorneyVerification({ data }: { data: VerificationView }) {
	const router = useRouter();
	const [running, startRunning] = useTransition();
	// Optimistic so the panel reads "Checking…" while the search runs, which can
	// take the better part of a minute.
	const [optimistic, setOptimistic] = useState<VerificationStatus | null>(null);
	const status = optimistic ?? data.status;
	const copy = STATUS_COPY[status];
	const check = data.latest;
	// A check runs against one state, and this button runs it for the primary one.
	// Every other state is checked from its own row in the admissions panel.
	const primary = data.jurisdiction;
	const canRun = !!primary;

	function run() {
		setOptimistic("pending");
		startRunning(async () => {
			const res = await verifyAttorneyAction({});
			setOptimistic(null);
			if (res.ok) {
				const messages: Record<VerificationStatus, string> = {
					verified: "Verified. Your listing now carries the verified badge.",
					needs_review:
						"We couldn't verify this automatically. An administrator will review it.",
					rejected: "The check couldn't confirm an active licence.",
					unverified: "The check found nothing conclusive.",
					pending: "Check started.",
				};
				if (res.status === "verified") toast.success(messages[res.status]);
				else toast.info(messages[res.status]);
				router.refresh();
			} else {
				toast.error(res.error);
			}
		});
	}

	return (
		<div className="flex flex-col gap-5">
			{/* Current state */}
			<div className="flex flex-wrap items-start justify-between gap-4 rounded-[var(--radius-card)] border border-border bg-paper-alt p-5">
				<div className="min-w-0 flex-1">
					<VerificationBadge status={status} />
					<p className="mt-2.5 max-w-[62ch] text-[13.5px] text-ink-soft leading-relaxed">
						{copy.blurb}
					</p>
					{data.verifiedAt && status !== "verified" && (
						<p className="mt-2 text-[12.5px] text-muted-foreground">
							Previously verified on {formatWhen(data.verifiedAt)}.
						</p>
					)}
				</div>
				<Button
					onClick={run}
					disabled={running || status === "pending" || !canRun}
					className="shrink-0 px-5"
				>
					<Search data-icon="inline-start" aria-hidden="true" />
					{running || status === "pending"
						? "Checking…"
						: primary
							? `${check ? "Re-check" : "Verify"} ${primary}`
							: "Run verification"}
				</Button>
			</div>

			{!canRun && (
				<p className="flex items-start gap-2.5 rounded-[var(--radius-card-sm)] bg-danger/5 px-4 py-3 text-[13px] text-danger leading-relaxed">
					<CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
					<span>
						Add the states you're admitted in above. A check needs to know which
						state's records to search.
					</span>
				</p>
			)}

			{/* How this works — set expectations before someone reads a result. */}
			<p className="flex items-start gap-2.5 text-[12.5px] text-muted-foreground leading-relaxed">
				<Landmark className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
				<span>
					Checks search public bar records, court registries, and legal
					directories, then report what they found. Results reflect a web search
					rather than a confirmation from the licensing authority, and an
					administrator can override any of them.
				</span>
			</p>

			{check && (
				<div className="rounded-[var(--radius-card)] border border-border bg-surface p-5">
					<div className="flex flex-wrap items-baseline justify-between gap-2">
						<h3 className="font-bold text-[14.5px] text-ink">
							Last check · {formatWhen(check.createdAt)}
						</h3>
						<span className="font-mono text-[11.5px] text-muted-foreground tabular-nums">
							{check.confidence}% confidence
						</span>
					</div>

					<p className="mt-3 max-w-[70ch] text-[13.5px] text-ink-soft leading-relaxed">
						{check.summary}
					</p>

					{/* What was searched vs. what was found — the comparison is the
					    whole point, so it's laid out side by side. */}
					<div className="mt-5 grid gap-5 sm:grid-cols-2">
						<div className="flex flex-col gap-3">
							<p className="font-semibold text-[12.5px] text-ink">
								What we searched for
							</p>
							<Detail label="Name" value={check.checkedName ?? "—"} muted />
							<Detail
								label="Jurisdiction"
								value={check.checkedJurisdiction ?? "—"}
								muted
							/>
						</div>
						<div className="flex flex-col gap-3">
							<p className="font-semibold text-[12.5px] text-ink">
								What the records say
							</p>
							<Detail label="Name" value={check.matchedName ?? "Not found"} />
							<Detail
								label="Bar number"
								value={check.matchedBarNumber ?? "Not found"}
							/>
							<Detail
								label="Status"
								value={check.licenseStatusText ?? "Not stated"}
							/>
						</div>
					</div>

					{/* The one finding the badge turns on, so it's stated outright rather
				    than left for someone to infer from the source list. */}
					<div className="mt-5 rounded-[var(--radius-card-sm)] border border-border bg-paper-alt px-4 py-3">
						<p className="font-mono font-semibold text-[10.5px] text-muted-foreground uppercase tracking-[0.08em]">
							Official licensee record
						</p>
						{check.officialRecordUrl ? (
							<a
								href={check.officialRecordUrl}
								target="_blank"
								rel="noopener noreferrer"
								className="mt-1 inline-flex items-center gap-1.5 break-all font-semibold text-[13px] text-brass-deep underline-offset-2 hover:underline"
							>
								{check.officialRecordUrl}
								<ExternalLink
									className="size-3.5 shrink-0"
									aria-hidden="true"
								/>
							</a>
						) : (
							<p className="mt-1 text-[13px] text-ink-soft leading-relaxed">
								None reached. The check couldn't open a licensee record on the
								licensing authority's own site, which is why this isn't
								verified. Whatever else it found restates a licence rather than
								conferring one.
							</p>
						)}
					</div>

					{check.disciplinaryNotes && (
						<p className="mt-5 flex items-start gap-2.5 rounded-[var(--radius-card-sm)] bg-danger/5 px-4 py-3 text-[13px] text-danger leading-relaxed">
							<CircleAlert
								className="mt-0.5 size-4 shrink-0"
								aria-hidden="true"
							/>
							<span>
								<span className="font-semibold">Discipline found: </span>
								{check.disciplinaryNotes}
							</span>
						</p>
					)}

					{/* Sources have to be openable — a claim nobody can check isn't
					    evidence, and official registries are listed first. */}
					<div className="mt-5">
						<p className="font-semibold text-[12.5px] text-ink">
							Sources
							<span className="ml-1.5 font-normal text-muted-foreground">
								({check.sources.length})
							</span>
						</p>
						{check.sources.length === 0 ? (
							<p className="mt-1.5 text-[13px] text-muted-foreground">
								The check cited no sources, which is why it wasn't verified.
							</p>
						) : (
							<ul className="mt-2.5 flex flex-col gap-2">
								{check.sources.map((source) => (
									<li key={source.url}>
										<a
											href={source.url}
											target="_blank"
											rel="noopener noreferrer"
											className="group flex items-start gap-2.5 rounded-[var(--radius-card-sm)] border border-border px-3.5 py-2.5 transition-colors hover:border-brass-deep hover:bg-brass-wash/30"
										>
											<span className="min-w-0 flex-1">
												<span className="block truncate font-semibold text-[13px] text-ink">
													{source.title}
												</span>
												<span className="block truncate text-[12px] text-muted-foreground">
													{source.url}
												</span>
											</span>
											<ExternalLink
												className="mt-0.5 size-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-brass-deep"
												aria-hidden="true"
											/>
										</a>
									</li>
								))}
							</ul>
						)}
						<p className="mt-2.5 text-[11.5px] text-muted-foreground leading-relaxed">
							These are the pages the search relied on. Open them to check the
							working behind the result.
						</p>
					</div>
				</div>
			)}
		</div>
	);
}
