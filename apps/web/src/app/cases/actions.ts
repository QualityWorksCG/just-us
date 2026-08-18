"use server";

import { generateInviteToken } from "@just-us/auth/invite-token";
import { sendCaseInviteEmail } from "@just-us/auth/lib/email";
import prisma from "@just-us/db";
import { admittedStatesForEmail } from "@just-us/db/admissions";
import {
	CASE_INVITATION_TTL_DAYS,
	countRecentCaseInvitationsBy,
	revokePendingInvitationsForCase,
	upsertCaseInvitationForPublish,
} from "@just-us/db/case-invitations";
import {
	closeCase,
	deleteDraft,
	getOwnedCase,
	incrementShareCount,
	publishCase,
	publishForAttorneys,
	revertSeekingToDraft,
	saveDraft,
	softDeleteCase,
	updateOwnedCase,
} from "@just-us/db/cases";
import { getCasePayoutOptions } from "@just-us/db/payouts";
import {
	acceptInterest,
	declineInterest,
	getCaseMatch,
} from "@just-us/db/requests";
import { env } from "@just-us/env/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireRole } from "@/lib/auth-server";
import { notifyCaseClosed, notifyStatusChange } from "@/lib/notify";
import { THANK_YOU_MAX, THANK_YOU_TOO_LONG } from "@/lib/thank-you-note";

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

/**
 * The plaintiff's thank-you note, as every save path accepts it.
 *
 * Three inputs, three outcomes, and the difference matters downstream: a string
 * sets the note, `""` and `null` clear it to null — so the acknowledgement's "did
 * they write one" stays a null check rather than a truthiness check on `""` — and
 * **absent stays absent**, which is what lets `toData` leave an existing note
 * alone. Mapping absent to null here instead would make every save that doesn't
 * mention the note erase it.
 */
const thankYouNoteField = z
	.string()
	.trim()
	.max(THANK_YOU_MAX, THANK_YOU_TOO_LONG)
	.nullish()
	.transform((v) => (v === undefined ? undefined : v || null));

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
	// Optional even here, where everything else is strict: a case with no note
	// still sends donors a complete confirmation, so refusing to publish over one
	// would be a gate on nothing.
	thankYouNote: thankYouNoteField,
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
	// Carried on this path too, though a `seeking` case takes no donations yet: the
	// note is written in step 1, and dropping it here would lose words the plaintiff
	// typed before they ever reach a state that can be funded.
	thankYouNote: thankYouNoteField,
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
	thankYouNote: thankYouNoteField,
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

/** What a case in a status that refuses to be republished is told. */
const NOT_REPUBLISHABLE =
	"This case has already been published and can't be sent out to attorneys again.";

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
		// `publishForAttorneys` refuses a case that is already live or committed and
		// reports its real status rather than moving it. Say so instead of showing
		// the "published to attorneys" screen for a case that did not move.
		if (created.status !== "seeking") {
			return { ok: false, error: NOT_REPUBLISHABLE };
		}
		await notifyStatusChange(created.id, "seeking").catch(() => {});
		// This path clears the attorney the plaintiff had named — they chose "No, not
		// yet" instead. Any invitation still out on that name has to go with it: it is
		// what holds the case out of the queue they just asked to be in, and it is a
		// live token that would otherwise let its holder claim a case the plaintiff
		// has taken away from them.
		await revokePendingInvitationsForCase({
			caseId: created.id,
			actorId: session.user.id,
			reason: "published_to_attorney_queue",
		}).catch(() => undefined);
		revalidatePath("/my-cases");
		revalidatePath("/representation");
		revalidatePath("/home");
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
	// Said plainly, and without blaming the plaintiff: an attorney's admissions can
	// change after they put themselves forward, and the plaintiff had no way to see
	// it. Their case stays in the queue for someone who can take it.
	not_admitted:
		"This attorney isn't admitted in your case's state, so they can't take it on. Your case stays open to other attorneys.",
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
	thankYouNote: thankYouNoteField,
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

// The plaintiff-named attorney. The email is the one field this path cannot do
// without: it is where the invitation goes, and an invitation is the only thing
// that can turn a typed name into representation.
const invitedAttorneySchema = z.object({
	name: z.string().trim().min(1, "Add your attorney's full name."),
	firm: z.string().optional(),
	area: z.string().optional(),
	location: z.string().optional(),
	email: z
		.string()
		.trim()
		.toLowerCase()
		.pipe(z.email("Enter a valid email address for your attorney.")),
	phone: z.string().optional(),
});

const inviteAttorneySchema = createCaseSchema.extend({
	attorney: invitedAttorneySchema,
});

export type InviteAttorneyCaseInput = z.infer<typeof inviteAttorneySchema>;

/**
 * What the bring-your-own publish hands back.
 *
 * Two outcomes, because one case can arrive here either way. `invited` is the
 * ordinary one: the case is saved as `seeking` and the named attorney has been
 * emailed. `matched` is the case that already had an attorney of its own — it
 * belongs on the payout path and is reported exactly as `commitCaseAction`
 * reports it.
 */
