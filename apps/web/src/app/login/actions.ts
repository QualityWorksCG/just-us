"use server";

import { signUpBasic } from "@just-us/auth/signup";
import prisma from "@just-us/db";
import { headers } from "next/headers";
import { z } from "zod";

/** Whether an account already exists for an email (case-insensitive). */
async function emailExists(email: string): Promise<boolean> {
	const normalized = email.trim();
	if (!normalized) return false;
	const user = await prisma.user.findFirst({
		where: { email: { equals: normalized, mode: "insensitive" } },
		select: { id: true },
	});
	return !!user;
}

/** True when the Better Auth signup failed because the email is already taken. */
function isExistingEmailError(err: unknown): boolean {
	if (typeof err !== "object" || err === null) return false;
	const e = err as {
		body?: { code?: unknown; message?: unknown };
		message?: unknown;
	};
	const code = typeof e.body?.code === "string" ? e.body.code : "";
	const text = [
		typeof e.body?.message === "string" ? e.body.message : "",
		typeof e.message === "string" ? e.message : "",
	]
		.join(" ")
		.toLowerCase();
	return (
		code === "USER_ALREADY_EXISTS" ||
		code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL" ||
		text.includes("already exists") ||
		text.includes("existing email") ||
		text.includes("already registered")
	);
}

const EMAIL_TAKEN: SignUpResult = {
	ok: false,
	error: "An account with that email already exists. Try signing in instead.",
	fieldErrors: { email: "That email is already registered" },
};

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

	// With `requireEmailVerification` on, Better Auth returns a generic success
	// (a synthetic user, no throw) for an existing email — enumeration protection.
	// So we can't rely on it erroring; check up front and report it ourselves.
	if (await emailExists(parsed.data.email)) {
		return EMAIL_TAKEN;
	}

	try {
		await signUpBasic(parsed.data, await headers());
		return { ok: true };
	} catch (err) {
		// Belt-and-suspenders for a race between the check above and creation.
		if (isExistingEmailError(err)) return EMAIL_TAKEN;
		const message =
			err instanceof Error ? err.message : "Could not create your account.";
		return { ok: false, error: message };
	}
}

/**
 * Whether an account exists for an email. Used to give an immediate, clear error
 * when someone requests a magic link for an unregistered address (magic-link
 * signup is disabled, so Better Auth otherwise defers the failure to the click).
 */
export async function accountExistsAction(email: string): Promise<boolean> {
	return emailExists(email);
}
