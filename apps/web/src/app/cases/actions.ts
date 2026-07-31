"use server";

import {
	deleteDraft,
	getOwnedCase,
	incrementShareCount,
	publishCase,
	publishForAttorneys,
	restoreCase,
	saveDraft,
	softDeleteCase,
	updateOwnedCase,
} from "@just-us/db/cases";
import { acceptInterest, declineInterest } from "@just-us/db/requests";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireRole } from "@/lib/auth-server";

const attorneySchema = z
	.object({
		name: z.string().optional(),
		firm: z.string().optional(),
		area: z.string().optional(),
		location: z.string().optional(),
		email: z.string().optional(),
		phone: z.string().optional(),
	})
	.nullish();

const evidenceSchema = z
	.array(z.object({ name: z.string(), size: z.number() }))
	.optional();

const imageFields = {
	coverImageUrl: z.string().url().nullish(),
	images: z.array(z.string().url()).optional(),
};

// Publishing is strict — the case goes live, so the essentials must be there.
const createCaseSchema = z.object({
	id: z.string().optional(),
	title: z.string().trim().min(3, "Give your case a title."),
	category: z.string().trim().min(1, "Choose a category."),
	location: z.string().trim().min(1, "Choose a location."),
	summary: z.string().trim().min(1, "Add a one-line summary."),
	story: z.string().trim().min(10, "Tell your story."),
	goalCents: z.number().int().positive("Enter the agreed fee."),
	payoutType: z.string().trim().optional(),
	attorney: attorneySchema,
	evidence: evidenceSchema,
	...imageFields,
});

// Publishing out to attorneys needs the case reviewable, but no attorney/fee yet.
const seekingSchema = z.object({
	id: z.string().optional(),
	title: z.string().trim().min(3, "Give your case a title."),
	category: z.string().trim().min(1, "Choose a category."),
	location: z.string().trim().min(1, "Choose a location."),
	summary: z.string().trim().min(1, "Add a one-line summary."),
	story: z.string().trim().min(10, "Tell your story."),
	evidence: evidenceSchema,
	...imageFields,
});

// Drafts are lenient — everything's optional so an early save still works.
const draftSchema = z.object({
	id: z.string().optional(),
	title: z.string().optional(),
	category: z.string().optional(),
	location: z.string().optional(),
	summary: z.string().optional(),
	story: z.string().optional(),
	goalCents: z.number().int().nonnegative().optional(),
	payoutType: z.string().optional(),
	attorney: attorneySchema,
	evidence: evidenceSchema,
	...imageFields,
});

export type CreateCaseInput = z.infer<typeof createCaseSchema>;
export type SaveDraftInput = z.infer<typeof draftSchema>;
export type PublishForAttorneysInput = z.infer<typeof seekingSchema>;

export type CreateCaseResult =
	| { ok: true; caseId: string }
	| { ok: false; error: string; fieldErrors?: Record<string, string> };

/** Publish the case out to attorneys ("No, not yet" path) — no fee/attorney. */
export async function publishForAttorneysAction(
	input: PublishForAttorneysInput,
): Promise<CreateCaseResult> {
	const { session } = await requireRole("plaintiff");
	const parsed = seekingSchema.safeParse(input);
	if (!parsed.success) {
		const fieldErrors: Record<string, string> = {};
		for (const issue of parsed.error.issues) {
			const key = issue.path[0];
			if (typeof key === "string" && !fieldErrors[key])
				fieldErrors[key] = issue.message;
		}
		return {
			ok: false,
			error: "Add a title, story, category, and state before publishing.",
			fieldErrors,
		};
	}
	try {
		const { id, ...rest } = parsed.data;
		const created = await publishForAttorneys({
			ownerId: session.user.id,
			id,
			...rest,
		});
		return { ok: true, caseId: created.id };
	} catch {
		return {
			ok: false,
			error: "Couldn't publish your case. Please try again.",
		};
	}
}

export type SaveDraftResult =
	| { ok: true; caseId: string }
	| { ok: false; error: string };

export type DeleteCaseResult = { ok: true } | { ok: false; error: string };

/** Soft-delete an owned draft. The row (and its images) are kept so it can be
 *  restored from the Deleted tab. */
export async function deleteCaseAction(id: string): Promise<DeleteCaseResult> {
	const { session } = await requireRole("plaintiff");
	const existing = await getOwnedCase(id, session.user.id);
	if (existing?.status !== "draft") {
		return { ok: false, error: "Only draft cases can be deleted." };
	}

	try {
		await deleteDraft(id, session.user.id);
		revalidatePath("/my-cases");
		return { ok: true };
	} catch {
		return { ok: false, error: "Couldn't delete the draft. Please try again." };
	}
}

/** Restore a previously deleted case from the Deleted tab. */
export async function restoreCaseAction(id: string): Promise<DeleteCaseResult> {
	const { session } = await requireRole("plaintiff");
	try {
		const res = await restoreCase(id, session.user.id);
		if (res.count === 0) {
			return { ok: false, error: "Couldn't find that case to restore." };
		}
		revalidatePath("/my-cases");
		return { ok: true };
	} catch {
		return { ok: false, error: "Couldn't restore the case. Please try again." };
	}
}