export type CommitCaseWithInviteResult =
	| {
			ok: true;
			kind: "invited";
			caseId: string;
			email: string;
			expiresInDays: number;
	  }
	| { ok: true; kind: "matched"; caseId: string; payout: CasePayoutReadiness }
	| {
			ok: false;
			error: string;
			/** Set once the case row exists, so a retry updates it rather than
			 *  creating a second copy of the same case. */
			caseId?: string;
			fieldErrors?: Record<string, string>;
	  };

/** "New York", "New York and Texas", "New York, Texas and Utah". */
function formatStates(states: string[]): string {
	if (states.length <= 1) return states[0] ?? "";
	return `${states.slice(0, -1).join(", ")} and ${states.at(-1)}`;
}

/**
 * Whether an account already holds the invited address (case-insensitive).
 *
 * Only chooses which of the two emails is sent — both carry the same link — so a
 * failed lookup falls back to the sign-up wording rather than costing the
 * attorney their invitation.
 */
async function accountExistsForEmail(email: string): Promise<boolean> {
	try {
		const user = await prisma.user.findFirst({
			where: { email: { equals: email, mode: "insensitive" } },
			select: { id: true },
		});
		return !!user;
	} catch {
		return false;
	}
}

const INVITE_TTL_MS = CASE_INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000;

// Every invitation sends mail from the platform's own verified domain carrying a
// subject and body built from text this plaintiff wrote — the case title and
// their own display name. Without a ceiling, scripting this action in a loop with
// a different address each time is an authenticated relay, so each plaintiff gets
// one per rolling hour. Mirrors the administrator invite ceiling.
const INVITE_WINDOW_MS = 60 * 60 * 1000;
const MAX_INVITES_PER_WINDOW = 10;

/**
 * Publish a case whose attorney the plaintiff brought themselves, and invite
 * that attorney to confirm it.
 *
 * The case lands in `seeking`, **not** `pending_payout`, and that is the whole
 * point of this being its own action. A typed name and address is an assertion:
 * the attorney has not agreed to anything, may not have a JustUs account, and may
 * never answer. Committing the case to them would park it in a state that waits
 * on a Stripe account nobody has undertaken to open.
 *
 * What holds the case out of the attorney queue meanwhile is the pending
 * invitation, not the typed name — so a decline or a lapse needs no write here at
 * all. The case simply reappears in front of every other attorney. See
 * `pendingCaseInvitationWhere`.
 */
