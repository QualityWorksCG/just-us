"use server";

import { auth } from "@just-us/auth";
import { hashInviteToken } from "@just-us/auth/invite-token";
import { isBlocked } from "@just-us/auth/user-status";
import {
	type CaseInvitationRef,
	type CaseInvitationTokenErrorCode,
	type ConfirmCaseInvitationErrorCode,
	confirmCaseInvitation,
	createInvitedAttorneyAccount,
	declineCaseInvitation,
} from "@just-us/db/case-invitations";
import type { Route } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getSession } from "@/lib/auth-server";
import { type CaseInviteRef, caseInviteHref } from "@/lib/case-invite-ref";

/**
 * The three things the invited attorney can do with their link: create the
 * account they need to answer, say yes, or say no.
 *
 * Every one of them resolves the caller's ref here — hashing the raw token, or
 * passing the invitation id through — and hands it to the data layer, which
 * re-checks the invitation, the identity, and the case inside its own
 * transaction. Nothing on the page that rendered the button is trusted: the
 * screen was drawn from a read that may be seconds stale, and confirming is the
 * act that binds an attorney to a matter.
 *
 * Account creation stays token-only. Someone with no account has no session to
 * be identified by, so the emailed token is the only thing they can offer, and
 * an id must never be enough to make an account for somebody else's address.
 */

/** Terminal-token wording, shared by all three actions. Expiry and decline say
 *  where the case went, because "it's over" without "and the plaintiff is being
 *  helped by someone else now" reads as a dead end. */
const TOKEN_ERRORS: Record<CaseInvitationTokenErrorCode, string> = {
	invalid: "This invitation link is no longer valid. Ask for a new one.",
	expired:
		"This invitation has expired, and the case has gone back to the attorney queue.",
	declined:
		"This invitation was already declined, and the case has gone back to the attorney queue.",
	revoked: "The plaintiff withdrew this invitation.",
	used: "This invitation has already been answered.",
};

const CONFIRM_ERRORS: Record<ConfirmCaseInvitationErrorCode, string> = {
	...TOKEN_ERRORS,
	email_mismatch:
		"This invitation was sent to a different email address. Sign in with that address to confirm.",
	not_attorney:
		"Only an attorney account can confirm representation. Finish attorney onboarding first.",
	not_verified:
		"Your bar standing has to be verified before you can take on a case.",
	not_admitted:
		"You aren't admitted in this case's state, so you can't confirm representation on it. Add the state on your directory profile and verify your bar standing there.",
	case_unavailable:
		"This case is no longer available — the plaintiff may have withdrawn it or already have an attorney.",
};

export type CaseInviteActionResult =
	| { ok: true }
	| { ok: false; error: string; fieldErrors?: Record<string, string> };

const accountSchema = z.object({
	name: z.string().trim().min(2, "Please enter your full name"),
	password: z
		.string()
		.min(8, "Password must be at least 8 characters")
		.regex(
			/[0-9!@#$%^&*(),.?":{}|<>]/,
			"Password must include at least one number or symbol",
		),
});

/**
 * The ref, as it arrives from the browser.
 *
 * A server action is a public endpoint, so what a client passes is an argument
 * and not a fact — and both members of this union end up in a database lookup.
 * Shape-checked here so junk is answered with "this invitation is no longer
 * valid" rather than by a thrown query, and `strict` so nothing rides along
 * beside the one field each route is allowed to carry.
 */
const refSchema = z.union([
	z.strictObject({ token: z.string().min(1).max(256) }),
	z.strictObject({
		invitationId: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/),
	}),
]);

/** Where a link-holder is sent back to after signing in or declining — the same
 *  page, which re-reads everything and decides what to show next. */
function inviteUrl(ref: CaseInviteRef, params?: Record<string, string>) {
	return caseInviteHref(ref, params) as Route;
}

/** The web app's ref in the data layer's terms. The token is hashed here, in the
 *  one place that knows the raw value, so nothing below ever sees it. */
function dbRef(ref: CaseInviteRef): CaseInvitationRef {
	return "token" in ref
		? { tokenHash: hashInviteToken(ref.token) }
		: { invitationId: ref.invitationId };
}

/**
 * Create the attorney account for an invitation whose address has none.
 *
 * Unguarded by design — the invitee has no account yet, so possession of the
 * emailed token is the only credential they can offer. It does not accept the
 * invitation: the account only gets them far enough to read the case and press
 * Confirm, which is still gated on onboarding and bar verification.
 */
