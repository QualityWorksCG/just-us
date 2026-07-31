"use server";

import { generateInviteToken } from "@just-us/auth/invite-token";
import { sendAdminInviteEmail } from "@just-us/auth/lib/email";
import {
	ADMIN_INVITATION_TTL_DAYS,
	countRecentInvitationsBy,
	createInvitation,
	resendInvitation,
	revokeInvitation,
} from "@just-us/db/invitations";
import { env } from "@just-us/env/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { guardAdministrator } from "@/lib/auth-server";

const inviteEmailSchema = z
	.string()
	.trim()
	.toLowerCase()
	.pipe(z.email("Enter a valid email address."));

// A compromised administrator account shouldn't be able to spray invitations, so
// each actor gets a ceiling per rolling hour.
const INVITE_WINDOW_MS = 60 * 60 * 1000;
const MAX_INVITES_PER_WINDOW = 10;

const TTL_MS = ADMIN_INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000;

function inviteExpiry() {
	return new Date(Date.now() + TTL_MS);
}

function acceptUrl(token: string) {
	return `${env.BETTER_AUTH_URL}/accept-invite?token=${token}`;
}

export type InviteResult = { ok: true } | { ok: false; error: string };

/** Invite an email address to become an administrator. */
export async function inviteAdminAction(email: string): Promise<InviteResult> {
	const guard = await guardAdministrator();
	if (!guard.ok) return guard;

	const parsed = inviteEmailSchema.safeParse(email);
	if (!parsed.success) {
		return { ok: false, error: "Enter a valid email address." };
	}

	const recent = await countRecentInvitationsBy(
		guard.userId,
		new Date(Date.now() - INVITE_WINDOW_MS),
	);
	if (recent >= MAX_INVITES_PER_WINDOW) {
		return {
			ok: false,
			error: "Too many invitations in the last hour. Try again later.",
		};
	}

	const { token, tokenHash } = generateInviteToken();

	let created: Awaited<ReturnType<typeof createInvitation>>;
	try {
		created = await createInvitation({
			email: parsed.data,
			invitedById: guard.userId,
			tokenHash,
			expiresAt: inviteExpiry(),
		});
	} catch {
		return {
			ok: false,
			error: "Couldn't create the invitation. Please try again.",
		};
	}

	if (!created.ok) {
		return {
			ok: false,
			error:
				created.code === "existing_account"
					? "That email already has an account. Use the promote script if this account should become an administrator."
					: "That email already has a pending invitation.",
		};
	}

	try {
		await sendAdminInviteEmail({
			to: parsed.data,
			url: acceptUrl(token),
			inviterName: guard.session.user.name,
		});
	} catch {
		// The row is written before the email goes out so a live token always has a
		// record behind it. When the send fails we revoke it again, which frees the
		// address to be invited afresh and leaves the attempt in the audit trail.
		await revokeInvitation(created.id, guard.userId).catch(() => undefined);
		return {
			ok: false,
			error:
				"Couldn't send the invitation email. Nothing was created — try again.",
		};
	}

	revalidatePath("/dashboard/users");
	return { ok: true };
}

/** Revoke a pending invitation, killing its token. */
export async function revokeInviteAction(id: string): Promise<InviteResult> {
	const guard = await guardAdministrator();
	if (!guard.ok) return guard;

	try {
		const revoked = await revokeInvitation(id, guard.userId);
		if (!revoked) {
			return {
				ok: false,
				error: "Couldn't find a pending invitation to revoke.",
			};
		}
	} catch {
		return {
			ok: false,
			error: "Couldn't revoke the invitation. Please try again.",
		};
	}

	revalidatePath("/dashboard/users");
	return { ok: true };
}

/** Send a pending invitation again with a fresh token and expiry. */
export async function resendInviteAction(id: string): Promise<InviteResult> {
	const guard = await guardAdministrator();
	if (!guard.ok) return guard;

	const { token, tokenHash } = generateInviteToken();

	let refreshed: Awaited<ReturnType<typeof resendInvitation>>;
	try {
		refreshed = await resendInvitation(
			id,
			guard.userId,
			tokenHash,
			inviteExpiry(),
		);
	} catch {
		return {
			ok: false,
			error: "Couldn't resend the invitation. Please try again.",
		};
	}

	if (!refreshed?.email) {
		return {
			ok: false,
			error: "Couldn't find a pending invitation to resend.",
		};
	}

	try {
		await sendAdminInviteEmail({
			to: refreshed.email,
			url: acceptUrl(token),
			inviterName: guard.session.user.name,
		});
	} catch {
		// Rotating the token already invalidated the previous link, so there is
		// nothing to roll back to — another resend is the only way forward.
		return {
			ok: false,
			error:
				"The invitation was refreshed but the email failed to send. Resend again.",
		};
	}

	revalidatePath("/dashboard/users");
	return { ok: true };
}
