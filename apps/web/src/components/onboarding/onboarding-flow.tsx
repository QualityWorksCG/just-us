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
import { cn } from "@just-us/ui/lib/utils";
import {
	ArrowLeft,
	ArrowRight,
	Check,
	CircleCheck,
	FileText,
	Globe,
	Heart,
	type LucideIcon,
	Scale,
	ShieldCheck,
} from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";

import { completeOnboardingAction } from "@/app/onboarding/actions";
import { Brandmark } from "@/components/brandmark";
import { BAR_NUMBER_MESSAGE, isValidBarNumber } from "@/lib/validation";

type Role = "plaintiff" | "donor" | "attorney";

const ROLES: {
	value: Role;
	label: string;
	article: string;
	icon: LucideIcon;
	blurb: string;
	points: string[];
}[] = [
	{
		value: "plaintiff",
		label: "I was wronged",
		article: "a plaintiff",
		icon: FileText,
		blurb:
			"Submit your case and raise the fee to hire the attorney you choose.",
		points: [
			"Submit a case for review",
			"Choose your own attorney",
			"Raise the agreed fee together",
		],
	},
	{
		value: "donor",
		label: "I want to help fund cases",
		article: "a donor",
		icon: Heart,
		blurb: "Give any amount to vetted cases and follow them to the outcome.",
		points: [
			"Browse vetted cases",
			"Donate any amount",
			"Get updates until it closes",
		],
	},
	{
		value: "attorney",
		label: "I'm an attorney",
		article: "an attorney",
		icon: Scale,
		blurb:
			"Take on vetted, fundable cases with the fee raised before you file.",
		points: [
			"Appear in the directory",
			"Pick the cases you want",
			"Fee funded up front",
		],
	},
];

const COUNTRIES = [
	"United States",
	"Canada",
	"United Kingdom",
	"Australia",
] as const;

const US_STATES = [
	"Alabama",
	"Alaska",
	"Arizona",
	"Arkansas",
	"California",
	"Colorado",
	"Connecticut",
	"Delaware",
	"Florida",
	"Georgia",
	"Hawaii",
	"Idaho",
	"Illinois",
	"Indiana",
	"Iowa",
	"Kansas",
	"Kentucky",
	"Louisiana",
	"Maine",
	"Maryland",
	"Massachusetts",
	"Michigan",
	"Minnesota",
	"Mississippi",
	"Missouri",
	"Montana",
	"Nebraska",
	"Nevada",
	"New Hampshire",
	"New Jersey",
	"New Mexico",
	"New York",
	"North Carolina",
	"North Dakota",
	"Ohio",
	"Oklahoma",
	"Oregon",
	"Pennsylvania",
	"Rhode Island",
	"South Carolina",
	"South Dakota",
	"Tennessee",
	"Texas",
	"Utah",
	"Vermont",
	"Virginia",
	"Washington",
	"West Virginia",
	"Wisconsin",
	"Wyoming",
];

const STEP2_FORM_ID = "onboarding-step-2";

