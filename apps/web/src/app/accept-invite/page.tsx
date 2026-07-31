import { hashInviteToken } from "@just-us/auth/invite-token";
import {
	findInvitationByTokenHash,
	invitationStatus,
} from "@just-us/db/invitations";
import { TriangleAlert } from "lucide-react";
import Link from "next/link";

import { AcceptInviteForm } from "@/components/auth/accept-invite-form";
import { AuthMiniShell } from "@/components/auth/auth-mini-shell";

export const metadata = { title: "Accept invitation" };

const signInLinkClass =
	"inline-flex h-10 w-full items-center justify-center rounded-[var(--radius-control)] bg-primary font-medium text-[14px] text-primary-foreground hover:bg-primary/90";

function AskForANewInvite() {
	return (
		<p className="text-[13px] text-muted-foreground">
			Ask the administrator who invited you to send a new invitation.
		</p>
	);
}

export default async function AcceptInvitePage({
	searchParams,
}: {
	searchParams: Promise<{ token?: string }>;
}) {
	const { token } = await searchParams;
	// The token is only ever compared as a hash, so an unknown link and a tampered
	// one are indistinguishable here — both fall through to "invalid".
	const invitation = token
		? await findInvitationByTokenHash(hashInviteToken(token))
		: null;

	if (!token || !invitation) {
		return (
			<AuthMiniShell
				icon={TriangleAlert}
				tone="danger"
				title="This invitation link is invalid"
				description="The link is missing or doesn't match an invitation we know about."
			>
				<AskForANewInvite />
			</AuthMiniShell>
		);
	}

	switch (invitationStatus(invitation)) {
		case "expired":
			return (
				<AuthMiniShell
					icon={TriangleAlert}
					tone="danger"
					title="This invitation has expired"
					description="Invitations are only good for 7 days, and this one has run out."
				>
					<AskForANewInvite />
				</AuthMiniShell>
			);
		case "revoked":
			return (
				<AuthMiniShell
					icon={TriangleAlert}
					tone="danger"
					title="This invitation was revoked"
					description="An administrator cancelled this invitation, so it can no longer be used."
				>
					<AskForANewInvite />
				</AuthMiniShell>
			);
		case "accepted":
			return (
				<AuthMiniShell
					icon={TriangleAlert}
					tone="danger"
					title="This invitation was already used"
					description="An account has already been created from this invitation."
				>
					<Link href="/login?mode=signin" className={signInLinkClass}>
						Sign in instead
					</Link>
				</AuthMiniShell>
			);
		default:
			return <AcceptInviteForm token={token} email={invitation.email} />;
	}
}
