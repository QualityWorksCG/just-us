import AdminInviteEmail, {
	adminInviteSubject,
} from "@just-us/email/admin-invite";
import MagicLinkEmail, { magicLinkSubject } from "@just-us/email/magic-link";
import NewMessageEmail, { newMessageSubject } from "@just-us/email/new-message";
import ResetPasswordEmail, {
	resetPasswordSubject,
} from "@just-us/email/reset-password";
import VerifyEmail, { verifyEmailSubject } from "@just-us/email/verify-email";
import { env } from "@just-us/env/server";
import { Resend } from "resend";

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

console.log(
	`[email:boot] resend=${resend ? "configured" : "DISABLED (no RESEND_API_KEY)"} from="${env.EMAIL_SOURCE}"`,
);

type SendArgs = {
	to: string;
	subject: string;
	react: React.ReactElement;
};

async function send({ to, subject, react }: SendArgs) {
	console.log(`[email] send → to=${to} subject="${subject}"`);
	if (!resend) {
		console.log(
			"[email:dev] RESEND_API_KEY not set — email skipped. Set it to send real mail.",
		);
		return;
	}
	const { data, error } = await resend.emails.send({
		from: env.EMAIL_SOURCE,
		to,
		subject,
		react,
	});
	if (error) {
		console.error(`[email] failed to send "${subject}" to ${to}:`, error);
		throw new Error(
			`Failed to send email: ${error.message ?? JSON.stringify(error)}`,
		);
	}
	console.log(`[email] sent id=${data?.id} to=${to}`);
}

export function sendVerificationEmail(params: {
	to: string;
	url: string;
	name?: string;
}) {
	return send({
		to: params.to,
		subject: verifyEmailSubject,
		react: VerifyEmail({ url: params.url, name: params.name }),
	});
}

export function sendResetPasswordEmail(params: {
	to: string;
	url: string;
	name?: string;
}) {
	return send({
		to: params.to,
		subject: resetPasswordSubject,
		react: ResetPasswordEmail({ url: params.url, name: params.name }),
	});
}

export function sendMagicLinkEmail(params: {
	to: string;
	url: string;
	name?: string;
}) {
	return send({
		to: params.to,
		subject: magicLinkSubject,
		react: MagicLinkEmail({ url: params.url, name: params.name }),
	});
}

export function sendAdminInviteEmail(params: {
	to: string;
	url: string;
	inviterName?: string;
}) {
	return send({
		to: params.to,
		subject: adminInviteSubject,
		react: AdminInviteEmail({
			url: params.url,
			inviterName: params.inviterName,
		}),
	});
}

/** Transactional JUS-66 message notification. The message body is intentionally
 * omitted so email previews do not expose private conversation content. */
export function sendNewMessageEmail(params: {
	to: string;
	url: string;
	recipientName?: string;
	senderName: string;
}) {
	return send({
		to: params.to,
		subject: newMessageSubject,
		react: NewMessageEmail({
			url: params.url,
			recipientName: params.recipientName,
			senderName: params.senderName,
		}),
	});
}
