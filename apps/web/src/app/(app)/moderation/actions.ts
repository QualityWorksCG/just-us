"use server";

import {
	getConversationReportContext,
	removeMessageByModerator,
	resolveConversationReport,
} from "@just-us/db/messages";
import {
	resolveCaseModeration,
	resolveModerationFlag,
} from "@just-us/db/moderation";
import { blockUser } from "@just-us/db/users";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requirePermission } from "@/lib/auth-server";
import {
	notifyAccountRestricted,
	notifyReportResolved,
	notifyUserWarned,
} from "@/lib/notify";

/** A short phrase for why an account was restricted, by report category. */
const RESTRICTION_REASON: Record<string, string> = {
	spam: "spam",
	fraud: "fraudulent activity",
	harassment: "harassment",
	inappropriate: "inappropriate content",
	other: "violating our conversation policy",
};

/**
 * An administrator's ruling on a moderation flag (Reg. & Ops §3–4).
 *
 * This is the human review the acceptance criteria require: flagged content
 * stays held until an admin resolves the flag here. "cleared" restores it (if
 * nothing else is still open against it); "removed" takes it down. Gated on
 * `moderation:review`, so only a moderator can rule.
 */
const schema = z.object({
	flagId: z.string().min(1),
	resolution: z.enum(["cleared", "removed"]),
});

export type ResolveFlagResult =
	| { ok: true; targetStatus: string }
	| { ok: false; error: string };

export async function resolveModerationFlagAction(
	input: unknown,
): Promise<ResolveFlagResult> {
	const { session } = await requirePermission("moderation:review");
	const parsed = schema.safeParse(input);
	if (!parsed.success) {
		return { ok: false, error: "That ruling wasn't valid." };
	}

	const res = await resolveModerationFlag({
		flagId: parsed.data.flagId,
		adminId: session.user.id,
		resolution: parsed.data.resolution,
	});
	if (!res.ok) {
		return {
			ok: false,
			error:
				res.reason === "already_resolved"
					? "Another moderator already ruled on this."
					: "That flag no longer exists.",
		};
	}

	revalidatePath("/moderation");
	return { ok: true, targetStatus: res.targetStatus };
}

const campaignSchema = z.object({
	caseId: z.string().min(1),
	// "cleared" = keep on site, "removed" = take down. Note is optional.
	resolution: z.enum(["cleared", "removed"]),
	note: z.string().trim().max(2000).optional().default(""),
});

/**
 * Rule on a flagged campaign from its review page: keep it on the site (cleared)
 * or remove it (removed), with an optional note recorded on the flags. Closes
 * every open flag on the case and its updates at once. Gated on
 * `moderation:review`.
 */
export async function resolveCampaignAction(
	input: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
	const { session } = await requirePermission("moderation:review");
	const parsed = campaignSchema.safeParse(input);
	if (!parsed.success) return { ok: false, error: "That ruling wasn't valid." };

	await resolveCaseModeration({
		caseId: parsed.data.caseId,
		adminId: session.user.id,
		resolution: parsed.data.resolution,
		note: parsed.data.note,
	});

	revalidatePath("/moderation");
	revalidatePath(`/moderation/campaigns/${parsed.data.caseId}`);
	revalidatePath(`/discover/${parsed.data.caseId}`);
	revalidatePath(`/cases/${parsed.data.caseId}`);
	return { ok: true };
}

export type ReportActionResult = { ok: true } | { ok: false; error: string };

const resolveSchema = z.object({
	reportId: z.string().min(1),
	resolution: z.enum(["dismissed", "message_removed"]),
});

/**
 * Close a conversation report without an account block — either "dismissed" (no
 * violation) or "message_removed" (the moderator took a message down). Either
 * way the reporter is told the outcome. Gated on `moderation:review`.
 */
export async function resolveReportAction(
	input: unknown,
): Promise<ReportActionResult> {
	const { session } = await requirePermission("moderation:review");
	const parsed = resolveSchema.safeParse(input);
	if (!parsed.success) return { ok: false, error: "That ruling wasn't valid." };

	const ctx = await getConversationReportContext(parsed.data.reportId);
	if (!ctx) return { ok: false, error: "That report no longer exists." };
	if (ctx.status !== "open") {
		return { ok: false, error: "Another moderator already ruled on this." };
	}

	await resolveConversationReport(
		parsed.data.reportId,
		session.user.id,
		parsed.data.resolution,
	);
	// Tell the reporter the outcome (in-app + email). Never fail the ruling on it.
	await notifyReportResolved({
		reportId: ctx.reportId,
		reporterId: ctx.reporter.id,
		reporterName: ctx.reporter.name,
		reporterEmail: ctx.reporter.email,
		otherName: ctx.reported.name,
		outcome: parsed.data.resolution,
	}).catch(() => {});

	revalidatePath("/moderation");
	revalidatePath(`/moderation/conversations/${ctx.conversationId}`);
	return { ok: true };
}

