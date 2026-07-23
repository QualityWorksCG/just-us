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

interface ResetPasswordProps {
	url: string;
	name?: string;
}

export const resetPasswordSubject = "Reset your JustUs password";

ResetPasswordEmail.PreviewProps = {
	url: "https://example.com/reset-password?token=abc123",
	name: "Jane Rivera",
} as ResetPasswordProps;

export default function ResetPasswordEmail({ url, name }: ResetPasswordProps) {
	return (
		<EmailShell preview="Reset your JustUs password">
			<Text style={heading}>Reset your password</Text>
			<Text style={paragraph}>
				{name ? `Hi ${name.split(" ")[0]},` : "Hi there,"} we got a request to
				reset the password on your JustUs account. Choose a new one using the
				button below.
			</Text>

			<Section style={buttonSection}>
				<Button href={url} style={buttonStyle}>
					Reset password
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
				This link expires in 1 hour. If you didn't request a reset, you can
				safely ignore this email — your password won't change.
			</Text>
		</EmailShell>
	);
}
