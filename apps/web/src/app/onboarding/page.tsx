import type { Route } from "next";
import { redirect } from "next/navigation";

import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import { requireVerifiedSession } from "@/lib/auth-server";
import { safeNextPath } from "@/lib/next-path";

export const metadata = { title: "Welcome" };

export default async function OnboardingPage({
	searchParams,
}: {
	searchParams: Promise<{ next?: string }>;
}) {
	// Verified session required, but NOT requireOnboarded — this is the page that
	// completes onboarding, so gating on it would loop.
	const session = await requireVerifiedSession();

	// Sent here mid-way through something else — a case invitation, typically,
	// which is unanswerable until onboarding is done. Honoured on the way out and
	// for someone who is already onboarded, so neither ends on a dashboard with no
	// route back. Same-site paths only; see `safeNextPath`.
	const { next } = await searchParams;
	const destination = safeNextPath(next);

	if ((session.user as { onboarded?: boolean }).onboarded) {
		redirect((destination ?? "/home") as Route);
	}

	return <OnboardingFlow name={session.user.name} next={destination} />;
}
