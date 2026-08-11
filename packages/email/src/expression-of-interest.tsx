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

export const expressionOfInterestSubject =
	"An attorney is interested in your case";

type ExpressionOfInterestEmailProps = {
	url: string;
	caseTitle: string;
	attorneyName?: string;
	recipientName?: string;
};

ExpressionOfInterestEmail.PreviewProps = {
	url: "https://example.com/my-cases/case-id/requests",
	caseTitle: "Seeking justice for workplace retaliation",
	attorneyName: "Daniel Osei",
	recipientName: "Janique",
} satisfies ExpressionOfInterestEmailProps;

export default function ExpressionOfInterestEmail({
	url,
	caseTitle,
	attorneyName,
	recipientName,
}: ExpressionOfInterestEmailProps) {
	const who = attorneyName || "A bar-verified attorney";
	return (
		<EmailShell preview={`${who} is interested in representing your case`}>
			<Text style={heading}>An attorney is interested</Text>
			<Text style={paragraph}>
				{recipientName ? `Hi ${recipientName.split(" ")[0]}, ` : "Hi, "}
				{who} has expressed interest in representing “{caseTitle}”. Review them
				and decide whether to take it forward — nothing is shared until you
				reach out.
			</Text>
			<Section style={buttonSection}>
				<Button href={url} style={buttonStyle}>
					Review interest
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
				You're getting this because it's your case on JustUs. Turn off email
				notifications in Profile &amp; settings.
			</Text>
		</EmailShell>
	);
}
