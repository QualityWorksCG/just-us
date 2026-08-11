"use server";

import {
	closeCase,
	deleteDraft,
	getOwnedCase,
	incrementShareCount,
	publishCase,
	publishForAttorneys,
	saveDraft,
	softDeleteCase,
	updateOwnedCase,
} from "@just-us/db/cases";
import { getCasePayoutOptions } from "@just-us/db/payouts";
import { acceptInterest, declineInterest } from "@just-us/db/requests";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireRole } from "@/lib/auth-server";
import { notifyCaseClosed, notifyStatusChange } from "@/lib/notify";

/** How far the representing firm's Stripe setup for this case has got. */
export type CasePayoutReadiness = NonNullable<
	Awaited<ReturnType<typeof getCasePayoutOptions>>
>;

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
	.array(
		z.object({
			name: z.string(),
			size: z.number().optional(),
			url: z.string().url().optional(),
		}),
	)
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

/**
 * What `commitCaseAction` hands back: the case is saved and its attorney can now
 * see it, plus how far that attorney's payout setup has got — which is the only
 * thing left between here and a public campaign.
 */
export type CommitCaseResult =
	| { ok: true; caseId: string; payout: CasePayoutReadiness }
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
		await notifyStatusChange(created.id, "seeking").catch(() => {});
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

/** Delete an owned draft. Deletion is permanent — the row is retained only as a
 *  record in the Deleted tab and can never be restored. */
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

const CLOSE_REASONS: Record<string, string> = {
	case_not_found: "That case couldn't be found.",
	not_live: "Only a live case can be closed.",
	already_closed: "This case is already closed.",
};

/**
 * Mark a live case Closed — the plaintiff's own act (mirrors go-live).
 *
 * On success, the close fan-out runs: backers get a certificate of appreciation
 * and the plaintiff is notified. It is `.catch`-swallowed so a mail/generation
 * hiccup can't undo a close that already happened — the certificates are also
 * regenerated idempotently on any later close, and the AC's 24-hour window leaves
 * ample room for a retry.
 */
export async function closeCaseAction(id: string): Promise<DeleteCaseResult> {
	const { session } = await requireRole("plaintiff");
	try {
		const res = await closeCase(id, session.user.id);
		if (!res.ok) {
			return {
				ok: false,
				error: CLOSE_REASONS[res.reason] ?? "Couldn't close this case.",
			};
		}
		await notifyCaseClosed(id).catch(() => {});
		// The case leaves the public directory and its manage view changes.
		revalidatePath(`/my-cases/${id}`);
		revalidatePath("/my-cases");
		revalidatePath(`/cases/${id}`);
		revalidatePath(`/discover/${id}`);
		revalidatePath("/discover");
		revalidatePath("/home");
		return { ok: true };
	} catch {
		return { ok: false, error: "Couldn't close this case. Please try again." };
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
	// The note sent to every donor. Emptied to null rather than to "" so the
	// acknowledgement's "did they write one" check stays a null check.
	thankYouNote: z
		.string()
		.trim()
		.max(600, "Keep your thank-you under 600 characters.")
		.nullish()
		.transform((v) => (v ? v : null)),
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

/**
 * Commit the finished case, handing it to the attorney. **It does not go public.**
 *
 * This is the wizard's payout step, and the reason it is a step rather than the
 * publish button: donations land in a Stripe account the plaintiff's *attorney*
 * opens for this case, and until that exists the case cannot take a dollar. A
 * campaign published before it can be funded is a goal, a progress bar and a
 * donate panel that refuses — so the case is parked in `pending_payout` instead,
 * where the attorney can finally see it (`myCasesWhere` excludes drafts, which is
 * why saving harder would not have worked) and clear it.
 *
 * Returns that attorney's readiness alongside the id, because the screen this
 * answers has to say who is being waited on and how far they have got.
 * `goLiveAction` is what makes it public afterwards.
 */
export async function commitCaseAction(
	input: CreateCaseInput,
): Promise<CommitCaseResult> {
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
		const payout = await getCasePayoutOptions(created.id, session.user.id);
		if (!payout) return { ok: false, error: "Couldn't find that case." };
		await notifyStatusChange(created.id, "pending_payout").catch(() => {});
		// The attorney's own screens now list this case and count it as waiting on
		// them — see `attorneyPayoutReadiness`.
		revalidatePath("/my-cases");
		revalidatePath("/representation");
		revalidatePath("/home");
		return { ok: true, caseId: created.id, payout };
	} catch {
		return {
			ok: false,
			error: "Could not save your case. Please try again.",
		};
	}
}

// The plaintiff's "Check again" now pulls the firm's account from Stripe rather
// than re-reading a cache no webhook may have touched — see
// `refreshCasePayoutAction` in the case's payout-actions. The old read-only
// version lived here and is gone with it.
