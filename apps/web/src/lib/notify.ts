import "server-only";

import {
	sendCaseStatusEmail,
	sendCaseUpdateEmail,
	sendCertificateEmail,
	sendExpressionOfInterestEmail,
	sendModerationNoticeEmail,
} from "@just-us/auth/lib/email";
import { getCaseUpdateForNotify } from "@just-us/db/case-updates";
import {
	type CertificateRow,
	generateCertificatesForCase,
	releaseCertificateEmail,
	reserveCertificateEmail,
} from "@just-us/db/certificates";
import {
	getDonationNotifyInfo,
	listCaseBackerUserIds,
} from "@just-us/db/donations";
import { listCaseFollowerUserIds } from "@just-us/db/follows";
import {
	createNotifications,
	getCaseNotifyContext,
	type NewNotification,
	notificationEmailEnabled,
	releaseNotificationEmail,
	reserveNotificationEmail,
	usersForNotification,
} from "@just-us/db/notifications";
import { getInterestForNotify } from "@just-us/db/representation";
import { env } from "@just-us/env/server";

import { tagConfig } from "@/lib/update-tags";

/**
 * The notification dispatcher (JUS email-notifications). Every notifiable event
 * calls one of these. Each one: records in-app `Notification` rows (idempotent
 * via `dedupeKey`), then sends email off those same rows — gated by the
 * recipient's preference and claimed exactly once via `reserveNotificationEmail`,
 * so a retried action/webhook never double-emails.
 *
 * Failures never propagate: notifying is a side effect of an event that already
 * happened, so a dead email provider must not fail the post/donation itself.
 * Callers `void`-invoke these.
 */

function absoluteUrl(path: string): string {
	return new URL(path, env.BETTER_AUTH_URL).toString();
}

function money(cents: number): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
	}).format(cents / 100);
}

/** Send one notification's email, respecting the recipient's preference and the
 *  once-only reservation. Swallows provider errors (releasing the reservation so
 *  a later trigger can retry). */
async function emailOnce(
	dedupeKey: string,
	recipientId: string,
	send: () => Promise<void>,
) {
	if (!(await notificationEmailEnabled(recipientId))) return;
	if (!(await reserveNotificationEmail(dedupeKey))) return;
	try {
		await send();
	} catch {
		await releaseNotificationEmail(dedupeKey);
	}
}

/** A new case update → every backer/follower (except the author). */
export async function notifyCaseUpdate(updateId: string) {
	const u = await getCaseUpdateForNotify(updateId);
	if (!u) return;

	const [followerIds, backerIds] = await Promise.all([
		listCaseFollowerUserIds(u.caseId),
		listCaseBackerUserIds(u.caseId),
	]);
	const recipientIds = [...new Set([...followerIds, ...backerIds])].filter(
		(id) => id !== u.authorId,
	);
	if (recipientIds.length === 0) return;

	const users = await usersForNotification(recipientIds);
	const href = `/discover/${u.caseId}/updates`;
	const snippet =
		u.body.length > 140 ? `${u.body.slice(0, 140).trimEnd()}…` : u.body;
	// The update's category, e.g. "Court date" — shown as a pill in the email.
	const tagLabel = tagConfig(u.tag)?.label;
	const title = `New update on ${u.caseTitle}`;

	const rows: NewNotification[] = users.map((usr) => ({
		recipientId: usr.id,
		type: "case_update",
		caseId: u.caseId,
		actorName: u.authorName,
		title,
		body: snippet,
		href,
		dedupeKey: `case_update:${updateId}:${usr.id}`,
	}));
	await createNotifications(rows);

	for (const usr of users) {
		await emailOnce(`case_update:${updateId}:${usr.id}`, usr.id, () =>
			sendCaseUpdateEmail({
				to: usr.email,
				url: absoluteUrl(href),
				caseTitle: u.caseTitle,
				actorName: u.authorName,
				recipientName: usr.name,
				snippet,
				tagLabel,
			}),
		);
	}
}

/** An attorney expression of interest → the plaintiff who owns the case. */
export async function notifyExpressionOfInterest(interestId: string) {
	const info = await getInterestForNotify(interestId);
	if (!info) return;

	const href = `/my-cases/${info.caseId}/requests`;
	const dedupeKey = `interest:${interestId}:${info.ownerId}`;
	await createNotifications([
		{
			recipientId: info.ownerId,
			type: "expression_of_interest",
			caseId: info.caseId,
			actorName: info.attorneyName,
			title: "An attorney is interested in your case",
			body: `${info.attorneyName} expressed interest in “${info.caseTitle}”.`,
			href,
			dedupeKey,
		},
	]);

	if (!info.ownerEmail) return;
	await emailOnce(dedupeKey, info.ownerId, () =>
		sendExpressionOfInterestEmail({
			to: info.ownerEmail as string,
			url: absoluteUrl(href),
			caseTitle: info.caseTitle,
			attorneyName: info.attorneyName,
			recipientName: info.ownerName ?? undefined,
		}),
	);
}

