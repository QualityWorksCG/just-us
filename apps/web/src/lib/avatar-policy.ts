const AVATAR_PATH_PREFIX = "avatars/";

/**
 * Restricts profile rendering to avatars managed by this application. Existing
 * third-party OAuth image URLs are intentionally not rendered in the dashboard
 * because profile photos are a private account detail.
 */
export function isManagedPrivateAvatarUrl(
	imageUrl: string | null | undefined,
): imageUrl is string {
	if (!imageUrl) return false;

	try {
		return new URL(imageUrl).pathname.startsWith(`/${AVATAR_PATH_PREFIX}`);
	} catch {
		return false;
	}
}

export function profileAvatarBlobPath(userId: string) {
	return `${AVATAR_PATH_PREFIX}${userId}/profile.webp`;
}
