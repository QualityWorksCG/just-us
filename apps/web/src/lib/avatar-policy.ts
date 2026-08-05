const AVATAR_PATH_PREFIX = "avatars/";

/**
 * Whether this URL is an avatar blob this application uploaded.
 *
 * Used to scope deletes: a user's `image` may be a third-party OAuth URL we
 * never created and must not try to remove from our own Blob store. Rendering is
 * no longer gated on it — profile photos are public, so any stored image URL is
 * fine to display.
 */
export function isManagedAvatarUrl(
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
