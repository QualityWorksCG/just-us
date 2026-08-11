"use server";

import { recordCaseAudit } from "@just-us/db/audit";
import { resolveCaseModeration } from "@just-us/db/moderation";
import { getCaseNotifyContext } from "@just-us/db/notifications";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdministrator } from "@/lib/auth-server";
import { notifyPlaintiffFromAdmin } from "@/lib/notify";

const visibilitySchema = z.object({
	caseId: z.string().min(1),
	// "removed" takes the case off the public site; "cleared" restores it.
	resolution: z.enum(["removed", "cleared"]),
	note: z.string().max(2000).optional(),
});

/**
 * An administrator taking a case down from — or restoring it to — the public
 * site, from the campaigns oversight detail page.
 *
 * It reuses the same `resolveCaseModeration` a moderator uses on a flagged
 * campaign, so removal is the one code path: it sets the case's
 * `moderationStatus` (and closes any open flags), which is what actually hides or
 * re-shows the case everywhere it renders. Reversible by design — "removed" is a
 * visibility state, not a delete, so an admin can restore a case they took down.
 */
export async function setCampaignVisibilityAction(
	input: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
	const { session } = await requireAdministrator();
	const parsed = visibilitySchema.safeParse(input);
	if (!parsed.success) {
		return { ok: false, error: "That action wasn't valid." };
	}

	try {
		await resolveCaseModeration({
			caseId: parsed.data.caseId,
			adminId: session.user.id,
			resolution: parsed.data.resolution,
			note: parsed.data.note,
		});
		// Record the decision so it survives on the case's history even when there
		// were no open flags for `resolveCaseModeration` to carry the note onto.
		await recordCaseAudit({
			actorId: session.user.id,
			action:
				parsed.data.resolution === "removed" ? "case.removed" : "case.restored",
			caseId: parsed.data.caseId,
			note: parsed.data.note,
		});
	} catch {
		return { ok: false, error: "Couldn't update the case. Please try again." };
	}

	// Both the oversight views and the case's own public/in-app pages reflect the
	// new visibility immediately.
	revalidatePath("/campaigns");
	revalidatePath(`/campaigns/${parsed.data.caseId}`);
	revalidatePath(`/discover/${parsed.data.caseId}`);
	revalidatePath(`/cases/${parsed.data.caseId}`);
	return { ok: true };
}

const messageSchema = z.object({
	caseId: z.string().min(1),
	message: z.string().trim().min(1).max(2000),
});

/**
 * An administrator messaging a case's plaintiff directly from the oversight page.
 *
 * Delivered as an in-app notification plus a one-time email (via the shared
 * notification dispatcher), with a CTA back to the plaintiff's case. The message
 * is also recorded on the case's decision history so there's an audit trail of
 * what an admin told the plaintiff and when. Best-effort delivery never blocks
 * the record.
 */
export async function messagePlaintiffAction(
	input: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
	const { session } = await requireAdministrator();
	const parsed = messageSchema.safeParse(input);
	if (!parsed.success) {
		return { ok: false, error: "Enter a message before sending." };
	}

	const ctx = await getCaseNotifyContext(parsed.data.caseId);
	if (!ctx?.owner) {
		return { ok: false, error: "Couldn't find this case's plaintiff." };
	}

	await recordCaseAudit({
		actorId: session.user.id,
		action: "case.messaged",
		caseId: parsed.data.caseId,
		note: parsed.data.message,
	});

	// Delivery is best-effort — a dead email provider must not lose the message the
	// admin already recorded. Its own dedupeKey makes every message deliver.
	notifyPlaintiffFromAdmin({
		dedupeKey: `admin-msg:${parsed.data.caseId}:${crypto.randomUUID()}`,
		caseId: parsed.data.caseId,
		ownerId: ctx.ownerId,
		ownerName: ctx.owner.name,
		ownerEmail: ctx.owner.email,
		caseTitle: ctx.title,
		message: parsed.data.message,
	}).catch(() => {});

	revalidatePath(`/campaigns/${parsed.data.caseId}`);
	return { ok: true };
}
