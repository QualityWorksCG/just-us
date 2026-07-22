import { buttonVariants } from "@just-us/ui/components/button";
import { cn } from "@just-us/ui/lib/utils";
import {
	ArrowRight,
	Bot,
	Eye,
	FileText,
	Gavel,
	Lock,
	Megaphone,
	Scale,
	ShieldCheck,
	Sparkles,
	Users,
} from "lucide-react";
import Link from "next/link";

import { Brandmark } from "@/components/brandmark";
import { LandingFaq } from "@/components/landing-faq";

const trustChips = [
	{ icon: ShieldCheck, label: "We never hold donated funds" },
	{ icon: Scale, label: "Attorney chosen before funding" },
	{ icon: Eye, label: "One transparent 5% fee" },
] as const;

const howSteps = [
	{
		num: "01",
		icon: FileText,
		title: "Tell what happened",
		body: "Submit your case with your story and evidence. Our team vets every case before it can go public.",
	},
	{
		num: "02",
		icon: Scale,
		title: "Choose your attorney",
		body: "Browse bar-verified attorneys, compare profiles and reviews, and contact the one you choose — then agree a set fee together.",
	},
	{
		num: "03",
		icon: Users,
		title: "Fund it together",
		body: "The agreed fee becomes your goal. The public donates toward it; every dollar routes straight to the attorney's case account.",
	},
	{
		num: "04",
		icon: Megaphone,
		title: "Follow it to the end",
		body: "Your attorney posts updates to every backer as the case moves — through to the outcome, whatever it is.",
	},
] as const;

const featuredCases = [
	{
		title: "Fired for reporting safety violations at a food plant",
		category: "Employment",
		jurisdiction: "Georgia",
		owner: "Denise Okafor",
		attorney: "Marcus Bell",
		raised: 6626,
		goal: 9800,
		donors: 84,
		tone: "from-brass-wash to-surface-2",
	},
	{
		title: "Three years of unpaid overtime at a fulfillment center",
		category: "Wage & hours",
		jurisdiction: "California",
		owner: "Sofia Alvarez",
		attorney: "Priya Shah",
		raised: 21400,
		goal: 45000,
		donors: 126,
		tone: "from-surface-2 to-brass-wash/60",
	},
	{
		title: "Mom's call button went unanswered for hours",
		category: "Elder care",
		jurisdiction: "Florida",
		owner: "James Whitfield",
		attorney: "Dana Kim",
		raised: 9800,
		goal: 9800,
		donors: 203,
		tone: "from-brass/20 to-surface-2",
	},
] as const;

const guardrails = [
	{
		icon: ShieldCheck,
		title: "Donations are gifts",
		body: "No promised return, and no share of any settlement — anywhere in the product. People give because the case matters, not to profit from it.",
	},
	{
		icon: Lock,
		title: "We never hold the money",
		body: "Donations route directly into the attorney's case-specific account. JustUs's own balance never receives a donated dollar.",
	},
	{
		icon: Scale,
		title: "We never touch legal fees",
		body: "Platform revenue is a transparent 5% donation fee plus optional tips. Attorney fees and settlements are between attorney and client.",
	},
] as const;

const aiSeats = [
	{
		role: "Plaintiff",
		title: "Completeness check",
		body: "Before you submit, AI flags what's missing — a thin story, no evidence — so your case arrives vetting-ready. Flags never block submission.",
	},
	{
		role: "Donor",
		title: "Plain-language summaries",
		body: "Every case carries a labelled AI summary of what's claimed and where it stands, so you understand before you give.",
	},
	{
		role: "Attorney",
		title: "Smarter search",
		body: "Plaintiff requests arrive with an AI case summary — practice area, jurisdiction, and evidence completeness, with the reasoning shown, not hidden.",
	},
	{
		role: "Administrator",
		title: "Moderation triage",
		body: "AI flags sensitive or risky content for human review. Nothing is auto-rejected, and nothing flagged publishes without a person's ruling.",
	},
] as const;

