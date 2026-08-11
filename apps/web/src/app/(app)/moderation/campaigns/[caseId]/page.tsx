// biome-ignore-all lint/performance/noImgElement: case covers are user-uploaded Blob URLs, not static assets
import { getCaseModerationReview } from "@just-us/db/moderation";
import { cn } from "@just-us/ui/lib/utils";
import { Flag } from "lucide-react";
import type { Route } from "next";
import { notFound } from "next/navigation";

import { CampaignModerationActions } from "@/components/dashboard/campaign-moderation-actions";
import { DetailBackLink } from "@/components/detail-back-link";
import { requirePermission } from "@/lib/auth-server";

const CATEGORY_LABEL: Record<string, string> = {
	defamation: "Defamation risk",
	frivolous: "Frivolous claim",
	sensitive: "Sensitive content",
	pii: "Third-party PII",
	report: "Public report",
};

const HOLD_LABEL: Record<string, { text: string; cls: string }> = {
	held: { text: "Hidden — awaiting review", cls: "bg-danger/10 text-danger" },
	ok: { text: "Visible", cls: "bg-green-soft text-green-deep" },
	removed: { text: "Removed", cls: "bg-surface-2 text-ink-soft" },
};

export default async function CampaignReviewPage({
	params,
}: {
	params: Promise<{ caseId: string }>;
}) {
	await requirePermission("moderation:review");
	const { caseId } = await params;
	const review = await getCaseModerationReview(caseId);
	if (!review) notFound();

	const { case: c, flags } = review;
	const hold = HOLD_LABEL[c.moderationStatus] ?? HOLD_LABEL.ok;

	return (
		<div className="mx-auto flex max-w-[980px] flex-col gap-6">
			<DetailBackLink href="/moderation" label="Back to moderation" />

			{/* The campaign content under review */}
			<div className="overflow-hidden rounded-[var(--radius-card-lg)] border border-border bg-surface shadow-[var(--shadow-rest)]">
				{c.coverImageUrl ? (
					<img
						src={c.coverImageUrl}
						alt=""
						className="h-48 w-full object-cover"
					/>
				) : null}
				<div className="p-6">
					<div className="flex flex-wrap items-center gap-2">
						<span
							className={cn(
								"rounded-[var(--radius-pill)] px-2.5 py-0.5 font-semibold text-[11px]",
								hold.cls,
							)}
						>
							{hold.text}
						</span>
						<span className="font-mono text-[11px] text-muted-foreground uppercase tracking-[0.06em]">
							{c.status}
						</span>
					</div>
					<h1 className="mt-2 font-extrabold text-[24px] text-ink tracking-[-0.02em]">
						{c.title || "Untitled campaign"}
					</h1>
					<p className="mt-1 text-[13px] text-muted-foreground">
						{c.ownerName} · {c.category} · {c.location}
					</p>
					{c.summary ? (
						<p className="mt-4 font-semibold text-[15px] text-ink leading-relaxed">
							{c.summary}
						</p>
					) : null}
					{c.story ? (
						<p className="mt-3 whitespace-pre-wrap text-[14px] text-ink-soft leading-relaxed">
							{c.story}
						</p>
					) : null}
				</div>
			</div>

			{/* Why it's flagged */}
			<section>
				<h2 className="mb-3 font-bold text-[16px] text-ink">
					Why this was flagged
					{flags.length > 0 && (
						<span className="ml-2 rounded-full bg-danger/10 px-2 py-0.5 align-middle font-semibold text-[12px] text-danger">
							{flags.length}
						</span>
					)}
				</h2>
				{flags.length === 0 ? (
					<p className="rounded-[var(--radius-card)] bg-paper-alt px-4 py-6 text-center text-[13px] text-muted-foreground">
						No open flags on this campaign.
					</p>
				) : (
					<div className="flex flex-col gap-3">
						{flags.map((f) => (
							<div
								key={f.id}
								className="rounded-[var(--radius-card-lg)] border border-border bg-surface p-4 shadow-[var(--shadow-rest)]"
							>
								<div className="flex flex-wrap items-center gap-2">
									<span className="rounded-[var(--radius-pill)] bg-ink px-2.5 py-0.5 font-mono font-semibold text-[10px] text-surface uppercase tracking-[0.06em]">
										{f.targetType === "update" ? "Update" : "Campaign"}
									</span>
									<span className="font-semibold text-[13px] text-ink-soft">
										{CATEGORY_LABEL[f.category] ?? f.category}
									</span>
									<span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] bg-surface-2 px-2 py-0.5 font-semibold text-[10.5px] text-ink-soft uppercase tracking-[0.04em]">
										<Flag className="size-3" aria-hidden="true" />
										Public report
									</span>
								</div>
								{f.updateBody ? (
									<p className="mt-2 text-[13px] text-muted-foreground italic">
										Flagged update: “{f.updateBody}”
									</p>
								) : null}
								<div className="mt-2 rounded-[var(--radius-card)] bg-paper-alt px-3.5 py-2.5">
									<p className="text-[10px] text-muted-foreground uppercase tracking-[0.08em]">
										Reporter's reason
									</p>
									<p className="mt-1 text-[13px] text-ink leading-relaxed">
										{f.detail}
									</p>
								</div>
							</div>
						))}
					</div>
				)}
			</section>

			{/* The decision */}
			<CampaignModerationActions caseId={c.id} />

			{/* Read the campaign exactly as a donor would. */}
			<a
				href={`/discover/${c.id}` as Route}
				className="text-center font-semibold text-[13px] text-brass-deep transition-colors hover:text-ink"
			>
				Open the donor-facing view →
			</a>
		</div>
	);
}
