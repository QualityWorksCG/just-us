import { getCertificateByToken } from "@just-us/db/certificates";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CertificateView } from "@/components/certificate/certificate-view";

export const metadata: Metadata = {
	title: "Certificate of appreciation",
	// A capability link is not meant to be indexed or advertised.
	robots: { index: false, follow: false },
};

function money(cents: number): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
	}).format(cents / 100);
}

function issued(date: Date): string {
	return date.toLocaleDateString("en-US", {
		month: "long",
		day: "numeric",
		year: "numeric",
	});
}

/**
 * A backer's certificate of appreciation, reached by its unguessable token.
 *
 * Public by design — the token is the credential — so a guest who backed a case
 * with no account still opens theirs straight from the emailed link. There is
 * nothing account-specific to gate: the certificate is the same page whoever
 * holds the link.
 */
export default async function CertificatePage({
	params,
}: {
	params: Promise<{ token: string }>;
}) {
	const { token } = await params;
	const cert = await getCertificateByToken(token);
	if (!cert) notFound();

	return (
		<CertificateView
			recipientName={cert.recipientName}
			caseTitle={cert.caseTitle}
			amountLabel={money(cert.amountCents)}
			serial={cert.serial}
			issuedLabel={issued(cert.issuedAt)}
		/>
	);
}
