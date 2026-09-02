import { randomUUID } from "node:crypto";

import { isAdmittedIn } from "./admissions";
import { writeAudit } from "./audit";
import prisma from "./index";

/**
 * Invitations to an attorney the plaintiff brought themselves.
 *
 * The plaintiff publishes a case saying "I already have an attorney" and gives
 * their email. That is an assertion, not a relationship — so the case is
 * published as `seeking`, the named attorney is emailed a single-use link, and
 * nothing binds until *they* confirm. Only then is a `Match` written and the
 * case moved on to `pending_payout`, where the payout machinery takes over.
 *
 * Two rules are worth stating plainly, because both replace something that used
 * to be assumed:
 *
 *   1. **A pending invitation is what hides the case from the attorney queue.**
 *      Not the plaintiff's typed `attorneyName`, which is a label and proves
 *      nothing. So a decline, a revoke, or an expiry needs no write to the case
 *      at all — the case reappears in the queue the moment this row stops being
 *      pending. See `queueWhere` in representation.ts.
 *   2. **Confirming is the attorney's own act, and it is gated.** The signed-in
 *      user must hold the invited email, be an attorney, and be verified. An
 *      invitation is an introduction; it is not authority to represent anyone.
 *
 * State is derived from the timestamps, never stored, exactly as
 * `AdminInvitation` does it — with `declined` inserted for the answer only this
 * flow can receive: accepted > declined > revoked > expired > pending.
 */

export const CASE_INVITATION_TTL_DAYS = 7;

export type CaseInvitationStatus =
	| "pending"
	| "accepted"
	| "declined"
	| "revoked"
	| "expired";

export function caseInvitationStatus(
	inv: {
		acceptedAt: Date | null;
		declinedAt: Date | null;
		revokedAt: Date | null;
		expiresAt: Date;
	},
	at = new Date(),
): CaseInvitationStatus {
	if (inv.acceptedAt) return "accepted";
	if (inv.declinedAt) return "declined";
	if (inv.revokedAt) return "revoked";
	if (inv.expiresAt <= at) return "expired";
	return "pending";
}

/**
 * The predicate for "still waiting on an answer", as a `where` fragment.
 *
 * Exported because the attorney queue reads it too — the queue's rule and this
 * module's rule have to be the same rule, or a case could be held out of the
 * queue by an invitation this file already considers dead.
 */
export function pendingCaseInvitationWhere(at: Date = new Date()) {
	return {
		acceptedAt: null,
		declinedAt: null,
		revokedAt: null,
		expiresAt: { gt: at },
	};
}

/** Terminal states an invitation can already be in when a link is followed.
 *  Separated from the eligibility codes below so a caller can tell "this
 *  invitation is over" from "you are not the person it was for". */
export type CaseInvitationTokenErrorCode =
	| "invalid"
	| "expired"
	| "declined"
	| "revoked"
	| "used";

/** Maps a non-pending status onto the code a caller reports. `accepted`
 *  becomes `used`, matching the admin-invitation vocabulary. */
function tokenErrorCode(
	status: Exclude<CaseInvitationStatus, "pending">,
): CaseInvitationTokenErrorCode {
	return status === "accepted" ? "used" : status;
}

/**
 * Which invitation, and how the caller earned the right to name it.
 *
 * `tokenHash` is the emailed link: possession of the raw token is the only
 * credential an invitee who has never signed in can offer, so it stands in for
 * proof that they hold the invited address. `invitationId` is the signed-in
 * route — the invitation an attorney sees on their own dashboard once they have
 * an account — where identity comes from the session instead.
 *
 * An id is not a secret. Nothing may be read or written from one without the
 * email match, which is why every mutation below makes that match itself rather
 * than trusting the screen that named the row.
 */
export type CaseInvitationRef =
	| { tokenHash: string }
	| { invitationId: string };

/** Both columns are unique, so either side of the ref is a `findUnique` key. */
function refWhere(ref: CaseInvitationRef) {
	return "tokenHash" in ref
		? { tokenHash: ref.tokenHash }
		: { id: ref.invitationId };
}

