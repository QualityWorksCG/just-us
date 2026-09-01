"use server";

import { generateInviteToken } from "@just-us/auth/invite-token";
import { sendCaseInviteEmail } from "@just-us/auth/lib/email";
import { attorneyInviteContact } from "@just-us/db/attorney-directory";
import {
	CASE_INVITATION_TTL_DAYS,
	revokePendingInvitationsForCase,
	upsertCaseInvitationForPublish,
} from "@just-us/db/case-invitations";
import {
	getOwnedCase,
	sendCaseToAttorneys,
	setCaseInvitedAttorney,
} from "@just-us/db/cases";
import { env } from "@just-us/env/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireRole } from "@/lib/auth-server";

const INVITE_TTL_MS = CASE_INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000;

const schema = z
	.object({ caseId: z.string().min(1), attorneyId: z.string().min(1) })
	.strict();

export type RequestRepresentationResult =
	| { ok: true }
	| { ok: false; error: string };

/**
 * A plaintiff asks a specific attorney from the directory to represent their case
 * — the "Request to represent" action, the directed twin of the wizard's
 * bring-your-own-attorney publish.
 *
 * The request only reaches the attorney once the case is out to attorneys, so a
 * draft is sent out here (`sendCaseToAttorneys`) and immediately held for this one
 * attorney by the pending invitation — never dropped into the open queue. The
 * attorney then sees it under Intake requests → New and accepts or declines.
 */
export async function requestRepresentationAction(
	input: unknown,
): Promise<RequestRepresentationResult> {
	const { session } = await requireRole("plaintiff");

	const parsed = schema.safeParse(input);
	if (!parsed.success)
		return { ok: false, error: "Couldn't send that request." };
	const { caseId, attorneyId } = parsed.data;

	const kase = await getOwnedCase(caseId, session.user.id);
	if (!kase || kase.deletedAt) {
		return { ok: false, error: "We couldn't find that case." };
	}

	const contact = await attorneyInviteContact(attorneyId);
	if (!contact) {
		return { ok: false, error: "That attorney isn't available to request." };
	}

	const sent = await sendCaseToAttorneys(caseId, session.user.id);
	if (!sent.ok) {
		return {
			ok: false,
			error:
				sent.reason === "incomplete"
					? "Add a title, story, category, and state to your case before requesting an attorney."
					: sent.reason === "unavailable"
						? "This case already has an attorney, so it can't take a new request."
						: "We couldn't find that case.",
		};
	}

	// Record who was asked on the case itself, so the plaintiff's own screens —
	// the "Manage invitation" resume of the wizard especially — show the chosen
	// attorney and a waiting state rather than an empty attorney step.
	await setCaseInvitedAttorney({
		caseId,
		ownerId: session.user.id,
		attorney: {
			name: contact.name,
			firm: contact.firm,
			area: contact.area,
			location: contact.location,
			email: contact.email,
		},
	});

	const { token, tokenHash } = generateInviteToken();
	try {
		await upsertCaseInvitationForPublish({
			caseId,
			actorId: session.user.id,
			email: contact.email,
			tokenHash,
			expiresAt: new Date(Date.now() + INVITE_TTL_MS),
		});
	} catch {
		return { ok: false, error: "Couldn't send the request. Please try again." };
	}

	try {
		await sendCaseInviteEmail({
			to: contact.email,
			inviteUrl: `${env.BETTER_AUTH_URL}/case-invite?token=${token}`,
			caseTitle: kase.title || "your case",
			plaintiffName: session.user.name,
			attorneyName: contact.name,
			// They're an on-platform attorney (we resolved a real account above), so
			// the email is the "sign in and answer" one, not the account-creation one.
			hasAccount: true,
			expiresInDays: CASE_INVITATION_TTL_DAYS,
		});
	} catch {
		// Nothing was sent, so nothing may be left holding the case out of the queue.
		await revokePendingInvitationsForCase({
			caseId,
			actorId: session.user.id,
			reason: "invitation_email_failed",
		}).catch(() => undefined);
		return {
			ok: false,
			error: `We couldn't reach ${contact.name}. Please try again in a moment.`,
		};
	}

	revalidatePath("/find-attorney");
	revalidatePath(`/my-cases/${caseId}/requests`);
	return { ok: true };
}
