import { hashInviteToken } from "@just-us/auth/invite-token";
import { isBlocked } from "@just-us/auth/user-status";
import { findCaseInvitation } from "@just-us/db/case-invitations";
import type { Route } from "next";
import { redirect } from "next/navigation";

import {
	CaseInviteResolved,
	type InviteUser,
} from "@/components/case-invite/case-invite-resolved";
import { getSession } from "@/lib/auth-server";
import { caseInviteHref, parseCaseInviteRef } from "@/lib/case-invite-ref";
import { withNext } from "@/lib/next-path";

/**
 * The one entry behind every bring-your-own-attorney invitation link.
 *
 * A plaintiff named an attorney by email when they published; this is where that
 * attorney answers. Where the answering happens depends on who is opening it:
 *
 *  - Signed in and ready to act (email verified, onboarded, not blocked) — the
 *    link is routed into the app, where the invitation is shown as a modal over
 *    their own dashboard (`/home?ci_*`). A decision that arrived by email is made
 *    without leaving where they were.
 *  - Signed out, or signed in but not yet able to reach a dashboard (mid-verify,
 *    mid-onboarding, blocked) — the invitation is a full page on the site, so the
 *    thing standing between them and confirming is the thing on screen.
 *
 * Everything the two share — the twelve states an invitation can be in, and their
 * words — lives in `CaseInviteResolved`. Nothing here or there is a permission
 * check: every gate is re-applied inside `confirmCaseInvitation`'s transaction.
 */

export const metadata = { title: "Case invitation" };

/** Carry the invitation into the app modal, under namespaced params so they never
 *  collide with a dashboard's own. Raw values are forwarded verbatim; the modal
 *  re-parses and re-validates them exactly as this page would. */
function homeInviteHref(raw: {
	token?: string;
	invitation?: string;
	declined?: string;
}): Route {
	const query = new URLSearchParams();
	if (raw.token) query.set("ci_token", raw.token);
	if (raw.invitation) query.set("ci_id", raw.invitation);
	if (raw.declined) query.set("ci_declined", raw.declined);
	return `/home?${query.toString()}` as Route;
}

export default async function CaseInvitePage({
	searchParams,
}: {
	searchParams: Promise<{
		token?: string;
		invitation?: string;
		declined?: string;
	}>;
}) {
	const raw = await searchParams;
	const ref = parseCaseInviteRef({
		token: raw.token,
		invitation: raw.invitation,
	});

	const session = await getSession();
	const user = (session?.user ?? null) as InviteUser;

	// Ready to act, so ready for the app: send them to the modal over their
	// dashboard. The not-yet-ready gates (verify email, finish onboarding, blocked)
	// can't render on `/home` — it bounces them — so those fall through to the
	// full-page card below, where they can actually clear the gate.
	if (user) {
		const ready =
			user.emailVerified === true &&
			!isBlocked(user) &&
			user.onboarded === true;
		if (ready) {
			redirect(homeInviteHref(raw));
		}
	}

	// The id route names a row and proves nothing on its own, so a signed-out
	// visitor is sent to sign in and brought straight back. The token route needs
	// none of this — holding the token is the proof.
	if (!user && ref && !("token" in ref)) {
		redirect(withNext("/login?mode=signin", caseInviteHref(ref)) as Route);
	}

	// Only the hash is stored, so an unknown link and a tampered one are
	// indistinguishable — both resolve to the invalid card.
	const invitation = ref
		? await findCaseInvitation(
				"token" in ref
					? { tokenHash: hashInviteToken(ref.token) }
					: { invitationId: ref.invitationId },
			)
		: null;

	return (
		<CaseInviteResolved
			inviteRef={ref}
			invitation={invitation}
			user={user}
			declined={raw.declined === "1"}
			asModal={false}
		/>
	);
}