const STATUS_COPY: Record<
	string,
	{
		headline: string;
		owner: (t: string) => string;
		audience?: (t: string) => string;
	}
> = {
	seeking: {
		headline: "Your case is out to attorneys",
		owner: (t) =>
			`“${t}” has been published to attorneys who can represent it.`,
	},
	pending_payout: {
		headline: "Your case is ready to go live",
		owner: (t) =>
			`“${t}” has an attorney and an agreed fee — publish it to start raising.`,
	},
	live: {
		headline: "This case is live and raising",
		owner: (t) => `“${t}” is now live and accepting donations.`,
		audience: (t) => `“${t}” is now live and accepting donations.`,
	},
	closed: {
		headline: "This case has closed",
		owner: (t) => `“${t}” has been marked closed.`,
		audience: (t) => `“${t}” has been resolved. Thank you for backing it.`,
	},
};

/**
 * A case status change → the plaintiff always; on `live`/`closed`, also every
 * backer/follower. Copy and destination differ by audience (the owner manages
 * the case; a backer views it).
 */
export async function notifyStatusChange(caseId: string, status: string) {
	const copy = STATUS_COPY[status];
	if (!copy) return;
	const ctx = await getCaseNotifyContext(caseId);
	if (!ctx) return;
	const title = ctx.title || "your case";

	const rows: NewNotification[] = [];
	const emails: {
		dedupeKey: string;
		recipientId: string;
		email: string;
		name: string;
		forOwner: boolean;
	}[] = [];

	// The plaintiff, on every transition.
	const ownerKey = `status:${caseId}:${status}:${ctx.ownerId}`;
	const ownerHref = `/my-cases/${caseId}`;
	rows.push({
		recipientId: ctx.ownerId,
		type: "case_status",
		caseId,
		title: copy.headline,
		body: copy.owner(title),
		href: ownerHref,
		dedupeKey: ownerKey,
	});
	if (ctx.owner?.email) {
		emails.push({
			dedupeKey: ownerKey,
			recipientId: ctx.ownerId,
			email: ctx.owner.email,
			name: ctx.owner.name ?? "",
			forOwner: true,
		});
	}

	// Backers + followers, only on the transitions that matter to them.
	if (copy.audience) {
		const [followerIds, backerIds] = await Promise.all([
			listCaseFollowerUserIds(caseId),
			listCaseBackerUserIds(caseId),
		]);
		const audienceIds = [...new Set([...followerIds, ...backerIds])].filter(
			(id) => id !== ctx.ownerId,
		);
		const users = await usersForNotification(audienceIds);
		const href = `/discover/${caseId}`;
		for (const usr of users) {
			const key = `status:${caseId}:${status}:${usr.id}`;
			rows.push({
				recipientId: usr.id,
				type: "case_status",
				caseId,
				title: copy.headline,
				body: copy.audience(title),
				href,
				dedupeKey: key,
			});
			emails.push({
				dedupeKey: key,
				recipientId: usr.id,
				email: usr.email,
				name: usr.name,
				forOwner: false,
			});
		}
	}

	await createNotifications(rows);

	for (const e of emails) {
		await emailOnce(e.dedupeKey, e.recipientId, () =>
			sendCaseStatusEmail({
				to: e.email,
				url: absoluteUrl(e.forOwner ? ownerHref : `/discover/${caseId}`),
				headline: copy.headline,
				message: e.forOwner
					? copy.owner(title)
					: (copy.audience?.(title) ?? copy.owner(title)),
				ctaLabel: e.forOwner ? "Manage your case" : "View the case",
				recipientName: e.name || undefined,
			}),
		);
	}
}

/**
 * A confirmed donation → an in-app notification for the donor. The email receipt
 * is sent separately (the pre-existing `DonationAcknowledgement` path), so this
 * records the in-app surface only and never emails — no double receipt.
 */
export async function notifyDonation(donationId: string) {
	const d = await getDonationNotifyInfo(donationId);
	if (!d?.donorId) return; // guest donations have no account to notify in-app
	await createNotifications([
		{
			recipientId: d.donorId,
			type: "donation",
			caseId: d.case.id,
			title: "Donation confirmed",
			body: `Your ${money(d.amountCents)} gift to “${d.case.title || "the case"}” is confirmed. Thank you!`,
			href: `/discover/${d.case.id}`,
			dedupeKey: `donation:${donationId}`,
		},
	]);
}

