import { redirect } from "next/navigation";

import { AuthScreen } from "@/components/auth/auth-screen";
import { getSession } from "@/lib/auth-server";

type Mode = "create" | "signin";

export default async function LoginPage({
	searchParams,
}: {
	searchParams: Promise<{ mode?: string }>;
}) {
	const session = await getSession();
	if (session?.user) {
		redirect("/dashboard");
	}

	const { mode } = await searchParams;
	const initialMode: Mode = mode === "signin" ? "signin" : "create";

	return <AuthScreen initialMode={initialMode} />;
}
