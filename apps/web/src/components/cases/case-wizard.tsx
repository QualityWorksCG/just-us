// biome-ignore-all lint/performance/noImgElement: previews are object-URL blobs of user uploads, not static assets next/image can optimize
"use client";

import { Button } from "@just-us/ui/components/button";
import { Input } from "@just-us/ui/components/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@just-us/ui/components/select";
import { Textarea } from "@just-us/ui/components/textarea";
import { cn } from "@just-us/ui/lib/utils";
import {
	ArrowLeft,
	ArrowRight,
	Check,
	CircleCheck,
	Eye,
	FileText,
	Handshake,
	ImageIcon,
	Link2,
	Lock,
	Mail,
	Megaphone,
	MessageCircle,
	Pencil,
	Plus,
	Rocket,
	Scale,
	Search,
	Send,
	Share2,
	Sparkles,
	TriangleAlert,
	Upload,
	UserPlus,
	X,
} from "lucide-react";
import { useId, useRef, useState } from "react";
import { toast } from "sonner";

import { createCaseAction } from "@/app/cases/actions";
import { Brandmark } from "@/components/brandmark";

type View = "wizard" | "preview" | "success";
type Attorney = {
	name: string;
	firm: string;
	area: string;
	location: string;
	quote?: string;
};

const STEPS = [
	{ n: 1, label: "The basics" },
	{ n: 2, label: "Your story" },
	{ n: 3, label: "Attorney & goal" },
	{ n: 4, label: "Review & publish" },
] as const;

const CATEGORIES = [
	"Employment",
	"Wage & hours",
	"Housing",
	"Consumer fraud",
	"Elder care",
	"Civil rights",
	"Personal injury",
	"Other",
];

const LOCATIONS = [
	"Austin, TX · 78701",
	"Newark, NJ · 07102",
	"New York, NY · 10001",
	"Atlanta, GA · 30301",
];

const INTERESTED: Attorney = {
	name: "Daniel Osei",
	firm: "Osei Legal Group",
	area: "Employment law",
	location: "New Jersey",
	quote: "I handle wage-and-hour cases in NJ and have room to take yours on.",
};

const AI_SUGGESTION =
	"For two years, my shifts regularly ran past clock-out — but those hours never appeared as overtime on my pay. I raised it with my supervisor twice and nothing changed. After I filed a formal complaint, my hours were cut, and a month later I was let go.";

function money(n: number) {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		maximumFractionDigits: 0,
	}).format(n);
}

