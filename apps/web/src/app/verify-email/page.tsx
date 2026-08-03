import { redirect } from "next/navigation";

import { VerifyEmailPrompt } from "@/components/auth/verify-email-prompt";
import { getSession } from "@/lib/auth-server";

export const metadata = { title: "Verify your email" };

export default async function VerifyEmailPage({
	searchParams,
}: {
	searchParams: Promise<{ email?: string }>;
}) {
	const session = await getSession();

	// Already verified — nothing to do here.
	if (session?.user?.emailVerified) {
		redirect("/home");
	}

	// A sign-in blocked on verification lands here signed out, so the address
	// comes over on the URL. Only used when there is no session to read it from;
	// a signed-in user's own email always wins (the resend endpoint rejects a
	// mismatch anyway).
	const { email } = await searchParams;

	return (
		<VerifyEmailPrompt
			email={session?.user?.email ?? email}
			signedIn={Boolean(session?.user)}
		/>
	);
}
