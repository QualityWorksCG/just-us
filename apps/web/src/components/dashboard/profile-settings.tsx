"use client";

import { US_STATES } from "@just-us/auth/jurisdiction";
import { requiresJurisdiction } from "@just-us/auth/rbac";
import { Button, buttonVariants } from "@just-us/ui/components/button";
import { Input } from "@just-us/ui/components/input";
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
	Camera,
	CircleAlert,
	CircleCheck,
	LoaderCircle,
	Mail,
	ShieldCheck,
	Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
	type ChangeEvent,
	useEffect,
	useId,
	useRef,
	useState,
	useTransition,
} from "react";

import { saveProfileAction } from "@/app/(app)/settings/profile-actions";

type SettingsProfile = {
	id: string;
	name: string;
	email: string;
	emailVerified: boolean;
	hasAvatar: boolean;
	role: string;
	jurisdiction: string | null;
	createdAt: string;
};

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const ACCEPTED_AVATAR_TYPES = new Set([
	"image/jpeg",
	"image/png",
	"image/webp",
]);

const ROLE_LABELS: Record<string, string> = {
	plaintiff: "Plaintiff",
	attorney: "Attorney",
	donor: "Donor",
	administrator: "Administrator",
};

function initials(name: string) {
	return (
		name
			.trim()
			.split(/\s+/)
			.slice(0, 2)
			.map((part) => part[0]?.toUpperCase() ?? "")
			.join("") || "JU"
	);
}

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

