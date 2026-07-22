/**
 * Role-based access control for JustUs (JUS-9).
 *
 * This module is framework-agnostic and is the single source of truth for the
 * four platform roles and what each may do. Route/handler guards (see the web
 * app's `auth-server` helpers) enforce these decisions server-side; the UI only
 * mirrors them for convenience.
 *
 * Note on attorneys: a permission like `case:view_full_detail` is granted to the
 * attorney role, but access is *additionally* resource-scoped — a "browsing"
 * attorney may only see the public Seeking-Representation summary, while a
 * "matched" attorney sees full detail for the cases matched to them. That
 * resource check is `canAttorneyAccessCase` below; the coarse role grant here is
 * necessary-but-not-sufficient.
 */

export const ROLES = [
	"plaintiff",
	"donor",
	"attorney",
	"administrator",
] as const;

export type Role = (typeof ROLES)[number];

/** Roles a user may self-select at sign-up. `administrator` is invite-only. */
export const SELF_SIGNUP_ROLES = [
	"plaintiff",
	"donor",
	"attorney",
] as const satisfies readonly Role[];

export const DEFAULT_ROLE: Role = "donor";

export function isRole(value: unknown): value is Role {
	return (
		typeof value === "string" && (ROLES as readonly string[]).includes(value)
	);
}

/**
 * Every guardable capability on the platform. Resource ownership/matching is
 * layered on top of these coarse grants where noted.
 */
export type Permission =
	// Plaintiff
	| "case:submit"
	| "case:view_own"
	| "case:manage_own"
	// Donor
	| "case:browse_public"
	| "case:donate"
	| "donation:view_own"
	// Attorney
	| "representation:browse_queue"
	| "representation:request_match"
	| "case:view_full_detail" // resource-scoped: matched cases only
	| "case:post_update" // resource-scoped: matched cases only
	| "attorney:manage_profile"
	// Administrator
	| "moderation:review"
	| "user:manage"
	| "platform:manage_settings";

/**
 * The RBAC permission matrix. Administrators intentionally do NOT inherit every
 * capability (e.g. they don't submit cases or donate); they get the moderation
 * and platform-management surface. Keep this table as the canonical reference.
 */
export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
	plaintiff: [
		"case:submit",
		"case:view_own",
		"case:manage_own",
		"case:browse_public",
	],
	donor: ["case:browse_public", "case:donate", "donation:view_own"],
	attorney: [
		"case:browse_public",
		"representation:browse_queue",
		"representation:request_match",
		"case:view_full_detail",
		"case:post_update",
		"attorney:manage_profile",
	],
	administrator: [
		"case:browse_public",
		"moderation:review",
		"user:manage",
		"platform:manage_settings",
	],
} as const;

export function roleHasPermission(role: Role, permission: Permission): boolean {
	return ROLE_PERMISSIONS[role].includes(permission);
}

/** Convenience predicate used across guards. */
export function isAdministrator(role: Role | undefined | null): boolean {
	return role === "administrator";
}

/**
 * Resource-scoped check for attorneys (JUS-9): a browsing attorney sees only the
 * public queue summary; full case detail/evidence is limited to the attorney
 * matched to that case. Callers pass the attorney id matched to the case (or
 * null/undefined if the case has no matched attorney yet).
 */
export function canAttorneyAccessCase(
	userId: string,
	role: Role,
	matchedAttorneyId: string | null | undefined,
): boolean {
	if (role === "administrator") return true;
	if (role !== "attorney") return false;
	return Boolean(matchedAttorneyId) && matchedAttorneyId === userId;
}