const trustItems = [
	{
		icon: ShieldCheck,
		title: "A person vets every case",
		body: "No case goes public on an algorithm's say-so. Our vetting team reviews every submission — story, evidence, and identity — before it can be listed or funded.",
	},
	{
		icon: Scale,
		title: "Every attorney is bar-verified",
		body: "Attorneys verify their bar standing per jurisdiction before their profile activates. Pending profiles aren't listed in the directory, full stop.",
	},
	{
		icon: Lock,
		title: "Funds we never touch",
		body: "Donations settle directly into the attorney's case-specific account. JustUs's own balance never receives a donated dollar — and the ledger shows it.",
	},
	{
		icon: Eye,
		title: "Radical fee transparency",
		body: "One 5% platform fee, shown to the cent before you confirm. No hidden spreads, no share of legal fees, no cut of any settlement.",
	},
] as const;

const roles = [
	{
		icon: FileText,
		title: "Been wronged?",
		body: "Submit your case free. A person vets it, you choose your attorney, and the public funds the agreed fee.",
		cta: "Start your case",
		href: "/login",
	},
	{
		icon: Users,
		title: "Fund someone's day in court",
		body: "Give any amount to a vetted case. One transparent 5% fee, and every update until the outcome.",
		cta: "Browse cases",
		href: "/cases",
	},
	{
		icon: Gavel,
		title: "Practice law that matters",
		body: "List your practice in the directory, take on vetted, fundable cases you choose — with the fee raised before you file.",
		cta: "Join as an attorney",
		href: "/attorneys",
	},
] as const;

function money(n: number) {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		maximumFractionDigits: 0,
	}).format(n);
}

function SectionLabel({
	children,
	dark = false,
}: {
	children: React.ReactNode;
	dark?: boolean;
}) {
	return (
		<div
			className={cn(
				"mb-3 inline-flex items-center gap-2 font-mono font-semibold text-[12px] uppercase tracking-[0.08em]",
				dark ? "text-brass" : "text-brass-deep",
			)}
		>
			<span className="h-px w-5 bg-current" aria-hidden="true" />
			{children}
		</div>
	);
}

function ProgressBar({ value, max }: { value: number; max: number }) {
	const pct = Math.min(100, Math.round((value / max) * 100));
	return (
		<div
			className="h-2 overflow-hidden rounded-full bg-surface-2"
			role="progressbar"
			aria-valuenow={pct}
			aria-valuemin={0}
			aria-valuemax={100}
		>
			<div
				className="h-full rounded-full bg-brass transition-[width] duration-500"
				style={{ width: `${pct}%` }}
			/>
		</div>
	);
}

