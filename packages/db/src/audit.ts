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
	"attorney.verified",
	"attorney.verification_cleared",
	// Administrator oversight on a case from the campaigns dashboard.
	"case.removed",
	"case.restored",
	"case.messaged",
	// Bring-your-own-attorney invitations. Namespaced apart from the `invite.*`
	// verbs above because they invite a different thing — representation of one
	// case, not an administrator account — and the admin audit screen should be
	// able to tell the two apart at a glance.
	"case_invite.created",
	"case_invite.resent",
	"case_invite.revoked",
	"case_invite.confirmed",
	"case_invite.declined",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export type AuditEntry = {
	/** Null only where the action genuinely has no account behind it — declining a
	 *  case invitation from the emailed link is the one such act. Attributing it to
	 *  somebody else would be worse than leaving it unattributed. */
	actorId: string | null;
	action: AuditAction;
	targetType?: "user" | "invitation" | "case" | "case_invitation";
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

export type CaseAuditEntry = {
	id: string;
	action: string;
	reason: string | null;
	createdAt: Date;
	actorName: string | null;
};

/**
 * The administrative decision trail for one case — every take-down, restore, and
 * message an admin recorded against it, newest first. Powers the "Decision
 * history" panel on the campaigns oversight page.
 */
/**
 * Records a single administrator action against a case. A one-row create with no
 * surrounding mutation, so it runs on the base client rather than a transaction —
 * the reads-free case `writeAudit` documents.
 */
export async function recordCaseAudit(input: {
	actorId: string;
	action: Extract<AuditAction, `case.${string}`>;
	caseId: string;
	note?: string | null;
}) {
	return writeAudit(prisma, {
		actorId: input.actorId,
		action: input.action,
		targetType: "case",
		targetId: input.caseId,
		reason: input.note?.trim() || undefined,
	});
}

export async function listCaseAuditEntries(
	caseId: string,
): Promise<CaseAuditEntry[]> {
	const rows = await prisma.auditLog.findMany({
		where: { targetType: "case", targetId: caseId },
		orderBy: { createdAt: "desc" },
		select: {
			id: true,
			action: true,
			reason: true,
			createdAt: true,
			actor: { select: { name: true } },
		},
	});
	return rows.map((r) => ({
		id: r.id,
		action: r.action,
		reason: r.reason,
		createdAt: r.createdAt,
		actorName: r.actor?.name ?? null,
	}));
}
