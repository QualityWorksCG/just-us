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

interface MagicLinkEmailProps {
	url: string;
	name?: string;
}

export const magicLinkSubject = "Your JustUs sign-in link";

MagicLinkEmail.PreviewProps = {
	url: "https://example.com/magic?token=abc123",
	name: "Jane Rivera",
} as MagicLinkEmailProps;

export default function MagicLinkEmail({ url, name }: MagicLinkEmailProps) {
	return (
		<EmailShell preview="Your one-time sign-in link for JustUs">
			<Text style={heading}>Sign in to JustUs</Text>
			<Text style={paragraph}>
				{name ? `Hi ${name.split(" ")[0]},` : "Hi there,"} click the button
				below to sign in. This link works once and expires shortly.
			</Text>

			<Section style={buttonSection}>
				<Button href={url} style={buttonStyle}>
					Sign in
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
				If you didn't request this link, you can safely ignore this email — your
				account stays secure.
			</Text>
		</EmailShell>
	);
}