function HeroCaseCard() {
	const raised = 6626;
	const goal = 9800;
	return (
		<div className="relative mx-auto w-full max-w-[380px]">
			<div className="overflow-hidden rounded-[var(--radius-modal)] border border-border bg-card shadow-[var(--shadow-hero)]">
				<div className="relative h-[86px] bg-[repeating-linear-gradient(135deg,var(--surface-2),var(--surface-2)_11px,color-mix(in_oklch,var(--brass)_9%,var(--surface-2))_11px,color-mix(in_oklch,var(--brass)_9%,var(--surface-2))_22px)]">
					<div className="absolute top-3 left-3.5 flex gap-1.5">
						<span className="rounded-[var(--radius-pill)] bg-brass px-2.5 py-1 font-mono font-semibold text-[11px] text-brass-ink uppercase tracking-wide">
							Funding
						</span>
						<span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] bg-brass-wash px-2.5 py-1 font-mono font-semibold text-[11px] text-brass-deep uppercase tracking-wide">
							<Sparkles className="size-3" aria-hidden="true" />
							Match
						</span>
					</div>
				</div>
				<div className="p-[18px]">
					<h3 className="mb-2 font-bold text-[17px] text-ink leading-snug">
						Fired for reporting safety violations at a food plant
					</h3>
					<p className="mb-4 text-[13px] text-muted-foreground leading-relaxed">
						Terminated eleven days after filing an internal safety complaint
						affecting 40+ warehouse staff…
					</p>
					<div className="mb-1.5 flex justify-between text-[12.5px]">
						<span className="font-bold text-ink tabular-nums">
							{money(raised)}
						</span>
						<span className="text-muted-foreground">of {money(goal)}</span>
					</div>
					<ProgressBar value={raised} max={goal} />
					<div className="mt-3.5 flex items-center justify-between">
						<span className="rounded-[var(--radius-chip)] border border-border px-2 py-0.5 text-[12px] text-ink-soft">
							Georgia
						</span>
						<span className="text-[12.5px] text-muted-foreground">
							84 donors · Employment
						</span>
					</div>
				</div>
			</div>
			<div className="absolute bottom-2 -left-2 flex max-w-[250px] items-center gap-2.5 rounded-[13px] border border-brass/30 bg-card px-3.5 py-3 shadow-[var(--shadow-float)] sm:-left-4">
				<div className="relative flex size-12 shrink-0 items-center justify-center rounded-full border-2 border-brass/40 font-bold text-brass-deep text-sm tabular-nums">
					78
				</div>
				<div>
					<p className="font-bold text-[12px] text-brass-deep uppercase tracking-[0.04em]">
						AI case strength
					</p>
					<p className="mt-0.5 text-[12.5px] text-ink-soft leading-snug">
						Strong evidence; corroborated.
					</p>
				</div>
			</div>
		</div>
	);
}

