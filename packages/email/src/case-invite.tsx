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

/**
 * How the invitation came about, which changes the framing an attorney reads:
 *   - "request"        — the plaintiff found this attorney in the JustUs
 *                        directory and asked them specifically.
 *   - "bring_your_own" — the plaintiff typed an attorney's email into the case
 *                        wizard; the attorney may not have an account yet.
 */
export type CaseInviteOrigin = "request" | "bring_your_own";

type CaseInviteEmailProps = {
	inviteUrl: string;
	caseTitle: string;
	plaintiffName: string;
	attorneyName: string;
	hasAccount: boolean;
	expiresInDays: number;
	origin?: CaseInviteOrigin;
};

/* The subject lives here so the sender and the template can never drift apart.
 * The framing turns on how the invitation came about (a directory request reads
 * differently from a typed-in name) and, for the bring-your-own path, whether
 * the attorney already has an account. The plaintiff's name is body copy, not
 * subject line — the subject has to make sense in a crowded inbox where the case
 * is the recognisable part. */
export function caseInviteSubject({
	hasAccount,
	caseTitle,
	origin = "bring_your_own",
}: {
	hasAccount: boolean;
	caseTitle: string;
	origin?: CaseInviteOrigin;
}) {
	if (origin === "request") {
		return `You've been requested to represent "${caseTitle}" on JustUs`;
	}
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
	origin = "bring_your_own",
}: CaseInviteEmailProps) {
	const firstName = attorneyName.trim().split(" ")[0];
	const days = `${expiresInDays} ${expiresInDays === 1 ? "day" : "days"}`;
	// A directory request is the plaintiff choosing this attorney by name; the
	// bring-your-own path is the plaintiff typing an address that may not have an
	// account yet. The two read differently from the first line.
	const isRequest = origin === "request";

	return (
		<EmailShell
			preview={
				isRequest
					? `${plaintiffName} requested you to represent their case on JustUs`
					: hasAccount
						? `${plaintiffName} named you as their attorney. Confirm to continue`
						: `${plaintiffName} named you as their attorney on JustUs`
			}
		>
			<Text style={heading}>
				{isRequest
					? `${plaintiffName} requested you to represent their case`
					: hasAccount
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
				{isRequest
					? `${plaintiffName} found you in the JustUs attorney directory and requested you to represent this case. Sign in with this email address to confirm you'll take it on, or decline if you can't.`
					: hasAccount
						? `${plaintiffName} named you as their attorney on JustUs. Sign in with this email address to confirm you represent this case, or decline if you don't.`
						: `${plaintiffName} named you as their attorney on JustUs, where supporters fund the legal costs of cases like theirs. Create your attorney account to review the case and confirm you represent it.`}
			</Text>

			<Section style={buttonSection}>
				<Button href={inviteUrl} style={buttonStyle}>
					{isRequest || hasAccount
						? "Review and confirm"
						: "Create your attorney account"}
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