/** Delete an owned case of any status from the Manage page (soft delete). */
export async function deleteOwnedCaseAction(
	id: string,
): Promise<DeleteCaseResult> {
	const { session } = await requireRole("plaintiff");
	const existing = await getOwnedCase(id, session.user.id);
	if (!existing || existing.deletedAt) {
		return { ok: false, error: "Couldn't find that case." };
	}
	try {
		await softDeleteCase(id, session.user.id);
		revalidatePath("/my-cases");
		revalidatePath("/home");
		return { ok: true };
	} catch {
		return { ok: false, error: "Couldn't delete the case. Please try again." };
	}
}

/** Record that the owner shared the case (bumps the share counter). */
export async function recordShareAction(id: string): Promise<DeleteCaseResult> {
	const { session } = await requireRole("plaintiff");
	try {
		const res = await incrementShareCount(id, session.user.id);
		if (res.count === 0)
			return { ok: false, error: "Couldn't find that case." };
		revalidatePath(`/my-cases/${id}`);
		return { ok: true };
	} catch {
		return { ok: false, error: "Couldn't record the share." };
	}
}

const ACCEPT_INTEREST_ERRORS = {
	not_found: "Couldn't find that expression of interest.",
	// JUS-24's gate at the point of matching. Worth its own message: the plaintiff
	// hasn't done anything wrong, and the attorney may well be verified later.
	not_verified:
		"This attorney's bar standing isn't verified, so they can't take your case yet.",
	already_matched: "You've already chosen an attorney for this case.",
} as const;

/**
 * Take an interested attorney forward — the plaintiff initiating contact, which
 * is the only way this path can resolve (JUS-25). Sets them on the case and
 * returns the case id so the plaintiff can go on to agree the fee and publish.
 */
export async function acceptInterestAction(
	interestId: string,
): Promise<CreateCaseResult> {
	const { session } = await requireRole("plaintiff");
	try {
		const res = await acceptInterest(interestId, session.user.id);
		if (!res.ok) {
			return { ok: false, error: ACCEPT_INTEREST_ERRORS[res.reason] };
		}
		revalidatePath(`/my-cases/${res.caseId}/requests`);
		revalidatePath("/my-cases");
		revalidatePath("/home");
		return { ok: true, caseId: res.caseId };
	} catch {
		return {
			ok: false,
			error: "Couldn't accept the request. Please try again.",
		};
	}
}

/** Decline an open expression of interest. */
export async function declineInterestAction(
	interestId: string,
	caseId: string,
): Promise<DeleteCaseResult> {
	const { session } = await requireRole("plaintiff");
	try {
		const count = await declineInterest(interestId, session.user.id);
		if (count === 0) return { ok: false, error: "Request already handled." };
		revalidatePath(`/my-cases/${caseId}/requests`);
		revalidatePath("/home");
		return { ok: true };
	} catch {
		return {
			ok: false,
			error: "Couldn't decline the request. Please try again.",
		};
	}
}

// Editing a published/draft case's core details from the Manage page. Status,
// attorney, and fee are left untouched here.
const editCaseSchema = z.object({
	id: z.string().min(1),
	title: z.string().trim().min(3, "Give your case a title."),
	category: z.string().trim().min(1, "Choose a category."),
	location: z.string().trim().min(1, "Choose a location."),
	summary: z.string().trim().optional(),
	story: z.string().trim().min(10, "Tell your story."),
	coverImageUrl: z.string().url().nullish(),
	images: z.array(z.string().url()).optional(),
});

export type EditCaseInput = z.infer<typeof editCaseSchema>;

/** Update an owned case's editable details (title, story, images, etc.). */
export async function updateCaseDetailsAction(
	input: EditCaseInput,
): Promise<CreateCaseResult> {
	const { session } = await requireRole("plaintiff");
	const parsed = editCaseSchema.safeParse(input);
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
	try {
		const { id, ...fields } = parsed.data;
		const res = await updateOwnedCase(id, session.user.id, fields);
		if (res.count === 0) {
			return { ok: false, error: "Couldn't find that case to update." };
		}
		revalidatePath(`/my-cases/${id}`);
		revalidatePath("/my-cases");
		revalidatePath("/home");
		return { ok: true, caseId: id };
	} catch {
		return {
			ok: false,
			error: "Couldn't save your changes. Please try again.",
		};
	}
}

/** Save (or update) the in-progress case as a draft — powers "Save & exit". */
export async function saveCaseDraftAction(
	input: SaveDraftInput,
): Promise<SaveDraftResult> {
	const { session } = await requireRole("plaintiff");
	const parsed = draftSchema.safeParse(input);
	if (!parsed.success) return { ok: false, error: "Couldn't save your draft." };

	try {
		const { id, attorney, ...rest } = parsed.data;
		const res = await saveDraft({
			ownerId: session.user.id,
			id,
			attorney: attorney ?? null,
			...rest,
		});
		return { ok: true, caseId: res.id };
	} catch {
		return { ok: false, error: "Couldn't save your draft. Please try again." };
	}
}

/** Publish the case live — updating the draft in place when an id is given. */
export async function createCaseAction(
	input: CreateCaseInput,
): Promise<CreateCaseResult> {
	const { session } = await requireRole("plaintiff");

	const parsed = createCaseSchema.safeParse(input);
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

	try {
		const { id, attorney, ...rest } = parsed.data;
		const created = await publishCase({
			ownerId: session.user.id,
			id,
			attorney: attorney ?? null,
			...rest,
		});
		return { ok: true, caseId: created.id };
	} catch {
		return {
			ok: false,
			error: "Could not publish your case. Please try again.",
		};
	}
}
