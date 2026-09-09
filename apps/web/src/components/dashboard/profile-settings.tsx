"use client";

import { requiresJurisdiction } from "@just-us/auth/rbac";
import { Button, buttonVariants } from "@just-us/ui/components/button";
import { Label } from "@just-us/ui/components/label";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@just-us/ui/components/select";
import { cn } from "@just-us/ui/lib/utils";
import {
	BriefcaseBusiness,
	CalendarDays,
	CircleAlert,
	CircleCheck,
	LoaderCircle,
	Mail,
	ShieldCheck,
} from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

import { saveProfileAction } from "@/app/(app)/settings/profile-actions";
import { IdentityFields } from "@/components/dashboard/identity-fields";

type SettingsProfile = {
	id: string;
	name: string;
	email: string;
	emailVerified: boolean;
	avatarUrl: string | null;
	role: string;
	jurisdiction: string | null;
	createdAt: string;
};

const ROLE_LABELS: Record<string, string> = {
	plaintiff: "Plaintiff",
	attorney: "Attorney",
	donor: "JustUs Member",
	administrator: "Administrator",
};

function formatCreatedAt(value: string) {
	return new Intl.DateTimeFormat("en-US", {
		month: "long",
		year: "numeric",
	}).format(new Date(value));
}

function InlineError({
	id,
	children,
}: {
	id?: string;
	children: React.ReactNode;
}) {
	return (
		<p
			id={id}
			role="alert"
			className="mt-1.5 flex items-start gap-1.5 text-[12px] text-destructive leading-relaxed"
		>
			<CircleAlert className="mt-px size-3.5 shrink-0" aria-hidden="true" />
			{children}
		</p>
	);
}

function AccountDetail({
	icon: Icon,
	label,
	children,
}: {
	icon: typeof BriefcaseBusiness;
	label: string;
	children: React.ReactNode;
}) {
	return (
		<div className="flex gap-3 border-border border-b py-4 last:border-b-0">
			<span className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-chip)] bg-brass-wash text-brass-deep">
				<Icon className="size-4" aria-hidden="true" />
			</span>
			<div className="min-w-0">
				<dt className="font-semibold text-[12px] text-ink-soft">{label}</dt>
				<dd className="mt-1 min-w-0 text-[13.5px] text-ink">{children}</dd>
			</div>
		</div>
	);
}

/**
 * The signed-in attorney's primary state — which of the states they are admitted
 * in leads their directory listing. Saved on its own, separately from name and
 * photo, because it is a different concern and reuses the same action only to set
 * the one field. The name is resubmitted unchanged so the write is valid; it is
 * the settled account name (the identity control refreshes it on save).
 */
function PrimaryStateField({
	name,
	initialJurisdiction,
	admittedStates,
	role,
}: {
	name: string;
	initialJurisdiction: string;
	admittedStates: string[];
	role: string;
}) {
	const router = useRouter();
	const stateId = useId();
	const stateErrorId = useId();
	const [pending, startTransition] = useTransition();
	const [jurisdiction, setJurisdiction] = useState(initialJurisdiction);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);

	function save() {
		setError(null);
		setSuccess(null);
		const formData = new FormData();
		formData.set("displayName", name);
		formData.set("jurisdiction", jurisdiction);
		startTransition(async () => {
			const result = await saveProfileAction(formData);
			if (!result.ok) {
				setError(result.fieldErrors?.jurisdiction ?? result.error);
				return;
			}
			setJurisdiction(result.profile.jurisdiction ?? "");
			setSuccess("Changes saved");
			router.refresh();
		});
	}

	return (
		<div className="rounded-[var(--radius-card)] border border-border bg-card p-5 sm:p-6">
			<div className="flex flex-col gap-1">
				<h2 className="font-bold text-[16px] text-ink">Primary state</h2>
				<p className="text-[13px] text-ink-soft leading-relaxed">
					The state your directory listing leads with.
				</p>
			</div>

			<div className="mt-5">
				<Label htmlFor={stateId} className="font-semibold text-[13px] text-ink">
					State
				</Label>
				{/* Only the states this attorney is admitted in. Where they practise is
				    managed on the directory profile, alongside each state's bar check —
				    offering all fifty here would let settings name a state no admission
				    backs, and that value is the one the directory would show. */}
				<Select
					value={jurisdiction || null}
					onValueChange={(value) => {
						setJurisdiction(value ?? "");
						setError(null);
						setSuccess(null);
					}}
					disabled={pending || admittedStates.length === 0}
				>
					<SelectTrigger
						id={stateId}
						aria-invalid={Boolean(error)}
						aria-describedby={error ? stateErrorId : undefined}
						className="mt-2 h-11 text-[14px]"
					>
						<SelectValue
							placeholder={
								admittedStates.length === 0
									? "No states added yet"
									: "Select a state"
							}
						/>
					</SelectTrigger>
					<SelectContent>
						<SelectGroup>
							{admittedStates.map((state) => (
								<SelectItem key={state} value={state}>
									{state}
								</SelectItem>
							))}
						</SelectGroup>
					</SelectContent>
				</Select>
				{error ? (
					<InlineError id={stateErrorId}>{error}</InlineError>
				) : (
					<p className="mt-1.5 text-[12px] text-ink-soft leading-relaxed">
						<Link
							href={"/profile" as Route}
							className="font-semibold text-brass-deep underline-offset-2 hover:underline"
						>
							Add or remove states
						</Link>{" "}
						on your directory profile. That list is what decides which cases
						reach you.
					</p>
				)}
			</div>

			<div className="mt-6 flex flex-wrap items-center gap-3 border-border border-t pt-5">
				<Button
					type="button"
					onClick={save}
					disabled={pending || !requiresJurisdiction(role)}
					className="min-h-11 px-5 text-[14px]"
				>
					{pending ? (
						<LoaderCircle
							data-icon="inline-start"
							className="animate-spin"
							aria-hidden="true"
						/>
					) : null}
					Save primary state
				</Button>
				{success ? (
					<p
						role="status"
						className="flex items-center gap-1.5 text-[13px] text-success"
					>
						<CircleCheck className="size-4" aria-hidden="true" />
						{success}
					</p>
				) : null}
			</div>
		</div>
	);
}

