"use client";

import { Button } from "@just-us/ui/components/button";
import { Input } from "@just-us/ui/components/input";
import { Label } from "@just-us/ui/components/label";
import {
	Camera,
	CircleAlert,
	CircleCheck,
	LoaderCircle,
	Trash2,
} from "lucide-react";
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

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const ACCEPTED_AVATAR_TYPES = new Set([
	"image/jpeg",
	"image/png",
	"image/webp",
]);

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

/**
 * The one editor for who the account is — display name and photo — used on both
 * the account settings page and the attorney directory profile.
 *
 * There used to be two of these: settings wrote `User.name`/`User.image`, the
 * directory profile wrote its own `legalName`/`headshotUrl`, and the two drifted.
 * This is the single control, so a name or photo set anywhere is the name and
 * photo everywhere. It writes through `saveProfileAction` — the server-side
 * pipeline that re-encodes the image and strips its EXIF before it becomes a
 * public photo — and that action mirrors the values onto the directory profile,
 * so both surfaces agree without either owning a second copy. Jurisdiction is
 * deliberately never submitted here, so an identity save never disturbs the
 * attorney's primary state.
 */
export function IdentityFields({
	initialName,
	initialAvatarUrl,
	nameLabel = "Display name",
	nameHint,
	onSaved,
}: {
	initialName: string;
	initialAvatarUrl: string | null;
	/** Framed as "Legal name" on the directory profile, "Display name" elsewhere —
	 *  the same stored value either way. */
	nameLabel?: string;
	nameHint?: string;
	/** Lets a host keep its own derived state (a readiness meter, a verify gate) in
	 *  step with a save without waiting on the router refresh. */
	onSaved?: (saved: { name: string; avatarUrl: string | null }) => void;
}) {
	const router = useRouter();
	const fileInputRef = useRef<HTMLInputElement>(null);
	const nameId = useId();
	const avatarErrorId = useId();
	const nameErrorId = useId();
	const [pending, startTransition] = useTransition();
	const [name, setName] = useState(initialName);
	const [selectedAvatar, setSelectedAvatar] = useState<File | null>(null);
	const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
	const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);
	const [removeAvatar, setRemoveAvatar] = useState(false);
	const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
	const [formError, setFormError] = useState<string | null>(null);
	const [successMessage, setSuccessMessage] = useState<string | null>(null);

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

	function validateName(value: string) {
		const trimmed = value.trim();
		if (!trimmed) {
			setFieldErrors((current) => ({
				...current,
				displayName: "Enter a name.",
			}));
			return false;
		}
		if (trimmed.length > 100) {
			setFieldErrors((current) => ({
				...current,
				displayName: "Keep your name to 100 characters or fewer.",
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
		if (!validateName(name)) return;

		const formData = new FormData();
		formData.set("displayName", name);
		if (selectedAvatar) formData.set("avatar", selectedAvatar);
		if (removeAvatar && !selectedAvatar) formData.set("removeAvatar", "true");

		startTransition(async () => {
			const result = await saveProfileAction(formData);
			if (!result.ok) {
				setFormError(result.error);
				setFieldErrors(result.fieldErrors ?? {});
				return;
			}

			setName(result.profile.name);
			setAvatarUrl(result.profile.avatarUrl);
			setRemoveAvatar(false);
			clearAvatarSelection();
			setFieldErrors({});
			setSuccessMessage("Changes saved");
			onSaved?.({
				name: result.profile.name,
				avatarUrl: result.profile.avatarUrl,
			});
			// Propagates the new name and photo to the dashboard shell (the sidebar
			// avatar) and the other surface that shows them.
			router.refresh();
		});
	}

	const avatarSrc = avatarPreview ?? (removeAvatar ? null : avatarUrl);

	return (
		<form onSubmit={onSubmit} className="flex flex-col gap-6">
			<section aria-labelledby={`${nameId}-photo`}>
				<p
					id={`${nameId}-photo`}
					className="font-semibold text-[13px] text-ink"
				>
					Profile photo
				</p>
				<div className="mt-3 flex flex-wrap items-center gap-4">
					<span className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brass font-bold text-[20px] text-brass-ink">
						{avatarSrc ? (
							// biome-ignore lint/performance/noImgElement: user-uploaded Blob image, not a static asset
							<img
								src={avatarSrc}
								alt="Your profile"
								className="size-full object-cover"
							/>
						) : (
							initials(name)
						)}
					</span>
					<div className="flex min-w-0 flex-1 flex-col gap-2">
						<p className="text-[13px] text-ink-soft leading-relaxed">
							Shown on your profile and anywhere your name appears.
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
							{avatarUrl ? (
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
							{selectedAvatar && !avatarUrl ? (
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
							aria-describedby={fieldErrors.avatar ? avatarErrorId : undefined}
						/>
					</div>
				</div>
				{fieldErrors.avatar ? (
					<InlineError id={avatarErrorId}>{fieldErrors.avatar}</InlineError>
				) : null}
			</section>

			<div>
				<Label htmlFor={nameId} className="font-semibold text-[13px] text-ink">
					{nameLabel}
				</Label>
				<Input
					id={nameId}
					value={name}
					onChange={(event) => {
						setName(event.target.value);
						setSuccessMessage(null);
					}}
					onBlur={(event) => validateName(event.target.value)}
					aria-invalid={Boolean(fieldErrors.displayName)}
					aria-describedby={fieldErrors.displayName ? nameErrorId : undefined}
					disabled={pending}
					className="mt-2 h-11 px-3 text-[14px]"
				/>
				{fieldErrors.displayName ? (
					<InlineError id={nameErrorId}>{fieldErrors.displayName}</InlineError>
				) : nameHint ? (
					<p className="mt-1.5 text-[12px] text-ink-soft leading-relaxed">
						{nameHint}
					</p>
				) : null}
			</div>

			<div className="flex flex-wrap items-center gap-3">
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
					Save name & photo
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
	);
}
