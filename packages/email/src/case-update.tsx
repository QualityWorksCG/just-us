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

export const caseUpdateSubject = "New update on a case you're backing";

type CaseUpdateEmailProps = {
	url: string;
	caseTitle: string;
	actorName: string;
	recipientName?: string;
	snippet?: string;
	/** The update's category label, e.g. "Court date" — shown as a pill. */
	tagLabel?: string;
};

CaseUpdateEmail.PreviewProps = {
	url: "https://example.com/discover/case-id/updates",
	caseTitle: "Seeking justice for workplace retaliation",
	actorName: "Daniel Osei",
	recipientName: "Aisha",
	snippet: "We've secured a court date — next Wednesday.",
	tagLabel: "Court date",
} satisfies CaseUpdateEmailProps;

export default function CaseUpdateEmail({
	url,
	caseTitle,
	actorName,
	recipientName,
	snippet,
	tagLabel,
}: CaseUpdateEmailProps) {
	return (
		<EmailShell preview={`${actorName} posted an update on ${caseTitle}`}>
			<Text style={heading}>New case update</Text>
			<Text style={paragraph}>
				{recipientName ? `Hi ${recipientName.split(" ")[0]}, ` : "Hi, "}
				{actorName} posted an update on “{caseTitle}”.
			</Text>
			{tagLabel ? (
				<Section style={{ textAlign: "center", padding: "0 0 4px" }}>
					<span
						style={{
							display: "inline-block",
							backgroundColor: "#EFE7D6",
							color: "#6B5A36",
							fontSize: "12px",
							fontWeight: 700,
							letterSpacing: "0.04em",
							textTransform: "uppercase",
							padding: "4px 12px",
							borderRadius: "999px",
						}}
					>
						{tagLabel}
					</span>
				</Section>
			) : null}
			{snippet ? (
				<Text
					style={{
						...paragraph,
						fontStyle: "italic",
						color: "#4C453B",
					}}
				>
					“{snippet}”
				</Text>
			) : null}
			<Section style={buttonSection}>
				<Button href={url} style={buttonStyle}>
					Read the update
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
				You're getting this because you're backing or following this case. Turn
				off email notifications in Profile &amp; settings.
			</Text>
		</EmailShell>
	);
}