/**
 * Create, resend, or replace the invitation for a case being published.
 *
 * Publishing is re-runnable — the wizard can be reopened against the same case
 * id — so this is written as one idempotent step rather than a create the
 * caller has to guard:
 *
 *   - **Same email, still pending** — the plaintiff republished, or asked for
 *     the email again. The token is regenerated and the clock restarts on the
 *     same row, which invalidates the link already in the attorney's inbox.
 *     One live link per invitation, always.
 *   - **Different email** — the plaintiff changed their mind about who they are
 *     inviting. The old invitation is revoked, so the previous attorney's link
 *     stops working, and a fresh one is created.
 *
 * Emails are lowercased on write so "the same attorney" is one answer rather
 * than a question of how it was typed.
 */
export async function upsertCaseInvitationForPublish(input: {
	caseId: string;
	/** The case owner — the only person who can invite on their own case. */
	actorId: string;
	email: string;
	/** SHA-256 of the raw token that goes in the email. The raw token is never
	 *  stored, so a leaked table cannot be used to accept an invitation. */
	tokenHash: string;
	expiresAt: Date;
}): Promise<{ id: string }> {
	const email = input.email.trim().toLowerCase();

	return prisma.$transaction(async (tx) => {
		const now = new Date();
		const pending = await tx.caseInvitation.findMany({
			where: { caseId: input.caseId, ...pendingCaseInvitationWhere(now) },
			select: { id: true, email: true },
		});

		const sameEmail = pending.find((inv) => inv.email === email);
		// Anything pending for a *different* address is withdrawn, whether or not
		// this call goes on to resend. Two live invitations on one case would let
		// two attorneys race to confirm a match only one of them can have.
		const stale = pending.filter((inv) => inv.id !== sameEmail?.id);
		for (const inv of stale) {
			await tx.caseInvitation.update({
				where: { id: inv.id },
				data: { revokedAt: now },
			});
			await writeAudit(tx, {
				actorId: input.actorId,
				action: "case_invite.revoked",
				targetType: "case_invitation",
				targetId: inv.id,
				metadata: {
					caseId: input.caseId,
					email: inv.email,
					reason: "replaced_by_new_invitee",
				},
			});
		}

		if (sameEmail) {
			await tx.caseInvitation.update({
				where: { id: sameEmail.id },
				data: { tokenHash: input.tokenHash, expiresAt: input.expiresAt },
			});
			await writeAudit(tx, {
				actorId: input.actorId,
				action: "case_invite.resent",
				targetType: "case_invitation",
				targetId: sameEmail.id,
				metadata: { caseId: input.caseId, email },
			});
			return { id: sameEmail.id };
		}

		const created = await tx.caseInvitation.create({
			data: {
				caseId: input.caseId,
				email,
				tokenHash: input.tokenHash,
				expiresAt: input.expiresAt,
			},
			select: { id: true },
		});
		await writeAudit(tx, {
			actorId: input.actorId,
			action: "case_invite.created",
			targetType: "case_invitation",
			targetId: created.id,
			metadata: { caseId: input.caseId, email },
		});
		return { id: created.id };
	});
}

/**
 * Withdraw every invitation still awaiting an answer on a case.
 *
 * The plaintiff changed their mind about the bring-your-own path — they went back
 * through the wizard and published the case out to attorneys instead, or removed
 * the attorney they had named. Clearing the case's `attorneyName` is not enough:
 * a pending invitation is what holds the case out of the queue, and it is also a
 * live token that would still let its holder claim representation of a case the
 * plaintiff has taken away from them.
 *
 * Returns how many were withdrawn, so a caller can stay quiet when there were
 * none. Safe to call on any case.
 */
