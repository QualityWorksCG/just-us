import { getNotificationPreference } from "@just-us/db/notifications";
import { attorneyPayoutReadiness } from "@just-us/db/payouts";
import { getOwnProfile } from "@just-us/db/profile";
import { redirect } from "next/navigation";

import { DonationPrivacySettings } from "@/components/dashboard/donation-privacy-settings";
import { NotificationSettings } from "@/components/dashboard/notification-settings";
import { PayoutCasesLink } from "@/components/dashboard/payout-cases-link";
import { PayoutExplainer } from "@/components/dashboard/payout-explainer";
import { ProfileSettings } from "@/components/dashboard/profile-settings";
import { requireOnboarded } from "@/lib/auth-server";

export default async function SettingsPage() {
	const session = await requireOnboarded();
	const [profile, notificationPref] = await Promise.all([
		getOwnProfile(session.user.id),
		getNotificationPreference(session.user.id),
	]);

	if (!profile) redirect("/login");

	// Neither role sets a payout up here any more. Donations pay the operating account
	// of the firm representing a case, and there is one account per case — so the
	// attorney's setup lives on each case, and this points them there rather than
	// keeping a second copy of it. Donors and administrators never receive donated
	// money, and a plaintiff no longer does either, so for them this stays an
	// explanation of where their case's money goes.
	const readiness =
		profile.role === "attorney"
			? await attorneyPayoutReadiness({
					userId: profile.id,
					email: profile.email,
				})
			: null;

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
			<NotificationSettings emailEnabled={notificationPref.emailEnabled} />
			<DonationPrivacySettings anonymous={profile.donationsAnonymous} />
			{readiness ? (
				<PayoutCasesLink
					waitingCases={readiness.waitingCases}
					inReviewCases={readiness.inReviewCases}
				/>
			) : (
				profile.role === "plaintiff" && <PayoutExplainer />
			)}
		</div>
	);
}
