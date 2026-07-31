import { randomUUID } from "node:crypto";

import { writeAudit } from "./audit";
import prisma from "./index";

export const ADMIN_INVITATION_TTL_DAYS = 7;

export type InvitationStatus = "pending" | "accepted" | "revoked" | "expired";

export function invitationStatus(
	inv: { acceptedAt: Date | null; revokedAt: Date | null; expiresAt: Date },
	at = new Date(),
): InvitationStatus {
	if (inv.acceptedAt) return "accepted";
	if (inv.revokedAt) return "revoked";
	if (inv.expiresAt <= at) return "expired";
	return "pending";
}

function pendingWhere(at: Date) {
	return { acceptedAt: null, revokedAt: null, expiresAt: { gt: at } };
}

export async function listPendingInvitations() {
	return prisma.adminInvitation.findMany({
		where: pendingWhere(new Date()),
		orderBy: { createdAt: "desc" },
		include: { invitedBy: { select: { name: true, email: true } } },
	});
}

export async function findInvitationByTokenHash(tokenHash: string) {
	return prisma.adminInvitation.findUnique({
		where: { tokenHash },
		include: { invitedBy: { select: { name: true } } },
	});
}

export async function countRecentInvitationsBy(actorId: string, since: Date) {
	return prisma.adminInvitation.count({
		where: { invitedById: actorId, createdAt: { gte: since } },
	});
}

export type CreateInvitationResult =
	| { ok: true; id: string }
	| { ok: false; code: "existing_account" | "already_invited" };

export async function createInvitation(input: {
	email: string;
	invitedById: string;
	tokenHash: string;
	expiresAt: Date;
}): Promise<CreateInvitationResult> {
	const email = input.email.toLowerCase();
	return prisma.$transaction(async (tx): Promise<CreateInvitationResult> => {
		const existing = await tx.user.findUnique({
			where: { email },
			select: { id: true },
		});
		if (existing) {
			// Rejected attempts are audited too — an invite aimed at an existing
			// account is a role-escalation attempt worth a trace.
			await writeAudit(tx, {
				actorId: input.invitedById,
				action: "invite.rejected_existing_account",
				targetType: "user",
				targetId: existing.id,
				metadata: { email },
			});
			return { ok: false, code: "existing_account" };
		}

		const pending = await tx.adminInvitation.findFirst({
			where: { email, ...pendingWhere(new Date()) },
			select: { id: true },
		});
		if (pending) return { ok: false, code: "already_invited" };

		const invitation = await tx.adminInvitation.create({
			data: {
				email,
				tokenHash: input.tokenHash,
				invitedById: input.invitedById,
				expiresAt: input.expiresAt,
			},
		});
		await writeAudit(tx, {
			actorId: input.invitedById,
			action: "invite.created",
			targetType: "invitation",
			targetId: invitation.id,
			metadata: { email },
		});
		return { ok: true, id: invitation.id };
	});
}

export async function revokeInvitation(id: string, actorId: string) {
	return prisma.$transaction(async (tx) => {
		const res = await tx.adminInvitation.updateMany({
			where: { id, ...pendingWhere(new Date()) },
			data: { revokedAt: new Date() },
		});
		if (res.count === 0) return null;
		const inv = await tx.adminInvitation.findUnique({
			where: { id },
			select: { email: true },
		});
		await writeAudit(tx, {
			actorId,
			action: "invite.revoked",
			targetType: "invitation",
			targetId: id,
			metadata: { email: inv?.email },
		});
		return { id };
	});
}

/** Resend regenerates the token and restarts the expiry clock on the same row. */
export async function resendInvitation(
	id: string,
	actorId: string,
	tokenHash: string,
	expiresAt: Date,
) {
	return prisma.$transaction(async (tx) => {
		const res = await tx.adminInvitation.updateMany({
			where: { id, ...pendingWhere(new Date()) },
			data: { tokenHash, expiresAt },
		});
		if (res.count === 0) return null;
		const inv = await tx.adminInvitation.findUnique({
			where: { id },
			select: { email: true },
		});
		await writeAudit(tx, {
			actorId,
			action: "invite.resent",
			targetType: "invitation",
			targetId: id,
			metadata: { email: inv?.email },
		});
		return { id, email: inv?.email ?? null };
	});
}

export type AcceptInvitationResult =
	| { ok: true; userId: string; email: string }
	| { ok: false; code: "invalid" | "expired" | "revoked" | "used" | "email_taken" };

/**
 * Creates the administrator account from a pending invitation. The invitee's
 * email was proven by receiving the invite, so the account is born verified and
 * onboarded — the onboarding flow can't express the administrator role.
 */
export async function acceptInvitation(input: {
	tokenHash: string;
	name: string;
	passwordHash: string;
}): Promise<AcceptInvitationResult> {
	return prisma.$transaction(async (tx): Promise<AcceptInvitationResult> => {
		const inv = await tx.adminInvitation.findUnique({
			where: { tokenHash: input.tokenHash },
		});
		if (!inv) return { ok: false, code: "invalid" };
		const status = invitationStatus(inv);
		if (status === "accepted") return { ok: false, code: "used" };
		if (status === "revoked") return { ok: false, code: "revoked" };
		if (status === "expired") return { ok: false, code: "expired" };

		const taken = await tx.user.findUnique({
			where: { email: inv.email },
			select: { id: true },
		});
		if (taken) return { ok: false, code: "email_taken" };

		const userId = randomUUID();
		await tx.user.create({
			data: {
				id: userId,
				name: input.name,
				email: inv.email,
				emailVerified: true,
				onboarded: true,
				role: "administrator",
			},
		});
		await tx.account.create({
			data: {
				id: randomUUID(),
				userId,
				accountId: userId,
				providerId: "credential",
				password: input.passwordHash,
			},
		});
		await tx.adminInvitation.update({
			where: { id: inv.id },
			data: { acceptedAt: new Date() },
		});
		await writeAudit(tx, {
			actorId: userId,
			action: "invite.accepted",
			targetType: "invitation",
			targetId: inv.id,
			metadata: { email: inv.email, invitedById: inv.invitedById },
		});
		return { ok: true, userId, email: inv.email };
	});
}