export async function revokePendingInvitationsForCase(input: {
	caseId: string;
	/** The case owner — the only person who can withdraw on their own case. */
	actorId: string;
	/** Recorded in the audit metadata: why these were withdrawn. */
	reason: string;
}): Promise<number> {
	return prisma.$transaction(async (tx) => {
		const now = new Date();
		const pending = await tx.caseInvitation.findMany({
			where: { caseId: input.caseId, ...pendingCaseInvitationWhere(now) },
			select: { id: true, email: true },
		});
		if (pending.length === 0) return 0;

		for (const inv of pending) {
			await tx.caseInvitation.update({
				where: { id: inv.id },
				data: { revokedAt: now },
			});
			await writeAudit(tx, {
				actorId: input.actorId,
				action: "case_invite.revoked",
				targetType: "case_invitation",
				targetId: inv.id,
				metadata: {
					caseId: input.caseId,
					email: inv.email,
					reason: input.reason,
				},
			});
		}
		return pending.length;
	});
}

/**
 * How many invitations this plaintiff has created across all their cases since
 * `since` — the ceiling the publish action enforces.
 *
 * Every invitation sends mail from the platform's own domain carrying text the
 * plaintiff wrote, so an unbounded loop over this path is a relay. Counted per
 * actor rather than per case because the invite step is idempotent on a case:
 * varying only the address rewrites the same row and would clear any per-case cap.
 */
export async function countRecentCaseInvitationsBy(
	ownerId: string,
	since: Date,
): Promise<number> {
	return prisma.caseInvitation.count({
		where: { case: { ownerId }, createdAt: { gte: since } },
	});
}

/**
 * The invitation behind a link, with as much of the case as the landing page
 * needs to show what is being asked.
 *
 * The story, the evidence, and the plaintiff's contact details are deliberately
 * absent: whoever holds this link has not proved they are the invited attorney,
 * only that they received (or found) the token. They get the shape of the
 * matter and the name of the person asking — the same line the attorney queue
 * draws — and the substance arrives once they confirm. That restraint is also
 * what makes the id route safe to share this function: an id names a row, and
 * this returns nothing an id-holder shouldn't see. The caller still has to make
 * the email match before drawing anything.
 *
 * Returns the row whatever state it is in, so the caller can say "this invite
 * has expired" rather than "not found".
 */
export async function findCaseInvitation(ref: CaseInvitationRef) {
	return prisma.caseInvitation.findUnique({
		where: refWhere(ref),
		include: {
			case: {
				select: {
					id: true,
					title: true,
					summary: true,
					category: true,
					location: true,
					goalCents: true,
					status: true,
					deletedAt: true,
					attorneyName: true,
					attorneyFirm: true,
					owner: { select: { name: true } },
				},
			},
		},
	});
}

export type CaseInvitationForCase = {
	id: string;
	email: string;
	createdAt: Date;
	expiresAt: Date;
	status: CaseInvitationStatus;
};

/**
 * The live invitation on a plaintiff's own case, for the case management view —
 * who was asked, and how long they have left to answer.
 *
 * Pending only. A lapsed or declined invitation is not something the plaintiff
 * is waiting on; what they need to see then is that their case is back in front
 * of other attorneys, which is the queue's business, not this row's.
 */
export async function getPendingInvitationForCase(
	caseId: string,
): Promise<CaseInvitationForCase | null> {
	const now = new Date();
	const inv = await prisma.caseInvitation.findFirst({
		where: { caseId, ...pendingCaseInvitationWhere(now) },
		orderBy: { createdAt: "desc" },
		select: {
			id: true,
			email: true,
			createdAt: true,
			expiresAt: true,
			acceptedAt: true,
			declinedAt: true,
			revokedAt: true,
		},
	});
	if (!inv) return null;
	const { acceptedAt, declinedAt, revokedAt, ...rest } = inv;
	return {
		...rest,
		status: caseInvitationStatus(
			{ acceptedAt, declinedAt, revokedAt, expiresAt: inv.expiresAt },
			now,
		),
	};
}

/**
 * The live invitation on each of a set of the plaintiff's cases, keyed by case id.
 *
 * The list version of `getPendingInvitationForCase`, for the screens that render
 * many cases at once. A `seeking` case with a pending invitation is not "out to
 * attorneys" — it is out to exactly one, and every other attorney is being kept
 * from it — so a card that cannot tell the two apart tells the plaintiff the
 * opposite of what is happening.
 *
 * Only pending rows come back, so a case with no entry is genuinely in the queue.
 */
