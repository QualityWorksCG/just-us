import { getPayoutAccount } from "@just-us/db/payouts";
import { getOwnProfile } from "@just-us/db/profile";
import { isPaymentsConfigured } from "@just-us/payments";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { PayoutAccount } from "@/components/dashboard/payout-account";
import { ProfileSettings } from "@/components/dashboard/profile-settings";
import { requireOnboarded } from "@/lib/auth-server";

export default async function SettingsPage() {
	const session = await requireOnboarded();
	const profile = await getOwnProfile(session.user.id);

	if (!profile) redirect("/login");

	// Only the two roles that can receive donations get a payout section. Donors
	// and administrators never hold a receiving account.
	const canReceive =
		profile.role === "plaintiff" || profile.role === "attorney";
	const payout = canReceive ? await getPayoutAccount(profile.id) : null;

	return (
		<div className="flex flex-col gap-6">
			<ProfileSettings
				profile={{
					id: profile.id,
					name: profile.name,
					email: profile.email,
					emailVerified: profile.emailVerified,
					avatarUrl: profile.image,
					role: profile.role,
					jurisdiction: profile.jurisdiction,
					createdAt: profile.createdAt.toISOString(),
				}}
			/>
			{canReceive && (
				// PayoutAccount reads ?payout= to detect the return from Stripe's hosted
				// flow, and useSearchParams needs a Suspense boundary to prerender.
				<Suspense fallback={null}>
					<PayoutAccount
						initial={{
							stripeAccountId: payout?.stripeAccountId ?? null,
							detailsSubmitted: payout?.detailsSubmitted ?? false,
							transfersEnabled: payout?.transfersEnabled ?? false,
							payoutsEnabled: payout?.payoutsEnabled ?? false,
							configured: isPaymentsConfigured(),
						}}
					/>
				</Suspense>
			)}
		</div>
	);
}
