import { redirect } from "next/navigation";

import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import { requireVerifiedSession } from "@/lib/auth-server";

export const metadata = { title: "Welcome" };

export default async function OnboardingPage() {
	// Verified session required, but NOT requireOnboarded — this is the page that
	// completes onboarding, so gating on it would loop.
	const session = await requireVerifiedSession();

	if ((session.user as { onboarded?: boolean }).onboarded) {
		redirect("/dashboard");
	}

	return <OnboardingFlow name={session.user.name} />;
}
