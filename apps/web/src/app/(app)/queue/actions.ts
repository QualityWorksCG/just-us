"use server";

import { declineCaseInvitation } from "@just-us/db/case-invitations";
import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { CaseInviteActionResult } from "@/app/case-invite/actions";
import { requireRole } from "@/lib/auth-server";
import type { CaseInviteRef } from "@/lib/case-invite-ref";
import { notifyInvitationDeclined } from "@/lib/notify";

/**
 * An attorney declines an intake they were named on, from inside the app.
 *
 * The in-app twin of the emailed `declineCaseInviteAction`. Same settle — the
 * invitation is marked declined and the case falls back into the queue for other
 * attorneys — but it never leaves the product: the request drops off "New" and
 * lands under "Declined", the plaintiff is told their case is back in front of
 * other attorneys, and the attorney returns to their queue. No standalone
 * confirmation screen and no signed-out invite-link view, which is what the
 * emailed decline redirects to and what this deliberately does not.
 */
export async function declineNamedIntakeAction(
	input: CaseInviteRef,
): Promise<CaseInviteActionResult> {
	const { session } = await requireRole("attorney");

	// This path only ever carries an invitation id — the raw token belongs to the
	// emailed flow. Anything else is a client passing junk to a public endpoint.
	if (
		!("invitationId" in input) ||
		!/^[A-Za-z0-9_-]{8,64}$/.test(input.invitationId)
	) {
		return { ok: false, error: "We couldn't find that request." };
	}
	const invitationId = input.invitationId;

	let result: Awaited<ReturnType<typeof declineCaseInvitation>>;
	try {
		result = await declineCaseInvitation({
			ref: { invitationId },
			actorId: session.user.id,
			// An id proves nothing on its own, so the signed-in address has to match
			// the invited one — enforced inside the data layer's transaction.
			requireEmail: session.user.email,
		});
	} catch {
		return { ok: false, error: "Couldn't record that. Please try again." };
	}

	if (!result.ok) {
		return {
			ok: false,
			error:
				result.code === "declined"
					? "You've already declined this request."
					: result.code === "used"
						? "This request has already been answered."
						: "This request is no longer open.",
		};
	}

	// The plaintiff's chosen attorney just said no — let them know, and clear the
	// caches the sidebar count and the tabs read from. Notifying is a side effect
	// of a decline that already happened, so its failure never fails the decline.
	await notifyInvitationDeclined(
		result.caseId,
		invitationId,
		session.user.name,
	).catch(() => {});
	revalidatePath("/queue");
	revalidatePath(`/my-cases/${result.caseId}/requests`);

	// Back to the queue, inside the app, rather than the emailed-invite terminal
	// page. redirect() throws, so this never returns on success.
	redirect("/queue" as Route);
}