export async function commitCaseWithInviteAction(
	input: InviteAttorneyCaseInput,
): Promise<CommitCaseWithInviteResult> {
	const { session } = await requireRole("plaintiff");

	const parsed = inviteAttorneySchema.safeParse(input);
	if (!parsed.success) {
		const fieldErrors: Record<string, string> = {};
		for (const issue of parsed.error.issues) {
			const key = issue.path.join(".");
			if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
		}
		return {
			ok: false,
			error:
				fieldErrors["attorney.email"] ??
				fieldErrors["attorney.name"] ??
				"Please fix the highlighted fields.",
			fieldErrors,
		};
	}

	const { id, attorney, ...rest } = parsed.data;

	// "Choose a different attorney" can drop a case that already has a match back
	// into this form. A match is settled representation — walking that case back to
	// `seeking` would put a represented case in front of the queue and invite a
	// second attorney to claim it.
	if (id && (await getCaseMatch(id, session.user.id))) {
		const committed = await commitCaseAction(parsed.data);
		return committed.ok ? { ...committed, kind: "matched" } : committed;
	}

	// What the case was before this call, which decides whether it may be published
	// out at all and how far a failure below can be taken back. `seeking` is the
	// only state this path may re-enter; everything past it is a case that has
	// already been committed or is already raising, and this wizard step is
	// reachable from those by the Back button alone.
	let previousStatus: string | null = null;
	if (id) {
		const existing = await getOwnedCase(id, session.user.id);
		if (!existing || existing.deletedAt) {
			return { ok: false, error: "Couldn't find that case." };
		}
		previousStatus = existing.status;
		if (existing.status === "live" || existing.status === "closed") {
			return { ok: false, caseId: id, error: NOT_REPUBLISHABLE };
		}
		// A case committed before invitations existed: no match, but handed to its
		// attorney and possibly already set up in Stripe. It belongs on the payout
		// path it is already on, not back in a queue it has left.
		if (existing.status === "pending_payout") {
			const committed = await commitCaseAction(parsed.data);
			return committed.ok ? { ...committed, kind: "matched" } : committed;
		}
	}

	// Jurisdiction, before anything is written and before an email goes out.
	//
	// Confirming re-checks this against the attorney's own admissions, which is the
	// authority — but leaving it to confirm alone would cost the plaintiff a week:
	// a pending invitation holds their case out of the attorney queue for seven
	// days, and an invitation that can never be confirmed holds it for nothing.
	//
	// Two things are checked, in order of how much they are worth. What the
	// plaintiff typed into the wizard is only a claim about somebody else, so it is
	// caught as a mistake in the form. If the address already belongs to an attorney
	// account, their admissions are the real answer and are checked instead.
	const claimed = attorney.location?.trim();
	if (claimed && claimed !== rest.location) {
		return {
			ok: false,
			caseId: id,
			error: `${attorney.name} is listed as practising in ${claimed}, but this case is in ${rest.location}. An attorney can only take a case in a state they're admitted in.`,
		};
	}

	const inviteeStates = await admittedStatesForEmail(attorney.email);
	if (inviteeStates && !inviteeStates.includes(rest.location)) {
		return {
			ok: false,
			caseId: id,
			error: inviteeStates.length
				? `That attorney is admitted in ${formatStates(inviteeStates)}, not ${rest.location}, so they couldn't confirm this case. Check the address, or choose an attorney admitted in ${rest.location}.`
				: `That attorney hasn't recorded any states they're admitted in yet, so they couldn't confirm a case in ${rest.location}. Ask them to add ${rest.location} to their JustUs profile first.`,
		};
	}

	// Counted before anything is written, so a refusal costs nothing.
	const recent = await countRecentCaseInvitationsBy(
		session.user.id,
		new Date(Date.now() - INVITE_WINDOW_MS),
	);
	if (recent >= MAX_INVITES_PER_WINDOW) {
		return {
			ok: false,
			caseId: id,
			error: "Too many invitations in the last hour. Try again later.",
		};
	}

	let created: { id: string; status: string };
	try {
		created = await publishForAttorneys({
			ownerId: session.user.id,
			id,
			attorney,
			...rest,
		});
	} catch {
		return { ok: false, error: "Could not save your case. Please try again." };
	}
	if (created.status !== "seeking") {
		return { ok: false, caseId: created.id, error: NOT_REPUBLISHABLE };
	}

	/** Take the publish back when the rest of the invitation never happened.
	 *  Only for a case this call published: one that was already `seeking` was
	 *  in the queue before the plaintiff pressed anything. */
	const undoPublish = async () => {
		if (previousStatus === "seeking") return;
		await revertSeekingToDraft(created.id, session.user.id).catch(
			() => undefined,
		);
	};

	const { token, tokenHash } = generateInviteToken();
	try {
		await upsertCaseInvitationForPublish({
			caseId: created.id,
			actorId: session.user.id,
			email: attorney.email,
			tokenHash,
			expiresAt: new Date(Date.now() + INVITE_TTL_MS),
		});
	} catch {
		// The case is `seeking` and there is no invitation to hold it out of the
		// queue, so without this it would be in front of every bar-verified attorney
		// at the moment the screen says nothing was sent.
		await undoPublish();
		return {
			ok: false,
			caseId: created.id,
			error: "Couldn't create the invitation. Please try again.",
		};
	}

	// Which of the two emails they get: sign in and confirm, or create an attorney
	// account on the way. Read before the send so a failure here can't be reported
	// as a mail failure.
	const hasAccount = await accountExistsForEmail(attorney.email);

	try {
		await sendCaseInviteEmail({
			to: attorney.email,
			inviteUrl: `${env.BETTER_AUTH_URL}/case-invite?token=${token}`,
			caseTitle: rest.title,
			plaintiffName: session.user.name,
			attorneyName: attorney.name,
			hasAccount,
			expiresInDays: CASE_INVITATION_TTL_DAYS,
		});
	} catch {
		// Nobody was sent a link, so nothing may be left behind that behaves as if
		// somebody was. A pending invitation holds the case out of the attorney queue
		// for a week — the exact silent dead end this flow exists to remove — so it is
		// withdrawn, and the case goes back to being a draft the plaintiff can send
		// again. Mirrors the administrator invite path.
		await revokePendingInvitationsForCase({
			caseId: created.id,
			actorId: session.user.id,
			reason: "invitation_email_failed",
		}).catch(() => undefined);
		await undoPublish();
		return {
			ok: false,
			caseId: created.id,
			error: `Your case is saved, but we couldn't email ${attorney.email}. Check the address and send again.`,
		};
	}

	revalidatePath("/my-cases");
	revalidatePath("/representation");
	revalidatePath("/home");
	return {
		ok: true,
		kind: "invited",
		caseId: created.id,
		email: attorney.email,
		expiresInDays: CASE_INVITATION_TTL_DAYS,
	};
}

/**
 * Re-read how far the firm's payout setup has got, for the wizard's payout step.
 *
 * The plaintiff is waiting on someone else's Stripe onboarding, which finishes
 * without anything happening in their browser. This is what their "Check again"
 * asks — cheap, owner-scoped, and read-only.
 */
export async function casePayoutReadinessAction(
	caseId: string,
): Promise<
	{ ok: true; payout: CasePayoutReadiness } | { ok: false; error: string }
> {
	const { session } = await requireRole("plaintiff");
	const payout = await getCasePayoutOptions(caseId, session.user.id);
	if (!payout) return { ok: false, error: "Couldn't find that case." };
	return { ok: true, payout };
}
