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

type CaseInviteEmailProps = {
	inviteUrl: string;
	caseTitle: string;
	plaintiffName: string;
	attorneyName: string;
	hasAccount: boolean;
	expiresInDays: number;
};

/* The subject lives here so the sender and the template can never drift apart.
 * It deliberately takes only the two fields that change the framing: an
 * attorney who already has an account is asked to confirm, a stranger is asked
 * to join. The plaintiff's name is body copy, not subject line — the subject
 * has to make sense in a crowded inbox where the case is the recognisable part. */
export function caseInviteSubject({
	hasAccount,
	caseTitle,
}: {
	hasAccount: boolean;
	caseTitle: string;
}) {
	return hasAccount
		? `Confirm you represent "${caseTitle}" on JustUs`
		: `You were named as the attorney on "${caseTitle}"`;
}

const caseCardTitle: React.CSSProperties = {
	color: "#2A251F",
	fontSize: 16,
	fontWeight: 700,
	lineHeight: "22px",
	margin: "0 0 4px",
	padding: "0 20px",
};

const caseCardMeta: React.CSSProperties = {
	color: "#6E5423",
	fontSize: 12,
	fontWeight: 600,
	letterSpacing: 0.4,
	margin: 0,
	padding: "0 20px",
	textTransform: "uppercase",
};

CaseInviteEmail.PreviewProps = {
	inviteUrl: "https://example.com/case-invite?token=abc123",
	caseTitle: "Wrongful termination — Hale v. Brightline Logistics",
	plaintiffName: "Maya Roberts",
	attorneyName: "Jane Rivera",
	hasAccount: false,
	expiresInDays: 14,
} satisfies CaseInviteEmailProps;

export default function CaseInviteEmail({
	inviteUrl,
	caseTitle,
	plaintiffName,
	attorneyName,
	hasAccount,
	expiresInDays,
}: CaseInviteEmailProps) {
	const firstName = attorneyName.trim().split(" ")[0];
	const days = `${expiresInDays} ${expiresInDays === 1 ? "day" : "days"}`;

	return (
		<EmailShell
			preview={
				hasAccount
					? `${plaintiffName} named you as their attorney. Confirm to continue`
					: `${plaintiffName} named you as their attorney on JustUs`
			}
		>
			<Text style={heading}>
				{hasAccount
					? "Confirm you represent this case"
					: `${plaintiffName} named you as their attorney`}
			</Text>

			<Section style={codeSection}>
				<Text style={caseCardMeta}>Case</Text>
				<Text style={caseCardTitle}>{caseTitle}</Text>
				<Text style={caseCardMeta}>Filed by {plaintiffName}</Text>
			</Section>

			<Text style={paragraph}>
				{firstName ? `Hi ${firstName}, ` : "Hi, "}
				{hasAccount
					? `${plaintiffName} named you as their attorney on JustUs. Sign in with this email address to confirm you represent this case, or decline if you don't.`
					: `${plaintiffName} named you as their attorney on JustUs, where supporters fund the legal costs of cases like theirs. Create your attorney account to review the case and confirm you represent it.`}
			</Text>

			<Section style={buttonSection}>
				<Button href={inviteUrl} style={buttonStyle}>
					{hasAccount ? "Review and confirm" : "Create your attorney account"}
				</Button>
			</Section>

			<Text style={paragraph}>
				Or paste this link into your browser:
				<br />
				<a href={inviteUrl} style={link}>
					{inviteUrl}
				</a>
			</Text>

			<Hr style={divider} />

			{/* Not "safely ignore". While this invitation is unanswered the case is
			    held back from every other attorney, so ignoring it is the one reply
			    that costs the plaintiff a week. Say what actually helps them. */}
			<Text style={footer}>
				This link expires in {days}, and {plaintiffName}'s case waits for your
				answer until then. It isn't shown to other attorneys while this
				invitation is open. If you weren't expecting this, or you don't act for{" "}
				{plaintiffName}, open the link and decline: their case goes in front of
				other attorneys straight away.
			</Text>
		</EmailShell>
	);
}
