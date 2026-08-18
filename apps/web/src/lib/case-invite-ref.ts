/**
 * Which invitation a screen or action is about, and how the caller is entitled
 * to name it.
 *
 * Two routes reach the same decision. The emailed link carries a raw `token`,
 * and holding it is the only credential someone who has never signed in can
 * offer. The dashboard carries an `invitationId`, because only the hash of the
 * token is stored — nothing in the product can reconstruct the link — so an
 * attorney who closed the email would otherwise have no way back to the case
 * they were asked about.
 *
 * An id is not a credential. Everything behind it is gated on the signed-in
 * account holding the invited address, checked in the data layer's own
 * transaction rather than by the screen that drew the button.
 */
export type CaseInviteRef = { token: string } | { invitationId: string };

/** Ids come off a URL, so they are attacker-supplied like everything else here.
 *  Shape-checked before a lookup so junk is a 404 on our terms rather than a
 *  database error, and narrow enough that only a cuid-shaped value gets through. */
const ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

/** Read the ref out of a page's search params. A token wins if both are present:
 *  it is the stronger claim, and it is the one that works signed out. */
export function parseCaseInviteRef(params: {
	token?: string;
	invitation?: string;
}): CaseInviteRef | null {
	if (params.token) return { token: params.token };
	if (params.invitation && ID_PATTERN.test(params.invitation)) {
		return { invitationId: params.invitation };
	}
	return null;
}

/** The URL of the invitation screen for a ref — the return path every detour
 *  carries, and the destination the dashboard links to. */
export function caseInviteHref(
	ref: CaseInviteRef,
	params?: Record<string, string>,
): string {
	const query = new URLSearchParams(
		"token" in ref
			? { token: ref.token, ...params }
			: { invitation: ref.invitationId, ...params },
	);
	return `/case-invite?${query.toString()}`;
}