export function OnboardingFlow({ name }: { name: string }) {
	const ids = {
		country: useId(),
		zip: useId(),
		firm: useId(),
		bar: useId(),
		jurisdiction: useId(),
	};
	const firstName = name.trim().split(" ")[0] || "there";

	const [step, setStep] = useState<1 | 2>(1);
	const [role, setRole] = useState<Role | null>(null);

	// Plaintiff / donor — payout location.
	const [country, setCountry] = useState<string>("United States");
	const [postalCode, setPostalCode] = useState("");

	// Attorney — practice details.
	const [firmName, setFirmName] = useState("");
	const [barNumber, setBarNumber] = useState("");
	const [jurisdiction, setJurisdiction] = useState("");

	const [errors, setErrors] = useState<Record<string, string>>({});
	const [pending, setPending] = useState(false);

	const isAttorney = role === "attorney";
	const inputClass =
		"h-11 rounded-[var(--radius-control)] border border-line-strong bg-surface px-3 text-[14px]";

	function goToStep2() {
		if (!role) {
			toast.error("Pick how you're joining to continue.");
			return;
		}
		setErrors({});
		setStep(2);
	}

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!role) return;
		setErrors({});

		const next: Record<string, string> = {};
		if (isAttorney) {
			if (!jurisdiction) next.jurisdiction = "Select your jurisdiction";
			if (!firmName.trim()) next.firmName = "Enter your firm";
			if (!barNumber.trim()) next.barNumber = "Enter your bar number";
			else if (!isValidBarNumber(barNumber))
				next.barNumber = BAR_NUMBER_MESSAGE;
		} else {
			if (!postalCode.trim()) next.postalCode = "Enter your ZIP or postal code";
		}
		if (Object.keys(next).length) {
			setErrors(next);
			return;
		}

		setPending(true);
		try {
			const result = await completeOnboardingAction({
				role,
				firmName: firmName.trim() || undefined,
				barNumber: barNumber.trim() || undefined,
				jurisdiction: jurisdiction || undefined,
			});
			if (result.ok) {
				toast.success("You're all set. Welcome to JustUs.");
				// Hard navigation so the destination renders with the freshly updated
				// session (role + onboarded), avoiding any stale client cache. New
				// plaintiffs go straight into creating their case; everyone else lands
				// on their dashboard.
				window.location.assign(
					role === "plaintiff" ? "/cases/new" : "/dashboard",
				);
			} else {
				if (result.fieldErrors) setErrors(result.fieldErrors);
				toast.error(result.error);
				setPending(false);
			}
		} catch {
			toast.error("Something went wrong. Please try again.");
			setPending(false);
		}
	}

	return (
		<div className="flex min-h-svh flex-col bg-paper">
			{/* Header — brand + step progress */}
			<header className="flex items-center justify-between px-6 py-5 sm:px-10">
				<div className="flex items-center gap-2.5">
					<Brandmark size={30} />
					<span className="font-bold text-[15px] tracking-tight">JustUs</span>
				</div>
				<div className="flex items-center gap-3">
					<span className="font-mono font-semibold text-[12px] text-muted-foreground uppercase tracking-[0.1em]">
						Step {step} of 2
					</span>
					<div className="flex gap-1.5">
						<span className="h-1.5 w-7 rounded-full bg-brass" />
						<span
							className={cn(
								"h-1.5 w-7 rounded-full",
								step >= 2 ? "bg-brass" : "bg-brass-wash",
							)}
						/>
					</div>
				</div>
			</header>

			{/* Main */}
			<main className="flex-1 px-6 sm:px-10">
				<div className="mx-auto max-w-[1180px] pt-4 pb-16 sm:pt-8">
					{step === 1 ? (
						<>
							<p className="mb-2.5 font-mono font-semibold text-[12px] text-brass-deep uppercase tracking-[0.1em]">
								Welcome to JustUs
							</p>
							<h1 className="font-extrabold text-[clamp(1.875rem,3.4vw,2.75rem)] text-ink tracking-[-0.03em]">
								Hi {firstName}, how are you joining?
							</h1>
							<p className="mt-2.5 max-w-[560px] text-[15px] text-ink-soft leading-relaxed">
								Pick what brings you here so we can tailor your experience —
								you'll still reach every part of JustUs. This just sets your
								home base.
							</p>

							<div className="mt-8 grid gap-5 md:grid-cols-3">
								{ROLES.map((r) => {
									const active = role === r.value;
									return (
										<button
											key={r.value}
											type="button"
											onClick={() => {
												setRole(r.value);
												setErrors({});
											}}
											aria-pressed={active}
											className={cn(
												"group relative flex flex-col overflow-hidden rounded-[var(--radius-card-lg)] border p-6 text-left transition-all duration-200",
												active
													? "border-brass bg-brass-wash shadow-[var(--shadow-hover)] ring-1 ring-brass"
													: "border-border bg-surface hover:-translate-y-0.5 hover:border-brass-deep hover:bg-brass-wash hover:shadow-[var(--shadow-hover)]",
											)}
										>
											{/* Faint watermark of the role icon */}
											<r.icon
												className={cn(
													"pointer-events-none absolute -right-4 -bottom-4 size-28",
													active ? "text-brass/15" : "text-brass/[0.06]",
												)}
												aria-hidden="true"
											/>

											<div className="mb-4 flex items-start justify-between">
												<span
													className={cn(
														"flex size-12 items-center justify-center rounded-[14px] transition-colors",
														active
															? "bg-brass text-white"
															: "bg-brass-wash text-brass-deep group-hover:bg-brass/15",
													)}
												>
													<r.icon className="size-6" aria-hidden="true" />
												</span>
												<span
													className={cn(
														"flex size-6 items-center justify-center rounded-full border-2 transition-colors",
														active
															? "border-brass bg-brass text-white"
															: "border-line-strong group-hover:border-brass-deep",
													)}
												>
													{active && (
														<Check className="size-3.5" aria-hidden="true" />
													)}
												</span>
											</div>

											<h2 className="font-bold text-[17px] text-ink">
												{r.label}
											</h2>
											<p className="mt-1.5 text-[13.5px] text-ink-soft leading-relaxed">
												{r.blurb}
											</p>

											<hr className="my-4 border-border" />

											<ul className="flex flex-col gap-2">
												{r.points.map((p) => (
													<li
														key={p}
														className="flex items-center gap-2 font-medium text-[13px] text-ink-soft"
													>
														<CircleCheck
															className="size-4 shrink-0 text-success"
															aria-hidden="true"
														/>
														{p}
													</li>
												))}
											</ul>
										</button>
									);
								})}
							</div>
						</>
					) : (
						<form id={STEP2_FORM_ID} onSubmit={handleSubmit}>
							<p className="mb-2.5 font-mono font-semibold text-[12px] text-brass-deep uppercase tracking-[0.1em]">
								{isAttorney ? "Your practice" : "Payout location"}
							</p>
							<h1 className="font-extrabold text-[clamp(1.875rem,3.4vw,2.75rem)] text-ink tracking-[-0.03em]">
								{isAttorney
									? "Tell us about your practice"
									: "Where will you receive funds?"}
							</h1>
							<p className="mt-2.5 max-w-[560px] text-[15px] text-ink-soft leading-relaxed">
								{isAttorney
									? "We verify your bar standing before your profile goes live, so cases only reach attorneys who can take them."
									: "This sets your jurisdiction and where payouts are sent. Funds land in your account, and you pay the attorney you choose."}
							</p>

							<div className="mt-8 max-w-[620px] rounded-[var(--radius-card-lg)] border border-border bg-surface p-6 shadow-[var(--shadow-rest)] sm:p-7">
								{isAttorney ? (
									<div className="flex flex-col gap-5">
										<div className="flex flex-col gap-1.5">
											<label
												htmlFor={ids.jurisdiction}
												className="font-semibold text-[13px] text-ink"
											>
												Jurisdiction
											</label>
											<Select
												value={jurisdiction}
												onValueChange={(v: string | null) =>
													setJurisdiction(v ?? "")
												}
											>
												<SelectTrigger
													id={ids.jurisdiction}
													className="h-11 text-[14px]"
													aria-invalid={!!errors.jurisdiction}
												>
													<SelectValue placeholder="Select your state…" />
												</SelectTrigger>
												<SelectContent className="max-h-[300px]">
													{US_STATES.map((s) => (
														<SelectItem
															key={s}
															value={s}
															className="text-[14px]"
														>
															{s}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
											{errors.jurisdiction && (
												<p className="text-[12px] text-danger">
													{errors.jurisdiction}
												</p>
											)}
										</div>
										<div className="flex flex-col gap-1.5">
											<label
												htmlFor={ids.firm}
												className="font-semibold text-[13px] text-ink"
											>
												Firm
											</label>
											<Input
												id={ids.firm}
												className={inputClass}
												value={firmName}
												onChange={(e) => setFirmName(e.target.value)}
												placeholder="Bell & Associates"
												aria-invalid={!!errors.firmName}
											/>
											{errors.firmName && (
												<p className="text-[12px] text-danger">
													{errors.firmName}
												</p>
											)}
										</div>
										<div className="flex flex-col gap-1.5">
											<label
												htmlFor={ids.bar}
												className="font-semibold text-[13px] text-ink"
											>
												Bar number
											</label>
											<Input
												id={ids.bar}
												className={inputClass}
												value={barNumber}
												onChange={(e) => setBarNumber(e.target.value)}
												placeholder="GA #338114"
												aria-invalid={!!errors.barNumber}
											/>
											{errors.barNumber && (
												<p className="text-[12px] text-danger">
													{errors.barNumber}
												</p>
											)}
										</div>
									</div>
								) : (
									<div className="flex flex-col gap-5">
										<div className="flex flex-col gap-1.5">
											<label
												htmlFor={ids.country}
												className="font-semibold text-[13px] text-ink"
											>
												Country
											</label>
											<Select
												value={country}
												onValueChange={(v: string | null) =>
													setCountry(v ?? "United States")
												}
											>
												<SelectTrigger
													id={ids.country}
													className="h-11 text-[14px]"
												>
													<span className="flex items-center gap-2">
														<Globe
															className="size-4 text-muted-foreground"
															aria-hidden="true"
														/>
														<SelectValue placeholder="Select country" />
													</span>
												</SelectTrigger>
												<SelectContent>
													{COUNTRIES.map((c) => (
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
										</div>
										<div className="flex flex-col gap-1.5">
											<label
												htmlFor={ids.zip}
												className="font-semibold text-[13px] text-ink"
											>
												ZIP / postal code
											</label>
											<Input
												id={ids.zip}
												className={inputClass}
												value={postalCode}
												onChange={(e) => setPostalCode(e.target.value)}
												placeholder="78701"
												autoComplete="postal-code"
												aria-invalid={!!errors.postalCode}
											/>
											{errors.postalCode && (
												<p className="text-[12px] text-danger">
													{errors.postalCode}
												</p>
											)}
										</div>
										<p className="flex gap-2.5 rounded-[var(--radius-card-sm)] bg-green-soft px-4 py-3 text-[13px] text-green-deep leading-relaxed">
											<ShieldCheck
												className="mt-0.5 size-4 shrink-0 text-success"
												aria-hidden="true"
											/>
											We use this only to match your jurisdiction and route
											payouts to your account — you pay the attorney you choose
											from there.
										</p>
									</div>
								)}
							</div>
						</form>
					)}
				</div>
			</main>

			{/* Sticky action bar */}
			<div className="sticky bottom-0 border-border border-t bg-paper/95 px-6 py-4 backdrop-blur-md sm:px-10">
				<div className="mx-auto flex max-w-[1180px] items-center justify-between gap-4">
					{step === 1 ? (
						<>
							<p className="text-[13px] text-muted-foreground">
								You can change your home base anytime in settings.
							</p>
							<Button
								type="button"
								size="lg"
								className="px-6"
								onClick={goToStep2}
								disabled={!role}
							>
								{role
									? `Continue as ${ROLES.find((r) => r.value === role)?.article}`
									: "Continue"}
								<ArrowRight data-icon="inline-end" aria-hidden="true" />
							</Button>
						</>
					) : (
						<>
							<Button
								type="button"
								variant="outline"
								size="lg"
								onClick={() => {
									setErrors({});
									setStep(1);
								}}
							>
								<ArrowLeft data-icon="inline-start" aria-hidden="true" />
								Back
							</Button>
							<Button
								type="submit"
								form={STEP2_FORM_ID}
								size="lg"
								className="px-6"
								disabled={pending}
							>
								{pending ? "Setting up…" : "Enter JustUs"}
								{!pending && (
									<ArrowRight data-icon="inline-end" aria-hidden="true" />
								)}
							</Button>
						</>
					)}
				</div>
			</div>
		</div>
	);
}
