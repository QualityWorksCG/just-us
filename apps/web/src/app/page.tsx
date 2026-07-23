import { buttonVariants } from "@just-us/ui/components/button";
import { cn } from "@just-us/ui/lib/utils";
import {
	ArrowRight,
	BadgeCheck,
	Check,
	CircleCheck,
	Eye,
	FileText,
	Gavel,
	Heart,
	HeartHandshake,
	Lock,
	Pencil,
	Quote,
	Scale,
	ShieldCheck,
	Sparkles,
	Star,
	Users,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { Brandmark } from "@/components/brandmark";
import { CountUp } from "@/components/count-up";
import { LandingFaq } from "@/components/landing-faq";
import { Reveal } from "@/components/reveal";

const howSteps = [
	{
		num: "01",
		icon: FileText,
		title: "Tell what happened",
		body: "Share your story and evidence — we vet every case before it goes public.",
	},
	{
		num: "02",
		icon: Scale,
		title: "Choose your attorney",
		body: "Compare bar-verified attorneys and agree a set fee together.",
	},
	{
		num: "03",
		icon: Users,
		title: "Fund it together",
		body: "The agreed fee becomes the goal, funded dollar by dollar.",
	},
	{
		num: "04",
		icon: HeartHandshake,
		title: "Follow it to the end",
		body: "Your attorney posts updates through to the outcome.",
	},
] as const;

const featuredCase = {
	title: "Mom's call button went unanswered for hours",
	category: "Elder care",
	jurisdiction: "Florida",
	img: "/images/case-eldercare.png",
	blurb:
		"“The home ignored her for hours. When mum's care needs slipped, we asked — and 356 strangers decided it mattered too.”",
	owner: "The Calloway family",
	attorney: "Miriam Solis",
	raised: 19760,
	goal: 22000,
	donors: 356,
} as const;

const sideCases = [
	{
		title: "Fired for reporting safety violations at a food plant",
		category: "Employment",
		attorney: "Marcus Bell",
		img: "/images/case-employment.png",
		raised: 12340,
		goal: 18600,
		donors: 84,
	},
	{
		title: "A contractor took my roof deposit and vanished",
		category: "Consumer fraud",
		attorney: "Walter Griggs",
		img: "/images/case-consumer.png",
		raised: 6690,
		goal: 7200,
		donors: 93,
	},
] as const;

const impactStats = [
	{ value: 1240, label: "cases fully funded" },
	{
		value: 14.6,
		prefix: "$",
		suffix: "M",
		decimals: 1,
		label: "raised by donors",
	},
	{ value: 38000, label: "people chipped in" },
] as const;

const promises = [
	{
		stat: "100%",
		title: "Donations are gifts",
		body: "No return, no strings.",
		icon: Heart,
		accent: "brass" as const,
	},
	{
		stat: "$0",
		title: "We never hold the money",
		body: "It routes straight to the attorney.",
		icon: Lock,
		accent: "green" as const,
	},
	{
		stat: "5%",
		title: "One flat fee",
		body: "Never a cut of fees or settlements.",
		icon: Scale,
		accent: "brass" as const,
	},
] as const;

const trustItems = [
	{
		icon: ShieldCheck,
		title: "Every case is vetted",
		body: "Cases are screened before they can be listed or funded, with people reviewing anything flagged.",
		badge: "AI-screened, human reviewed",
	},
	{
		icon: BadgeCheck,
		title: "Every attorney is bar-verified",
		body: "Attorneys confirm their bar standing per jurisdiction before their profile goes live.",
		badge: "Bar-checked per jurisdiction",
	},
	{
		icon: Lock,
		title: "Funds we never touch",
		body: "Donations settle straight into the attorney's case-specific account.",
		badge: "Stripe Connect · $0 to JustUs",
	},
	{
		icon: Eye,
		title: "Radical fee transparency",
		body: "One flat fee, no hidden spreads, and no cut of any settlement.",
		badge: "5% shown to the cent",
	},
] as const;

const roles = [
	{
		icon: FileText,
		eyebrow: "For the wronged",
		title: "Plaintiff",
		body: "Submit your case, choose your attorney, and raise the agreed fee together.",
		cta: "Start your case",
		href: "/login",
	},
	{
		icon: Heart,
		eyebrow: "For supporters",
		title: "Donor",
		body: "Give any amount to a vetted case, and follow every update to the outcome.",
		cta: "Become a donor",
		href: "/cases",
	},
	{
		icon: Gavel,
		eyebrow: "For advocates",
		title: "Attorney",
		body: "List in the directory, take the cases you choose, and keep the fee you agreed.",
		cta: "Join as attorney",
		href: "/attorneys",
	},
] as const;

const startPaths = [
	{
		icon: Pencil,
		title: "Been wronged?",
		body: "Submit your case free. A person vets it, you choose your attorney, and the public funds the agreed fee.",
		meta: "Free to submit · vetted before it's public",
		cta: "Start your case",
		href: "/login",
		badge: "Most start here",
	},
	{
		icon: Heart,
		title: "Fund someone's day in court",
		body: "Give any amount to a vetted case. One transparent 5% fee, and every update until the outcome.",
		meta: "Any amount · one flat 5% fee",
		cta: "Become a donor",
		href: "/cases",
	},
	{
		icon: Scale,
		title: "Practice law that matters",
		body: "List the vetted, fundable cases you choose — with the fee raised before you file.",
		meta: "Bar-verified · funded before you file",
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

function ProgressBar({
	value,
	max,
	className,
}: {
	value: number;
	max: number;
	className?: string;
}) {
	const pct = Math.min(100, Math.round((value / max) * 100));
	return (
		<div
			className={cn("h-2 overflow-hidden rounded-full bg-surface-2", className)}
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

function DonorAvatars() {
	const tones = [
		"from-brass to-brass-deep",
		"from-brass-deep to-ink",
		"from-surface-2 to-brass",
		"from-brass-wash to-brass-deep",
		"from-ink to-brass-deep",
	];
	return (
		<div className="flex items-center -space-x-2">
			{tones.map((tone, i) => (
				<span
					key={tone}
					className={cn(
						"size-8 rounded-full border-2 border-paper bg-gradient-to-br",
						tone,
					)}
					style={{ zIndex: tones.length - i }}
					aria-hidden="true"
				/>
			))}
		</div>
	);
}

function HeroVisual() {
	return (
		<div className="relative mx-auto w-full max-w-[560px] pb-6">
			{/* Gold backing panel for depth */}
			<div
				aria-hidden="true"
				className="absolute -bottom-3 -left-5 h-[64%] w-[56%] rounded-[var(--radius-modal)] bg-gold-bright"
			/>

			{/* Collage: one tall photo + two stacked tiles */}
			<div className="relative grid aspect-[7/6] grid-cols-[1.12fr_0.88fr] grid-rows-[1.4fr_1fr] gap-3.5">
				{/* Main — attorney meeting a client */}
				<div className="relative row-span-2 overflow-hidden rounded-[var(--radius-modal)] border border-border bg-surface-2 shadow-[var(--shadow-hero)]">
					<Image
						src="/images/hero.png"
						alt="An attorney meeting with a client"
						fill
						priority
						sizes="(min-width: 1024px) 300px, 60vw"
						className="object-cover"
					/>
					<span className="absolute top-4 left-4 inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-card/95 px-3 py-1.5 font-semibold text-[12px] text-ink shadow-[var(--shadow-float)] backdrop-blur">
						<ShieldCheck className="size-3.5 text-success" aria-hidden="true" />
						Every case is vetted
					</span>
				</div>

				{/* Top-right — courthouse / exterior (placeholder image) */}
				<div className="relative overflow-hidden rounded-[var(--radius-modal)] border border-border bg-surface-2 shadow-[var(--shadow-rest)]">
					<Image
						src="/images/courthouse.png"
						alt="A courthouse building"
						fill
						sizes="(min-width: 1024px) 220px, 40vw"
						className="object-cover"
					/>
					<span className="absolute top-3 right-3 inline-flex animate-[ju-fade_1s_var(--ease-rise)_0.7s_both] items-center gap-1.5 rounded-[var(--radius-pill)] bg-card/95 px-3 py-1.5 font-semibold text-[12px] text-ink shadow-[var(--shadow-float)] backdrop-blur">
						<Heart className="size-3.5 text-brass-deep" aria-hidden="true" />
						Anita just gave $50
					</span>
				</div>

				{/* Bottom-right — signing a case agreement (placeholder image) */}
				<div className="relative overflow-hidden rounded-[var(--radius-modal)] border border-border bg-surface-2 shadow-[var(--shadow-rest)]">
					<Image
						src="/images/signing.png"
						alt="A client signing a case agreement"
						fill
						sizes="(min-width: 1024px) 220px, 40vw"
						className="object-cover"
					/>
				</div>
			</div>

			{/* Funded card, overlapping the bottom — gently floats */}
			<div className="absolute -bottom-2 left-1/2 w-[76%] max-w-[360px] -translate-x-1/2">
				<div className="ju-float rounded-[var(--radius-card)] border border-border bg-card p-4 shadow-[var(--shadow-drop)]">
					<span className="font-mono text-[11px] text-muted-foreground uppercase tracking-[0.06em]">
						Reyes family · Housing · Texas
					</span>
					<p className="mt-1 mb-2.5 font-bold text-[15px] text-ink">
						Fully funded in 31 days
					</p>
					<ProgressBar value={100} max={100} />
					<div className="mt-2.5 flex items-center justify-between text-[12.5px]">
						<span className="font-bold text-ink tabular-nums">
							{money(18600)} raised
						</span>
						<span className="text-muted-foreground">573 donors</span>
					</div>
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
				<div className="relative mx-auto grid max-w-[1180px] items-center gap-12 px-6 pt-16 pb-24 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:pt-20 lg:pb-28">
					<div>
						<div className="mb-5 inline-flex animate-[ju-rise_0.7s_var(--ease-rise)_0.05s_both] items-center gap-2 rounded-[var(--radius-pill)] border border-border bg-surface px-3.5 py-1.5 font-semibold text-[12.5px] text-ink shadow-[var(--shadow-rest)]">
							<Sparkles
								className="size-3.5 text-brass-deep"
								aria-hidden="true"
							/>
							1,240 cases funded and counting
						</div>
						<h1 className="max-w-[16ch] animate-[ju-rise_0.8s_var(--ease-rise)_0.14s_both] font-extrabold text-[clamp(2.5rem,5.5vw,4rem)] text-ink leading-[0.98] tracking-[-0.035em]">
							Justice shouldn't depend on your{" "}
							<span className="text-brass">bank balance.</span>
						</h1>
						<p className="mt-5 max-w-[480px] animate-[ju-rise_0.8s_var(--ease-rise)_0.24s_both] text-[16.5px] text-ink-soft leading-relaxed">
							Choose your own attorney, agree a fair fee, and let the public
							fund your day in court.
						</p>
						<div className="mt-7 flex animate-[ju-rise_0.8s_var(--ease-rise)_0.34s_both] flex-col gap-3 sm:flex-row">
							<Link
								href="/login"
								className={cn(
									buttonVariants({ size: "lg" }),
									"w-full sm:w-auto",
								)}
							>
								<Pencil data-icon="inline-start" aria-hidden="true" />
								Start your case
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
						<div className="mt-8 flex animate-[ju-rise_0.8s_var(--ease-rise)_0.44s_both] items-center gap-3.5">
							<div className="flex -space-x-2.5">
								{[
									{ letter: "A", tone: "bg-brass" },
									{ letter: "M", tone: "bg-success" },
									{ letter: "J", tone: "bg-ink" },
								].map((a) => (
									<span
										key={a.letter}
										className={cn(
											"flex size-9 items-center justify-center rounded-full border-2 border-paper font-bold text-[13px] text-white",
											a.tone,
										)}
										aria-hidden="true"
									>
										{a.letter}
									</span>
								))}
							</div>
							<div className="leading-tight">
								<div className="flex gap-0.5" aria-hidden="true">
									{Array.from({ length: 5 }).map((_, i) => (
										<Star
											key={`star-${i}`}
											className="size-3.5 fill-brass text-brass"
										/>
									))}
								</div>
								<p className="mt-1 font-semibold text-[13px] text-ink">
									Loved by 38,000+ donors
								</p>
							</div>
						</div>
					</div>
					<div className="hidden animate-[ju-fade_1s_var(--ease-rise)_0.3s_both] pb-6 lg:block lg:pb-0">
						<HeroVisual />
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
						{howSteps.map((step, i) => (
							<Reveal
								as="li"
								key={step.num}
								delay={i * 90}
								className="rounded-[var(--radius-card)] border border-border bg-paper p-[22px]"
							>
								<div className="mb-4 flex items-center justify-between">
									<span className="flex size-[42px] items-center justify-center rounded-xl bg-brass-wash text-brass-deep">
										<step.icon className="size-5" aria-hidden="true" />
									</span>
									<span className="font-display font-extrabold text-[40px] text-brass/25 leading-none tracking-[-0.03em]">
										{step.num}
									</span>
								</div>
								<h3 className="mb-1.5 font-bold text-base text-ink">
									{step.title}
								</h3>
								<p className="text-[13.5px] text-ink-soft leading-relaxed">
									{step.body}
								</p>
							</Reveal>
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
					<div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
						{/* Featured large card */}
						<Link
							href="/cases"
							className="group flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-border bg-card shadow-[var(--shadow-rest)] transition-[transform,box-shadow,border-color] duration-[var(--dur-base)] hover:-translate-y-0.5 hover:border-line-strong hover:shadow-[var(--shadow-hover)]"
						>
							<div className="relative h-[220px] overflow-hidden bg-surface-2">
								<Image
									src={featuredCase.img}
									alt={featuredCase.title}
									fill
									sizes="(min-width: 1024px) 620px, 100vw"
									className="object-cover transition-transform duration-[var(--dur-base)] group-hover:scale-[1.03]"
								/>
								<span className="absolute top-4 left-4 inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-card/95 px-3 py-1 font-semibold text-[12px] text-success shadow-[var(--shadow-float)] backdrop-blur">
									<Check className="size-3.5" aria-hidden="true" />
									Closed to the goal
								</span>
							</div>
							<div className="flex flex-1 flex-col p-6">
								<div className="mb-2.5 flex flex-wrap gap-1.5">
									<span className="rounded-[var(--radius-chip)] bg-brass-wash px-2 py-0.5 font-semibold text-[12px] text-brass-deep">
										{featuredCase.category}
									</span>
									<span className="rounded-[var(--radius-chip)] border border-border px-2 py-0.5 text-[12px] text-ink-soft">
										{featuredCase.jurisdiction}
									</span>
								</div>
								<h3 className="mb-2 font-bold text-[19px] text-ink leading-snug">
									{featuredCase.title}
								</h3>
								<p className="mb-4 text-[13.5px] text-ink-soft leading-relaxed">
									{featuredCase.blurb}
								</p>
								<p className="mb-4 text-[13px] text-muted-foreground">
									{featuredCase.owner} · with {featuredCase.attorney}
								</p>
								<div className="mt-auto">
									<div className="mb-3 flex items-center gap-2.5">
										<DonorAvatars />
										<span className="font-semibold text-[12.5px] text-ink-soft">
											{featuredCase.donors} donors
										</span>
									</div>
									<ProgressBar
										value={featuredCase.raised}
										max={featuredCase.goal}
									/>
									<div className="mt-2.5 flex justify-between text-[12.5px] text-ink-soft">
										<span className="font-bold tabular-nums">
											{money(featuredCase.raised)} of {money(featuredCase.goal)}
										</span>
										<span className="text-muted-foreground">
											{Math.round(
												(featuredCase.raised / featuredCase.goal) * 100,
											)}
											% funded
										</span>
									</div>
								</div>
							</div>
						</Link>

						{/* Side cases */}
						<div className="grid gap-5">
							{sideCases.map((c) => (
								<Link
									key={c.title}
									href="/cases"
									className="group flex gap-4 rounded-[var(--radius-card)] border border-border bg-card p-4 shadow-[var(--shadow-rest)] transition-[transform,box-shadow,border-color] duration-[var(--dur-base)] hover:-translate-y-0.5 hover:border-line-strong hover:shadow-[var(--shadow-hover)]"
								>
									<div className="relative min-h-[128px] w-[132px] shrink-0 self-stretch overflow-hidden rounded-[var(--radius-card-sm)] bg-surface-2">
										<Image
											src={c.img}
											alt={c.title}
											fill
											sizes="132px"
											className="object-cover"
										/>
									</div>
									<div className="flex min-w-0 flex-col">
										<span className="mb-1.5 w-fit rounded-[var(--radius-chip)] bg-brass-wash px-2 py-0.5 font-semibold text-[11.5px] text-brass-deep">
											{c.category}
										</span>
										<h3 className="mb-1 font-bold text-[14.5px] text-ink leading-snug">
											{c.title}
										</h3>
										<p className="mb-2 text-[12px] text-muted-foreground">
											with {c.attorney}
										</p>
										<div className="mt-auto">
											<ProgressBar
												value={c.raised}
												max={c.goal}
												className="h-1.5"
											/>
											<div className="mt-1.5 flex justify-between text-[12px] text-ink-soft">
												<span className="font-bold tabular-nums">
													{money(c.raised)} of {money(c.goal)}
												</span>
												<span>{c.donors} donors</span>
											</div>
										</div>
									</div>
								</Link>
							))}
						</div>
					</div>
				</div>
			</section>

			{/* Impact stats band */}
			<section
				aria-labelledby="impact-heading"
				className="border-border border-b bg-gold-bright text-gold-bright-ink"
			>
				<div className="mx-auto grid max-w-[1180px] items-center gap-10 px-6 py-16 sm:py-20 lg:grid-cols-[1fr_0.8fr]">
					<div>
						<h2
							id="impact-heading"
							className="max-w-[18ch] font-extrabold text-[clamp(1.75rem,3.4vw,2.375rem)] leading-[1.08] tracking-[-0.02em]"
						>
							When enough people care, justice gets funded.
						</h2>
						<p className="mt-4 max-w-[440px] text-[14.5px] text-gold-bright-ink/75 leading-relaxed">
							No one funds a case alone. Small gifts from many people add up to
							a lawyer, a filing, and a day in court.
						</p>
						<dl className="mt-8 flex flex-wrap gap-x-12 gap-y-6">
							{impactStats.map((stat) => (
								<div key={stat.label}>
									<dt className="font-display font-extrabold text-[clamp(1.75rem,3vw,2.25rem)] tabular-nums tracking-[-0.02em]">
										<CountUp
											value={stat.value}
											prefix={"prefix" in stat ? stat.prefix : undefined}
											suffix={"suffix" in stat ? stat.suffix : undefined}
											decimals={"decimals" in stat ? stat.decimals : 0}
										/>
									</dt>
									<dd className="mt-0.5 text-[13px] text-gold-bright-ink/70">
										{stat.label}
									</dd>
								</div>
							))}
						</dl>
					</div>
					<div className="relative hidden aspect-[5/4] overflow-hidden rounded-[var(--radius-modal)] bg-surface-2 shadow-[var(--shadow-hero)] lg:block">
						<Image
							src="/images/impact.png"
							alt="Supporters celebrating together outside a courthouse"
							fill
							sizes="(min-width: 1024px) 420px, 0px"
							className="object-cover"
						/>
					</div>
				</div>
			</section>

			{/* Three promises */}
			<section
				id="guardrails"
				aria-labelledby="guardrails-heading"
				className="bg-dark text-dark-fg"
			>
				<div className="mx-auto max-w-[1180px] px-6 py-16 sm:py-24">
					<h2
						id="guardrails-heading"
						className="mb-12 max-w-[560px] font-extrabold text-[clamp(1.75rem,3vw,2rem)] tracking-[-0.02em]"
					>
						Three promises we build the whole platform around.
					</h2>
					<div className="grid gap-5 sm:grid-cols-3">
						{promises.map((p, i) => (
							<Reveal
								key={p.title}
								delay={i * 120}
								variant="scale"
								className="relative overflow-hidden rounded-[var(--radius-card-lg)] border border-dark-fg/12 bg-dark-card/40 p-7"
							>
								<p.icon
									className="pointer-events-none absolute -right-4 -bottom-4 size-28 text-dark-fg/[0.055]"
									aria-hidden="true"
								/>
								<p
									className={cn(
										"font-display font-extrabold text-[clamp(2.75rem,6vw,3.5rem)] leading-none tracking-[-0.03em]",
										p.accent === "green"
											? "text-green-on-dark"
											: "text-brass-on-dark",
									)}
								>
									{p.stat}
								</p>
								<h3 className="mt-4 font-bold text-dark-fg text-lg">
									{p.title}
								</h3>
								<p className="mt-1 text-[13.5px] text-dark-fg-soft leading-relaxed">
									{p.body}
								</p>
							</Reveal>
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
					<div className="rounded-[var(--radius-card)] border border-border bg-card p-6 shadow-[var(--shadow-rest)]">
						<p className="mb-4 font-mono text-[12px] text-muted-foreground uppercase tracking-[0.08em]">
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

			{/* Trust */}
			<section
				aria-labelledby="trust-heading"
				className="border-border border-b bg-paper-alt"
			>
				<div className="mx-auto max-w-[1180px] px-6 py-16 sm:py-20">
					<div className="mb-10 max-w-2xl">
						<h2
							id="trust-heading"
							className="font-extrabold text-[clamp(1.75rem,3vw,1.875rem)] text-ink tracking-[-0.02em]"
						>
							Built so you never have to take our word for it.
						</h2>
					</div>
					<div className="grid gap-5 sm:grid-cols-2">
						{trustItems.map((item, i) => (
							<Reveal
								key={item.title}
								delay={(i % 2) * 90}
								className="flex gap-4 rounded-[var(--radius-card)] border border-border bg-surface p-6 shadow-[var(--shadow-rest)]"
							>
								<span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-green-soft text-green-deep">
									<item.icon className="size-5" aria-hidden="true" />
								</span>
								<div>
									<h3 className="mb-1.5 font-bold text-[15px] text-ink">
										{item.title}
									</h3>
									<p className="mb-3 text-[13.5px] text-ink-soft leading-relaxed">
										{item.body}
									</p>
									<span className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-green-soft px-2.5 py-1 font-semibold text-[11.5px] text-green-deep">
										<Check className="size-3 text-success" aria-hidden="true" />
										{item.badge}
									</span>
								</div>
							</Reveal>
						))}
					</div>
				</div>
			</section>

			{/* Three parties */}
			<section
				aria-labelledby="roles-heading"
				className="border-border border-b"
			>
				<div className="mx-auto max-w-[1180px] px-6 py-16 sm:py-20">
					<div className="mb-10 max-w-xl">
						<h2
							id="roles-heading"
							className="font-extrabold text-[clamp(1.75rem,3vw,1.875rem)] text-ink tracking-[-0.02em]"
						>
							Three parties. One outcome.
						</h2>
					</div>
					<div className="grid gap-5 md:grid-cols-3">
						{roles.map((role, i) => (
							<Reveal
								key={role.title}
								delay={i * 110}
								className="flex flex-col rounded-[var(--radius-card-lg)] border border-border bg-card p-7 shadow-[var(--shadow-rest)]"
							>
								<span className="mb-5 flex size-14 items-center justify-center rounded-full bg-brass-wash text-brass-deep">
									<role.icon className="size-6" aria-hidden="true" />
								</span>
								<p className="mb-1 font-mono font-semibold text-[11.5px] text-brass-deep uppercase tracking-[0.06em]">
									{role.eyebrow}
								</p>
								<h3 className="mb-2 font-bold text-ink text-lg">
									{role.title}
								</h3>
								<p className="mb-6 flex-1 text-[13.5px] text-ink-soft leading-relaxed">
									{role.body}
								</p>
								<Link
									href={role.href}
									className={cn(
										buttonVariants({ variant: "outline" }),
										"w-full",
									)}
								>
									{role.cta}
									<ArrowRight data-icon="inline-end" aria-hidden="true" />
								</Link>
							</Reveal>
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
				<div className="mx-auto grid max-w-[1180px] gap-10 px-6 py-16 sm:py-20 lg:grid-cols-[0.8fr_1.2fr] lg:gap-14">
					<div>
						<h2
							id="faq-heading"
							className="font-extrabold text-[clamp(1.75rem,3vw,1.875rem)] text-ink tracking-[-0.02em]"
						>
							Fair questions, straight answers.
						</h2>
						<p className="mt-3 max-w-[380px] text-[14.5px] text-ink-soft leading-relaxed">
							The ones we hear most. If yours isn't here, ask — we answer donors
							and plaintiffs alike.
						</p>
						<figure className="mt-8 rounded-[var(--radius-card)] border border-[color-mix(in_oklch,var(--success)_28%,var(--green-soft))] bg-green-soft p-5">
							<Quote className="size-5 text-success" aria-hidden="true" />
							<blockquote className="mt-3 text-[14px] text-green-deep leading-relaxed">
								“I never thought strangers would fund my case. They did — and my
								attorney never stopped updating me.”
							</blockquote>
							<figcaption className="mt-3 font-semibold text-[12.5px] text-[color-mix(in_oklch,var(--green-deep)_78%,transparent)]">
								Denise O. · Plaintiff, Georgia
							</figcaption>
						</figure>
					</div>
					<LandingFaq />
				</div>
			</section>

			{/* Start here CTA */}
			<section
				id="start"
				aria-labelledby="start-heading"
				className="relative overflow-hidden bg-gold-bright text-gold-bright-ink"
			>
				<div
					aria-hidden="true"
					className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,color-mix(in_oklch,var(--gold-bright-ink)_10%,transparent),transparent_60%)]"
				/>
				<div className="relative mx-auto max-w-[1180px] px-6 py-16 sm:py-24">
					<div className="mx-auto mb-10 max-w-2xl text-center">
						<h2
							id="start-heading"
							className="font-extrabold text-[clamp(1.75rem,3.6vw,2.625rem)] tracking-[-0.02em]"
						>
							Whoever you are in the fight, start here.
						</h2>
						<p className="mt-3 text-[14.5px] text-gold-bright-ink/75">
							Three ways in — and every one of them is free to start.
						</p>
					</div>
					<div className="grid gap-4 md:grid-cols-3">
						{startPaths.map((path, i) => (
							<Reveal
								key={path.title}
								delay={i * 110}
								variant="scale"
								className="flex flex-col rounded-[var(--radius-card-lg)] border border-gold-bright-ink/10 bg-surface p-6.5 shadow-[var(--shadow-rest)]"
							>
								<div className="mb-4 flex items-center justify-between gap-2">
									<span className="flex size-11 items-center justify-center rounded-xl bg-brass-wash text-brass-deep">
										<path.icon className="size-5" aria-hidden="true" />
									</span>
									{"badge" in path && (
										<span className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-brass-wash px-2.5 py-1 font-semibold text-[11px] text-brass-deep uppercase tracking-[0.06em]">
											<Star className="size-3" aria-hidden="true" />
											{path.badge}
										</span>
									)}
								</div>
								<h3 className="mb-2 font-bold text-ink text-lg">
									{path.title}
								</h3>
								<p className="mb-6 flex-1 text-[13.5px] text-ink-soft leading-relaxed">
									{path.body}
								</p>
								<p className="mb-4 flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
									<CircleCheck
										className="size-3.5 shrink-0"
										aria-hidden="true"
									/>
									{path.meta}
								</p>
								<Link
									href={path.href}
									className={cn(buttonVariants({ size: "lg" }), "w-full")}
								>
									<path.icon data-icon="inline-start" aria-hidden="true" />
									{path.cta}
								</Link>
							</Reveal>
						))}
					</div>
				</div>
			</section>

			{/* Footer */}
			<footer className="bg-dark-deep text-dark-fg">
				<div className="mx-auto max-w-[1180px] px-6 pt-14 pb-10">
					<div className="grid gap-10 border-dark-fg/15 border-b pb-9 sm:grid-cols-[1.4fr_1fr_1fr]">
						<div className="max-w-sm">
							<div className="mb-4 flex items-center gap-3">
								<Brandmark size={36} />
								<div>
									<p className="font-bold text-lg">JustUs Financial</p>
									<p className="font-mono text-[11px] text-dark-fg/55 uppercase tracking-[0.1em]">
										Litigation crowdfunding
									</p>
								</div>
							</div>
							<p className="text-[13.5px] text-dark-fg/60 leading-relaxed">
								Funding access to justice — so the merit of a case matters more
								than the size of a bank account.
							</p>
						</div>
						<nav aria-label="Platform" className="flex flex-col gap-3">
							<p className="font-mono font-semibold text-[11px] text-dark-fg/45 uppercase tracking-[0.1em]">
								Platform
							</p>
							<Link
								href="/cases"
								className="text-[13.5px] text-dark-fg/70 hover:text-dark-fg"
							>
								Browse cases
							</Link>
							<Link
								href="/#how"
								className="text-[13.5px] text-dark-fg/70 hover:text-dark-fg"
							>
								How it works
							</Link>
							<Link
								href="/attorneys"
								className="text-[13.5px] text-dark-fg/70 hover:text-dark-fg"
							>
								For attorneys
							</Link>
						</nav>
						<nav aria-label="Legal" className="flex flex-col gap-3">
							<p className="font-mono font-semibold text-[11px] text-dark-fg/45 uppercase tracking-[0.1em]">
								Legal
							</p>
							<Link
								href="/#guardrails"
								className="text-[13.5px] text-dark-fg/70 hover:text-dark-fg"
							>
								Our guardrails
							</Link>
							<Link
								href="/terms"
								className="text-[13.5px] text-dark-fg/70 hover:text-dark-fg"
							>
								Terms of Service
							</Link>
							<Link
								href="/privacy"
								className="text-[13.5px] text-dark-fg/70 hover:text-dark-fg"
							>
								Privacy Policy
							</Link>
						</nav>
					</div>
					<div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
						<p className="max-w-3xl text-[12px] text-dark-fg/45 leading-relaxed">
							Donations made through JustUs are gifts — not investments. They
							carry no financial return and grant no share of any settlement or
							judgment. JustUs never takes custody of donated funds.
						</p>
						<p className="shrink-0 font-mono text-[11px] text-dark-fg/45">
							© 2026 JustUs Financial LLC · Phase 1
						</p>
					</div>
				</div>
			</footer>
		</main>
	);
}