export default function Home() {
	return (
		<main className="h-full overflow-y-auto">
			{/* Hero */}
			<section className="relative overflow-hidden border-border border-b">
				<div
					aria-hidden="true"
					className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,color-mix(in_oklch,var(--brass)_14%,transparent),transparent_55%),radial-gradient(ellipse_at_bottom_left,color-mix(in_oklch,var(--brass-wash)_80%,transparent),transparent_50%)]"
				/>
				<div className="relative mx-auto grid max-w-[1180px] items-center gap-12 px-6 pt-16 pb-20 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14 lg:pt-20 lg:pb-24">
					<div>
						<p className="mb-3 animate-[ju-rise_0.7s_var(--ease-rise)_both] font-display font-extrabold text-[clamp(2.5rem,5.5vw,3.75rem)] text-ink leading-none tracking-[-0.04em]">
							JustUs
						</p>
						<p className="mb-3 animate-[ju-rise_0.7s_var(--ease-rise)_0.05s_both] font-mono font-semibold text-[12px] text-brass-deep uppercase tracking-[0.08em]">
							Litigation crowdfunding, done right
						</p>
						<h1 className="max-w-[20ch] animate-[ju-rise_0.8s_var(--ease-rise)_0.14s_both] font-extrabold text-[clamp(2rem,4.2vw,3.25rem)] text-ink leading-[1.04] tracking-[-0.03em]">
							Justice shouldn't depend on what's in your pocket.
						</h1>
						<p className="mt-4 max-w-[520px] animate-[ju-rise_0.8s_var(--ease-rise)_0.24s_both] text-[16.5px] text-ink-soft leading-relaxed">
							People who've been wronged find their own attorney in our open
							directory, agree a fair fee up front, and let the public fund it
							together. Every dollar goes straight to the attorney's case
							account — we never hold the money.
						</p>
						<div className="mt-6 flex animate-[ju-rise_0.8s_var(--ease-rise)_0.34s_both] flex-col gap-3 sm:flex-row">
							<Link
								href="/login"
								className={cn(
									buttonVariants({ size: "lg" }),
									"w-full sm:w-auto",
								)}
							>
								Start your case
								<Gavel data-icon="inline-end" aria-hidden="true" />
							</Link>
							<Link
								href="/cases"
								className={cn(
									buttonVariants({ variant: "outline", size: "lg" }),
									"w-full sm:w-auto",
								)}
							>
								Browse cases
								<ArrowRight data-icon="inline-end" aria-hidden="true" />
							</Link>
						</div>
						<ul className="mt-7 flex animate-[ju-rise_0.8s_var(--ease-rise)_0.44s_both] flex-wrap gap-x-5 gap-y-3">
							{trustChips.map((chip) => (
								<li
									key={chip.label}
									className="flex items-center gap-2 font-semibold text-[13px] text-ink-soft"
								>
									<chip.icon
										className="size-4 text-brass-deep"
										aria-hidden="true"
									/>
									{chip.label}
								</li>
							))}
						</ul>
					</div>
					<div className="animate-[ju-fade_1s_var(--ease-rise)_0.3s_both]">
						<HeroCaseCard />
					</div>
				</div>
			</section>

			{/* How it works */}
			<section
				id="how"
				aria-labelledby="how-heading"
				className="border-border border-b bg-card"
			>
				<div className="mx-auto max-w-[1180px] px-6 py-16 sm:py-24">
					<div className="mb-10 max-w-xl">
						<SectionLabel>How it works</SectionLabel>
						<h2
							id="how-heading"
							className="font-extrabold text-[clamp(1.75rem,3vw,1.875rem)] text-ink tracking-[-0.02em]"
						>
							One flow, from wrong to won.
						</h2>
						<p className="mt-3.5 max-w-[640px] text-[14.5px] text-ink-soft leading-relaxed">
							The plaintiff chooses an attorney from the directory and a fee is
							agreed before a single dollar is asked for. The fee becomes the
							goal — nothing more is ever raised.
						</p>
					</div>
					<ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
						{howSteps.map((step) => (
							<li
								key={step.num}
								className="rounded-[var(--radius-card)] border border-border bg-paper p-[22px]"
							>
								<div className="mb-4 flex items-center justify-between">
									<span className="flex size-[42px] items-center justify-center rounded-xl bg-brass-wash text-brass-deep">
										<step.icon className="size-5" aria-hidden="true" />
									</span>
									<span className="font-mono text-[13px] text-muted-foreground">
										{step.num}
									</span>
								</div>
								<h3 className="mb-1.5 font-bold text-base text-ink">
									{step.title}
								</h3>
								<p className="text-[13.5px] text-ink-soft leading-relaxed">
									{step.body}
								</p>
							</li>
						))}
					</ol>
				</div>
			</section>

			{/* Featured cases */}
			<section
				id="cases"
				aria-labelledby="cases-heading"
				className="border-border border-b"
			>
				<div className="mx-auto max-w-[1180px] px-6 py-16 sm:py-20">
					<div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
						<div>
							<SectionLabel>Live now</SectionLabel>
							<h2
								id="cases-heading"
								className="font-extrabold text-[30px] text-ink tracking-[-0.02em]"
							>
								Cases raising right now
							</h2>
						</div>
						<Link
							href="/cases"
							className={cn(buttonVariants({ variant: "outline" }))}
						>
							See all cases
							<ArrowRight data-icon="inline-end" aria-hidden="true" />
						</Link>
					</div>
					<div className="grid gap-5 md:grid-cols-3">
						{featuredCases.map((c) => (
							<Link
								key={c.title}
								href="/cases"
								className="group overflow-hidden rounded-[var(--radius-card)] border border-border bg-card shadow-[var(--shadow-rest)] transition-[transform,box-shadow,border-color] duration-[var(--dur-base)] hover:-translate-y-0.5 hover:border-line-strong hover:shadow-[var(--shadow-hover)]"
							>
								<div
									className={cn("h-[170px] bg-gradient-to-br", c.tone)}
									aria-hidden="true"
								/>
								<div className="p-5">
									<div className="mb-2.5 flex flex-wrap gap-1.5">
										<span className="rounded-[var(--radius-chip)] bg-brass-wash px-2 py-0.5 font-semibold text-[12px] text-brass-deep">
											{c.category}
										</span>
										<span className="rounded-[var(--radius-chip)] border border-border px-2 py-0.5 text-[12px] text-ink-soft">
											{c.jurisdiction}
										</span>
									</div>
									<h3 className="mb-1.5 font-bold text-base text-ink leading-snug">
										{c.title}
									</h3>
									<p className="mb-3.5 text-[13px] text-muted-foreground">
										{c.owner} · with {c.attorney}
									</p>
									<ProgressBar value={c.raised} max={c.goal} />
									<div className="mt-2.5 flex justify-between text-[12.5px] text-ink-soft">
										<span className="font-bold tabular-nums">
											{money(c.raised)} of {money(c.goal)}
										</span>
										<span>{c.donors} donors</span>
									</div>
								</div>
							</Link>
						))}
					</div>
				</div>
			</section>

			{/* Guardrails */}
			<section
				id="guardrails"
				aria-labelledby="guardrails-heading"
				className="bg-ink text-paper"
			>
				<div className="mx-auto max-w-[1180px] px-6 py-16 sm:py-20">
					<SectionLabel dark>Our guardrails</SectionLabel>
					<h2
						id="guardrails-heading"
						className="mb-10 max-w-[560px] font-extrabold text-[30px] tracking-[-0.02em]"
					>
						Three promises we build the whole platform around.
					</h2>
					<div className="grid gap-5 md:grid-cols-3">
						{guardrails.map((item) => (
							<div
								key={item.title}
								className="rounded-[var(--radius-card)] border border-paper/15 p-6"
							>
								<span className="mb-4 flex size-[42px] items-center justify-center rounded-xl bg-brass/20 text-brass">
									<item.icon className="size-5" aria-hidden="true" />
								</span>
								<h3 className="mb-2 font-bold text-base text-paper/95">
									{item.title}
								</h3>
								<p className="text-[13.5px] text-paper/60 leading-relaxed">
									{item.body}
								</p>
							</div>
						))}
					</div>
				</div>
			</section>

			{/* Fee transparency */}
			<section
				id="fees"
				aria-labelledby="fees-heading"
				className="border-border border-b"
			>
				<div className="mx-auto grid max-w-[1180px] items-center gap-12 px-6 py-16 sm:py-20 lg:grid-cols-2 lg:gap-14">
					<div>
						<SectionLabel>Fee transparency</SectionLabel>
						<h2
							id="fees-heading"
							className="font-extrabold text-[30px] text-ink tracking-[-0.02em]"
						>
							One fee. Shown before you give, to the cent.
						</h2>
						<p className="mt-3.5 text-[14.5px] text-ink-soft leading-relaxed">
							JustUs charges a 5% platform fee on donations — that's how we keep
							the lights on. We never take a share of legal fees or settlements,
							and tips are always optional.
						</p>
						<p className="mt-3.5 text-[13px] text-muted-foreground leading-relaxed">
							Donations are gifts. They carry no financial return and no share
							of any outcome — you give because the case matters, and you follow
							it to the end.
						</p>
					</div>
					<div className="rounded-[var(--radius-card)] border border-border bg-card p-6.5 shadow-[var(--shadow-rest)]">
						<p className="mb-4.5 font-mono text-[12px] text-muted-foreground uppercase tracking-[0.08em]">
							Where a $100 donation goes
						</p>
						<div className="flex justify-between border-border border-b py-3.5 text-[14.5px]">
							<span className="text-ink-soft">Your donation</span>
							<span className="font-bold text-ink tabular-nums">$100.00</span>
						</div>
						<div className="flex justify-between border-border border-b py-3.5 text-[14.5px]">
							<span className="text-ink-soft">JustUs platform fee (5%)</span>
							<span className="text-muted-foreground tabular-nums">
								− $5.00
							</span>
						</div>
						<div className="flex justify-between py-4 text-[14.5px]">
							<span className="font-semibold text-ink">
								Straight to the attorney's case account
							</span>
							<span className="font-extrabold text-[18px] text-brass-deep tabular-nums">
								$95.00
							</span>
						</div>
						<p className="mt-2 flex gap-2 rounded-[var(--radius-card-sm)] bg-brass-wash px-3.5 py-3 text-[13px] text-brass-deep leading-relaxed">
							<Lock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
							Funds route directly to a case-specific account held by the
							attorney. JustUs never takes custody.
						</p>
					</div>
				</div>
			</section>

			{/* AI */}
			<section
				aria-labelledby="ai-heading"
				className="border-border border-b bg-card"
			>
				<div className="mx-auto max-w-[1180px] px-6 py-16 sm:py-20">
					<div className="mx-auto mb-10 max-w-2xl text-center">
						<SectionLabel>AI in every seat</SectionLabel>
						<h2
							id="ai-heading"
							className="font-extrabold text-[clamp(1.75rem,3vw,1.875rem)] text-ink tracking-[-0.02em]"
						>
							AI assists every role. It never decides.
						</h2>
						<p className="mt-3 text-[14.5px] text-ink-soft leading-relaxed">
							Every AI output on the platform is labelled, auditable, and
							advisory. Vetting and moderation rulings are made by a person —
							and people choose their own attorney.
						</p>
					</div>
					<div className="grid gap-px overflow-hidden rounded-[var(--radius-card)] border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
						{aiSeats.map((seat) => (
							<div key={seat.role} className="bg-card p-6">
								<div className="mb-3 flex items-center gap-2">
									<span className="flex size-8 items-center justify-center rounded-lg bg-brass-wash text-brass-deep">
										<Bot className="size-4" aria-hidden="true" />
									</span>
									<span className="font-mono font-semibold text-[11.5px] text-brass-deep uppercase tracking-[0.06em]">
										{seat.role}
									</span>
								</div>
								<h3 className="mb-1.5 font-bold text-[14.5px] text-ink">
									{seat.title}
								</h3>
								<p className="text-[13px] text-muted-foreground leading-relaxed">
									{seat.body}
								</p>
							</div>
						))}
					</div>
				</div>
			</section>

			{/* Trust */}
			<section
				aria-labelledby="trust-heading"
				className="border-border border-b"
			>
				<div className="mx-auto max-w-[1180px] px-6 py-16 sm:py-20">
					<div className="mx-auto mb-10 max-w-2xl text-center">
						<SectionLabel>Built to be checked</SectionLabel>
						<h2
							id="trust-heading"
							className="font-extrabold text-[clamp(1.75rem,3vw,1.875rem)] text-ink tracking-[-0.02em]"
						>
							Built so you never have to take our word for it.
						</h2>
					</div>
					<div className="grid gap-5 sm:grid-cols-2">
						{trustItems.map((item) => (
							<div
								key={item.title}
								className="flex gap-4 rounded-[var(--radius-card)] border border-border bg-card p-6"
							>
								<span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brass-wash text-brass-deep">
									<item.icon className="size-5" aria-hidden="true" />
								</span>
								<div>
									<h3 className="mb-1.5 font-bold text-[15px] text-ink">
										{item.title}
									</h3>
									<p className="text-[13.5px] text-ink-soft leading-relaxed">
										{item.body}
									</p>
								</div>
							</div>
						))}
					</div>
				</div>
			</section>

			{/* FAQ */}
			<section
				id="faq"
				aria-labelledby="faq-heading"
				className="border-border border-b bg-card"
			>
				<div className="mx-auto max-w-[760px] px-6 py-16 sm:py-20">
					<div className="mb-8 text-center">
						<SectionLabel>FAQ</SectionLabel>
						<h2
							id="faq-heading"
							className="font-extrabold text-[30px] text-ink tracking-[-0.02em]"
						>
							Fair questions, straight answers.
						</h2>
						<p className="mt-3 text-[14.5px] text-ink-soft leading-relaxed">
							The ones we hear most. If yours isn't here, ask — we answer donors
							and plaintiffs alike.
						</p>
					</div>
					<LandingFaq />
				</div>
			</section>

			{/* Roles CTA */}
			<section
				id="roles"
				aria-labelledby="roles-heading"
				className="relative overflow-hidden bg-ink text-paper"
			>
				<div
					aria-hidden="true"
					className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,color-mix(in_oklch,var(--brass)_18%,transparent),transparent_60%)]"
				/>
				<div className="relative mx-auto max-w-[1180px] px-6 py-16 sm:py-24">
					<div className="mx-auto mb-10 max-w-2xl text-center">
						<p className="mb-3 font-mono font-semibold text-[12px] text-brass uppercase tracking-[0.08em]">
							Join JustUs
						</p>
						<h2
							id="roles-heading"
							className="font-extrabold text-[clamp(1.75rem,3.6vw,2.625rem)] tracking-[-0.02em]"
						>
							Whoever you are in the fight, start here.
						</h2>
					</div>
					<div className="grid gap-4 md:grid-cols-3">
						{roles.map((role) => (
							<div
								key={role.title}
								className="flex flex-col rounded-[var(--radius-card-lg)] border border-paper/15 bg-paper/[0.07] p-6.5"
							>
								<span className="mb-4 flex size-11 items-center justify-center rounded-xl bg-brass/20 text-brass">
									<role.icon className="size-5" aria-hidden="true" />
								</span>
								<h3 className="mb-2 font-bold text-lg">{role.title}</h3>
								<p className="mb-6 flex-1 text-[13.5px] text-paper/65 leading-relaxed">
									{role.body}
								</p>
								<Link
									href={role.href}
									className={cn(
										buttonVariants({ size: "lg" }),
										"w-full bg-brass text-brass-ink hover:bg-brass/90",
									)}
								>
									{role.cta}
									<ArrowRight data-icon="inline-end" aria-hidden="true" />
								</Link>
							</div>
						))}
					</div>
				</div>
			</section>

			{/* Footer */}
			<footer className="bg-ink text-paper">
				<div className="mx-auto max-w-[1180px] px-6 pt-14 pb-10">
					<div className="flex flex-col gap-10 border-paper/15 border-b pb-9 sm:flex-row sm:justify-between">
						<div className="max-w-sm">
							<div className="mb-4 flex items-center gap-3">
								<Brandmark size={36} />
								<div>
									<p className="font-bold text-lg">JustUs</p>
									<p className="font-mono text-[11px] text-paper/55 uppercase tracking-[0.1em]">
										Litigation crowdfunding
									</p>
								</div>
							</div>
							<p className="text-[13.5px] text-paper/60 leading-relaxed">
								Funding access to justice — so the merit of a case matters more
								than the size of a bank account.
							</p>
						</div>
						<nav
							aria-label="Footer"
							className="flex flex-wrap gap-x-7 gap-y-3 text-paper/65 text-sm"
						>
							<Link href="/#how" className="hover:text-paper">
								How it works
							</Link>
							<Link href="/cases" className="hover:text-paper">
								Browse cases
							</Link>
							<Link href="/attorneys" className="hover:text-paper">
								Attorneys
							</Link>
							<Link href="/#faq" className="hover:text-paper">
								FAQ
							</Link>
							<Link href="/login" className="hover:text-paper">
								Sign in
							</Link>
							<Link href="/terms" className="hover:text-paper">
								Terms of Service
							</Link>
							<Link href="/privacy" className="hover:text-paper">
								Privacy Policy
							</Link>
						</nav>
					</div>
					<p className="mt-8 max-w-3xl text-[12px] text-paper/45 leading-relaxed">
						Donations made through JustUs are gifts. They are not investments,
						carry no financial return, and grant no share of any settlement or
						judgment. JustUs never takes custody of donated funds — they route
						directly to the retained attorney's case account. A transparent 5%
						platform fee is shown before you confirm.
					</p>
				</div>
			</footer>
		</main>
	);
}
