"use server";

import { completeUserOnboarding } from "@just-us/auth/signup";
import { z } from "zod";

import { requireVerifiedSession } from "@/lib/auth-server";

const onboardingSchema = z
	.object({
		role: z.enum(["plaintiff", "donor", "attorney"]),
		firmName: z.string().optional(),
		barNumber: z.string().optional(),
		jurisdiction: z.string().optional(),
	})
	.superRefine((val, ctx) => {
		if (val.role === "attorney") {
			if (!val.jurisdiction)
				ctx.addIssue({
					code: "custom",
					path: ["jurisdiction"],
					message: "Select your jurisdiction",
				});
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
