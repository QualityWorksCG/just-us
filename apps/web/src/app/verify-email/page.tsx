import type { Route } from "next";
import { redirect } from "next/navigation";

import { VerifyEmailPrompt } from "@/components/auth/verify-email-prompt";
import { getSession } from "@/lib/auth-server";
import { safeNextPath } from "@/lib/next-path";

export const metadata = { title: "Verify your email" };

export default async function VerifyEmailPage({
	searchParams,
}: {
	searchParams: Promise<{ email?: string; next?: string }>;
}) {
	const session = await getSession();
	// Where they were headed before verification interrupted them — carried into
	// the verification link itself, so clicking it in the inbox ends on the thing
	// they were doing rather than on a dashboard. Same-site paths only; see
	// `safeNextPath`.
	const { email, next } = await searchParams;
	const destination = safeNextPath(next);

	// Already verified — nothing to do here.
	if (session?.user?.emailVerified) {
		redirect((destination ?? "/home") as Route);
	}

	// A sign-in blocked on verification lands here signed out, so the address
	// comes over on the URL. Only used when there is no session to read it from;
	// a signed-in user's own email always wins (the resend endpoint rejects a
	// mismatch anyway).
	return (
		<VerifyEmailPrompt
			email={session?.user?.email ?? email}
			signedIn={Boolean(session?.user)}
			next={destination}
		/>
	);
}
