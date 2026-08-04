// biome-ignore-all lint/performance/noImgElement: case images are user-uploaded Blob URLs, not static assets
import type { getPublicCase } from "@just-us/db/cases";
import { Eye, Lock, Megaphone, Scale, ShieldCheck } from "lucide-react";
import type { Route } from "next";

import { DetailBackLink } from "@/components/detail-back-link";
import { PublicCaseActions } from "@/components/public-case-actions";

/**
 * One live case, as a donor reads it.
 *
 * Shared by the public `/cases/[id]` page and the in-app `/discover/[id]` screen.
 * The funding claims on here — where the money goes, the fee, who chose the
 * attorney — have to read identically wherever the case appears, and a copy would
 * drift.
 *
 * Two routes rather than one because the in-app screen has to stay inside the
 * dashboard shell. Sending a signed-in donor to the public page dropped them out
 * of the app: the marketing header hides itself once there's a session, so the
 * case became a dead end with no sidebar and nothing to go back with.
 *
 * The page chrome around this — `<main>`, gutters, any max-width — belongs to the
 * route, since the shell already supplies its own.
 */
export type PublicCase = NonNullable<Awaited<ReturnType<typeof getPublicCase>>>;

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

export function PublicCaseView({
	c,
	backHref,
	backLabel,
	headingLevel = "h1",
}: {
	c: PublicCase;
	/** Where "back" goes — the list this case was opened from. */
	backHref: Route;
	backLabel: string;
	/** "h2" inside the app shell, whose header bar is already the page's h1. */
	headingLevel?: "h1" | "h2";
}) {
	const Heading = headingLevel;

	const goal = c.goalCents / 100;
	const raised = c.raisedCents / 100;
	const pct = goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : 0;
	const owner = c.owner?.name ?? "A plaintiff";
	const ownerFirst = owner.split(" ")[0];
	const attorneyMeta =
		[c.attorneyFirm, c.attorneyArea, c.attorneyLocation]
			.filter(Boolean)
			.join(" · ") || "—";
	const paragraphs = c.story
		.split(/\n{2,}|\n/)
		.map((p) => p.trim())
		.filter(Boolean);

	return (
		<div>
			{/* Sits above the title, flush with the page's left edge — the same return
			    control the attorney profile and conversation views use. */}
			<DetailBackLink href={backHref} label={backLabel} />

			{/* Header */}
			<div className="mt-4 mb-2.5 flex flex-wrap gap-1.5">
				<span className="rounded-[var(--radius-chip)] bg-brass-wash px-2.5 py-0.5 font-semibold text-[12px] text-brass-deep">
					{c.category || "Case"}
				</span>
				<span className="rounded-[var(--radius-chip)] border border-border px-2.5 py-0.5 text-[12px] text-ink-soft">
					{c.location || "—"}
				</span>
			</div>
			<div className="flex flex-wrap items-center gap-3">
				<Heading className="font-extrabold text-[clamp(1.9rem,4vw,2.75rem)] text-ink leading-[1.05] tracking-[-0.03em]">
					{c.title || "Untitled case"}
				</Heading>
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
							No updates yet — {ownerFirst}'s attorney will post progress here.
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
							{/* Always the public link, even from inside the app — the
							    in-app route is signed-in only, so sharing it would send
							    everyone else to the login screen. */}
							<PublicCaseActions sharePath={`/cases/${c.id}`} />
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
							Funds go to {ownerFirst}'s account — {ownerFirst} pays the
							attorney directly.
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
	);
}
