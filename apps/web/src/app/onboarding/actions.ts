"use server";

import {
	isValidJurisdiction,
	JURISDICTION_MESSAGE,
} from "@just-us/auth/jurisdiction";
import { requiresJurisdiction } from "@just-us/auth/rbac";
import { completeUserOnboarding } from "@just-us/auth/signup";
import { z } from "zod";

import { requireVerifiedSession } from "@/lib/auth-server";
import { BAR_NUMBER_MESSAGE, isValidBarNumber } from "@/lib/validation";

const onboardingSchema = z
	.object({
		role: z.enum(["plaintiff", "donor", "attorney"]),
		firmName: z.string().optional(),
		barNumber: z.string().optional(),
		// Every state the attorney is admitted in. Capped so a hand-made request
		// can't ask us to write fifty admission rows for one account; nobody
		// practises in more states than this.
		jurisdictions: z.array(z.string()).max(12).optional(),
	})
	.superRefine((val, ctx) => {
		// Only the roles in JURISDICTION_ROLES supply these (JUS-12), and each has to
		// be one of the known states so downstream comparisons — against
		// `Case.location`, in every matching gate — match the exact string.
		if (requiresJurisdiction(val.role)) {
			const states = val.jurisdictions ?? [];
			if (states.length === 0 || !states.every(isValidJurisdiction))
				ctx.addIssue({
					code: "custom",
					path: ["jurisdictions"],
					message: JURISDICTION_MESSAGE,
				});
		}

		if (val.role === "attorney") {
			if (!val.firmName)
				ctx.addIssue({
					code: "custom",
					path: ["firmName"],
					message: "Enter your firm",
				});
			if (!val.barNumber)
				ctx.addIssue({
					code: "custom",
					path: ["barNumber"],
					message: "Enter your bar number",
				});
			else if (!isValidBarNumber(val.barNumber))
				ctx.addIssue({
					code: "custom",
					path: ["barNumber"],
					message: BAR_NUMBER_MESSAGE,
				});
		}
	});

export type OnboardingResult =
	| { ok: true }
	| { ok: false; error: string; fieldErrors?: Record<string, string> };

export async function completeOnboardingAction(
	input: z.infer<typeof onboardingSchema>,
): Promise<OnboardingResult> {
	// Must be signed in and verified to onboard.
	const session = await requireVerifiedSession();

	const parsed = onboardingSchema.safeParse(input);
	if (!parsed.success) {
		const fieldErrors: Record<string, string> = {};
		for (const issue of parsed.error.issues) {
			const key = issue.path[0];
			if (typeof key === "string" && !fieldErrors[key])
				fieldErrors[key] = issue.message;
		}
		return {
			ok: false,
			error: "Please fix the highlighted fields.",
			fieldErrors,
		};
	}

	try {
		await completeUserOnboarding(session.user.id, parsed.data);
		return { ok: true };
	} catch {
		return {
			ok: false,
			error: "Could not save your details. Please try again.",
		};
	}
}
