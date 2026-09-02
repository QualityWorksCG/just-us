import { redirect } from "next/navigation";

import { VerifyEmailPrompt } from "@/components/auth/verify-email-prompt";
import { getSession } from "@/lib/auth-server";

export const metadata = { title: "Verify your email" };

export default async function VerifyEmailPage() {
	const session = await getSession();

	// Already verified — nothing to do here.
	if (session?.user?.emailVerified) {
		redirect("/dashboard");
	}

	return (
		<VerifyEmailPrompt
			email={session?.user?.email}
			signedIn={Boolean(session?.user)}
		/>
	);
}
