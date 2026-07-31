"use server";

import { auth } from "@just-us/auth";
import { hashInviteToken } from "@just-us/auth/invite-token";
import {
	type AcceptInvitationResult,
	acceptInvitation,
	findInvitationByTokenHash,
} from "@just-us/db/invitations";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

const acceptSchema = z.object({
	name: z.string().trim().min(2, "Please enter your full name"),
	password: z
		.string()
		.min(8, "Password must be at least 8 characters")
		.regex(
			/[0-9!@#$%^&*(),.?":{}|<>]/,
			"Password must include at least one number or symbol",
		),
});

const CODE_ERRORS: Record<
	Extract<AcceptInvitationResult, { ok: false }>["code"],
	string
> = {
	invalid: "This invitation link is no longer valid. Ask for a new one.",
	expired: "This invitation has expired. Ask for a new one.",
	revoked: "This invitation was revoked. Ask for a new one.",
	used: "This invitation was already used. Try signing in instead.",
	email_taken:
		"An account already exists for that email. Try signing in instead.",
};

export type AcceptInviteResult =
	| { ok: true }
	| { ok: false; error: string; fieldErrors?: Record<string, string> };

/**
 * Accept an administrator invitation. Deliberately unguarded — the invitee has
 * no account yet, so possession of the emailed token is the only credential.
 * A successful accept redirects, so callers only ever see failures.
 */
export async function acceptInviteAction(
	token: string,
	input: { name: string; password: string },
): Promise<AcceptInviteResult> {
	const parsed = acceptSchema.safeParse(input);
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

	const tokenHash = hashInviteToken(token);
	if (!(await findInvitationByTokenHash(tokenHash))) {
		return { ok: false, error: CODE_ERRORS.invalid };
	}

	let accepted: AcceptInvitationResult;
	try {
		// Hash with Better Auth's own KDF so the account row it later reads back is
		// indistinguishable from one created through sign-up.
		const passwordHash = await (await auth.$context).password.hash(
			parsed.data.password,
		);
		accepted = await acceptInvitation({
			tokenHash,
			name: parsed.data.name,
			passwordHash,
		});
	} catch {
		return {
			ok: false,
			error: "Couldn't set up your account. Please try again.",
		};
	}

	if (!accepted.ok) {
		return { ok: false, error: CODE_ERRORS[accepted.code] };
	}

	// The account exists from here on, so a failed sign-in is a convenience
	// problem, not a reason to report failure — send them to the sign-in screen.
	let signedIn = true;
	try {
		await auth.api.signInEmail({
			body: { email: accepted.email, password: parsed.data.password },
			headers: await headers(),
		});
	} catch {
		signedIn = false;
	}

	// redirect() throws NEXT_REDIRECT — it must stay outside the try above so the
	// catch can't swallow it.
	redirect(signedIn ? "/home" : "/login?mode=signin");
}
