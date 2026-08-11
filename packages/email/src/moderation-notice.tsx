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

export const moderationNoticeSubject = "An update from JustUs moderation";

type ModerationNoticeEmailProps = {
	headline: string;
	message: string;
	recipientName?: string;
	/** Optional CTA — omitted for notices there's nothing to act on. */
	url?: string;
	ctaLabel?: string;
};

ModerationNoticeEmail.PreviewProps = {
	headline: "We've reviewed your report",
	message:
		"Thanks for flagging this conversation. Our moderation team reviewed it and has taken appropriate action.",
	recipientName: "Aisha",
	url: "https://example.com/messages",
	ctaLabel: "Go to messages",
} satisfies ModerationNoticeEmailProps;

export default function ModerationNoticeEmail({
	headline,
	message,
	recipientName,
	url,
	ctaLabel,
}: ModerationNoticeEmailProps) {
	return (
		<EmailShell preview={headline}>
			<Text style={heading}>{headline}</Text>
			<Text style={paragraph}>
				{recipientName ? `Hi ${recipientName.split(" ")[0]}, ` : "Hi, "}
				{message}
			</Text>
			{url && ctaLabel ? (
				<>
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
				</>
			) : null}
			<Hr style={divider} />
			<Text style={footer}>
				This message was sent by the JustUs moderation team.
			</Text>
		</EmailShell>
	);
}
