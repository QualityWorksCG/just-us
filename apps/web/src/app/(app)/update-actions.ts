"use server";

import { editCaseUpdate, postCaseUpdate } from "@just-us/db/case-updates";
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
} as const;
