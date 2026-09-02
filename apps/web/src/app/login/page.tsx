import type { Route } from "next";
import { redirect } from "next/navigation";

import { AuthScreen } from "@/components/auth/auth-screen";
import { getSession } from "@/lib/auth-server";
import { safeNextPath } from "@/lib/next-path";

type Mode = "create" | "signin";

export default async function LoginPage({
	searchParams,
}: {
	searchParams: Promise<{ mode?: string; error?: string; next?: string }>;
}) {
	const { mode, error, next } = await searchParams;
	// Where they were headed before being asked to sign in — a same-site path
	// only, see `safeNextPath`. Someone who followed a case invitation lands back
	// on it instead of on a dashboard with no way to find the decision again.
	const destination = safeNextPath(next);

	const session = await getSession();
	if (session?.user) {
		redirect((destination ?? "/home") as Route);
	}

	// A clicked magic link for an unknown email lands here with
	// new_user_signup_disabled — send them to create-account instead of sign-in.
	const initialMode: Mode =
		mode === "create" || error === "new_user_signup_disabled"
			? "create"
			: "signin";

	return (
		<AuthScreen
			initialMode={initialMode}
			initialError={error}
			next={destination}
		/>
	);
}
