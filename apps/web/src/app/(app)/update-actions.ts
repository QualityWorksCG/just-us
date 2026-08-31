"use server";

import {
	editCaseUpdate,
	markAllCaseUpdatesSeenByOwner,
	postCaseUpdate,
} from "@just-us/db/case-updates";
import { markCaseUpdateNotificationsRead } from "@just-us/db/notifications";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireRole } from "@/lib/auth-server";
import { notifyCaseUpdate } from "@/lib/notify";

/** Refresh every surface an update reads on, so a reload anywhere reflects it. */
function revalidateUpdateSurfaces(caseId: string) {
	revalidatePath(`/my-cases/${caseId}`);
	revalidatePath(`/my-cases/${caseId}/updates`);
	revalidatePath(`/discover/${caseId}`);
	revalidatePath(`/cases/${caseId}`);
	revalidatePath("/updates");
}

const attachmentSchema = z.object({
	url: z.string().url(),
	name: z.string().min(1).max(200),
	contentType: z.string().max(120),
});

/**
 * The case-updates posting tool (JUS-33).
 *
 * The two people running a case — the plaintiff who owns it and the attorney
 * matched to it — may post. Role is gated at the door (`requireRole`) and
 * attachment is gated at the data layer (`postCaseUpdate` checks owner/match).
 * Neither is a substitute for the other, so both stay: the role guard keeps
 * donors/admins out; the attachment check keeps a plaintiff or attorney out of a
 * case that isn't theirs.
 */
const postUpdateSchema = z
	.object({
		caseId: z.string().min(1),
		body: z.string().trim().min(1).max(4000),
		tag: z.string().trim().max(40).optional(),
		attachments: z.array(attachmentSchema).max(10).optional(),
	})
	.strict();

export type PostUpdateActionResult =
	| { ok: true }
	| { ok: false; error: string };

/**
 * Clear the plaintiff's "new update" markers across every case at once — the
 * "Mark all as read" control on the Case updates page. Owner-scoped in the data
 * layer, so it only ever touches the caller's own cases.
 */
export async function markAllUpdatesReadAction(): Promise<{ ok: boolean }> {
	const { session, role } = await requireRole("plaintiff", "donor");
	// A plaintiff owns the cases, so their "seen" is a stamp on each case. A donor
	// doesn't, so theirs is clearing the case-update notifications the count reads.
	if (role === "donor") {
		await markCaseUpdateNotificationsRead(session.user.id);
	} else {
		await markAllCaseUpdatesSeenByOwner(session.user.id);
	}
	revalidatePath("/updates");
	revalidatePath("/home");
	return { ok: true };
}

/** Post a case-status update as the signed-in plaintiff or attorney. */
export async function postCaseUpdateAction(
	input: unknown,
): Promise<PostUpdateActionResult> {
	const { session } = await requireRole("plaintiff", "attorney");

	const parsed = postUpdateSchema.safeParse(input);
	if (!parsed.success) {
		return { ok: false, error: "Write an update before posting it." };
	}

	try {
		const res = await postCaseUpdate({
			caseId: parsed.data.caseId,
			authorId: session.user.id,
			body: parsed.data.body,
			tag: parsed.data.tag || null,
			attachments: parsed.data.attachments,
		});
		if (!res.ok) {
			return { ok: false, error: FAILURE_MESSAGES[res.reason] };
		}
		// Notify backers/followers (in-app + email). Never let a notification
		// failure fail the post itself.
		await notifyCaseUpdate(res.id).catch(() => {});
		revalidateUpdateSurfaces(parsed.data.caseId);
		return { ok: true };
	} catch {
		return {
			ok: false,
			error: "Couldn't post your update. Please try again.",
		};
	}
}

const editUpdateSchema = z
	.object({
		updateId: z.string().min(1),
		caseId: z.string().min(1),
		body: z.string().trim().min(1).max(4000),
		tag: z.string().trim().max(40).optional(),
	})
	.strict();

/** Edit one of your own updates (body + category). Only the author succeeds. */
export async function editCaseUpdateAction(
	input: unknown,
): Promise<PostUpdateActionResult> {
	const { session } = await requireRole("plaintiff", "attorney");

	const parsed = editUpdateSchema.safeParse(input);
	if (!parsed.success) {
		return { ok: false, error: "Write an update before saving it." };
	}

	try {
		const res = await editCaseUpdate({
			updateId: parsed.data.updateId,
			authorId: session.user.id,
			body: parsed.data.body,
			tag: parsed.data.tag || null,
		});
		if (!res.ok) {
			return {
				ok: false,
				error:
					res.reason === "empty"
						? "Write an update before saving it."
						: "You can only edit your own updates.",
			};
		}
		revalidateUpdateSurfaces(parsed.data.caseId);
		return { ok: true };
	} catch {
		return {
			ok: false,
			error: "Couldn't save your changes. Please try again.",
		};
	}
}

const FAILURE_MESSAGES = {
	empty: "Write an update before posting it.",
	not_attached: "You can only post updates to a case you're part of.",
	not_live:
		"Updates open once your case is live. Publish it first, then you can post progress for your supporters.",
} as const;
