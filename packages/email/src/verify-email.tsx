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

interface VerifyEmailProps {
	url: string;
	name?: string;
}

export const verifyEmailSubject = "Verify your email for just-us";

VerifyEmail.PreviewProps = {
	url: "https://example.com/verify?token=abc123",
	name: "Jane Rivera",
} as VerifyEmailProps;

export default function VerifyEmail({ url, name }: VerifyEmailProps) {
	return (
		<EmailShell preview="Verify your email to activate your just-us account">
			<Text style={heading}>Verify your email</Text>
			<Text style={paragraph}>
				{name ? `Hi ${name.split(" ")[0]},` : "Hi there,"} confirm this is your
				email to activate your just-us account.
			</Text>

			<Section style={buttonSection}>
				<Button href={url} style={buttonStyle}>
					Verify email
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
				If you didn't create an account, you can safely ignore this email.
			</Text>
		</EmailShell>
	);
}
