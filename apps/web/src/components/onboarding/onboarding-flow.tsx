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
	ArrowRight,
	Check,
	FileText,
	Gavel,
	type LucideIcon,
	Users,
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
	icon: LucideIcon;
	blurb: string;
	points: string[];
}[] = [
	{
		value: "plaintiff",
		label: "I was wronged",
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
		icon: Users,
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
		icon: Gavel,
		blurb:
			"Take on vetted, fundable cases with the fee raised before you file.",
		points: [
			"Appear in the directory",
			"Pick cases you want",
			"Fee funded up front",
		],
	},
];

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

// Selected lane gets the brass gradient (matches the auth brand panel).
const SELECTED_LANE =
	"bg-[radial-gradient(700px_500px_at_50%_-10%,color-mix(in_oklch,var(--brass)_32%,transparent),transparent_60%),linear-gradient(168deg,color-mix(in_oklch,var(--ink)_92%,var(--brass-deep)),color-mix(in_oklch,var(--ink)_58%,var(--brass-deep)))] text-paper";

export function OnboardingFlow({ name }: { name: string }) {
	const ids = {
		firm: useId(),
		bar: useId(),
		jurisdiction: useId(),
	};
	const firstName = name.trim().split(" ")[0] || "there";

	const [role, setRole] = useState<Role | null>(null);
	const [firmName, setFirmName] = useState("");
	const [barNumber, setBarNumber] = useState("");
	const [jurisdiction, setJurisdiction] = useState("");
	const [errors, setErrors] = useState<Record<string, string>>({});
	const [pending, setPending] = useState(false);

	const isAttorney = role === "attorney";
	const inputClass =
		"h-10 rounded-[var(--radius-control)] border border-line-strong bg-surface px-3 text-[14px]";

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setErrors({});
		if (!role) {
			toast.error("Pick how you're joining to continue.");
			return;
		}
		if (role === "attorney") {
			const next: Record<string, string> = {};
			if (!jurisdiction) next.jurisdiction = "Select your jurisdiction";
			if (!firmName.trim()) next.firmName = "Enter your firm";
			if (!barNumber.trim()) next.barNumber = "Enter your bar number";
			else if (!isValidBarNumber(barNumber))
				next.barNumber = BAR_NUMBER_MESSAGE;
			if (Object.keys(next).length) {
				setErrors(next);
				return;
			}
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
				// Hard navigation so the dashboard renders with the freshly updated
				// session (role + onboarded), avoiding any stale client cache.
				window.location.assign("/dashboard");
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
			{/* Top band — brand + welcome */}
			<div className="border-border border-b px-6 pt-7 pb-8 sm:px-10 sm:pb-10">
				<div className="mb-7 flex items-center gap-2.5">
					<Brandmark size={30} />
					<span className="font-bold text-[15px] tracking-tight">JustUs</span>
				</div>
				<p className="mb-2 font-mono font-semibold text-[12px] text-brass-deep uppercase tracking-[0.08em]">
					Welcome to JustUs
				</p>
				<h1 className="font-extrabold text-[clamp(1.875rem,3.4vw,2.75rem)] text-ink tracking-[-0.03em]">
					Hi {firstName}, how are you joining?
				</h1>
				<p className="mt-2.5 max-w-[620px] text-[15px] text-ink-soft leading-relaxed">
					Pick what brings you here so we can tailor your experience. You can
					reach every part of JustUs whatever you choose — this just sets your
					home base.
				</p>
			</div>

			{/* Three lanes */}
			<div className="grid flex-1 grid-cols-1 md:grid-cols-3">
				{ROLES.map((r) => {
					const Icon = r.icon;
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
								"group relative flex flex-col justify-center gap-5 px-8 py-14 text-left transition-all duration-300 md:border-r md:border-b-0 md:last:border-r-0",
								"border-border border-b",
								active
									? SELECTED_LANE
									: "bg-paper text-ink hover:bg-surface-2/60",
							)}
						>
							{active && (
								<span className="absolute top-5 right-5 flex size-7 items-center justify-center rounded-full bg-brass text-brass-ink">
									<Check className="size-4" aria-hidden="true" />
								</span>
							)}

							<span
								className={cn(
									"flex size-14 items-center justify-center rounded-[16px] transition-colors",
									active
										? "bg-paper/15 text-paper"
										: "bg-brass-wash text-brass-deep group-hover:bg-brass/20",
								)}
							>
								<Icon className="size-7" aria-hidden="true" />
							</span>

							<div>
								<h2
									className={cn(
										"font-extrabold text-[clamp(1.25rem,1.8vw,1.5rem)] tracking-[-0.02em]",
										active ? "text-paper" : "text-ink",
									)}
								>
									{r.label}
								</h2>
								<p
									className={cn(
										"mt-2 max-w-[34ch] text-[15px] leading-relaxed",
										active ? "text-paper/75" : "text-ink-soft",
									)}
								>
									{r.blurb}
								</p>
							</div>

							<ul className="flex flex-col gap-2.5">
								{r.points.map((p) => (
									<li
										key={p}
										className={cn(
											"flex items-center gap-2.5 font-medium text-[13.5px]",
											active ? "text-paper/85" : "text-ink-soft",
										)}
									>
										<Check
											className={cn(
												"size-4 shrink-0",
												active ? "text-brass" : "text-brass-deep",
											)}
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

			{/* Sticky action bar */}
			<form
				onSubmit={handleSubmit}
				className="sticky bottom-0 border-border border-t bg-paper/95 px-6 py-5 backdrop-blur-md sm:px-10"
			>
				{isAttorney && (
					<div className="mb-4 grid gap-3 sm:grid-cols-3">
						<div className="flex flex-col gap-1.5">
							<label
								htmlFor={ids.jurisdiction}
								className="font-semibold text-[12.5px] text-ink"
							>
								Jurisdiction<span className="ml-0.5 text-danger">*</span>
							</label>
							<Select
								value={jurisdiction}
								onValueChange={(value: string | null) =>
									setJurisdiction(value ?? "")
								}
							>
								<SelectTrigger
									id={ids.jurisdiction}
									className="h-10 text-[14px]"
									aria-invalid={!!errors.jurisdiction}
								>
									<SelectValue placeholder="Select your state…" />
								</SelectTrigger>
								<SelectContent className="max-h-[300px]">
									{US_STATES.map((s) => (
										<SelectItem key={s} value={s} className="text-[14px]">
											{s}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							{errors.jurisdiction && (
								<p className="text-[12px] text-danger">{errors.jurisdiction}</p>
							)}
						</div>
						<div className="flex flex-col gap-1.5">
							<label
								htmlFor={ids.firm}
								className="font-semibold text-[12.5px] text-ink"
							>
								Firm<span className="ml-0.5 text-danger">*</span>
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
								<p className="text-[12px] text-danger">{errors.firmName}</p>
							)}
						</div>
						<div className="flex flex-col gap-1.5">
							<label
								htmlFor={ids.bar}
								className="font-semibold text-[12.5px] text-ink"
							>
								Bar number<span className="ml-0.5 text-danger">*</span>
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
								<p className="text-[12px] text-danger">{errors.barNumber}</p>
							)}
						</div>
					</div>
				)}

				<div className="mx-auto flex max-w-[1180px] items-center justify-between gap-4">
					<p className="text-[13px] text-muted-foreground">
						{role
							? "You can change this later in your settings."
							: "Choose how you're joining to continue."}
					</p>
					<Button
						type="submit"
						size="lg"
						className="px-8"
						disabled={pending || !role}
					>
						{pending ? "Setting up…" : "Enter JustUs"}
						{!pending && (
							<ArrowRight data-icon="inline-end" aria-hidden="true" />
						)}
					</Button>
				</div>
			</form>
		</div>
	);
}