export async function pendingInvitationsForCases(
	caseIds: string[],
): Promise<Map<string, CaseInvitationForCase & { caseId: string }>> {
	const found = new Map<string, CaseInvitationForCase & { caseId: string }>();
	if (caseIds.length === 0) return found;

	const now = new Date();
	const rows = await prisma.caseInvitation.findMany({
		where: { caseId: { in: caseIds }, ...pendingCaseInvitationWhere(now) },
		orderBy: { createdAt: "desc" },
		select: {
			id: true,
			caseId: true,
			email: true,
			createdAt: true,
			expiresAt: true,
		},
	});
	for (const row of rows) {
		// Newest first, and `upsertCaseInvitationForPublish` revokes the rest, so
		// the first one seen for a case is the one being waited on.
		if (!found.has(row.caseId))
			found.set(row.caseId, { ...row, status: "pending" });
	}
	return found;
}

/**
 * Does the invited address already belong to an account?
 *
 * The question the landing page has to answer before it can show anything: an
 * attorney who is already on JustUs is asked to sign in and confirm, a stranger
 * is asked to create an account first. It is the same question the invitation
 * email asked when it chose its copy, so both must ask it the same way.
 *
 * Answered from the address alone, and only ever as a yes or no. Holding the
 * token proves nothing about who is holding it, so nothing about the account
 * behind the address is returned. Matched case-insensitively, because the
 * plaintiff typed one of these addresses and the account holder typed the other.
 */
export async function invitedEmailHasAccount(email: string): Promise<boolean> {
	const normalized = email.trim();
	if (!normalized) return false;
	const user = await prisma.user.findFirst({
		where: { email: { equals: normalized, mode: "insensitive" } },
		select: { id: true },
	});
	return !!user;
}

export type PendingInvitationForAttorney = {
	id: string;
	expiresAt: Date;
	caseId: string;
	caseTitle: string;
	category: string;
	location: string;
	goalCents: number;
	plaintiffName: string;
};

/**
 * The invitations an attorney has been sent and not yet answered, for their own
 * dashboard.
 *
 * The counterpart to `pendingInvitationsForCases`, which answers the same
 * question for the plaintiff. This side did not exist, and its absence was the
 * bug: only the hash of a token is stored, so the emailed link was the one and
 * only way into the confirm screen, and an attorney who closed that email — or
 * who was sent off to finish onboarding or a bar check on the way — had no route
 * back to it from inside the product. Reading by address gives the invitation a
 * home that outlives the email.
 *
 * Matched on the address rather than the account, because that is what the
 * invitation was addressed to and the row may predate the account by a week.
 * Case-insensitively, for the same reason `invitedEmailHasAccount` is: the
 * plaintiff typed one of these and the account holder typed the other.
 *
 * Pending only, and only for a case that can still be taken: an invitation whose
 * case has since been withdrawn or matched elsewhere is not something to put in
 * front of an attorney as an outstanding decision. The predicate is the one
 * `confirmCaseInvitation` enforces, so nothing is advertised here that would be
 * refused there.
 */
export async function pendingInvitationsForEmail(
	email: string,
): Promise<PendingInvitationForAttorney[]> {
	const normalized = email.trim();
	if (!normalized) return [];

	const rows = await prisma.caseInvitation.findMany({
		where: {
			email: { equals: normalized, mode: "insensitive" },
			...pendingCaseInvitationWhere(),
			case: { deletedAt: null, status: "seeking", match: { is: null } },
		},
		orderBy: { createdAt: "desc" },
		select: {
			id: true,
			expiresAt: true,
			case: {
				select: {
					id: true,
					title: true,
					category: true,
					location: true,
					goalCents: true,
					owner: { select: { name: true } },
				},
			},
		},
	});

	return rows.map((row) => ({
		id: row.id,
		expiresAt: row.expiresAt,
		caseId: row.case.id,
		caseTitle: row.case.title,
		category: row.case.category,
		location: row.case.location,
		goalCents: row.case.goalCents,
		plaintiffName: row.case.owner.name,
	}));
}

