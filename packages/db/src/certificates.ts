import { randomBytes } from "node:crypto";

import prisma from "./index";

/**
 * Certificates of appreciation for a closed case's backers (JUS: case-closing
 * workflow). One certificate per backer — the person, not the gift — so a donor
 * who gave three times is thanked once, for their total. Generation is idempotent
 * (`dedupeKey`), and every access path is keyed by the unguessable `accessToken`
 * so a guest with no account still reaches theirs. See `certificate.prisma`.
 */

/** A distinct backer of a case, with their total succeeded contribution. */
export type CaseBacker = {
	/** The account, when the backer had one; null for a guest. */
	donorId: string | null;
	/** Where they can be reached — always present for a succeeded gift. */
	donorEmail: string | null;
	recipientName: string;
	amountCents: number;
};

export type CertificateRow = {
	id: string;
	caseId: string;
	donorId: string | null;
	donorEmail: string | null;
	recipientName: string;
	caseTitle: string;
	amountCents: number;
	serial: string;
	accessToken: string;
	issuedAt: Date;
	emailedAt: Date | null;
};

/** Stable identity for one backer of one case — an account id when present, else
 *  the (lowercased) guest email. Drives both aggregation and the dedupe key. */
function backerKey(
	donorId: string | null,
	email: string | null,
): string | null {
	if (donorId) return donorId;
	if (email) return `email:${email.trim().toLowerCase()}`;
	return null;
}

/** A human-facing certificate number, e.g. `JU-3F9A2C71`. */
function mintSerial(): string {
	return `JU-${randomBytes(4).toString("hex").toUpperCase()}`;
}

/** An unguessable capability token for the public certificate page. */
function mintToken(): string {
	return randomBytes(32).toString("base64url");
}

/**
 * Every distinct backer of a case, with their total succeeded contribution.
 * Aggregated in application code rather than a `groupBy` because a backer is
 * identified by account *or* email, and their display name comes from the account
 * (authoritative) when they have one and the checkout name otherwise.
 */
export async function listCaseBackersForCertificate(
	caseId: string,
): Promise<CaseBacker[]> {
	const donations = await prisma.donation.findMany({
		where: { caseId, status: "succeeded" },
		select: {
			donorId: true,
			donorEmail: true,
			donorName: true,
			amountCents: true,
		},
	});

	// Fold every gift into its backer. Guests keep their checkout name; account
	// holders get their real name resolved below, overriding whatever they typed.
	const byKey = new Map<string, CaseBacker>();
	for (const d of donations) {
		const key = backerKey(d.donorId, d.donorEmail);
		if (!key) continue; // no account and no email — unreachable, so uncertifiable
		const existing = byKey.get(key);
		if (existing) {
			existing.amountCents += d.amountCents;
			// Prefer any non-empty name we see.
			if (!existing.recipientName && d.donorName) {
				existing.recipientName = d.donorName;
			}
		} else {
			byKey.set(key, {
				donorId: d.donorId,
				donorEmail: d.donorEmail,
				recipientName: d.donorName?.trim() || "",
				amountCents: d.amountCents,
			});
		}
	}

	// Resolve account holders' authoritative names + a reliable email.
	const accountIds = [...byKey.values()]
		.map((b) => b.donorId)
		.filter((id): id is string => Boolean(id));
	if (accountIds.length > 0) {
		const users = await prisma.user.findMany({
			where: { id: { in: accountIds } },
			select: { id: true, name: true, email: true },
		});
		const usersById = new Map(users.map((u) => [u.id, u]));
		for (const b of byKey.values()) {
			if (!b.donorId) continue;
			const u = usersById.get(b.donorId);
			if (u) {
				if (u.name?.trim()) b.recipientName = u.name.trim();
				if (!b.donorEmail && u.email) b.donorEmail = u.email;
			}
		}
	}

	for (const b of byKey.values()) {
		if (!b.recipientName) b.recipientName = "A generous backer";
	}

	return [...byKey.values()];
}

/**
 * Issue a certificate to every backer of a case, and return the full set for the
 * case (so the caller can notify/email off it). Safe to call more than once: the
 * unique `dedupeKey` means a re-close adds only backers who arrived since, and the
 * returned set always reflects everyone currently entitled.
 */
export async function generateCertificatesForCase(
	caseId: string,
): Promise<CertificateRow[]> {
	const c = await prisma.case.findUnique({
		where: { id: caseId },
		select: { id: true, title: true },
	});
	if (!c) return [];

	const backers = await listCaseBackersForCertificate(caseId);
	if (backers.length > 0) {
		await prisma.certificate.createMany({
			data: backers.map((b) => {
				const key = backerKey(b.donorId, b.donorEmail);
				return {
					caseId,
					donorId: b.donorId,
					donorEmail: b.donorEmail,
					recipientName: b.recipientName,
					caseTitle: c.title || "your case",
					amountCents: b.amountCents,
					serial: mintSerial(),
					accessToken: mintToken(),
					dedupeKey: `cert:${caseId}:${key}`,
				};
			}),
			skipDuplicates: true,
		});
	}

	return prisma.certificate.findMany({
		where: { caseId },
		orderBy: { issuedAt: "asc" },
		select: CERT_SELECT,
	});
}

const CERT_SELECT = {
	id: true,
	caseId: true,
	donorId: true,
	donorEmail: true,
	recipientName: true,
	caseTitle: true,
	amountCents: true,
	serial: true,
	accessToken: true,
	issuedAt: true,
	emailedAt: true,
} as const;

/** A single certificate by its capability token — the public page's only key. */
export async function getCertificateByToken(
	token: string,
): Promise<(CertificateRow & { caseStatus: string }) | null> {
	const cert = await prisma.certificate.findUnique({
		where: { accessToken: token },
		select: { ...CERT_SELECT, case: { select: { status: true } } },
	});
	if (!cert) return null;
	const { case: c, ...rest } = cert;
	return { ...rest, caseStatus: c.status };
}

/** An account holder's own certificates, newest first — for their donations page. */
export async function listCertificatesForUser(
	userId: string,
): Promise<CertificateRow[]> {
	return prisma.certificate.findMany({
		where: { donorId: userId },
		orderBy: { issuedAt: "desc" },
		select: CERT_SELECT,
	});
}

/**
 * Claim the single "your certificate is ready" email for a certificate. Stamps
 * `emailedAt` only if it was null, so exactly one caller wins under a race or a
 * re-close. Returns true if this caller may send.
 */
export async function reserveCertificateEmail(
	certificateId: string,
): Promise<boolean> {
	const res = await prisma.certificate.updateMany({
		where: { id: certificateId, emailedAt: null },
		data: { emailedAt: new Date() },
	});
	return res.count > 0;
}

/** Release a reservation after a failed send, so a later trigger can retry. */
export async function releaseCertificateEmail(certificateId: string) {
	return prisma.certificate.updateMany({
		where: { id: certificateId },
		data: { emailedAt: null },
	});
}
