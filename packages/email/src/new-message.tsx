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

export const newMessageSubject = "You have a new JustUs message";

type NewMessageEmailProps = {
	url: string;
	recipientName?: string;
	senderName: string;
};

NewMessageEmail.PreviewProps = {
	url: "https://example.com/messages/conversation-id",
	recipientName: "Jordan",
	senderName: "Maya Roberts",
} satisfies NewMessageEmailProps;

export default function NewMessageEmail({
	url,
	recipientName,
	senderName,
}: NewMessageEmailProps) {
	return (
		<EmailShell preview={`New message from ${senderName} on JustUs`}>
			<Text style={heading}>You have a new message</Text>
			<Text style={paragraph}>
				{recipientName ? `Hi ${recipientName.split(" ")[0]}, ` : "Hi, "}
				{senderName} sent you a message on JustUs. Open the conversation to read
				and reply.
			</Text>
			<Section style={buttonSection}>
				<Button href={url} style={buttonStyle}>
					Open messages
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
				You can turn off message email in Profile & settings, or mute this
				conversation from Messages.
			</Text>
		</EmailShell>
	);
}