export type DeclinedInvitationForAttorney = {
	id: string;
	caseId: string;
	caseTitle: string;
	category: string;
	location: string;
	plaintiffName: string;
	declinedAt: Date;
};

/**
 * The invitations this attorney has declined — the record behind the "Declined"
 * tab of Intake requests.
 *
 * A plaintiff named them, they said no, and the intake leaves their "New" list;
 * this is where it lands so a decline reads as something that happened rather
 * than a request that silently vanished. Kept even after the case is taken or
 * withdrawn — this is history, not an open decision, so only a deleted case
 * drops out. Matched on the address, like the pending side.
 */
export async function declinedInvitationsForEmail(
	email: string,
): Promise<DeclinedInvitationForAttorney[]> {
	const normalized = email.trim();
	if (!normalized) return [];

	const rows = await prisma.caseInvitation.findMany({
		where: {
			email: { equals: normalized, mode: "insensitive" },
			declinedAt: { not: null },
			case: { deletedAt: null },
		},
		orderBy: { declinedAt: "desc" },
		select: {
			id: true,
			declinedAt: true,
			case: {
				select: {
					id: true,
					title: true,
					category: true,
					location: true,
					owner: { select: { name: true } },
				},
			},
		},
	});

	return rows.map((row) => ({
		id: row.id,
		caseId: row.case.id,
		caseTitle: row.case.title,
		category: row.case.category,
		location: row.case.location,
		plaintiffName: row.case.owner.name,
		// Non-null: the `declinedAt: { not: null }` predicate above guarantees it.
		declinedAt: row.declinedAt as Date,
	}));
}

export type CreateInvitedAttorneyResult =
	| { ok: true; userId: string; email: string }
	| { ok: false; code: CaseInvitationTokenErrorCode | "email_taken" };

/**
 * The account for an invited attorney who does not have one yet.
 *
 * Deliberately *not* the same step as accepting. The admin flow can create the
 * account and stamp `acceptedAt` in one move because there the invitation is the
 * account; here the invitation is a question about a case, and signing up is
 * only how the invited attorney gets far enough to answer it. So this writes the
 * user and leaves the invitation exactly as it found it — pending, and still
 * hiding the case from the queue until `confirmCaseInvitation` or
 * `declineCaseInvitation` settles it.
 *
 * Born `emailVerified` (receiving the link at that address is the proof) with
 * role `attorney`, but *not* onboarded: firm, bar number, and jurisdiction come
 * from onboarding, and bar verification after that. Confirming stays gated on
 * both — an invitation cannot be a way around JUS-24's verification rule.
 *
 * No audit entry. Nothing has happened to the invitation yet, and the account
 * creation is Better Auth's own record to keep.
 */
