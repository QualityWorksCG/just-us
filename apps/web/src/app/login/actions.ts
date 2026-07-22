"use server";

import { signUpBasic } from "@just-us/auth/signup";
import { headers } from "next/headers";
import { z } from "zod";

const passwordSchema = z
	.string()
	.min(8, "Password must be at least 8 characters")
	.regex(
		/[0-9!@#$%^&*(),.?":{}|<>]/,
		"Password must include at least one number or symbol",
	);

const signUpSchema = z.object({
	name: z.string().min(2, "Please enter your full name"),
	email: z.email("Enter a valid email address"),
	password: passwordSchema,
});

export type SignUpResult =
	| { ok: true }
	| { ok: false; error: string; fieldErrors?: Record<string, string> };

export async function signUpAction(
	input: z.infer<typeof signUpSchema>,
): Promise<SignUpResult> {
	const parsed = signUpSchema.safeParse(input);
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
		await signUpBasic(parsed.data, await headers());
		return { ok: true };
	} catch (err) {
		const message =
			err instanceof Error ? err.message : "Could not create your account.";
		return { ok: false, error: message };
	}
}