/** Self-service JUS-65 profile settings form for every dashboard role. */
export function ProfileSettings({
	profile,
	admittedStates = [],
}: {
	profile: SettingsProfile;
	/** The states this attorney is admitted in — the only valid primaries. Empty
	 *  for every other role, which never sees this control. */
	admittedStates?: string[];
}) {
	const canEditJurisdiction = requiresJurisdiction(profile.role);

	return (
		<div>
			<p className="max-w-[640px] text-[14.5px] text-ink-soft leading-relaxed">
				Manage your account details and privacy.
			</p>

			<div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
				<div className="flex flex-col gap-6">
					<div className="rounded-[var(--radius-card)] border border-border bg-card p-5 sm:p-6">
						<div className="flex flex-col gap-1">
							<h2 className="font-bold text-[16px] text-ink">
								Personal details
							</h2>
							<p className="text-[13px] text-ink-soft leading-relaxed">
								Your name and photo, shown anywhere your account appears.
							</p>
						</div>
						<div className="mt-6">
							<IdentityFields
								initialName={profile.name}
								initialAvatarUrl={profile.avatarUrl}
							/>
						</div>
					</div>

					{canEditJurisdiction ? (
						<PrimaryStateField
							name={profile.name}
							initialJurisdiction={profile.jurisdiction ?? ""}
							admittedStates={admittedStates}
							role={profile.role}
						/>
					) : null}
				</div>

				<aside className="h-fit rounded-[var(--radius-card)] border border-border bg-card p-5 sm:p-6">
					<h2 className="font-bold text-[16px] text-ink">Account details</h2>
					<p className="mt-1 text-[13px] text-ink-soft leading-relaxed">
						Your account information.
					</p>
					<dl className="mt-4">
						<AccountDetail icon={BriefcaseBusiness} label="Role">
							{ROLE_LABELS[profile.role] ?? profile.role}
						</AccountDetail>
						<AccountDetail icon={Mail} label="Email">
							<span className="block truncate" title={profile.email}>
								{profile.email}
							</span>
						</AccountDetail>
						<AccountDetail icon={ShieldCheck} label="Email status">
							<span
								className={cn(
									"inline-flex items-center gap-1.5",
									profile.emailVerified ? "text-success" : "text-ink-soft",
								)}
							>
								<CircleCheck className="size-4" aria-hidden="true" />
								{profile.emailVerified ? "Verified" : "Not verified"}
							</span>
						</AccountDetail>
						<AccountDetail icon={CalendarDays} label="Member since">
							{formatCreatedAt(profile.createdAt)}
						</AccountDetail>
					</dl>

					{profile.role === "attorney" ? (
						<div className="mt-5 border-border border-t pt-5">
							<p className="font-semibold text-[13px] text-ink">
								Public directory profile
							</p>
							<p className="mt-1 text-[12px] text-ink-soft leading-relaxed">
								Manage the information plaintiffs see in the attorney directory.
							</p>
							<Link
								href="/dashboard/profile"
								className={cn(
									buttonVariants({ variant: "outline" }),
									"mt-3 min-h-10 px-4 text-[13px]",
								)}
							>
								Manage directory profile
							</Link>
						</div>
					) : null}
				</aside>
			</div>
		</div>
	);
}
