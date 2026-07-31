/**
 * Pure helpers shared by client and server. Blocked (administrator-initiated,
 * banned/banExpires) and locked (automated after failed sign-ins, lockedUntil)
 * are different states and must never be conflated in the UI.
 */

type BanFields = {
	banned?: boolean | null;
	banExpires?: Date | string | null;
};

type LockFields = {
	lockedUntil?: Date | string | null;
};

export function isBlocked(user: BanFields, at = new Date()): boolean {
	if (user.banned !== true) return false;
	if (!user.banExpires) return true;
	return new Date(user.banExpires) > at;
}

export function isLocked(user: LockFields, at = new Date()): boolean {
	if (!user.lockedUntil) return false;
	return new Date(user.lockedUntil) > at;
}
