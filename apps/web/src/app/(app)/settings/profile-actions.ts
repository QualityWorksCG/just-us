"use server";

import { ProfileAccessError, updateOwnProfile } from "@just-us/db/profile";
import { revalidatePath } from "next/cache";

import { requireOnboarded } from "@/lib/auth-server";
import { AvatarValidationError, deleteAvatar, storeAvatar } from "@/lib/avatar";
import { useLogger, withEvlog } from "@/lib/evlog";
import { validateProfileFields } from "@/lib/profile-validation";

export type SaveProfileResult =
	| {
			ok: true;
			profile: {
				name: string;
				avatarUrl: string | null;
				jurisdiction: string | null;
			};
	  }
	| { ok: false; error: string; fieldErrors?: Record<string, string> };

function formText(formData: FormData, key: string) {
	const value = formData.get(key);
	return typeof value === "string" ? value : "";
}

function formAvatar(formData: FormData) {
	const value = formData.get("avatar");
	return value instanceof File && value.size > 0 ? value : null;
}

/**
 * Persists the signed-in user's profile. No caller-controlled id is accepted:
 * both the query and write are scoped to the user id re-derived from the server
 * session for every submission.
 */
export const saveProfileAction = withEvlog(async function saveProfileAction(
	formData: FormData,
): Promise<SaveProfileResult> {
	const session = await requireOnboarded();
	const log = useLogger();
	const role = (session.user as { role?: string }).role ?? "donor";
	const validated = validateProfileFields({
		role,
		displayName: formText(formData, "displayName"),
		jurisdiction: formText(formData, "jurisdiction"),
	});
	if (!validated.ok) {
		return {
			ok: false,
			error: "Please fix the highlighted field.",
			fieldErrors: validated.fieldErrors,
		};
	}

	const avatar = formAvatar(formData);
	const removeAvatar = formText(formData, "removeAvatar") === "true";
	let newAvatarUrl: string | undefined;

	try {
		if (avatar) {
			newAvatarUrl = (await storeAvatar(session.user.id, avatar)).url;
		}
	} catch (error) {
		const uploadError =
			error instanceof Error
				? error
				: new Error("Unknown avatar upload failure");
		// Keep provider diagnostics on the server. Deliberately exclude image content,
		// filename, Blob URL, and all credentials from the event.
		log.error(uploadError, {
			action: "profile.avatar.upload",
			user: { id: session.user.id },
		});

		return {
			ok: false,
			error: "We couldn’t save your changes. Review the highlighted field.",
			fieldErrors: {
				avatar:
					error instanceof AvatarValidationError
						? error.message
						: "We couldn’t upload that image. Try again.",
			},
		};
	}

	try {
		const updated = await updateOwnProfile({
			userId: session.user.id,
			name: validated.data.displayName,
			// A blank control deliberately means "leave it blank/as-is" so legacy
			// accounts can save a name or photo without acquiring a jurisdiction.
			jurisdiction: validated.data.jurisdiction,
			image: newAvatarUrl ?? (removeAvatar ? null : undefined),
		});

		// The database now points at the replacement (or null), so remove the old
		// object afterwards. A cleanup failure never undoes a successful profile
		// save; it only leaves a harmless orphan for lifecycle cleanup.
		if (newAvatarUrl || removeAvatar) {
			try {
				await deleteAvatar(updated.previousImage);
			} catch {
				// Best-effort object cleanup; keep the user-facing save successful.
			}
		}

		revalidatePath("/home");
		revalidatePath("/settings");
		return {
			ok: true,
			profile: {
				name: updated.profile.name,
				avatarUrl: updated.profile.image,
				jurisdiction: updated.profile.jurisdiction,
			},
		};
	} catch (error) {
		if (newAvatarUrl) {
			try {
				await deleteAvatar(newAvatarUrl);
			} catch {
				// The original failure is more useful than a compensating-delete error.
			}
		}

		if (error instanceof ProfileAccessError) {
			return {
				ok: false,
				error: "We couldn’t save your changes.",
				fieldErrors: { jurisdiction: error.message },
			};
		}
		return {
			ok: false,
			error: "We couldn’t save your changes. Please try again.",
		};
	}
});