/** Self-service JUS-65 profile settings form for every dashboard role. */
export function ProfileSettings({ profile }: { profile: SettingsProfile }) {
	const router = useRouter();
	const fileInputRef = useRef<HTMLInputElement>(null);
	const displayNameId = useId();
	const stateId = useId();
	const avatarErrorId = useId();
	const nameErrorId = useId();
	const stateErrorId = useId();
	const [pending, startTransition] = useTransition();
	const [displayName, setDisplayName] = useState(profile.name);
	const [jurisdiction, setJurisdiction] = useState(profile.jurisdiction ?? "");
	const [selectedAvatar, setSelectedAvatar] = useState<File | null>(null);
	const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
	const [hasAvatar, setHasAvatar] = useState(profile.hasAvatar);
	const [removeAvatar, setRemoveAvatar] = useState(false);
	const [avatarVersion, setAvatarVersion] = useState(0);
	const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
	const [formError, setFormError] = useState<string | null>(null);
	const [successMessage, setSuccessMessage] = useState<string | null>(null);
	const canEditJurisdiction = requiresJurisdiction(profile.role);

	useEffect(
		() => () => {
			if (avatarPreview) URL.revokeObjectURL(avatarPreview);
		},
		[avatarPreview],
	);

	function clearFieldError(field: string) {
		setFieldErrors((current) => {
			const { [field]: _removed, ...remaining } = current;
			return remaining;
		});
	}

	function validateDisplayName(value: string) {
		const trimmed = value.trim();
		if (!trimmed) {
			setFieldErrors((current) => ({
				...current,
				displayName: "Enter a display name.",
			}));
			return false;
		}
		if (trimmed.length > 100) {
			setFieldErrors((current) => ({
				...current,
				displayName: "Keep your display name to 100 characters or fewer.",
			}));
			return false;
		}
		clearFieldError("displayName");
		return true;
	}

	function chooseAvatar(event: ChangeEvent<HTMLInputElement>) {
		const file = event.target.files?.[0] ?? null;
		event.target.value = "";
		if (!file) return;

		setSuccessMessage(null);
		setFormError(null);
		if (!ACCEPTED_AVATAR_TYPES.has(file.type)) {
			setFieldErrors((current) => ({
				...current,
				avatar: "Choose a JPG, PNG, or WebP image for your profile photo.",
			}));
			return;
		}
		if (file.size > MAX_AVATAR_BYTES) {
			setFieldErrors((current) => ({
				...current,
				avatar:
					"That image is too large. Choose a JPG, PNG, or WebP under 2 MB.",
			}));
			return;
		}

		clearFieldError("avatar");
		setRemoveAvatar(false);
		setSelectedAvatar(file);
		setAvatarPreview((current) => {
			if (current) URL.revokeObjectURL(current);
			return URL.createObjectURL(file);
		});
	}

	function clearAvatarSelection() {
		setSelectedAvatar(null);
		setAvatarPreview((current) => {
			if (current) URL.revokeObjectURL(current);
			return null;
		});
		clearFieldError("avatar");
	}

	function markAvatarForRemoval() {
		clearAvatarSelection();
		setRemoveAvatar(true);
		setSuccessMessage(null);
	}

	function keepAvatar() {
		setRemoveAvatar(false);
		setSuccessMessage(null);
	}

	function onSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setSuccessMessage(null);
		setFormError(null);
		if (!validateDisplayName(displayName)) return;

		const formData = new FormData();
		formData.set("displayName", displayName);
		if (canEditJurisdiction) formData.set("jurisdiction", jurisdiction);
		if (selectedAvatar) formData.set("avatar", selectedAvatar);
		if (removeAvatar && !selectedAvatar) formData.set("removeAvatar", "true");

		startTransition(async () => {
			const result = await saveProfileAction(formData);
			if (!result.ok) {
				setFormError(result.error);
				setFieldErrors(result.fieldErrors ?? {});
				return;
			}

			setDisplayName(result.profile.name);
			setJurisdiction(result.profile.jurisdiction ?? "");
			setHasAvatar(result.profile.hasAvatar);
			setRemoveAvatar(false);
			clearAvatarSelection();
			setAvatarVersion((version) => version + 1);
			setFieldErrors({});
			setSuccessMessage("Changes saved");
			// Refreshes the server component tree rather than reloading the document;
			// the dashboard shell receives the new sidebar name/avatar immediately.
			router.refresh();
		});
	}

	const avatarSrc =
		avatarPreview ??
		(hasAvatar && !removeAvatar
			? `/api/avatars/${profile.id}?v=${avatarVersion}`
			: null);

	return (
		<div>
			<p className="max-w-[640px] text-[14.5px] text-ink-soft leading-relaxed">
				Manage your account details and privacy.
			</p>

			<div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
				<form
					onSubmit={onSubmit}
					className="rounded-[var(--radius-card)] border border-border bg-card p-5 sm:p-6"
				>
					<div className="flex flex-col gap-1">
						<h2 className="font-bold text-[16px] text-ink">Personal details</h2>
						<p className="text-[13px] text-ink-soft leading-relaxed">
							Update the details shown on your private account.
						</p>
					</div>

					<div className="mt-6 flex flex-col gap-6">
						<section aria-labelledby="profile-photo-label">
							<p
								id="profile-photo-label"
								className="font-semibold text-[13px] text-ink"
							>
								Profile photo
							</p>
							<div className="mt-3 flex flex-wrap items-center gap-4">
								<span className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brass font-bold text-[20px] text-brass-ink">
									{avatarSrc ? (
										// Deliberately a first-party, cookie-authenticated URL; next/image
										// would not forward the session cookie to this private endpoint.
										// biome-ignore lint/performance/noImgElement: authenticated image route
										<img
											src={avatarSrc}
											alt="Your profile"
											className="size-full object-cover"
										/>
									) : (
										initials(displayName)
									)}
								</span>
								<div className="flex min-w-0 flex-1 flex-col gap-2">
									<p className="text-[13px] text-ink-soft leading-relaxed">
										Private to your account and people you message.
									</p>
									<div className="flex flex-wrap gap-2">
										<Button
											type="button"
											variant="outline"
											onClick={() => fileInputRef.current?.click()}
											disabled={pending}
											className="min-h-10 px-4 text-[13px]"
										>
											<Camera data-icon="inline-start" aria-hidden="true" />
											Change photo
										</Button>
										{hasAvatar ? (
											removeAvatar ? (
												<Button
													type="button"
													variant="outline"
													onClick={keepAvatar}
													disabled={pending}
													className="min-h-10 px-4 text-[13px]"
												>
													Keep photo
												</Button>
											) : (
												<Button
													type="button"
													variant="destructive"
													onClick={markAvatarForRemoval}
													disabled={pending}
													className="min-h-10 px-4 text-[13px]"
												>
													<Trash2 data-icon="inline-start" aria-hidden="true" />
													Remove photo
												</Button>
											)
										) : null}
										{selectedAvatar && !hasAvatar ? (
											<Button
												type="button"
												variant="ghost"
												onClick={clearAvatarSelection}
												disabled={pending}
												className="min-h-10 px-4 text-[13px]"
											>
												Clear selection
											</Button>
										) : null}
									</div>
									<input
										ref={fileInputRef}
										type="file"
										accept="image/jpeg,image/png,image/webp"
										onChange={chooseAvatar}
										className="sr-only"
										aria-label="Choose a profile photo"
										aria-describedby={
											fieldErrors.avatar ? avatarErrorId : undefined
										}
									/>
								</div>
							</div>
							{fieldErrors.avatar ? (
								<InlineError id={avatarErrorId}>
									{fieldErrors.avatar}
								</InlineError>
							) : null}
						</section>

						<div>
							<Label
								htmlFor={displayNameId}
								className="font-semibold text-[13px] text-ink"
							>
								Display name
							</Label>
							<Input
								id={displayNameId}
								value={displayName}
								onChange={(event) => {
									setDisplayName(event.target.value);
									setSuccessMessage(null);
								}}
								onBlur={(event) => validateDisplayName(event.target.value)}
								aria-invalid={Boolean(fieldErrors.displayName)}
								aria-describedby={
									fieldErrors.displayName ? nameErrorId : undefined
								}
								disabled={pending}
								className="mt-2 h-11 px-3 text-[14px]"
							/>
							{fieldErrors.displayName ? (
								<InlineError id={nameErrorId}>
									{fieldErrors.displayName}
								</InlineError>
							) : null}
						</div>

						{canEditJurisdiction ? (
							<div>
								<Label
									htmlFor={stateId}
									className="font-semibold text-[13px] text-ink"
								>
									State
								</Label>
								<Select
									value={jurisdiction || null}
									onValueChange={(value) => {
										setJurisdiction(value ?? "");
										clearFieldError("jurisdiction");
										setSuccessMessage(null);
									}}
									disabled={pending}
								>
									<SelectTrigger
										id={stateId}
										aria-invalid={Boolean(fieldErrors.jurisdiction)}
										aria-describedby={
											fieldErrors.jurisdiction ? stateErrorId : undefined
										}
										className="mt-2 h-11 text-[14px]"
									>
										<SelectValue placeholder="Select a state" />
									</SelectTrigger>
									<SelectContent>
										<SelectGroup>
											{US_STATES.map((state) => (
												<SelectItem key={state} value={state}>
													{state}
												</SelectItem>
											))}
										</SelectGroup>
									</SelectContent>
								</Select>
								{fieldErrors.jurisdiction ? (
									<InlineError id={stateErrorId}>
										{fieldErrors.jurisdiction}
									</InlineError>
								) : (
									<p className="mt-1.5 text-[12px] text-ink-soft leading-relaxed">
										{jurisdiction
											? "Use the state where you seek or provide legal representation."
											: "You can leave this blank and save other changes."}
									</p>
								)}
							</div>
						) : null}
					</div>

					<div className="mt-8 flex flex-wrap items-center gap-3 border-border border-t pt-5">
						<Button
							type="submit"
							disabled={pending}
							className="min-h-11 px-5 text-[14px]"
						>
							{pending ? (
								<LoaderCircle
									data-icon="inline-start"
									className="animate-spin"
									aria-hidden="true"
								/>
							) : null}
							Save changes
						</Button>
						{successMessage ? (
							<p
								role="status"
								className="flex items-center gap-1.5 text-[13px] text-success"
							>
								<CircleCheck className="size-4" aria-hidden="true" />
								{successMessage}
							</p>
						) : null}
					</div>
					{formError ? <InlineError>{formError}</InlineError> : null}
				</form>

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

					<p className="mt-5 border-border border-t pt-5 text-[12px] text-ink-soft leading-relaxed">
						Your email and role can’t be changed here. Changing an email
						requires verification.
					</p>
				</aside>
			</div>
		</div>
	);
}