export async function createInvitedAttorneyAccount(input: {
	tokenHash: string;
	name: string;
	/** Already hashed with Better Auth's KDF, so the row it later reads back is
	 *  indistinguishable from one created through sign-up. */
	passwordHash: string;
}): Promise<CreateInvitedAttorneyResult> {
	return prisma.$transaction(
		async (tx): Promise<CreateInvitedAttorneyResult> => {
			const inv = await tx.caseInvitation.findUnique({
				where: { tokenHash: input.tokenHash },
				select: {
					email: true,
					expiresAt: true,
					acceptedAt: true,
					declinedAt: true,
					revokedAt: true,
				},
			});
			if (!inv) return { ok: false, code: "invalid" };

			const status = caseInvitationStatus(inv);
			if (status !== "pending") {
				return { ok: false, code: tokenErrorCode(status) };
			}

			// The address may have signed up between the email going out and this
			// form being submitted. That is a sign-in, not a second account.
			const taken = await tx.user.findFirst({
				where: { email: { equals: inv.email, mode: "insensitive" } },
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
					onboarded: false,
					role: "attorney",
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

			return { ok: true, userId, email: inv.email };
		},
	);
}

/** Why a confirmation was refused. Every one of these needs different words on
 *  the screen — "that invitation expired" and "your bar standing isn't verified
 *  yet" are different problems with different next steps — so the reason is
 *  returned rather than thrown. */
export type ConfirmCaseInvitationErrorCode =
	| CaseInvitationTokenErrorCode
	| "email_mismatch"
	| "not_attorney"
	| "not_verified"
	| "not_admitted"
	| "case_unavailable";

export type ConfirmCaseInvitationResult =
	| { ok: true; caseId: string; matchId: string }
	| { ok: false; code: ConfirmCaseInvitationErrorCode };

/**
 * The attorney accepts: the case gets its representation, in one transaction.
 *
 * Four things have to be true at this instant, and each is checked here rather
 * than trusted from the page that rendered the button:
 *
 *   - the invitation is still pending;
 *   - the signed-in account holds the invited address. Receiving the link is
 *     not identity — email forwards, and a match must not be creatable by
 *     anyone who happens to hold the token;
 *   - they are an attorney whose bar standing is `verified`. Same gate JUS-24
 *     puts on every other route to a match, applied here so the bring-your-own
 *     path cannot be the way around it;
 *   - the case is still `seeking`, undeleted, and unmatched.
 *
 * On success the case moves to `pending_payout` — finished, committed, private,
 * and waiting on this attorney to open its Stripe account. `publishedAt` is
 * re-stamped for the same reason `publishCase` re-stamps it: it marks the last
 * change of visibility, not the first.
 */
export async function confirmCaseInvitation(input: {
	ref: CaseInvitationRef;
	/** The signed-in user's id. */
	attorneyId: string;
}): Promise<ConfirmCaseInvitationResult> {
	return prisma.$transaction(
		async (tx): Promise<ConfirmCaseInvitationResult> => {
			const now = new Date();
			const inv = await tx.caseInvitation.findUnique({
				where: refWhere(input.ref),
				select: {
					id: true,
					caseId: true,
					email: true,
					expiresAt: true,
					acceptedAt: true,
					declinedAt: true,
					revokedAt: true,
				},
			});
			if (!inv) return { ok: false, code: "invalid" };

			const status = caseInvitationStatus(inv, now);
			if (status !== "pending") {
				return { ok: false, code: tokenErrorCode(status) };
			}

			const attorney = await tx.user.findUnique({
				where: { id: input.attorneyId },
				select: {
					id: true,
					email: true,
					role: true,
					attorneyProfile: { select: { verificationStatus: true } },
				},
			});
			if (!attorney) return { ok: false, code: "invalid" };
			if (attorney.email.trim().toLowerCase() !== inv.email) {
				return { ok: false, code: "email_mismatch" };
			}
			if (attorney.role !== "attorney") {
				return { ok: false, code: "not_attorney" };
			}
			if (attorney.attorneyProfile?.verificationStatus !== "verified") {
				return { ok: false, code: "not_verified" };
			}

			// Re-read against the full predicate rather than trusting the id on the
			// invitation: the plaintiff may have deleted, withdrawn, or matched the
			// case since the email went out, and a stale link must not reach it.
			const target = await tx.case.findFirst({
				where: {
					id: inv.caseId,
					deletedAt: null,
					status: "seeking",
					match: { is: null },
				},
				select: { id: true, location: true },
			});
			if (!target) return { ok: false, code: "case_unavailable" };

			// Being named by a plaintiff is not a licence. The invitation says who
			// they want; whether this attorney may act on a matter in this state is a
			// fact about their admissions, and it is checked here in the same
			// transaction as every other condition — the plaintiff typed a
			// jurisdiction into the wizard, and what they typed is a claim about
			// somebody else.
			if (!(await isAdmittedIn(tx, attorney.id, target.location))) {
				return { ok: false, code: "not_admitted" };
			}

			// Claim the invitation *first*, with the pending predicate in the `where`
			// rather than in the code above it. The status read is a snapshot — two
			// tabs, or a confirm racing a decline, both see `pending` — and only a
			// conditional write serialises them. Whichever transaction loses updates
			// nothing and reports the answer that was already given, instead of both
			// stamping the row and the later one being silently discarded.
			const claimed = await tx.caseInvitation.updateMany({
				where: { id: inv.id, ...pendingCaseInvitationWhere(now) },
				data: { acceptedAt: now },
			});
			if (claimed.count === 0) return { ok: false, code: "used" };

			const match = await tx.match.create({
				data: {
					caseId: inv.caseId,
					attorneyId: attorney.id,
					origin: "bring_your_own",
				},
				select: { id: true },
			});
			await tx.case.update({
				where: { id: inv.caseId },
				data: { status: "pending_payout", publishedAt: now },
			});
			await writeAudit(tx, {
				actorId: attorney.id,
				action: "case_invite.confirmed",
				targetType: "case_invitation",
				targetId: inv.id,
				metadata: {
					caseId: inv.caseId,
					email: inv.email,
					matchId: match.id,
					origin: "bring_your_own",
				},
			});

			return { ok: true, caseId: inv.caseId, matchId: match.id };
		},
	);
}

export type DeclineCaseInvitationResult =
	| { ok: true; caseId: string }
	| { ok: false; code: CaseInvitationTokenErrorCode };

/**
 * The attorney says no.
 *
 * Nothing about the case changes. It is already `seeking`, and it re-enters the
 * attorney queue by this row ceasing to be pending — which is the whole reason
 * the queue reads invitations instead of `attorneyName`. A plaintiff whose
 * chosen attorney declined is put back in front of every other attorney without
 * anyone having to remember to do it.
 *
 * `actorId` is optional because declining does not require an account — the link
 * is the only thing the invited attorney was given. An anonymous decline is
 * audited with **no actor at all** rather than against the case owner: the actor
 * column is what an administrator reads, and attributing the refusal to the
 * plaintiff would make the log say the opposite of what happened. The invited
 * address is in the metadata, which is as far as the record honestly goes.
 */
export async function declineCaseInvitation(input: {
	ref: CaseInvitationRef;
	actorId?: string | null;
	/** Required on the id route, where there is no token to stand in for holding
	 *  the invited address. A mismatch is reported as `invalid` rather than as a
	 *  wrong-account error: an id names a row the caller may have no business
	 *  knowing exists, and the reply must not confirm that it does. */
	requireEmail?: string | null;
}): Promise<DeclineCaseInvitationResult> {
	return prisma.$transaction(
		async (tx): Promise<DeclineCaseInvitationResult> => {
			const now = new Date();
			const inv = await tx.caseInvitation.findUnique({
				where: refWhere(input.ref),
				select: {
					id: true,
					caseId: true,
					email: true,
					expiresAt: true,
					acceptedAt: true,
					declinedAt: true,
					revokedAt: true,
				},
			});
			if (!inv) return { ok: false, code: "invalid" };

			if (
				input.requireEmail !== undefined &&
				input.requireEmail?.trim().toLowerCase() !== inv.email
			) {
				return { ok: false, code: "invalid" };
			}

			const status = caseInvitationStatus(inv, now);
			if (status !== "pending") {
				return { ok: false, code: tokenErrorCode(status) };
			}

			// Conditional on the row still being pending, for the same reason confirm
			// is: a decline racing a confirm must lose rather than stamp a second
			// timestamp on a row that has already been answered.
			const claimed = await tx.caseInvitation.updateMany({
				where: { id: inv.id, ...pendingCaseInvitationWhere(now) },
				data: { declinedAt: now },
			});
			if (claimed.count === 0) return { ok: false, code: "used" };

			await writeAudit(tx, {
				actorId: input.actorId ?? null,
				action: "case_invite.declined",
				targetType: "case_invitation",
				targetId: inv.id,
				metadata: {
					caseId: inv.caseId,
					email: inv.email,
					signedInActorId: input.actorId ?? null,
				},
			});

			return { ok: true, caseId: inv.caseId };
		},
	);
}
