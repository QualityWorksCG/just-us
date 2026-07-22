"use client";

import { Button } from "@just-us/ui/components/button";
import { Input } from "@just-us/ui/components/input";
import { cn } from "@just-us/ui/lib/utils";
import {
	ArrowRight,
	Check,
	FileText,
	Gavel,
	type LucideIcon,
	Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { toast } from "sonner";

import { completeOnboardingAction } from "@/app/onboarding/actions";
import { Brandmark } from "@/components/brandmark";

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

export function OnboardingFlow({ name }: { name: string }) {
	const router = useRouter();
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
				router.push("/dashboard");
				router.refresh();
			} else {
				if (result.fieldErrors) setErrors(result.fieldErrors);
				toast.error(result.error);
			}
		} catch {
			toast.error("Something went wrong. Please try again.");
		} finally {
			setPending(false);
		}
	}

	return (
		<div className="flex min-h-svh flex-col bg-paper">
			<header className="mx-auto flex w-full max-w-[720px] items-center gap-2.5 px-6 pt-8">
				<Brandmark size={30} />
				<span className="font-bold text-[15px] tracking-tight">JustUs</span>
			</header>

			<main className="mx-auto flex w-full max-w-[720px] flex-1 flex-col justify-center px-6 py-10">
				<p className="mb-2 font-mono font-semibold text-[12px] text-brass-deep uppercase tracking-[0.08em]">
					Welcome to JustUs
				</p>
				<h1 className="font-extrabold text-[clamp(1.75rem,3vw,2.125rem)] text-ink tracking-[-0.025em]">
					Hi {firstName}, how are you joining?
				</h1>
				<p className="mt-2.5 max-w-[560px] text-[15px] text-ink-soft leading-relaxed">
					Pick what brings you here so we can tailor your experience. You can
					reach every part of JustUs whatever you choose — this just sets your
					home base.
				</p>

				<form onSubmit={handleSubmit} className="mt-7 flex flex-col gap-4">
					<fieldset className="grid gap-3 sm:grid-cols-3">
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
										"flex flex-col rounded-[var(--radius-card)] border p-4 text-left transition-all",
										active
											? "border-brass bg-brass-wash shadow-[var(--shadow-rest)]"
											: "border-border bg-surface hover:border-brass/50 hover:shadow-[var(--shadow-rest)]",
									)}
								>
									<span
										className={cn(
											"mb-3 flex size-10 items-center justify-center rounded-[11px]",
											active
												? "bg-brass text-brass-ink"
												: "bg-brass-wash text-brass-deep",
										)}
									>
										<Icon className="size-5" aria-hidden="true" />
									</span>
									<span className="font-bold text-[15px] text-ink">
										{r.label}
									</span>
									<span className="mt-1 text-[13px] text-ink-soft leading-snug">
										{r.blurb}
									</span>
									<ul className="mt-3 flex flex-col gap-1.5">
										{r.points.map((p) => (
											<li
												key={p}
												className="flex items-center gap-1.5 text-[12.5px] text-ink-soft"
											>
												<Check
													className="size-3.5 shrink-0 text-brass-deep"
													aria-hidden="true"
												/>
												{p}
											</li>
										))}
									</ul>
								</button>
							);
						})}
					</fieldset>

					{role === "attorney" && (
						<div className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-border bg-surface-2 p-5">
							<p className="font-semibold text-[13.5px] text-ink">
								A few details so donors and plaintiffs can find you. Your bar
								standing is verified before your profile goes live.
							</p>
							<div className="flex flex-col gap-1.5">
								<label
									htmlFor={ids.jurisdiction}
									className="font-semibold text-[13px] text-ink"
								>
									Jurisdiction<span className="ml-0.5 text-danger">*</span>
								</label>
								<select
									id={ids.jurisdiction}
									className={cn(inputClass, "w-full")}
									value={jurisdiction}
									onChange={(e) => setJurisdiction(e.target.value)}
									aria-invalid={!!errors.jurisdiction}
								>
									<option value="">Select your state…</option>
									{US_STATES.map((s) => (
										<option key={s} value={s}>
											{s}
										</option>
									))}
								</select>
								{errors.jurisdiction && (
									<p className="text-[12px] text-danger">
										{errors.jurisdiction}
									</p>
								)}
							</div>
							<div className="grid gap-4 sm:grid-cols-2">
								<div className="flex flex-col gap-1.5">
									<label
										htmlFor={ids.firm}
										className="font-semibold text-[13px] text-ink"
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
										className="font-semibold text-[13px] text-ink"
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
										<p className="text-[12px] text-danger">
											{errors.barNumber}
										</p>
									)}
								</div>
							</div>
						</div>
					)}

					<Button
						type="submit"
						size="lg"
						className="mt-1 w-full sm:w-auto sm:self-start sm:px-8"
						disabled={pending || !role}
					>
						{pending ? "Setting up…" : "Enter JustUs"}
						{!pending && (
							<ArrowRight data-icon="inline-end" aria-hidden="true" />
						)}
					</Button>
				</form>
			</main>
		</div>
	);
}