export async function createCaseInviteAccountAction(
	token: string,
	input: { name: string; password: string },
): Promise<CaseInviteActionResult> {
	const parsed = accountSchema.safeParse(input);
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

	let created: Awaited<ReturnType<typeof createInvitedAttorneyAccount>>;
	try {
		// Better Auth's own KDF, so the credential row is indistinguishable from
		// one written by sign-up and the password works on the normal sign-in form.
		const passwordHash = await (await auth.$context).password.hash(
			parsed.data.password,
		);
		created = await createInvitedAttorneyAccount({
			tokenHash: hashInviteToken(token),
			name: parsed.data.name,
			passwordHash,
		});
	} catch {
		return {
			ok: false,
			error: "Couldn't set up your account. Please try again.",
		};
	}

	if (!created.ok) {
		return {
			ok: false,
			error:
				created.code === "email_taken"
					? "An account already exists for that email. Sign in, then open this link again."
					: TOKEN_ERRORS[created.code],
		};
	}

	// From here the account exists, so a failed sign-in is an inconvenience
	// rather than a failure — send them to sign in and come back.
	let signedIn = true;
	try {
		await auth.api.signInEmail({
			body: { email: created.email, password: parsed.data.password },
			headers: await headers(),
		});
	} catch {
		signedIn = false;
	}

	// redirect() throws NEXT_REDIRECT, so it has to stay outside the try above.
	redirect(signedIn ? inviteUrl({ token }) : "/login?mode=signin");
}

/**
 * The attorney confirms. Success never returns — they land on the case, where
 * the payout account they now have to open is waiting for them.
 */
export async function confirmCaseInviteAction(
	input: CaseInviteRef,
): Promise<CaseInviteActionResult> {
	const parsedRef = refSchema.safeParse(input);
	if (!parsedRef.success) {
		return { ok: false, error: TOKEN_ERRORS.invalid };
	}
	const ref = parsedRef.data;

	const session = await getSession();
	if (!session?.user) {
		return {
			ok: false,
			error: "Sign in with the invited email address to confirm.",
		};
	}

	// The two account-level conditions the data layer's transaction does not ask
	// about, applied here as everywhere else a privileged mutation runs. Confirming
	// makes this account the attorney of record and unlocks the case's payout
	// onboarding; a blocked account, or one whose address was never confirmed, must
	// not reach that — and blocking only clears sessions, so a cookie session can
	// outlive it. Written out rather than routed through `requireVerifiedSession`
	// because that redirects, which would lose the invitation.
	const user = session.user as typeof session.user & {
		banned?: boolean | null;
		banExpires?: Date | string | null;
	};
	if (isBlocked(user)) {
		return {
			ok: false,
			error:
				"This account has been blocked and can't take on a case. Contact support if you believe this is a mistake.",
		};
	}
	if (!user.emailVerified) {
		return {
			ok: false,
			error: "Verify your email address before confirming a case.",
		};
	}

	let result: Awaited<ReturnType<typeof confirmCaseInvitation>>;
	try {
		result = await confirmCaseInvitation({
			ref: dbRef(ref),
			attorneyId: session.user.id,
		});
	} catch {
		return { ok: false, error: "Couldn't confirm just now. Please try again." };
	}

	if (!result.ok) return { ok: false, error: CONFIRM_ERRORS[result.code] };

	// The attorney's own view of the case they now represent — the same screen
	// Stripe returns them to once they start the payout account.
	redirect(`/my-cases/${result.caseId}` as Route);
}

/**
 * The attorney says no.
 *
 * The token route takes no session: declining is not a privileged act, and the
 * person who was emailed the link should not have to make an account to say they
 * aren't taking the case. A signed-in decline is recorded as theirs; an anonymous
 * one still settles the invitation and puts the case back in the queue.
 *
 * The id route is the opposite — an id proves nothing on its own — so the signed-in
 * address has to match the invited one, enforced inside the data layer's
 * transaction. Without that, a guessed id would let a stranger throw somebody
 * else's case back into the queue.
 */
export async function declineCaseInviteAction(
	input: CaseInviteRef,
): Promise<CaseInviteActionResult> {
	const parsedRef = refSchema.safeParse(input);
	if (!parsedRef.success) {
		return { ok: false, error: TOKEN_ERRORS.invalid };
	}
	const ref = parsedRef.data;

	const session = await getSession();

	if (!("token" in ref) && !session?.user) {
		return {
			ok: false,
			error: "Sign in with the invited email address to decline.",
		};
	}

	let result: Awaited<ReturnType<typeof declineCaseInvitation>>;
	try {
		result = await declineCaseInvitation({
			ref: dbRef(ref),
			actorId: session?.user.id ?? null,
			// Only sent on the id route. `undefined` is what tells the data layer this
			// caller held the token and needs no address of its own.
			...("token" in ref ? {} : { requireEmail: session?.user.email ?? null }),
		});
	} catch {
		return { ok: false, error: "Couldn't record that. Please try again." };
	}

	if (!result.ok) return { ok: false, error: TOKEN_ERRORS[result.code] };

	// Back to this page, which now reads the invitation as declined and says so
	// — one screen owns every state of this link, including its last one.
	redirect(inviteUrl(ref, { declined: "1" }));
}
