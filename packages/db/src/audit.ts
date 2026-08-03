import type { Prisma } from "../prisma/generated/client";
import prisma from "./index";

export const AUDIT_ACTIONS = [
	"invite.created",
	"invite.resent",
	"invite.revoked",
	"invite.accepted",
	"invite.rejected_existing_account",
	"user.blocked",
	"user.unblocked",
	"user.role_changed",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export type AuditEntry = {
	actorId: string;
	action: AuditAction;
	targetType?: "user" | "invitation";
	targetId?: string;
	reason?: string;
	metadata?: Prisma.InputJsonValue;
};

/**
 * Takes the transaction client so the entry commits or rolls back with the
 * mutation it records. Pass `prisma` itself only for reads-free actions.
 */
export async function writeAudit(
	db: Prisma.TransactionClient,
	entry: AuditEntry,
) {
	return db.auditLog.create({
		data: {
			actorId: entry.actorId,
			action: entry.action,
			targetType: entry.targetType,
			targetId: entry.targetId,
			reason: entry.reason,
			metadata: entry.metadata,
		},
	});
}

export async function listAuditEntries(opts?: {
	skip?: number;
	take?: number;
}) {
	return prisma.auditLog.findMany({
		orderBy: { createdAt: "desc" },
		skip: opts?.skip,
		take: opts?.take,
		include: { actor: { select: { name: true, email: true } } },
	});
}

export async function countAuditEntries() {
	return prisma.auditLog.count();
}