function formatSize(bytes: number) {
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function ThinBar({ pct = 0 }: { pct?: number }) {
	return (
		<div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
			<div
				className="h-full rounded-full bg-brass"
				style={{ width: `${Math.max(2, Math.min(100, pct))}%` }}
			/>
		</div>
	);
}

export function CaseWizard({ name }: { name: string }) {
	const ids = {
		title: useId(),
		summary: useId(),
		story: useId(),
		fee: useId(),
		manual: useId(),
	};
	const firstName = name.trim().split(" ")[0] || "there";

	const [view, setView] = useState<View>("wizard");
	const [step, setStep] = useState(1);

	// Step 1
	const [title, setTitle] = useState("");
	const [category, setCategory] = useState("Employment");
	const [location, setLocation] = useState(LOCATIONS[0]);
	const [summary, setSummary] = useState("");
	const [coverUrl, setCoverUrl] = useState<string | null>(null);
	const [moreImages, setMoreImages] = useState<string[]>([]);

	// Step 2
	const [story, setStory] = useState("");
	const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
	const [evidence, setEvidence] = useState<{ name: string; size: number }[]>(
		[],
	);

	// Step 3
	const [attorney, setAttorney] = useState<Attorney | null>(null);
	const [dismissedInterested, setDismissedInterested] = useState(false);
	const [showManual, setShowManual] = useState(false);
	const [manualName, setManualName] = useState("");
	const [fee, setFee] = useState("");
	const [publishing, setPublishing] = useState(false);

	const coverInput = useRef<HTMLInputElement>(null);
	const moreInput = useRef<HTMLInputElement>(null);
	const evidenceInput = useRef<HTMLInputElement>(null);

	const goal = Number(fee.replace(/[^0-9.]/g, "")) || 0;
	const displayTitle = title.trim() || "Your case title";
	const attorneyName = attorney?.name ?? "your attorney";

	function next() {
		if (step === 1) {
			if (!title.trim()) return toast.error("Give your case a title.");
			if (!summary.trim()) return toast.error("Add a one-line summary.");
		}
		if (step === 3) {
			if (!attorney)
				return toast.error("Choose an attorney to represent your case.");
			if (!goal) return toast.error("Enter the agreed fee.");
		}
		setStep((s) => Math.min(4, s + 1));
		window.scrollTo({ top: 0 });
	}

	function back() {
		if (step === 1) {
			window.location.assign("/dashboard");
			return;
		}
		setStep((s) => Math.max(1, s - 1));
		window.scrollTo({ top: 0 });
	}

	async function publish() {
		if (!coverUrl) return toast.error("Add a cover image before publishing.");
		if (!attorney || !goal)
			return toast.error("Choose an attorney and set the fee first.");
		const storyText = story.trim();
		if (storyText.length < 10) {
			toast.error("Add your story before publishing.");
			setView("wizard");
			setStep(2);
			return;
		}

		setPublishing(true);
		const result = await createCaseAction({
			title: title.trim(),
			category,
			location,
			summary: summary.trim(),
			story: storyText,
			goalCents: Math.round(goal * 100),
			attorney,
			evidence,
		});
		if (result.ok) {
			setView("success");
			window.scrollTo({ top: 0 });
		} else {
			toast.error(result.error);
			setPublishing(false);
		}
	}

	function acceptInterested() {
		setAttorney(INTERESTED);
		if (!fee) setFee("18,500");
		toast.success(`${INTERESTED.name} added as your attorney.`);
	}

	function refineWithAI() {
		if (story.trim().length < 12)
			return toast.error("Write a little of your story first.");
		setAiSuggestion(AI_SUGGESTION);
	}

	function onPickCover(e: React.ChangeEvent<HTMLInputElement>) {
		const f = e.target.files?.[0];
		if (f) setCoverUrl(URL.createObjectURL(f));
	}
	function onPickMore(e: React.ChangeEvent<HTMLInputElement>) {
		const urls = Array.from(e.target.files ?? []).map((f) =>
			URL.createObjectURL(f),
		);
		setMoreImages((p) => [...p, ...urls].slice(0, 6));
	}
	function onPickEvidence(e: React.ChangeEvent<HTMLInputElement>) {
		const files = Array.from(e.target.files ?? []).map((f) => ({
			name: f.name,
			size: f.size,
		}));
		setEvidence((p) => [...p, ...files]);
	}

	function copyLink() {
		const url =
			typeof window !== "undefined" ? `${window.location.origin}/cases` : "";
		navigator.clipboard?.writeText(url);
		toast.success("Link copied to clipboard.");
	}

	// ─────────────────────────────────────────── Success view
	if (view === "success") {
		return (
			<div className="min-h-svh bg-surface px-6 py-16">
				<div className="mx-auto max-w-[620px] text-center">
					<div className="relative mx-auto mb-6 flex size-[92px] items-center justify-center">
						<span
							aria-hidden="true"
							className="absolute inset-0 rounded-full bg-[radial-gradient(circle,color-mix(in_oklch,var(--brass)_28%,transparent),transparent_70%)]"
						/>
						<span className="relative flex size-16 items-center justify-center rounded-full bg-brass text-white">
							<Rocket className="size-7" aria-hidden="true" />
						</span>
					</div>
					<p className="mb-3 font-mono font-semibold text-[12px] text-brass-deep uppercase tracking-[0.14em]">
						Your campaign is live
					</p>
					<h1 className="font-extrabold text-[clamp(1.875rem,3.6vw,2.75rem)] text-ink tracking-[-0.03em]">
						You're one step closer to justice.
					</h1>
					<p className="mx-auto mt-3 max-w-[460px] text-[15px] text-ink-soft leading-relaxed">
						Your case is live and ready for backers, {firstName}. Share it far
						and wide — every gift brings your day in court closer.
					</p>

					<div className="mt-8 rounded-[var(--radius-card-lg)] border border-border bg-surface p-5 text-left shadow-[var(--shadow-rest)]">
						<div className="mb-2 flex items-center justify-between">
							<span className="inline-flex items-center gap-1.5 font-mono font-semibold text-[11px] text-success uppercase tracking-[0.08em]">
								<span className="size-1.5 rounded-full bg-success" />
								Live now
							</span>
							<span className="font-semibold text-[13px] text-ink tabular-nums">
								{money(0)} of {money(goal)}
							</span>
						</div>
						<p className="mb-2.5 font-bold text-[15px] text-ink">
							{displayTitle}
						</p>
						<ThinBar pct={0} />
						<p className="mt-2.5 text-[12.5px] text-muted-foreground">
							with {attorneyName} · 0 donors
						</p>
					</div>

					<p className="mt-8 mb-3 text-[13px] text-muted-foreground">
						Share to get your first backers
					</p>
					<div className="flex items-center justify-center gap-2.5">
						<button
							type="button"
							onClick={copyLink}
							className="inline-flex h-11 items-center gap-2 rounded-[var(--radius-pill)] border border-border bg-surface px-4 font-semibold text-[13.5px] text-ink transition-colors hover:border-line-strong"
						>
							<Link2 className="size-4" aria-hidden="true" />
							Copy link
						</button>
						{[
							{ icon: Send, label: "Share on X" },
							{ icon: Share2, label: "Share on Facebook" },
							{ icon: MessageCircle, label: "Share on WhatsApp" },
							{ icon: Mail, label: "Share by email" },
						].map((s) => (
							<button
								key={s.label}
								type="button"
								aria-label={s.label}
								onClick={() => toast.success("Sharing link copied.")}
								className="flex size-11 items-center justify-center rounded-full border border-border bg-surface text-ink-soft transition-colors hover:border-line-strong hover:text-ink"
							>
								<s.icon className="size-4" aria-hidden="true" />
							</button>
						))}
					</div>

					<div className="mt-8">
						<Button
							size="lg"
							className="px-6"
							onClick={() => setView("preview")}
						>
							<ArrowRight data-icon="inline-start" aria-hidden="true" />
							View your campaign
						</Button>
					</div>
				</div>
			</div>
		);
	}

	// ─────────────────────────────────────────── Preview view
	if (view === "preview") {
		return (
			<div className="min-h-svh bg-surface">
				{/* Preview chrome */}
				<div className="sticky top-0 z-20 flex items-center justify-between gap-4 bg-dark px-6 py-3 text-dark-fg sm:px-10">
					<div className="flex items-center gap-2.5">
						<Eye className="size-4 text-brass-on-dark" aria-hidden="true" />
						<div className="leading-tight">
							<p className="font-mono font-semibold text-[11px] text-brass-on-dark uppercase tracking-[0.12em]">
								Preview mode
							</p>
							<p className="text-[12px] text-dark-fg-soft">
								Only you can see this — your case isn't live yet.
							</p>
						</div>
					</div>
					<div className="flex items-center gap-2.5">
						<Button
							variant="outline"
							size="sm"
							className="h-9 border-dark-fg/20 bg-transparent px-3.5 text-dark-fg hover:bg-dark-fg/10 hover:text-dark-fg"
							onClick={() => {
								setView("wizard");
								setStep(4);
							}}
						>
							<Pencil data-icon="inline-start" aria-hidden="true" />
							Back to editing
						</Button>
						<Button
							size="sm"
							className="h-9 px-3.5"
							onClick={publish}
							disabled={publishing}
						>
							<Rocket data-icon="inline-start" aria-hidden="true" />
							{publishing ? "Publishing…" : "Publish case"}
						</Button>
					</div>
				</div>

				<div className="mx-auto grid max-w-[1100px] gap-10 px-6 py-10 sm:px-10 lg:grid-cols-[1.5fr_0.9fr]">
					<div>
						<div className="mb-3 flex flex-wrap gap-2">
							<span className="rounded-[var(--radius-chip)] bg-brass-wash px-2.5 py-1 font-semibold text-[12px] text-brass-deep">
								{category}
							</span>
							<span className="rounded-[var(--radius-chip)] border border-border px-2.5 py-1 text-[12px] text-ink-soft">
								{location.split(" · ")[0]}
							</span>
						</div>
						<h1 className="font-extrabold text-[clamp(1.75rem,3.4vw,2.5rem)] text-ink leading-[1.05] tracking-[-0.03em]">
							{displayTitle}
						</h1>
						<div className="mt-3 flex items-center gap-2.5 text-[14px]">
							<span className="flex size-7 items-center justify-center rounded-full bg-success font-bold text-[11px] text-white">
								{firstName.slice(0, 2).toUpperCase()}
							</span>
							<span className="font-semibold text-ink">{firstName} M.</span>
							{attorney && (
								<span className="text-muted-foreground">
									· with {attorney.name}, Esq.
								</span>
							)}
						</div>

						<div className="mt-6 aspect-[16/9] overflow-hidden rounded-[var(--radius-card-lg)] border border-border bg-surface-2">
							{coverUrl ? (
								<img
									src={coverUrl}
									alt={displayTitle}
									className="size-full object-cover"
								/>
							) : (
								<div className="flex size-full items-center justify-center text-muted-foreground">
									<ImageIcon className="size-8" aria-hidden="true" />
								</div>
							)}
						</div>

						<h2 className="mt-8 mb-2 font-bold text-ink text-lg">The story</h2>
						<div className="space-y-3 text-[14.5px] text-ink-soft leading-relaxed">
							{(story.trim() ? story : AI_SUGGESTION)
								.split("\n")
								.filter(Boolean)
								.map((para) => (
									<p key={para.slice(0, 24)}>{para}</p>
								))}
						</div>

						<h2 className="mt-8 mb-3 font-bold text-ink text-lg">
							Case updates
						</h2>
						<div className="flex flex-col items-center gap-1.5 rounded-[var(--radius-card-lg)] border border-border border-dashed bg-surface/50 px-6 py-10 text-center">
							<Megaphone
								className="size-6 text-muted-foreground"
								aria-hidden="true"
							/>
							<p className="font-bold text-[14px] text-ink">No updates yet</p>
							<p className="max-w-[42ch] text-[13px] text-muted-foreground leading-relaxed">
								Your attorney posts updates here as the case moves — every
								backer gets notified.
							</p>
						</div>

						<h2 className="mt-8 mb-3 font-bold text-ink text-lg">
							Represented by
						</h2>
						<div className="flex items-center gap-3.5 rounded-[var(--radius-card-lg)] border border-border bg-surface p-5">
							<span className="flex size-11 items-center justify-center rounded-full bg-brass font-bold text-[13px] text-white">
								{(attorney?.name ?? "N A")
									.split(" ")
									.map((w) => w[0])
									.join("")
									.slice(0, 2)}
							</span>
							<div>
								<p className="font-bold text-[15px] text-ink">
									{attorney ? `${attorney.name}, Esq.` : "No attorney yet"}
								</p>
								<p className="text-[13px] text-muted-foreground">
									{attorney
										? `${attorney.firm} · ${attorney.area} · ${attorney.location}`
										: "Choose your attorney in the previous step."}
								</p>
							</div>
						</div>
					</div>

					{/* Sidebar */}
					<aside className="lg:sticky lg:top-24 lg:self-start">
						<div className="rounded-[var(--radius-card-lg)] border border-border bg-surface p-6 shadow-[var(--shadow-rest)]">
							<p className="font-extrabold text-[32px] text-ink tracking-[-0.02em]">
								{money(0)}
							</p>
							<p className="mb-3 text-[13px] text-muted-foreground">
								raised of {money(goal)} goal
							</p>
							<ThinBar pct={0} />
							<p className="mt-3 mb-4 text-[13px] text-ink-soft">
								0 donors · just launched
							</p>
							<Button size="lg" className="w-full">
								<Handshake data-icon="inline-start" aria-hidden="true" />
								Back this case
							</Button>
							<Button variant="outline" size="lg" className="mt-2.5 w-full">
								<Link2 data-icon="inline-start" aria-hidden="true" />
								Share
							</Button>
						</div>
						<ul className="mt-4 flex flex-col gap-3 rounded-[var(--radius-card-lg)] border border-border bg-surface/60 p-5">
							<li className="flex items-center gap-2.5 text-[13px] text-ink-soft">
								<Handshake
									className="size-4 shrink-0 text-brass-deep"
									aria-hidden="true"
								/>
								You chose your own attorney
							</li>
							<li className="flex items-center gap-2.5 text-[13px] text-ink-soft">
								<Lock
									className="size-4 shrink-0 text-brass-deep"
									aria-hidden="true"
								/>
								Funds land in your account — you pay your attorney
							</li>
							<li className="flex items-center gap-2.5 text-[13px] text-ink-soft">
								<Eye
									className="size-4 shrink-0 text-brass-deep"
									aria-hidden="true"
								/>
								One 5% fee, shown upfront
							</li>
						</ul>
					</aside>
				</div>
			</div>
		);
	}

	// ─────────────────────────────────────────── Wizard view
	const inputClass =
		"h-11 rounded-[var(--radius-control)] border border-line-strong bg-surface px-3 text-[14px]";

	return (
		<div className="flex min-h-svh bg-surface">
			{/* Sidebar */}
			<aside className="hidden w-[260px] shrink-0 flex-col justify-between border-border border-r px-6 py-6 lg:flex">
				<div>
					<div className="mb-8 flex items-center gap-2.5">
						<Brandmark size={30} />
						<span className="font-bold text-[15px] tracking-tight">JustUs</span>
					</div>
					<p className="mb-4 font-mono font-semibold text-[11px] text-muted-foreground uppercase tracking-[0.12em]">
						Create your case
					</p>
					<ol className="flex flex-col gap-1">
						{STEPS.map((s) => {
							const state =
								step === s.n ? "active" : step > s.n ? "done" : "todo";
							return (
								<li key={s.n}>
									<div
										className={cn(
											"flex items-center gap-3 rounded-[var(--radius-control)] px-3 py-2.5 text-[14px]",
											state === "active"
												? "bg-brass-wash font-bold text-ink"
												: "font-medium text-ink-soft",
										)}
									>
										<span
											className={cn(
												"flex size-6 shrink-0 items-center justify-center rounded-full text-[12px]",
												state === "done" && "bg-success text-white",
												state === "active" && "bg-brass font-bold text-white",
												state === "todo" &&
													"border border-line-strong text-muted-foreground",
											)}
										>
											{state === "done" ? (
												<Check className="size-3.5" aria-hidden="true" />
											) : (
												s.n
											)}
										</span>
										{s.label}
									</div>
								</li>
							);
						})}
					</ol>
				</div>
				<button
					type="button"
					onClick={() => window.location.assign("/dashboard")}
					className="flex items-center gap-2 font-medium text-[13px] text-muted-foreground transition-colors hover:text-ink"
				>
					<ArrowLeft className="size-4" aria-hidden="true" />
					Save & exit
				</button>
			</aside>

			{/* Main */}
			<div className="flex min-w-0 flex-1 flex-col">
				<main className="flex-1 px-6 py-10 sm:px-12">
					<div className="mx-auto max-w-[720px]">
						<p className="mb-2 font-mono font-semibold text-[12px] text-brass-deep uppercase tracking-[0.1em]">
							Step {step} of 4
						</p>

						{step === 1 && (
							<>
								<h1 className="font-extrabold text-[clamp(1.75rem,3vw,2.375rem)] text-ink tracking-[-0.03em]">
									Let's create your case, {firstName}.
								</h1>
								<p className="mt-2.5 max-w-[560px] text-[15px] text-ink-soft leading-relaxed">
									Start with the basics — you can edit anything before it goes
									live. Nothing is public until a person reviews it and you hit
									publish.
								</p>

								<div className="mt-8 flex flex-col gap-6">
									<Field label="Case title" htmlFor={ids.title}>
										<Input
											id={ids.title}
											className={inputClass}
											value={title}
											onChange={(e) => setTitle(e.target.value)}
											placeholder="e.g. Fired for reporting safety violations at a food plant"
										/>
									</Field>

									<div className="grid gap-5 sm:grid-cols-2">
										<Field label="Category">
											<Select
												value={category}
												onValueChange={(v: string | null) =>
													setCategory(v ?? "Employment")
												}
											>
												<SelectTrigger className="h-11 text-[14px]">
													<SelectValue placeholder="Select a category" />
												</SelectTrigger>
												<SelectContent>
													{CATEGORIES.map((c) => (
														<SelectItem
															key={c}
															value={c}
															className="text-[14px]"
														>
															{c}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										</Field>
										<Field
											label="Location"
											hint="Prefilled from your payout location"
										>
											<Select
												value={location}
												onValueChange={(v: string | null) =>
													setLocation(v ?? LOCATIONS[0])
												}
											>
												<SelectTrigger className="h-11 text-[14px]">
													<SelectValue placeholder="Select a location" />
												</SelectTrigger>
												<SelectContent>
													{LOCATIONS.map((l) => (
														<SelectItem
															key={l}
															value={l}
															className="text-[14px]"
														>
															{l}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										</Field>
									</div>

									<Field label="One-line summary" htmlFor={ids.summary}>
										<Input
											id={ids.summary}
											className={inputClass}
											value={summary}
											onChange={(e) => setSummary(e.target.value)}
											placeholder="What happened, in one sentence — this is what donors see first."
										/>
									</Field>

									<div>
										<p className="mb-1.5 font-semibold text-[13px] text-ink">
											Cover image<span className="ml-0.5 text-danger">*</span>
										</p>
										<button
											type="button"
											onClick={() => coverInput.current?.click()}
											className="flex w-full flex-col items-center gap-2 rounded-[var(--radius-card-lg)] border border-line-strong border-dashed bg-surface px-6 py-10 text-center transition-colors hover:bg-surface-2/50"
										>
											{coverUrl ? (
												<img
													src={coverUrl}
													alt="Cover preview"
													className="max-h-40 rounded-[var(--radius-card-sm)] object-contain"
												/>
											) : (
												<>
													<span className="flex size-11 items-center justify-center rounded-xl bg-brass-wash text-brass-deep">
														<ImageIcon className="size-5" aria-hidden="true" />
													</span>
													<span className="font-bold text-[14px] text-ink">
														Add a cover image
													</span>
													<span className="text-[12.5px] text-muted-foreground">
														Drag &amp; drop or browse · JPG or PNG · 1600×900
														recommended
													</span>
												</>
											)}
										</button>
										<input
											ref={coverInput}
											type="file"
											accept="image/*"
											hidden
											onChange={onPickCover}
										/>
									</div>

									<div>
										<p className="font-semibold text-[13px] text-ink">
											More images{" "}
											<span className="font-normal text-muted-foreground">
												· optional
											</span>
										</p>
										<p className="mt-0.5 mb-3 text-[12.5px] text-muted-foreground">
											Add up to 6 — photos or scans that help tell your story.
										</p>
										<div className="flex flex-wrap gap-3">
											{moreImages.map((url) => (
												<div
													key={url}
													className="relative size-[92px] overflow-hidden rounded-[var(--radius-card-sm)] border border-border"
												>
													<img
														src={url}
														alt="Case attachment"
														className="size-full object-cover"
													/>
													<button
														type="button"
														aria-label="Remove image"
														onClick={() =>
															setMoreImages((p) => p.filter((u) => u !== url))
														}
														className="absolute top-1 right-1 flex size-5 items-center justify-center rounded-full bg-ink/70 text-white"
													>
														<X className="size-3" aria-hidden="true" />
													</button>
												</div>
											))}
											{moreImages.length < 6 && (
												<button
													type="button"
													onClick={() => moreInput.current?.click()}
													className="flex size-[92px] flex-col items-center justify-center gap-1 rounded-[var(--radius-card-sm)] border border-line-strong border-dashed text-muted-foreground transition-colors hover:text-ink"
												>
													<Plus className="size-5" aria-hidden="true" />
													<span className="text-[12px]">Add</span>
												</button>
											)}
										</div>
										<input
											ref={moreInput}
											type="file"
											accept="image/*"
											multiple
											hidden
											onChange={onPickMore}
										/>
										<p className="mt-4 text-[12.5px] text-muted-foreground">
											<span className="text-danger">*</span> Required to publish
											your case
										</p>
									</div>
								</div>
							</>
						)}

						{step === 2 && (
							<>
								<h1 className="font-extrabold text-[clamp(1.75rem,3vw,2.375rem)] text-ink tracking-[-0.03em]">
									What happened?
								</h1>
								<p className="mt-2.5 max-w-[560px] text-[15px] text-ink-soft leading-relaxed">
									Tell it in your own words — this is the heart of your case. Be
									specific about who, what, and when. You can edit it anytime
									before publishing.
								</p>

								<div className="mt-8 flex flex-col gap-6">
									<div>
										<p className="mb-1.5 font-semibold text-[13px] text-ink">
											Your story
										</p>
										<div className="rounded-[var(--radius-card-lg)] border border-line-strong bg-surface p-1.5">
											<Textarea
												id={ids.story}
												value={story}
												onChange={(e) => setStory(e.target.value)}
												placeholder="Start with what happened and how it affected you. Include dates, names, and anything you can back up with evidence…"
												className="min-h-[130px] rounded-[var(--radius-card-sm)] border-0 bg-transparent px-3 py-2.5 text-[14px] focus-visible:ring-0"
											/>
											<div className="flex items-center justify-between px-2 pt-1 pb-1.5">
												<span className="text-[12px] text-muted-foreground">
													AI keeps your facts &amp; your voice
												</span>
												<Button
													type="button"
													variant="secondary"
													size="sm"
													className="h-8"
													onClick={refineWithAI}
												>
													<Sparkles
														data-icon="inline-start"
														aria-hidden="true"
													/>
													Refine with AI
												</Button>
											</div>
										</div>
									</div>

									{aiSuggestion && (
										<div className="rounded-[var(--radius-card-lg)] border border-brass bg-brass-wash/40 p-5">
											<div className="mb-3 flex items-center gap-2.5">
												<span className="flex size-8 items-center justify-center rounded-lg bg-brass text-white">
													<Sparkles className="size-4" aria-hidden="true" />
												</span>
												<span className="font-bold text-[14px] text-ink">
													AI suggestion
												</span>
												<span className="rounded-[var(--radius-chip)] border border-brass-deep/40 px-2 py-0.5 font-mono font-semibold text-[10px] text-brass-deep uppercase tracking-[0.08em]">
													AI-generated
												</span>
											</div>
											<p className="text-[14px] text-ink leading-relaxed">
												“{aiSuggestion}”
											</p>
											<div className="mt-4 flex flex-wrap gap-2.5">
												<Button
													type="button"
													size="sm"
													className="h-9"
													onClick={() => {
														setStory(aiSuggestion);
														setAiSuggestion(null);
														toast.success("Applied the refined version.");
													}}
												>
													<Check data-icon="inline-start" aria-hidden="true" />
													Use this version
												</Button>
												<Button
													type="button"
													variant="outline"
													size="sm"
													className="h-9"
													onClick={() => setAiSuggestion(null)}
												>
													Keep mine
												</Button>
												<Button
													type="button"
													variant="ghost"
													size="sm"
													className="h-9"
													onClick={() => toast.success("Rewriting…")}
												>
													Try again
												</Button>
											</div>
											<p className="mt-3 text-[12px] text-muted-foreground leading-relaxed">
												AI only tightens clarity and structure — your facts and
												voice stay yours. Nothing changes until you accept.
											</p>
										</div>
									)}

									<div>
										<p className="mb-1.5 font-semibold text-[13px] text-ink">
											Evidence{" "}
											<span className="font-normal text-muted-foreground">
												(optional)
											</span>
										</p>
										<button
											type="button"
											onClick={() => evidenceInput.current?.click()}
											className="flex w-full flex-col items-center gap-1.5 rounded-[var(--radius-card-lg)] border border-line-strong border-dashed bg-surface px-6 py-8 text-center transition-colors hover:bg-surface-2/50"
										>
											<Upload
												className="size-5 text-brass-deep"
												aria-hidden="true"
											/>
											<span className="font-bold text-[14px] text-ink">
												Drag files here, or browse
											</span>
											<span className="text-[12.5px] text-muted-foreground">
												PDF, JPG, PNG · up to 25MB each
											</span>
										</button>
										<input
											ref={evidenceInput}
											type="file"
											accept=".pdf,image/*"
											multiple
											hidden
											onChange={onPickEvidence}
										/>
										{evidence.map((f) => (
											<div
												key={f.name}
												className="mt-2.5 flex items-center gap-2.5 rounded-[var(--radius-control)] border border-border bg-surface px-3.5 py-2.5"
											>
												<FileText
													className="size-4 text-brass-deep"
													aria-hidden="true"
												/>
												<span className="flex-1 truncate text-[13.5px] text-ink">
													{f.name}
												</span>
												<span className="text-[12px] text-muted-foreground tabular-nums">
													{formatSize(f.size)}
												</span>
												<button
													type="button"
													aria-label="Remove file"
													onClick={() =>
														setEvidence((p) =>
															p.filter((x) => x.name !== f.name),
														)
													}
													className="text-muted-foreground hover:text-ink"
												>
													<X className="size-4" aria-hidden="true" />
												</button>
											</div>
										))}
									</div>

									<p className="flex gap-2.5 rounded-[var(--radius-card-sm)] bg-green-soft px-4 py-3 text-[13px] text-green-deep leading-relaxed">
										<Sparkles
											className="mt-0.5 size-4 shrink-0 text-success"
											aria-hidden="true"
										/>
										AI checks your story for completeness and flags what's
										missing — it never blocks you. You decide what to publish.
									</p>
								</div>
							</>
						)}

						{step === 3 && (
							<>
								<h1 className="font-extrabold text-[clamp(1.75rem,3vw,2.375rem)] text-ink tracking-[-0.03em]">
									Choose your attorney &amp; set the fee.
								</h1>
								<p className="mt-2.5 max-w-[600px] text-[15px] text-ink-soft leading-relaxed">
									Accept an interested attorney, browse the directory, or bring
									your own — then agree the fee. It becomes your funding goal.
								</p>

								<div className="mt-6 flex gap-2.5 rounded-[var(--radius-control)] border border-warn/50 bg-warn/10 px-4 py-3 text-[13px] text-ink leading-relaxed">
									<TriangleAlert
										className="mt-0.5 size-4 shrink-0 text-warn-deep"
										aria-hidden="true"
									/>
									You're responsible for vetting any attorney you choose. JustUs
									can't confirm their bar standing for you — verify it yourself
									before accepting.
								</div>

								{!dismissedInterested && !attorney && (
									<>
										<p className="mt-6 mb-2.5 font-mono font-semibold text-[11px] text-brass-deep uppercase tracking-[0.1em]">
											Interested in your case
										</p>
										<div className="flex items-center gap-4 rounded-[var(--radius-card-lg)] border border-brass bg-brass-wash/40 p-4">
											<span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brass font-bold text-[13px] text-white">
												DO
											</span>
											<div className="min-w-0 flex-1">
												<p className="text-[14px]">
													<span className="font-bold text-ink">
														{INTERESTED.name}
													</span>{" "}
													<span className="text-muted-foreground">
														{INTERESTED.area} · {INTERESTED.location}
													</span>
												</p>
												<p className="mt-0.5 text-[13px] text-ink-soft italic">
													“{INTERESTED.quote}”
												</p>
											</div>
											<div className="flex shrink-0 items-center gap-2">
												<Button
													type="button"
													size="sm"
													className="h-9"
													onClick={acceptInterested}
												>
													<Check data-icon="inline-start" aria-hidden="true" />
													Accept
												</Button>
												<Button
													type="button"
													variant="outline"
													size="sm"
													className="h-9"
													onClick={() => toast.success("Opening profile…")}
												>
													View
												</Button>
												<button
													type="button"
													aria-label="Dismiss"
													onClick={() => setDismissedInterested(true)}
													className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:text-ink"
												>
													<X className="size-4" aria-hidden="true" />
												</button>
											</div>
										</div>
									</>
								)}

								{attorney && (
									<div className="mt-6 flex items-center gap-4 rounded-[var(--radius-card-lg)] border border-brass bg-brass-wash/40 p-4">
										<span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brass text-white">
											<Check className="size-5" aria-hidden="true" />
										</span>
										<div className="min-w-0 flex-1">
											<p className="font-bold text-[14px] text-ink">
												{attorney.name} · {attorney.area}
											</p>
											<p className="text-[13px] text-muted-foreground">
												{attorney.firm} · {attorney.location}
											</p>
										</div>
										<Button
											type="button"
											variant="ghost"
											size="sm"
											onClick={() => setAttorney(null)}
										>
											Change
										</Button>
									</div>
								)}

								<div className="mt-5 grid gap-4 sm:grid-cols-2">
									<OptionCard
										icon={Search}
										title="Browse the directory"
										body="Compare profiles and reviews, then reach out."
										cta="Open directory"
										onClick={() =>
											toast.success("The directory is coming soon.")
										}
									/>
									<OptionCard
										icon={UserPlus}
										title="I have an attorney"
										body="Add their details to invite them."
										cta="Add their details"
										onClick={() => setShowManual((v) => !v)}
									/>
								</div>

								{showManual && (
									<div className="mt-4 flex items-end gap-3 rounded-[var(--radius-card-lg)] border border-border bg-surface p-4">
										<div className="flex-1">
											<label
												htmlFor={ids.manual}
												className="mb-1.5 block font-semibold text-[13px] text-ink"
											>
												Attorney's name
											</label>
											<Input
												id={ids.manual}
												className={inputClass}
												value={manualName}
												onChange={(e) => setManualName(e.target.value)}
												placeholder="Jordan Rivera"
											/>
										</div>
										<Button
											type="button"
											onClick={() => {
												if (!manualName.trim())
													return toast.error("Enter their name.");
												setAttorney({
													name: manualName.trim(),
													firm: "Invited",
													area: category,
													location: location.split(" · ")[0],
												});
												setShowManual(false);
												toast.success("Attorney invited.");
											}}
										>
											Invite
										</Button>
									</div>
								)}

								<hr className="my-7 border-border" />

								<div className="max-w-[320px]">
									<label
										htmlFor={ids.fee}
										className="mb-1.5 block font-semibold text-[13px] text-ink"
									>
										Agreed fee (USD)
										<span className="ml-0.5 text-danger">*</span>
									</label>
									<div className="relative">
										<span className="absolute top-1/2 left-3 -translate-y-1/2 text-[14px] text-muted-foreground">
											$
										</span>
										<Input
											id={ids.fee}
											inputMode="numeric"
											className={cn(inputClass, "pl-7")}
											value={fee}
											onChange={(e) => setFee(e.target.value)}
											placeholder="18,500"
										/>
									</div>
								</div>

								<div className="mt-4 flex gap-2.5 rounded-[var(--radius-card-sm)] bg-brass-wash/60 px-4 py-3.5">
									<Scale
										className="mt-0.5 size-4 shrink-0 text-brass-deep"
										aria-hidden="true"
									/>
									<div className="text-[13px] leading-relaxed">
										<p className="font-bold text-ink">
											Your funding goal is {money(goal)}
										</p>
										<p className="text-ink-soft">
											The most that's ever raised — it lands in your account,
											then you pay your attorney.
										</p>
									</div>
								</div>
							</>
						)}

						{step === 4 && (
							<>
								<h1 className="font-extrabold text-[clamp(1.75rem,3vw,2.375rem)] text-ink tracking-[-0.03em]">
									Ready to go live?
								</h1>
								<p className="mt-2.5 max-w-[600px] text-[15px] text-ink-soft leading-relaxed">
									This is exactly what donors will see. Publish when you're
									ready — your campaign goes live right away.
								</p>

								<p className="mt-7 mb-2.5 font-mono font-semibold text-[11px] text-muted-foreground uppercase tracking-[0.1em]">
									Public preview
								</p>
								<div className="rounded-[var(--radius-card-lg)] border border-border bg-surface p-5 shadow-[var(--shadow-rest)]">
									<div className="mb-2.5 flex flex-wrap gap-2">
										<span className="rounded-[var(--radius-chip)] bg-brass-wash px-2.5 py-1 font-semibold text-[12px] text-brass-deep">
											{category}
										</span>
										<span className="rounded-[var(--radius-chip)] border border-border px-2.5 py-1 text-[12px] text-ink-soft">
											{location.split(" · ")[0]}
										</span>
									</div>
									<h3 className="font-bold text-[18px] text-ink">
										{displayTitle}
									</h3>
									{summary.trim() && (
										<p className="mt-1.5 text-[13.5px] text-ink-soft leading-relaxed">
											{summary}
										</p>
									)}
									<p className="mt-2.5 text-[13px] text-muted-foreground">
										You{attorney ? ` · with ${attorney.name}` : ""}
									</p>
									<div className="mt-3">
										<ThinBar pct={0} />
										<div className="mt-2 flex items-center justify-between text-[12.5px]">
											<span className="font-bold text-ink tabular-nums">
												{money(0)} of {money(goal)}
											</span>
											<span className="text-muted-foreground">
												Goal set · 0 donors
											</span>
										</div>
									</div>
								</div>

								<Button
									type="button"
									variant="outline"
									className="mt-4"
									onClick={() => setView("preview")}
								>
									<Eye data-icon="inline-start" aria-hidden="true" />
									Preview full campaign
								</Button>

								<div className="mt-6 rounded-[var(--radius-card-lg)] bg-green-soft p-5">
									<p className="mb-3 font-mono font-semibold text-[11px] text-green-deep uppercase tracking-[0.1em]">
										Ready to publish
									</p>
									<ul className="flex flex-col gap-2.5">
										{[
											"Title & one-line summary",
											"Your story",
											`Evidence attached (${evidence.length} file${evidence.length === 1 ? "" : "s"})`,
											"Attorney chosen · fee agreed",
										].map((item) => (
											<li
												key={item}
												className="flex items-center gap-2.5 text-[13.5px] text-green-deep"
											>
												<CircleCheck
													className="size-4 shrink-0 text-success"
													aria-hidden="true"
												/>
												{item}
											</li>
										))}
									</ul>
								</div>
							</>
						)}
					</div>
				</main>

				{/* Action bar */}
				<div className="sticky bottom-0 border-border border-t bg-surface/95 px-6 py-4 backdrop-blur-md sm:px-12">
					<div className="mx-auto flex max-w-[720px] items-center justify-between gap-4">
						<Button type="button" variant="outline" size="lg" onClick={back}>
							<ArrowLeft data-icon="inline-start" aria-hidden="true" />
							Back
						</Button>
						{step < 4 ? (
							<Button type="button" size="lg" className="px-6" onClick={next}>
								Continue
								<ArrowRight data-icon="inline-end" aria-hidden="true" />
							</Button>
						) : (
							<Button
								type="button"
								size="lg"
								className="px-6"
								onClick={publish}
								disabled={publishing}
							>
								<Rocket data-icon="inline-start" aria-hidden="true" />
								{publishing ? "Publishing…" : "Publish & go live"}
							</Button>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}

function Field({
	label,
	htmlFor,
	hint,
	children,
}: {
	label: string;
	htmlFor?: string;
	hint?: string;
	children: React.ReactNode;
}) {
	return (
		<div className="flex flex-col gap-1.5">
			<label htmlFor={htmlFor} className="font-semibold text-[13px] text-ink">
				{label}
			</label>
			{children}
			{hint && <p className="text-[12px] text-muted-foreground">{hint}</p>}
		</div>
	);
}

function OptionCard({
	icon: Icon,
	title,
	body,
	cta,
	onClick,
}: {
	icon: typeof Search;
	title: string;
	body: string;
	cta: string;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className="flex flex-col rounded-[var(--radius-card-lg)] border border-border bg-surface p-5 text-left transition-colors hover:border-line-strong"
		>
			<span className="mb-3 flex size-10 items-center justify-center rounded-xl bg-brass-wash text-brass-deep">
				<Icon className="size-5" aria-hidden="true" />
			</span>
			<span className="font-bold text-[15px] text-ink">{title}</span>
			<span className="mt-1 text-[13px] text-ink-soft leading-relaxed">
				{body}
			</span>
			<span className="mt-3 inline-flex items-center gap-1.5 font-semibold text-[13px] text-brass-deep">
				{cta}
				<ArrowRight className="size-3.5" aria-hidden="true" />
			</span>
		</button>
	);
}
