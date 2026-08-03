import { isValidJurisdiction } from "@just-us/auth/jurisdiction";
import { requiresJurisdiction } from "@just-us/auth/rbac";
import { z } from "zod";

const profileSchema = z.object({
	displayName: z
		.string()
		.trim()
		.min(1, "Enter a display name.")
		.max(100, "Keep your display name to 100 characters or fewer."),
});

export type ValidatedProfileFields = {
	displayName: string;
	/** Undefined intentionally preserves a legacy null value. */
	jurisdiction?: string;
};

export type ProfileFieldValidation =
	| { ok: true; data: ValidatedProfileFields }
	| { ok: false; fieldErrors: Record<string, string> };

/**
 * Shared profile-form validation. The server action is the enforcement point;
 * keeping this function framework-free also makes the JUS-65 policy executable
 * without a database or a browser.
 */
export function validateProfileFields({
	role,
	displayName,
	jurisdiction,
}: {
	role: string;
	displayName: string;
	jurisdiction: string;
}): ProfileFieldValidation {
	const parsed = profileSchema.safeParse({ displayName });
	if (!parsed.success) {
		const fieldErrors: Record<string, string> = {};
		for (const issue of parsed.error.issues) {
			const field = issue.path[0];
			if (typeof field === "string" && !fieldErrors[field]) {
				fieldErrors[field] = issue.message;
			}
		}
		return { ok: false, fieldErrors };
	}

	const submittedJurisdiction = jurisdiction.trim();
	if (!submittedJurisdiction) {
		return { ok: true, data: { displayName: parsed.data.displayName } };
	}
	if (!requiresJurisdiction(role)) {
		return {
			ok: false,
			fieldErrors: {
				jurisdiction: "Jurisdiction is not available for this account type.",
			},
		};
	}
	if (!isValidJurisdiction(submittedJurisdiction)) {
		return {
			ok: false,
			fieldErrors: {
				jurisdiction: "Choose a valid U.S. state and try again.",
			},
		};
	}

	return {
		ok: true,
		data: {
			displayName: parsed.data.displayName,
			jurisdiction: submittedJurisdiction,
		},
	};
}
