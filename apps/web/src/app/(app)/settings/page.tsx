import { getOwnProfile } from "@just-us/db/profile";
import { redirect } from "next/navigation";

import { ProfileSettings } from "@/components/dashboard/profile-settings";
import { requireOnboarded } from "@/lib/auth-server";
import { isManagedPrivateAvatarUrl } from "@/lib/avatar-policy";

export default async function SettingsPage() {
	const session = await requireOnboarded();
	const profile = await getOwnProfile(session.user.id);

	if (!profile) redirect("/login");

	return (
		<ProfileSettings
			profile={{
				id: profile.id,
				name: profile.name,
				email: profile.email,
				emailVerified: profile.emailVerified,
				hasAvatar: isManagedPrivateAvatarUrl(profile.image),
				role: profile.role,
				jurisdiction: profile.jurisdiction,
				createdAt: profile.createdAt.toISOString(),
			}}
		/>
	);
}