/** Send a certificate's "it's ready" email exactly once, respecting an account
 *  backer's email preference. Guests have no account and no other channel, so
 *  they always get it — it's the only way their certificate reaches them. Uses the
 *  Certificate's own reservation (guests have no Notification row to reserve). */
async function emailCertificateOnce(
	cert: CertificateRow,
	send: () => Promise<void>,
) {
	if (!cert.donorEmail) return;
	if (cert.donorId && !(await notificationEmailEnabled(cert.donorId))) return;
	if (!(await reserveCertificateEmail(cert.id))) return;
	try {
		await send();
	} catch {
		await releaseCertificateEmail(cert.id);
	}
}

/**
 * A case marked Closed. This is the whole close fan-out:
 *
 *   - the plaintiff is told their case closed (in-app + email);
 *   - a certificate of appreciation is generated for every backer (idempotent),
 *     each account backer gets an in-app notification pointing at theirs, and
 *     every backer — account or guest — is emailed a link to it.
 *
 * Closing is not a refund, and the copy says so. Certificate email is claimed
 * once per certificate, so a re-close or a retried action never double-sends.
 * Runs after the status write and, like every notifier, is `.catch`-swallowed by
 * its caller — a mail outage must not undo a close.
 */
export async function notifyCaseClosed(caseId: string) {
	const ctx = await getCaseNotifyContext(caseId);
	if (!ctx) return;
	const title = ctx.title || "your case";

	// The plaintiff: their case has closed. Its own dedupe key, distinct from the
	// per-backer certificate keys below.
	const ownerHref = `/my-cases/${caseId}`;
	const ownerKey = `status:${caseId}:closed:${ctx.ownerId}`;
	await createNotifications([
		{
			recipientId: ctx.ownerId,
			type: "case_status",
			caseId,
			title: "This case has closed",
			body: `“${title}” has been marked closed. Everyone who backed it has been thanked with a certificate of appreciation.`,
			href: ownerHref,
			dedupeKey: ownerKey,
		},
	]);
	if (ctx.owner?.email) {
		await emailOnce(ownerKey, ctx.ownerId, () =>
			sendCaseStatusEmail({
				to: ctx.owner?.email as string,
				url: absoluteUrl(ownerHref),
				headline: "This case has closed",
				message: `“${title}” has been marked closed. Everyone who backed it has been thanked with a certificate of appreciation.`,
				ctaLabel: "Manage your case",
				recipientName: ctx.owner?.name ?? undefined,
			}),
		);
	}

	// Every backer: a certificate. Generation is idempotent and returns the full
	// current set, so this delivers to anyone not yet reached even on a re-close.
	const certs = await generateCertificatesForCase(caseId);

	const inApp: NewNotification[] = [];
	for (const cert of certs) {
		if (!cert.donorId) continue; // guests reach it by emailed link, not the bell
		inApp.push({
			recipientId: cert.donorId,
			type: "certificate",
			caseId,
			title: "Your certificate of appreciation",
			body: `“${cert.caseTitle}” has closed. Thank you for backing it — your certificate is ready.`,
			href: `/certificates/${cert.accessToken}`,
			dedupeKey: `certificate:${cert.id}`,
		});
	}
	await createNotifications(inApp);

	for (const cert of certs) {
		await emailCertificateOnce(cert, () =>
			sendCertificateEmail({
				to: cert.donorEmail as string,
				url: absoluteUrl(`/certificates/${cert.accessToken}`),
				caseTitle: cert.caseTitle,
				recipientName: cert.recipientName,
				serial: cert.serial,
			}),
		);
	}
}

/**
 * A moderator's ruling on a conversation report → the person who filed it. They
 * can log in, so this is in-app + email (email respecting their preference). The
 * copy names the outcome without exposing the other party's private details.
 */
