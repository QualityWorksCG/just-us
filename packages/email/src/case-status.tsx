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

export const caseStatusSubject = "A case status update from JustUs";

type CaseStatusEmailProps = {
	url: string;
	headline: string;
	message: string;
	ctaLabel: string;
	recipientName?: string;
};

CaseStatusEmail.PreviewProps = {
	url: "https://example.com/discover/case-id",
	headline: "This case is now live and raising",
	message:
		"“Seeking justice for workplace retaliation” has gone live and is now accepting donations.",
	ctaLabel: "View the case",
	recipientName: "Aisha",
} satisfies CaseStatusEmailProps;

export default function CaseStatusEmail({
	url,
	headline,
	message,
	ctaLabel,
	recipientName,
}: CaseStatusEmailProps) {
	return (
		<EmailShell preview={headline}>
			<Text style={heading}>{headline}</Text>
			<Text style={paragraph}>
				{recipientName ? `Hi ${recipientName.split(" ")[0]}, ` : "Hi, "}
				{message}
			</Text>
			<Section style={buttonSection}>
				<Button href={url} style={buttonStyle}>
					{ctaLabel}
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
				Turn off email notifications any time in Profile &amp; settings.
			</Text>
		</EmailShell>
	);
}
