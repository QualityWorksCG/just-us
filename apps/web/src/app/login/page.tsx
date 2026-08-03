import { redirect } from "next/navigation";

import { AuthScreen } from "@/components/auth/auth-screen";
import { getSession } from "@/lib/auth-server";

type Mode = "create" | "signin";

export default async function LoginPage({
	searchParams,
}: {
	searchParams: Promise<{ mode?: string; error?: string }>;
}) {
	const session = await getSession();
	if (session?.user) {
		redirect("/home");
	}

	const { mode, error } = await searchParams;
	// A clicked magic link for an unknown email lands here with
	// new_user_signup_disabled — send them to create-account instead of sign-in.
	const initialMode: Mode =
		mode === "create" || error === "new_user_signup_disabled"
			? "create"
			: "signin";

	return <AuthScreen initialMode={initialMode} initialError={error} />;
}