export async function notifyReportResolved(input: {
	reportId: string;
	reporterId: string;
	reporterName: string | null;
	reporterEmail: string;
	otherName: string;
	outcome: "dismissed" | "message_removed" | "user_blocked";
}) {
	const copy = {
		dismissed: {
			title: "Your report was reviewed",
			body: `We reviewed your report about your conversation with ${input.otherName}. We didn't find a policy violation this time, but thank you for helping keep JustUs safe.`,
		},
		message_removed: {
			title: "We acted on your report",
			body: `We reviewed your report about your conversation with ${input.otherName} and removed the message in question. Thank you for flagging it.`,
		},
		user_blocked: {
			title: "We acted on your report",
			body: `We reviewed your report about your conversation with ${input.otherName} and have restricted that account. Thank you for flagging it.`,
		},
	}[input.outcome];

	const href = "/messages";
	const dedupeKey = `report_outcome:${input.reportId}`;
	await createNotifications([
		{
			recipientId: input.reporterId,
			type: "moderation",
			title: copy.title,
			body: copy.body,
			href,
			dedupeKey,
		},
	]);
	await emailOnce(dedupeKey, input.reporterId, () =>
		sendModerationNoticeEmail({
			to: input.reporterEmail,
			headline: copy.title,
			message: copy.body,
			recipientName: input.reporterName ?? undefined,
			url: absoluteUrl(href),
			ctaLabel: "Go to messages",
		}),
	);
}

/**
 * An account restriction → the person restricted. This one always emails,
 * bypassing the preference switch: it is an account-status notice, not marketing,
 * and a blocked user is signed out so email is their only channel. Still claimed
 * exactly once via the notification reservation so a retry can't double-send.
 */
export async function notifyAccountRestricted(input: {
	reportId: string;
	userId: string;
	name: string | null;
	email: string;
	reasonLabel: string;
}) {
	const title = "Your JustUs account has been restricted";
	const body = `Following a report, your JustUs account has been restricted for ${input.reasonLabel}. You've been signed out and can't send messages while the restriction is in place. If you believe this was a mistake, reply to this email to appeal.`;
	const dedupeKey = `account_restricted:${input.reportId}`;

	await createNotifications([
		{
			recipientId: input.userId,
			type: "moderation",
			title,
			body,
			href: "/home",
			dedupeKey,
		},
	]);
	// Always send (no preference gate) — but exactly once.
	if (await reserveNotificationEmail(dedupeKey)) {
		try {
			await sendModerationNoticeEmail({
				to: input.email,
				headline: title,
				message: body,
				recipientName: input.name ?? undefined,
			});
		} catch {
			await releaseNotificationEmail(dedupeKey);
		}
	}
}

/**
 * A moderator's warning to a reported user — softer than a restriction. In-app +
 * email (always sent, once), telling them a report was upheld and continued
 * behaviour may cost them their account.
 */
export async function notifyUserWarned(input: {
	reportId: string;
	userId: string;
	name: string | null;
	email: string;
	reasonLabel: string;
}) {
	const title = "A warning from JustUs moderation";
	const body = `Following a report, our moderation team is warning you about ${input.reasonLabel} in your messages. Please review our community guidelines — continued behaviour may lead to your account being restricted.`;
	const dedupeKey = `warned:${input.reportId}`;

	await createNotifications([
		{
			recipientId: input.userId,
			type: "moderation",
			title,
			body,
			href: "/messages",
			dedupeKey,
		},
	]);
	if (await reserveNotificationEmail(dedupeKey)) {
		try {
			await sendModerationNoticeEmail({
				to: input.email,
				headline: title,
				message: body,
				recipientName: input.name ?? undefined,
			});
		} catch {
			await releaseNotificationEmail(dedupeKey);
		}
	}
}

/**
 * A direct message from an administrator to a case's plaintiff, sent from the
 * campaigns oversight page. In-app + email (once), with a CTA back to the case.
 *
 * Unlike the moderation notices, each message is its own event — an admin may
 * send several — so the caller supplies a unique `dedupeKey` rather than one
 * derived from a single record, and every message is delivered.
 */
export async function notifyPlaintiffFromAdmin(input: {
	dedupeKey: string;
	caseId: string;
	ownerId: string;
	ownerName: string | null;
	ownerEmail: string;
	caseTitle: string;
	message: string;
}) {
	const href = `/my-cases/${input.caseId}`;
	await createNotifications([
		{
			recipientId: input.ownerId,
			type: "moderation",
			caseId: input.caseId,
			title: "A message from JustUs",
			body: input.message,
			href,
			dedupeKey: input.dedupeKey,
		},
	]);
	if (await reserveNotificationEmail(input.dedupeKey)) {
		try {
			await sendModerationNoticeEmail({
				to: input.ownerEmail,
				headline: `A message about “${input.caseTitle || "your case"}”`,
				message: input.message,
				recipientName: input.ownerName ?? undefined,
				url: absoluteUrl(href),
				ctaLabel: "View your case",
			});
		} catch {
			await releaseNotificationEmail(input.dedupeKey);
		}
	}
}