/**
 * Restrict the reported participant's account and close the report. Blocks the
 * *other* party (never the reporter), signs them out, then notifies both sides:
 * the reporter that action was taken, and the restricted account of the reason.
 * Gated on `moderation:review`.
 */
export async function blockReportedUserAction(
	input: unknown,
): Promise<ReportActionResult> {
	const { session } = await requirePermission("moderation:review");
	const parsed = z.object({ reportId: z.string().min(1) }).safeParse(input);
	if (!parsed.success)
		return { ok: false, error: "That request wasn't valid." };

	const ctx = await getConversationReportContext(parsed.data.reportId);
	if (!ctx) return { ok: false, error: "That report no longer exists." };

	const reasonLabel =
		RESTRICTION_REASON[ctx.category] ?? RESTRICTION_REASON.other;
	const block = await blockUser(
		session.user.id,
		ctx.reported.id,
		`Reported for ${reasonLabel} in messages`,
	);
	if (!block.ok) {
		if (block.code === "already_blocked") {
			// Already restricted — still close the report so the queue is accurate.
			if (ctx.status === "open") {
				await resolveConversationReport(
					parsed.data.reportId,
					session.user.id,
					"user_blocked",
				);
				revalidatePath("/moderation");
			}
			return { ok: true };
		}
		return {
			ok: false,
			error:
				block.code === "last_administrator"
					? "You can't restrict the last administrator."
					: block.code === "self_block"
						? "You can't restrict your own account."
						: "That account couldn't be restricted.",
		};
	}

	if (ctx.status === "open") {
		await resolveConversationReport(
			parsed.data.reportId,
			session.user.id,
			"user_blocked",
		);
	}

	await Promise.all([
		notifyReportResolved({
			reportId: ctx.reportId,
			reporterId: ctx.reporter.id,
			reporterName: ctx.reporter.name,
			reporterEmail: ctx.reporter.email,
			otherName: ctx.reported.name,
			outcome: "user_blocked",
		}).catch(() => {}),
		notifyAccountRestricted({
			reportId: ctx.reportId,
			userId: ctx.reported.id,
			name: ctx.reported.name,
			email: ctx.reported.email,
			reasonLabel,
		}).catch(() => {}),
	]);

	revalidatePath("/moderation");
	revalidatePath(`/moderation/conversations/${ctx.conversationId}`);
	return { ok: true };
}

/**
 * Warn the reported participant — a softer step than a suspension. Sends them a
 * warning (in-app + email), then closes the report as handled. The reporter isn't
 * told the specifics; the record shows the report was resolved as "warned".
 */
export async function warnReportedUserAction(
	input: unknown,
): Promise<ReportActionResult> {
	const { session } = await requirePermission("moderation:review");
	const parsed = z.object({ reportId: z.string().min(1) }).safeParse(input);
	if (!parsed.success)
		return { ok: false, error: "That request wasn't valid." };

	const ctx = await getConversationReportContext(parsed.data.reportId);
	if (!ctx) return { ok: false, error: "That report no longer exists." };

	const reasonLabel =
		RESTRICTION_REASON[ctx.category] ?? RESTRICTION_REASON.other;
	await notifyUserWarned({
		reportId: ctx.reportId,
		userId: ctx.reported.id,
		name: ctx.reported.name,
		email: ctx.reported.email,
		reasonLabel,
	}).catch(() => {});

	if (ctx.status === "open") {
		await resolveConversationReport(
			parsed.data.reportId,
			session.user.id,
			"warned",
		);
	}

	revalidatePath("/moderation");
	revalidatePath(`/moderation/conversations/${ctx.conversationId}`);
	return { ok: true };
}

/**
 * Take a single message down from within a review. The moderator's own removal,
 * independent of closing the report — they may remove several, then resolve.
 */
export async function removeConversationMessageAction(
	input: unknown,
): Promise<ReportActionResult> {
	await requirePermission("moderation:review");
	const parsed = z
		.object({ messageId: z.string().min(1), conversationId: z.string().min(1) })
		.safeParse(input);
	if (!parsed.success)
		return { ok: false, error: "That request wasn't valid." };

	const removed = await removeMessageByModerator(parsed.data.messageId);
	if (!removed) return { ok: false, error: "That message is already removed." };

	revalidatePath(`/moderation/conversations/${parsed.data.conversationId}`);
	return { ok: true };
}
