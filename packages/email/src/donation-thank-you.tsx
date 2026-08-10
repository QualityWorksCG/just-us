import {
	Button,
	buttonSection,
	buttonStyle,
	codeSection,
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

export const donationThankYouSubject = "Thank you for backing this case";

type DonationThankYouEmailProps = {
	url: string;
	caseTitle: string;
	/** Already formatted for display — the sender owns the currency rules. */
	amountLabel: string;
	donorName?: string | null;
	/** The plaintiff's own words. Omitted when they haven't written any. */
	thankYouNote?: string | null;
	/** Who the note is from. Falls back to "the plaintiff" when unknown. */
	plaintiffName?: string | null;
};

DonationThankYouEmail.PreviewProps = {
	url: "https://example.com/cases/case-id",
	caseTitle: "Wrongful eviction after 11 years in the same home",
	amountLabel: "$50.00",
	donorName: "Jordan Ellis",
	thankYouNote:
		"I didn't think anyone outside my family would care about this. Knowing strangers are standing behind me makes the next hearing a lot less frightening. Thank you.",
	plaintiffName: "Maya Roberts",
} satisfies DonationThankYouEmailProps;

/*
 * The note is rendered as a quoted block rather than as body copy on purpose: it
 * is the only part of this email written by a person, and it should be legible as
 * theirs rather than as ours. Whitespace is preserved so the plaintiff's own line
 * breaks survive the trip.
 */
const noteSection: React.CSSProperties = {
	...codeSection,
	padding: "20px 22px",
	textAlign: "left",
};

const noteText: React.CSSProperties = {
	color: "#2A251F",
	fontSize: 15,
	lineHeight: "24px",
	fontStyle: "italic",
	margin: 0,
	whiteSpace: "pre-wrap",
};

const noteAttribution: React.CSSProperties = {
	color: "#6E5423",
	fontSize: 13,
	fontWeight: 700,
	margin: "14px 0 0",
};

const receiptLine: React.CSSProperties = {
	color: "#4C453B",
	fontSize: 14,
	lineHeight: "22px",
	textAlign: "center",
	margin: "0 0 6px",
};

export default function DonationThankYouEmail({
	url,
	caseTitle,
	amountLabel,
	donorName,
	thankYouNote,
	plaintiffName,
}: DonationThankYouEmailProps) {
	const firstName = donorName?.trim().split(/\s+/)[0];
	const note = thankYouNote?.trim();

	return (
		<EmailShell preview={`Your ${amountLabel} gift to ${caseTitle} is in`}>
			<Text style={heading}>Your donation is in</Text>
			<Text style={paragraph}>
				{firstName ? `Thank you, ${firstName}. ` : "Thank you. "}
				Your gift has been received and is already counted toward this case's
				goal.
			</Text>

			<Section style={codeSection}>
				<Text style={{ ...receiptLine, fontSize: 24, fontWeight: 800 }}>
					{amountLabel}
				</Text>
				<Text style={{ ...receiptLine, margin: 0 }}>{caseTitle}</Text>
			</Section>

			{note ? (
				<Section style={noteSection}>
					<Text style={noteText}>{note}</Text>
					<Text style={noteAttribution}>
						— {plaintiffName?.trim() || "The plaintiff"}
					</Text>
				</Section>
			) : null}

			<Section style={buttonSection}>
				<Button href={url} style={buttonStyle}>
					See the case
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
				Donations on JustUs go to the law firm representing this case, not to
				JustUs. This is a confirmation of your gift, not a tax receipt.
			</Text>
		</EmailShell>
	);
}
