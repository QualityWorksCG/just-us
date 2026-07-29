// biome-ignore-all lint/performance/noImgElement: user-uploaded Blob images aren't static assets next/image can optimize
"use client";

import { US_STATES } from "@just-us/auth/jurisdiction";
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
import { upload } from "@vercel/blob/client";
import {
	Eye,
	Heart,
	ImageIcon,
	Link2,
	type LucideIcon,
	Mail,
	Megaphone,
	MessageCircle,
	Plus,
	Rocket,
	Save,
	Scale,
	Send,
	Share2,
	Sparkles,
	Target,
	Trash2,
	TrendingUp,
	Upload,
	X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import {
	deleteOwnedCaseAction,
	recordShareAction,
	updateCaseDetailsAction,
} from "@/app/cases/actions";

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

export type ManageCaseData = {
	id: string;
	title: string;
	category: string;
	location: string;
	summary: string;
	story: string;
	status: string;
	goalCents: number;
	raisedCents: number;
	donorsCount: number;
	viewsCount: number;
	sharesCount: number;
	coverImageUrl: string | null;
	images: string[];
	attorneyName: string | null;
	attorneyFirm: string | null;
	attorneyArea: string | null;
	attorneyLocation: string | null;
};

function money(n: number) {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		maximumFractionDigits: 0,
	}).format(n);
}

async function uploadImage(file: File): Promise<string> {
	const blob = await upload(file.name, file, {
		access: "public",
		handleUploadUrl: "/api/cases/upload",
	});
	return blob.url;
}

type MetricTone = "green" | "tan" | "dark" | "gold";
const METRIC_TONES: Record<
	MetricTone,
	{ card: string; chip: string; value: string; label: string }
> = {
	green: {
		card: "bg-green-soft",
		chip: "bg-surface text-green-deep",
		value: "text-ink",
		label: "text-green-deep/80",
	},
	tan: {
		card: "bg-brass-wash",
		chip: "bg-surface text-brass-deep",
		value: "text-ink",
		label: "text-brass-deep/80",
	},
	dark: {
		card: "bg-dark",
		chip: "bg-dark-fg/10 text-gold-bright",
		value: "text-gold-bright",
		label: "text-dark-fg/70",
	},
	gold: {
		card: "bg-gold-bright",
		chip: "bg-surface/60 text-gold-bright-ink",
		value: "text-gold-bright-ink",
		label: "text-gold-bright-ink/75",
	},
};

function Metric({
	icon: Icon,
	label,
	value,
	tone,
}: {
	icon: LucideIcon;
	label: string;
	value: string;
	tone: MetricTone;
}) {
	const t = METRIC_TONES[tone];
	return (
		<div
			className={cn(
				"rounded-[var(--radius-card)] border border-transparent p-5 shadow-[var(--shadow-rest)]",
				t.card,
			)}
		>
			<span
				className={cn(
					"mb-3 flex size-9 items-center justify-center rounded-lg",
					t.chip,
				)}
			>
				<Icon className="size-[18px]" aria-hidden="true" />
			</span>
			<p
				className={cn(
					"font-extrabold text-[26px] tabular-nums leading-none tracking-[-0.02em]",
					t.value,
				)}
			>
				{value}
			</p>
			<p className={cn("mt-1.5 text-[12.5px]", t.label)}>{label}</p>
		</div>
	);
}

