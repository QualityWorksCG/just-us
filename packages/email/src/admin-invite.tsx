import {
	Button,
	buttonSection,
	buttonStyle,
	divider,
	EmailShell,
	footer,
	Hr,
	heading,
	link,
	paragraph,
	Section,
	Text,
} from "./_layout";

interface AdminInviteProps {
	url: string;
	inviterName?: string;
}

export const adminInviteSubject = "You're invited to administer JustUs";

AdminInviteEmail.PreviewProps = {
	url: "https://example.com/accept-invite?token=abc123",
	inviterName: "Jane Rivera",
} as AdminInviteProps;

export default function AdminInviteEmail({
	url,
	inviterName,
}: AdminInviteProps) {
	return (
		<EmailShell preview="You've been invited to administer JustUs">
			<Text style={heading}>You've been invited</Text>
			<Text style={paragraph}>
				{inviterName ?? "An administrator"} invited you to join JustUs as an
				administrator. Accept below to choose your name and password — your
				account is ready to use straight away.
			</Text>

			<Section style={buttonSection}>
				<Button href={url} style={buttonStyle}>
					Accept invitation
				</Button>
			</Section>

			<Text style={paragraph}>
				Or paste this link into your browser:
				<br />
				<a href={url} style={link}>
					{url}
				</a>
			</Text>

			<Hr style={divider} />

			<Text style={footer}>
				This link expires in 7 days. If you weren't expecting this invitation,
				you can safely ignore this email — no account is created until you
				accept.
			</Text>
		</EmailShell>
	);
}
