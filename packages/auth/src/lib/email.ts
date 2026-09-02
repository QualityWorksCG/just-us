import AdminInviteEmail, {
	adminInviteSubject,
} from "@just-us/email/admin-invite";
import CaseInviteEmail, {
	type CaseInviteOrigin,
	caseInviteSubject,
} from "@just-us/email/case-invite";
import CaseStatusEmail, { caseStatusSubject } from "@just-us/email/case-status";
import CaseUpdateEmail, { caseUpdateSubject } from "@just-us/email/case-update";
import CertificateEmail, {
	certificateSubject,
} from "@just-us/email/certificate";
import DonationThankYouEmail, {
	donationThankYouSubject,
} from "@just-us/email/donation-thank-you";
import ExpressionOfInterestEmail, {
	expressionOfInterestSubject,
} from "@just-us/email/expression-of-interest";
import MagicLinkEmail, { magicLinkSubject } from "@just-us/email/magic-link";
import ModerationNoticeEmail, {
	moderationNoticeSubject,
} from "@just-us/email/moderation-notice";
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
		// Skipping the send is a local-development convenience, and only that. A
		// deployed build with no key would report every invitation, verification and
		// reset as sent while nothing left the building — and callers that create a
		// record on the strength of a successful send (a case invitation holds its
		// case out of the attorney queue for a week) would act on a lie. Fail where
		// it can be seen instead.
		if (env.NODE_ENV === "production") {
			throw new Error("Failed to send email: RESEND_API_KEY is not configured");
		}
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

/** Invitation to the attorney a plaintiff named on their own case. `hasAccount`
 * picks the copy: sign in and confirm, or create an attorney account first.
 * Both variants land on the same tokenised invite URL. */
export function sendCaseInviteEmail(params: {
	to: string;
	inviteUrl: string;
	caseTitle: string;
	plaintiffName: string;
	attorneyName: string;
	hasAccount: boolean;
	expiresInDays: number;
	/** How the invitation came about — a directory "request" or the wizard's
	 *  "bring_your_own". Defaults to bring-your-own. Changes the email's framing. */
	origin?: CaseInviteOrigin;
}) {
	return send({
		to: params.to,
		subject: caseInviteSubject({
			hasAccount: params.hasAccount,
			caseTitle: params.caseTitle,
			origin: params.origin,
		}),
		react: CaseInviteEmail({
			inviteUrl: params.inviteUrl,
			caseTitle: params.caseTitle,
			plaintiffName: params.plaintiffName,
			attorneyName: params.attorneyName,
			hasAccount: params.hasAccount,
			expiresInDays: params.expiresInDays,
			origin: params.origin,
		}),
	});
}

/**
 * The donor acknowledgement for one successful donation — confirmation of the
 * gift plus the plaintiff's own thank-you note.
 *
 * Sending is guarded upstream, not here: the caller must already hold the
 * donation's `DonationAcknowledgement` reservation, which is what makes this
 * exactly one email per donation across webhook redeliveries and read-time
 * reconciliation alike. Calling it without that reservation will send a duplicate.
 */
export function sendDonationThankYouEmail(params: {
	to: string;
	url: string;
	caseTitle: string;
	amountLabel: string;
	donorName?: string | null;
	thankYouNote?: string | null;
	plaintiffName?: string | null;
}) {
	return send({
		to: params.to,
		subject: donationThankYouSubject,
		react: DonationThankYouEmail({
			url: params.url,
			caseTitle: params.caseTitle,
			amountLabel: params.amountLabel,
			donorName: params.donorName,
			thankYouNote: params.thankYouNote,
			plaintiffName: params.plaintiffName,
		}),
	});
}

/**
 * A moderation-team notice — a report outcome to a reporter, or an account
 * restriction to the person acted on. Copy is passed in so one template serves
 * both; the CTA is optional (an account-restriction notice has nothing to act on).
 */
export function sendModerationNoticeEmail(params: {
	to: string;
	headline: string;
	message: string;
	recipientName?: string;
	url?: string;
	ctaLabel?: string;
}) {
	return send({
		to: params.to,
		subject: moderationNoticeSubject,
		react: ModerationNoticeEmail({
			headline: params.headline,
			message: params.message,
			recipientName: params.recipientName,
			url: params.url,
			ctaLabel: params.ctaLabel,
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

/** A new case update, to backers/followers. Deduped by the caller's Notification
 *  reservation (see notifications.ts). */
export function sendCaseUpdateEmail(params: {
	to: string;
	url: string;
	caseTitle: string;
	actorName: string;
	recipientName?: string;
	snippet?: string;
	tagLabel?: string;
}) {
	return send({
		to: params.to,
		subject: caseUpdateSubject,
		react: CaseUpdateEmail({
			url: params.url,
			caseTitle: params.caseTitle,
			actorName: params.actorName,
			recipientName: params.recipientName,
			snippet: params.snippet,
			tagLabel: params.tagLabel,
		}),
	});
}

/** An attorney expression of interest, to the plaintiff who owns the case. */
export function sendExpressionOfInterestEmail(params: {
	to: string;
	url: string;
	caseTitle: string;
	attorneyName?: string;
	recipientName?: string;
}) {
	return send({
		to: params.to,
		subject: expressionOfInterestSubject,
		react: ExpressionOfInterestEmail({
			url: params.url,
			caseTitle: params.caseTitle,
			attorneyName: params.attorneyName,
			recipientName: params.recipientName,
		}),
	});
}

/**
 * The certificate of appreciation for a backer of a closed case. Deduped by the
 * caller's `Certificate.emailedAt` reservation — this sends whatever it's given,
 * so calling it without that reservation held will send a duplicate.
 */
export function sendCertificateEmail(params: {
	to: string;
	url: string;
	caseTitle: string;
	recipientName?: string;
	serial?: string;
}) {
	return send({
		to: params.to,
		subject: certificateSubject,
		react: CertificateEmail({
			url: params.url,
			caseTitle: params.caseTitle,
			recipientName: params.recipientName,
			serial: params.serial,
		}),
	});
}

/** A case status change, to the plaintiff and (on live/closed) backers/followers.
 *  Copy is passed in so one template serves every transition and audience. */
export function sendCaseStatusEmail(params: {
	to: string;
	url: string;
	headline: string;
	message: string;
	ctaLabel: string;
	recipientName?: string;
}) {
	return send({
		to: params.to,
		subject: caseStatusSubject,
		react: CaseStatusEmail({
			url: params.url,
			headline: params.headline,
			message: params.message,
			ctaLabel: params.ctaLabel,
			recipientName: params.recipientName,
		}),
	});
}