export function ManageCase({ data }: { data: ManageCaseData }) {
	const router = useRouter();
	const ids = {
		title: useId(),
		summary: useId(),
		story: useId(),
	};

	const [tab, setTab] = useState<"overview" | "edit">("overview");

	const [title, setTitle] = useState(data.title);
	const [category, setCategory] = useState(data.category || CATEGORIES[0]);
	const [state, setState] = useState(data.location);
	const [summary, setSummary] = useState(data.summary);
	const [story, setStory] = useState(data.story);
	const [coverUrl, setCoverUrl] = useState<string | null>(data.coverImageUrl);
	const [images, setImages] = useState<string[]>(data.images);
	const [uploadingCover, setUploadingCover] = useState(false);
	const [uploadingMore, setUploadingMore] = useState(false);
	const [shares, setShares] = useState(data.sharesCount);

	const [saving, startSaving] = useTransition();
	const [deleting, startDeleting] = useTransition();
	const [confirmOpen, setConfirmOpen] = useState(false);

	const coverInput = useRef<HTMLInputElement>(null);
	const moreInput = useRef<HTMLInputElement>(null);

	const isLive = data.status === "live";
	const isSeeking = data.status === "seeking";
	const goal = data.goalCents / 100;
	const raised = data.raisedCents / 100;
	const pct = goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : 0;
	const attorneyMeta =
		[data.attorneyArea, data.attorneyLocation, data.attorneyFirm]
			.filter(Boolean)
			.join(" · ") || "—";

	const dirty =
		title !== data.title ||
		category !== data.category ||
		state !== data.location ||
		summary !== data.summary ||
		story !== data.story ||
		coverUrl !== data.coverImageUrl ||
		images.join("|") !== data.images.join("|");

	async function onPickCover(e: React.ChangeEvent<HTMLInputElement>) {
		const f = e.target.files?.[0];
		if (!f) return;
		setUploadingCover(true);
		try {
			setCoverUrl(await uploadImage(f));
		} catch {
			toast.error("Couldn't upload that image. Please try again.");
		} finally {
			setUploadingCover(false);
		}
	}

	async function onPickMore(e: React.ChangeEvent<HTMLInputElement>) {
		const files = Array.from(e.target.files ?? []).slice(0, 6 - images.length);
		if (!files.length) return;
		setUploadingMore(true);
		try {
			const urls = await Promise.all(files.map(uploadImage));
			setImages((p) => [...p, ...urls].slice(0, 6));
		} catch {
			toast.error("Couldn't upload one of those images. Please try again.");
		} finally {
			setUploadingMore(false);
		}
	}

	function shareCase(message: string) {
		const link =
			typeof window !== "undefined"
				? `${window.location.origin}/cases/${data.id}`
				: "";
		navigator.clipboard?.writeText(link);
		setShares((s) => s + 1);
		void recordShareAction(data.id);
		toast.success(message);
	}

	function save() {
		if (!title.trim()) return toast.error("Add a title for your case.");
		if (!state) return toast.error("Select the state your case is in.");
		if (story.trim().length < 10) return toast.error("Tell your story.");
		startSaving(async () => {
			const res = await updateCaseDetailsAction({
				id: data.id,
				title: title.trim(),
				category,
				location: state,
				summary: summary.trim() || undefined,
				story: story.trim(),
				coverImageUrl: coverUrl,
				images,
			});
			if (res.ok) {
				toast.success("Changes saved.");
				router.refresh();
			} else {
				toast.error(res.error);
			}
		});
	}

	function del() {
		startDeleting(async () => {
			const res = await deleteOwnedCaseAction(data.id);
			if (res.ok) {
				toast.success("Case deleted — restore it anytime from Deleted.");
				router.push("/dashboard/cases");
			} else {
				toast.error(res.error);
				setConfirmOpen(false);
			}
		});
	}

	const TABS = [
		{ key: "overview" as const, label: "Overview" },
		{ key: "edit" as const, label: "Edit & settings" },
	];

	return (
		<div className="flex flex-col gap-6">
			{/* Tab bar */}
			<div className="flex gap-2">
				{TABS.map((t) => {
					const active = t.key === tab;
					return (
						<button
							key={t.key}
							type="button"
							onClick={() => setTab(t.key)}
							aria-current={active ? "true" : undefined}
							className={cn(
								"rounded-[var(--radius-pill)] border px-4 py-2 font-semibold text-[13px] transition-colors",
								active
									? "border-ink bg-ink text-paper"
									: "border-border bg-surface text-ink-soft hover:border-brass-deep hover:text-ink",
							)}
						>
							{t.label}
						</button>
					);
				})}
			</div>

			{tab === "overview" ? (
				<div className="flex flex-col gap-6">
					{/* Hero goal panel */}
					<section className="relative overflow-hidden rounded-[var(--radius-card-lg)] bg-gold-bright p-6 shadow-[var(--shadow-rest)] sm:p-8">
						<div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
							<div className="min-w-0">
								<span className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-surface/80 px-2.5 py-1 font-mono font-semibold text-[10px] text-brass-deep uppercase tracking-[0.1em]">
									<TrendingUp className="size-3" aria-hidden="true" />
									{isLive
										? "Raising now"
										: isSeeking
											? "Out to attorneys"
											: "Draft — not live yet"}
								</span>
								<div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
									<span className="font-extrabold text-[44px] text-gold-bright-ink tabular-nums leading-none tracking-[-0.03em]">
										{money(raised)}
									</span>
									<span className="text-[14px] text-gold-bright-ink/80">
										{goal > 0 ? (
											<>
												raised of{" "}
												<span className="font-bold text-gold-bright-ink">
													{money(goal)}
												</span>{" "}
												goal
											</>
										) : (
											"set your goal by agreeing a fee with your attorney"
										)}
									</span>
								</div>
								{goal > 0 && (
									<div className="mt-4 max-w-[560px]">
										<div className="h-3 overflow-hidden rounded-full bg-surface/70">
											<div
												className="h-full rounded-full bg-gradient-to-r from-brass to-success transition-all"
												style={{ width: `${Math.max(3, pct)}%` }}
											/>
										</div>
										<p className="mt-2 font-semibold text-[13px] text-gold-bright-ink">
											{pct}% of the way there
											{raised === 0 ? " — just launched" : ""}
										</p>
									</div>
								)}
							</div>

							{/* Progress ring */}
							<div
								className="relative flex size-[132px] shrink-0 items-center justify-center rounded-full"
								style={{
									background: `conic-gradient(var(--success) ${pct * 3.6}deg, color-mix(in oklch, var(--surface) 80%, var(--gold-bright)) 0)`,
								}}
							>
								<div className="flex size-[104px] flex-col items-center justify-center rounded-full bg-surface text-center shadow-[var(--shadow-rest)]">
									<Rocket
										className="mb-1 size-5 text-brass-deep"
										aria-hidden="true"
									/>
									<span className="font-extrabold text-[26px] text-ink tabular-nums leading-none">
										{pct}%
									</span>
									<span className="mt-0.5 text-[10.5px] text-muted-foreground">
										funded
									</span>
								</div>
							</div>
						</div>
					</section>

					{/* Metrics */}
					<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
						<Metric
							icon={Heart}
							label={data.donorsCount === 1 ? "donor" : "donors"}
							value={String(data.donorsCount)}
							tone="green"
						/>
						<Metric
							icon={Eye}
							label="views"
							value={String(data.viewsCount)}
							tone="tan"
						/>
						<Metric
							icon={Share2}
							label="shares"
							value={String(shares)}
							tone="dark"
						/>
						<Metric
							icon={Target}
							label="funding goal"
							value={goal > 0 ? money(goal) : "—"}
							tone="gold"
						/>
					</div>

					{/* Share / rally panel */}
					<section className="relative overflow-hidden rounded-[var(--radius-card-lg)] border border-border bg-gradient-to-br from-brass-wash/50 via-surface to-green-soft/40 p-6 shadow-[var(--shadow-rest)]">
						<div className="flex items-center gap-2.5">
							<span className="flex size-10 items-center justify-center rounded-xl bg-gold-bright text-gold-bright-ink">
								<Megaphone className="size-5" aria-hidden="true" />
							</span>
							<div>
								<h2 className="font-bold text-[15px] text-ink">
									Rally your supporters
								</h2>
								<p className="text-[12.5px] text-muted-foreground">
									Every share puts your case in front of more people who can
									help.
								</p>
							</div>
						</div>
						<div className="mt-4 flex flex-wrap items-center gap-2.5">
							<button
								type="button"
								onClick={() => shareCase("Link copied — thanks for sharing!")}
								className="inline-flex h-11 items-center gap-2 rounded-[var(--radius-pill)] bg-success px-4 font-semibold text-[13.5px] text-white transition-transform hover:scale-[1.02]"
							>
								<Link2 className="size-4" aria-hidden="true" />
								Copy link
							</button>
							{[
								{ icon: Send, label: "Share on X" },
								{ icon: Share2, label: "Share on Facebook" },
								{ icon: MessageCircle, label: "Share on WhatsApp" },
								{ icon: Mail, label: "Share by email" },
							].map((s, i) => (
								<button
									key={s.label}
									type="button"
									aria-label={s.label}
									onClick={() => shareCase("Share link copied!")}
									className={cn(
										"flex size-11 items-center justify-center rounded-full transition-colors",
										i % 2 === 0
											? "bg-brass-wash text-brass-deep hover:bg-gold-bright hover:text-gold-bright-ink"
											: "bg-green-soft text-green-deep hover:bg-success hover:text-white",
									)}
								>
									<s.icon className="size-4" aria-hidden="true" />
								</button>
							))}
						</div>
					</section>

					{/* Encouragement */}
					<div className="flex items-start gap-2.5 rounded-[var(--radius-card)] border border-border border-dashed bg-green-soft/40 px-5 py-3.5 text-[13px] text-green-deep leading-relaxed">
						<Sparkles className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
						{isLive
							? "You're live and building momentum — keep sharing updates so backers stay invested in your journey to justice."
							: "Fill out your story and add photos in Edit & settings — cases with a clear story and cover image raise far more."}
					</div>
				</div>
			) : (
				<div className="flex flex-col gap-6">
					{/* Editable details */}
					<section className="rounded-[var(--radius-card-lg)] border border-border bg-surface p-6 shadow-[var(--shadow-rest)]">
						<h2 className="mb-5 font-bold text-ink text-lg">Case details</h2>
						<div className="flex flex-col gap-5">
							<div>
								<label
									htmlFor={ids.title}
									className="mb-1.5 block font-semibold text-[13px] text-ink"
								>
									Title
								</label>
								<Input
									id={ids.title}
									value={title}
									onChange={(e) => setTitle(e.target.value)}
									placeholder="Give your case a clear, human title"
								/>
							</div>

							<div className="grid gap-4 sm:grid-cols-2">
								<div>
									<span className="mb-1.5 block font-semibold text-[13px] text-ink">
										Category
									</span>
									<Select
										value={category}
										onValueChange={(v) => setCategory(v ?? "")}
									>
										<SelectTrigger>
											<SelectValue placeholder="Choose a category" />
										</SelectTrigger>
										<SelectContent>
											{CATEGORIES.map((cat) => (
												<SelectItem key={cat} value={cat}>
													{cat}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
								<div>
									<span className="mb-1.5 block font-semibold text-[13px] text-ink">
										State
									</span>
									<Select
										value={state}
										onValueChange={(v) => setState(v ?? "")}
									>
										<SelectTrigger>
											<SelectValue placeholder="Select a state" />
										</SelectTrigger>
										<SelectContent>
											{US_STATES.map((s) => (
												<SelectItem key={s} value={s}>
													{s}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
							</div>

							<div>
								<label
									htmlFor={ids.summary}
									className="mb-1.5 block font-semibold text-[13px] text-ink"
								>
									One-line summary
								</label>
								<Input
									id={ids.summary}
									value={summary}
									onChange={(e) => setSummary(e.target.value)}
									placeholder="A short hook shown on your case card"
								/>
							</div>

							<div>
								<label
									htmlFor={ids.story}
									className="mb-1.5 block font-semibold text-[13px] text-ink"
								>
									Your story
								</label>
								<Textarea
									id={ids.story}
									value={story}
									onChange={(e) => setStory(e.target.value)}
									rows={7}
									placeholder="What happened, when, and what it's cost you."
								/>
							</div>
						</div>
					</section>

					{/* Images */}
					<section className="rounded-[var(--radius-card-lg)] border border-border bg-surface p-6 shadow-[var(--shadow-rest)]">
						<h2 className="mb-5 font-bold text-ink text-lg">Images</h2>

						<p className="mb-1.5 font-semibold text-[13px] text-ink">
							Cover image
						</p>
						{coverUrl ? (
							<div className="relative w-full max-w-[420px] overflow-hidden rounded-[var(--radius-card)] border border-border">
								<img
									src={coverUrl}
									alt="Cover"
									className="aspect-[16/9] w-full object-cover"
								/>
								<div className="absolute top-2 right-2 flex gap-2">
									<button
										type="button"
										onClick={() => coverInput.current?.click()}
										disabled={uploadingCover}
										className="rounded-[var(--radius-pill)] bg-surface/90 px-2.5 py-1 font-semibold text-[12px] text-ink backdrop-blur-sm transition-colors hover:bg-surface"
									>
										Replace
									</button>
									<button
										type="button"
										onClick={() => setCoverUrl(null)}
										className="flex size-7 items-center justify-center rounded-full bg-surface/90 text-danger backdrop-blur-sm transition-colors hover:bg-surface"
										aria-label="Remove cover"
									>
										<X className="size-4" aria-hidden="true" />
									</button>
								</div>
							</div>
						) : (
							<button
								type="button"
								onClick={() => coverInput.current?.click()}
								disabled={uploadingCover}
								className="flex w-full max-w-[420px] flex-col items-center gap-2 rounded-[var(--radius-card)] border border-line-strong border-dashed bg-surface px-6 py-10 text-center transition-colors hover:border-brass hover:border-solid hover:ring-1 hover:ring-brass disabled:opacity-70"
							>
								<span className="flex size-11 items-center justify-center rounded-xl bg-brass-wash text-brass-deep">
									{uploadingCover ? (
										<Upload
											className="size-5 animate-pulse"
											aria-hidden="true"
										/>
									) : (
										<ImageIcon className="size-5" aria-hidden="true" />
									)}
								</span>
								<span className="font-bold text-[14px] text-ink">
									{uploadingCover ? "Uploading…" : "Add a cover image"}
								</span>
							</button>
						)}
						<input
							ref={coverInput}
							type="file"
							accept="image/*"
							className="hidden"
							onChange={onPickCover}
						/>

						<p className="mt-6 mb-1.5 font-semibold text-[13px] text-ink">
							More images{" "}
							<span className="font-normal text-muted-foreground">
								(up to 6)
							</span>
						</p>
						<div className="flex flex-wrap gap-3">
							{images.map((url) => (
								<div
									key={url}
									className="relative size-[92px] overflow-hidden rounded-[var(--radius-card-sm)] border border-border"
								>
									<img src={url} alt="" className="size-full object-cover" />
									<button
										type="button"
										onClick={() => setImages((p) => p.filter((u) => u !== url))}
										className="absolute top-1 right-1 flex size-6 items-center justify-center rounded-full bg-surface/90 text-danger backdrop-blur-sm transition-colors hover:bg-surface"
										aria-label="Remove image"
									>
										<X className="size-3.5" aria-hidden="true" />
									</button>
								</div>
							))}
							{images.length < 6 && (
								<button
									type="button"
									onClick={() => moreInput.current?.click()}
									disabled={uploadingMore}
									className="flex size-[92px] flex-col items-center justify-center gap-1 rounded-[var(--radius-card-sm)] border border-line-strong border-dashed bg-surface text-muted-foreground transition-colors hover:border-brass hover:border-solid hover:text-ink hover:ring-1 hover:ring-brass"
								>
									{uploadingMore ? (
										<Upload
											className="size-5 animate-pulse"
											aria-hidden="true"
										/>
									) : (
										<Plus className="size-5" aria-hidden="true" />
									)}
									<span className="text-[11px]">Add</span>
								</button>
							)}
						</div>
						<input
							ref={moreInput}
							type="file"
							accept="image/*"
							multiple
							className="hidden"
							onChange={onPickMore}
						/>
					</section>

					{/* Attorney & fee (read-only) */}
					<section className="rounded-[var(--radius-card-lg)] border border-border bg-surface p-6 shadow-[var(--shadow-rest)]">
						<h2 className="mb-4 font-bold text-ink text-lg">Attorney & fee</h2>
						<div className="flex flex-wrap items-center justify-between gap-4">
							<div className="flex items-center gap-3">
								<span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brass-wash text-brass-deep">
									<Scale className="size-5" aria-hidden="true" />
								</span>
								<div>
									<p className="font-bold text-[15px] text-ink">
										{data.attorneyName || "No attorney chosen yet"}
									</p>
									<p className="text-[12.5px] text-muted-foreground">
										{data.attorneyName
											? attorneyMeta
											: "Choose one from the wizard"}
									</p>
								</div>
							</div>
							<div className="text-right">
								<p className="font-mono font-semibold text-[11px] text-muted-foreground uppercase tracking-[0.08em]">
									Agreed fee
								</p>
								<p className="font-extrabold text-[20px] text-ink tabular-nums">
									{goal > 0 ? money(goal) : "—"}
								</p>
							</div>
						</div>
					</section>

					{/* Save bar */}
					<div className="sticky bottom-4 flex items-center justify-end gap-3 rounded-[var(--radius-card)] border border-border bg-surface/95 px-4 py-3 shadow-[var(--shadow-float)] backdrop-blur-sm">
						<span className="mr-auto text-[13px] text-muted-foreground">
							{dirty ? "You have unsaved changes." : "All changes saved."}
						</span>
						<Button onClick={save} disabled={!dirty || saving} className="px-5">
							<Save data-icon="inline-start" aria-hidden="true" />
							{saving ? "Saving…" : "Save changes"}
						</Button>
					</div>

					{/* Danger zone */}
					<section className="rounded-[var(--radius-card-lg)] border border-danger/30 bg-danger/5 p-6">
						<h2 className="font-bold text-danger text-lg">Delete this case</h2>
						<p className="mt-1.5 max-w-[60ch] text-[13.5px] text-ink-soft leading-relaxed">
							The case moves to your Deleted list. Nothing is lost — you can
							restore it anytime.
						</p>
						<button
							type="button"
							onClick={() => setConfirmOpen(true)}
							className="mt-4 inline-flex items-center gap-1.5 rounded-[var(--radius-control)] border border-danger/40 px-4 py-2 font-semibold text-[13px] text-danger transition-colors hover:bg-danger/10"
						>
							<Trash2 className="size-4" aria-hidden="true" />
							Delete case
						</button>
					</section>
				</div>
			)}

			{confirmOpen && (
				<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
					<button
						type="button"
						aria-label="Cancel"
						disabled={deleting}
						onClick={() => setConfirmOpen(false)}
						className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
					/>
					<div
						role="dialog"
						aria-modal="true"
						className="relative w-full max-w-[400px] rounded-[var(--radius-card-lg)] border border-border bg-surface p-6 shadow-[var(--shadow-modal)]"
					>
						<div className="mb-3 flex size-11 items-center justify-center rounded-full bg-danger/10 text-danger">
							<Trash2 className="size-5" aria-hidden="true" />
						</div>
						<h3 className="font-bold text-[17px] text-ink">
							Delete this case?
						</h3>
						<p className="mt-1.5 text-[13.5px] text-ink-soft leading-relaxed">
							“{data.title || "This case"}” will move to your Deleted cases. You
							can restore it anytime.
						</p>
						<div className="mt-5 flex justify-end gap-2.5">
							<Button
								variant="outline"
								disabled={deleting}
								onClick={() => setConfirmOpen(false)}
							>
								Cancel
							</Button>
							<Button
								disabled={deleting}
								onClick={del}
								className={cn("bg-danger text-white hover:bg-danger/90")}
							>
								<Trash2 data-icon="inline-start" aria-hidden="true" />
								{deleting ? "Deleting…" : "Delete case"}
							</Button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
