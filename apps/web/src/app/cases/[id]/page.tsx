// biome-ignore-all lint/performance/noImgElement: case images are user-uploaded Blob URLs, not static assets
import { getPublicCase } from "@just-us/db/cases";
import { resolvePayoutDestination } from "@just-us/db/payouts";
import {
	donationPresets,
	minDonationCents,
	platformFeeBps,
} from "@just-us/payments";
import { Eye, Lock, Megaphone, Scale, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PublicCaseActions } from "@/components/public-case-actions";

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

export async function generateMetadata({
	params,
}: {
	params: Promise<{ id: string }>;
}): Promise<Metadata> {
	const { id } = await params;
	const c = await getPublicCase(id);
	if (!c) return { title: "Case not found" };
	return {
		title: `${c.title} · JustUs Financial`,
		description: c.summary || c.story.slice(0, 155),
	};
}

export default async function PublicCasePage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;
	const c = await getPublicCase(id);
	if (!c) notFound();

	const goal = c.goalCents / 100;
	const raised = c.raisedCents / 100;
	const pct = goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : 0;
	const owner = c.owner?.name ?? "A plaintiff";
	const ownerFirst = owner.split(" ")[0];
	const attorneyMeta =
		[c.attorneyFirm, c.attorneyArea, c.attorneyLocation]
			.filter(Boolean)
			.join(" · ") || "—";

	// Can this case actually take money right now? Resolved server-side from the
	// case's *bound* payout account, so the button state and the charge path agree
	// rather than each deciding for itself.
	const destination = await resolvePayoutDestination(c.id);
	const BLOCKED: Record<string, string> = {
		not_live: "This case isn't raising right now.",
		unbound:
			"This case is still setting up where donations go, so it can't accept them yet.",
		transfers_disabled:
			"The recipient's payout setup is still being verified. Donations open as soon as it clears.",
	};

	// Who this case's donations are paid to. A donor decides partly on this, and
	// terms §4 commits to stating it per case, so it is read from the case's own
	// `payoutRecipient` rather than asserted globally — the recipient is either
	// side depending on how the case was set up. Null means no payout account has
	// been designated yet, and the note must claim neither rather than guess.
	const fundsNote =
		c.payoutRecipient === "plaintiff"
			? `Funds go to ${ownerFirst}'s account — ${ownerFirst} pays the attorney directly.`
			: c.payoutRecipient === "attorney"
				? `Funds go straight to ${c.attorneyName ?? "the attorney"}'s account — never through ${ownerFirst}.`
				: "Funds go to the recipient this case designates — never to JustUs.";
	const paragraphs = c.story
		.split(/\n{2,}|\n/)
		.map((p) => p.trim())
		.filter(Boolean);

	return (
		<main className="h-full overflow-y-auto bg-paper">
			<div className="mx-auto max-w-[1100px] px-6 py-10 sm:py-14">
				{/* Header */}
				<div className="mb-2.5 flex flex-wrap gap-1.5">
					<span className="rounded-[var(--radius-chip)] bg-brass-wash px-2.5 py-0.5 font-semibold text-[12px] text-brass-deep">
						{c.category || "Case"}
					</span>
					<span className="rounded-[var(--radius-chip)] border border-border px-2.5 py-0.5 text-[12px] text-ink-soft">
						{c.location || "—"}
					</span>
				</div>
				<div className="flex flex-wrap items-center gap-3">
					<h1 className="font-extrabold text-[clamp(1.9rem,4vw,2.75rem)] text-ink leading-[1.05] tracking-[-0.03em]">
						{c.title || "Untitled case"}
					</h1>
					<span className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-green-soft px-3 py-1 font-mono font-semibold text-[11px] text-green-deep uppercase tracking-[0.06em]">
						<span className="size-1.5 rounded-full bg-success" />
						Live · raising
					</span>
				</div>
				<div className="mt-3 flex items-center gap-2 text-[13.5px] text-muted-foreground">
					<span className="flex size-6 items-center justify-center rounded-full bg-green-soft font-bold text-[10px] text-green-deep">
						{initials(owner)}
					</span>
					<span className="font-semibold text-ink">{owner}</span>
					{c.attorneyName ? <span>· with {c.attorneyName}</span> : null}
				</div>

				{/* Cover */}
				<div className="mt-6 overflow-hidden rounded-[var(--radius-card-lg)] border border-border bg-surface-2">
					{c.coverImageUrl ? (
						<img
							src={c.coverImageUrl}
							alt=""
							className="aspect-[16/9] w-full object-cover"
						/>
					) : (
						<div className="flex aspect-[16/9] w-full items-center justify-center text-brass-deep/40">
							<Scale className="size-12" aria-hidden="true" />
						</div>
					)}
				</div>

				{/* Two columns */}
				<div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
					{/* Left — story + attorney */}
					<div className="flex flex-col gap-8">
						<section>
							<h2 className="mb-3 font-bold text-[18px] text-ink">The story</h2>
							<div className="flex flex-col gap-3 text-[15px] text-ink-soft leading-relaxed">
								{paragraphs.length > 0 ? (
									paragraphs.map((p, i) => (
										<p key={`${i}-${p.slice(0, 12)}`}>{p}</p>
									))
								) : (
									<p>{c.summary}</p>
								)}
							</div>
						</section>

						{/* Gallery */}
						{c.images.length > 0 && (
							<section>
								<h2 className="mb-3 font-bold text-[18px] text-ink">Photos</h2>
								<div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
									{c.images.map((url) => (
										<img
											key={url}
											src={url}
											alt=""
											className="aspect-square w-full rounded-[var(--radius-card-sm)] border border-border object-cover"
										/>
									))}
								</div>
							</section>
						)}

						{/* Case updates — no updates model yet, honest empty state */}
						<section>
							<h2 className="mb-3 font-bold text-[18px] text-ink">
								Case updates
							</h2>
							<div className="flex items-center gap-2.5 rounded-[var(--radius-card)] border border-border border-dashed bg-surface/60 px-4 py-4 text-[13.5px] text-muted-foreground">
								<Megaphone className="size-4 shrink-0" aria-hidden="true" />
								No updates yet — {ownerFirst}'s attorney will post progress
								here.
							</div>
						</section>

						{/* Represented by */}
						{c.attorneyName && (
							<section>
								<h2 className="mb-3 font-bold text-[18px] text-ink">
									Represented by
								</h2>
								<div className="flex items-center gap-3 rounded-[var(--radius-card-lg)] border border-border bg-surface p-5 shadow-[var(--shadow-rest)]">
									<span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brass font-bold text-[13px] text-white">
										{initials(c.attorneyName)}
									</span>
									<div>
										<p className="font-bold text-[15px] text-ink">
											{c.attorneyName}
										</p>
										<p className="text-[12.5px] text-muted-foreground">
											{attorneyMeta}
										</p>
									</div>
								</div>
							</section>
						)}
					</div>

					{/* Right — funding sidebar */}
					<div className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
						<div className="rounded-[var(--radius-card-lg)] border border-border bg-surface p-6 shadow-[var(--shadow-rest)]">
							<p className="font-extrabold text-[34px] text-ink tabular-nums leading-none tracking-[-0.02em]">
								{money(raised)}
							</p>
							<p className="mt-2 text-[13.5px] text-muted-foreground">
								raised of {money(goal)} goal · {pct}%
							</p>
							<div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-2">
								<div
									className="h-full rounded-full bg-brass"
									style={{ width: `${Math.max(2, pct)}%` }}
								/>
							</div>
							<p className="mt-3 font-semibold text-[13px] text-ink">
								{c.donorsCount} {c.donorsCount === 1 ? "donor" : "donors"}
							</p>
							<div className="mt-5">
								<PublicCaseActions
									sharePath={`/cases/${c.id}`}
									caseId={c.id}
									config={{
										presetsCents: donationPresets(),
										minCents: minDonationCents(),
										feeBps: platformFeeBps(),
										canDonate: destination.ok,
										blockedReason: destination.ok
											? null
											: (BLOCKED[destination.reason] ?? null),
									}}
								/>
							</div>
						</div>

						{/* Recent backers — no backer records yet, honest empty state */}
						<div className="rounded-[var(--radius-card-lg)] border border-border bg-surface p-6 shadow-[var(--shadow-rest)]">
							<p className="mb-3 font-mono font-semibold text-[11px] text-muted-foreground uppercase tracking-[0.08em]">
								Recent backers
							</p>
							{c.donorsCount > 0 ? (
								<p className="text-[13px] text-ink-soft">
									{c.donorsCount} people have backed this case.
								</p>
							) : (
								<p className="text-[13px] text-muted-foreground leading-relaxed">
									No backers yet — be the first to help {ownerFirst} fund this
									case.
								</p>
							)}
						</div>

						{/* Trust notes */}
						<div className="flex flex-col gap-2.5 rounded-[var(--radius-card-lg)] border border-border bg-surface/60 p-5 text-[12.5px] text-ink-soft">
							<span className="flex items-start gap-2">
								<Lock
									className="mt-0.5 size-4 shrink-0 text-brass-deep"
									aria-hidden="true"
								/>
								{fundsNote}
							</span>
							<span className="flex items-start gap-2">
								<Eye
									className="mt-0.5 size-4 shrink-0 text-brass-deep"
									aria-hidden="true"
								/>
								One 5% fee, shown to you before you give.
							</span>
							<span className="flex items-start gap-2">
								<ShieldCheck
									className="mt-0.5 size-4 shrink-0 text-brass-deep"
									aria-hidden="true"
								/>
								{ownerFirst} chose their own attorney.
							</span>
						</div>
					</div>
				</div>
			</div>
		</main>
	);
}
