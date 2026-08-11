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

export const certificateSubject =
	"Your certificate of appreciation from JustUs";

type CertificateEmailProps = {
	url: string;
	caseTitle: string;
	recipientName?: string;
	serial?: string;
};

CertificateEmail.PreviewProps = {
	url: "https://example.com/certificates/token",
	caseTitle: "Seeking justice for workplace retaliation",
	recipientName: "Jane",
	serial: "JU-3F9A2C71",
} satisfies CertificateEmailProps;

export default function CertificateEmail({
	url,
	caseTitle,
	recipientName,
	serial,
}: CertificateEmailProps) {
	return (
		<EmailShell preview={`Your certificate of appreciation for ${caseTitle}`}>
			<Text style={heading}>Thank you for backing this case</Text>
			<Text style={paragraph}>
				{recipientName ? `Hi ${recipientName.split(" ")[0]}, ` : "Hi, "}“
				{caseTitle}” has now closed. Backing a case on JustUs is a gift, not an
				investment — there's no financial return, and none is owed. What your
				support made possible is the case itself, and we've prepared a
				certificate of appreciation to recognize it.
			</Text>
			<Section style={buttonSection}>
				<Button href={url} style={buttonStyle}>
					View your certificate
				</Button>
			</Section>
			<Text style={paragraph}>
				Or paste this link into your browser:
				<br />
				<a href={url} style={link}>
					{url}
				</a>
			</Text>
			{serial ? <Text style={paragraph}>Certificate no. {serial}</Text> : null}
			<Hr style={divider} />
			<Text style={footer}>
				You're receiving this because you backed a case that has now closed.
			</Text>
		</EmailShell>
	);
}
