/**
 * The feature-flag registry (JUS-13).
 *
 * Flags are declared here, in code — the database only stores whether each one is
 * on. That ordering is deliberate:
 *
 * - `FlagKey` is a union of the declared keys, so `isFeatureEnabled("typo")` is a
 *   compile error rather than a silently-false read.
 * - Deleting a flag from this registry removes it from the admin screen and from
 *   every code path at once; a leftover database row can't resurrect it.
 * - Every flag is off until an administrator turns it on, so declaring a flag is
 *   always safe to ship.
 *
 * This module is framework-agnostic and safe to import from client components —
 * it holds no state and touches no database. **Client code must import from
 * `@just-us/flags/registry`, not `@just-us/flags`**: the package root pulls in
 * Prisma, which drags Node built-ins (`dns`, `fs`) into the browser bundle and
 * fails the build.
 */

export type FlagDefinition = {
	/** Short label for the admin Configuration screen. */
	label: string;
	/** What turning this on actually does, for the admin who has to decide. */
	description: string;
};

export const FLAGS = {
	aiAssistant: {
		label: "AI assistant",
		description:
			"Gates the in-app role-aware AI assistant — both its entry point in the app shell and the endpoint behind it. Off means no user can reach it and no model spend is possible.",
	},
	investorTrack: {
		label: "Investor track",
		description:
			"Phase 2. Opens the investor area: investors can browse funded cases and track returns. Leave off until the investor flow is signed off.",
	},
} as const satisfies Record<string, FlagDefinition>;

export type FlagKey = keyof typeof FLAGS;

/** Resolved on/off state for every declared flag. */
export type FlagState = Record<FlagKey, boolean>;

export const FLAG_KEYS = Object.keys(FLAGS) as FlagKey[];

export function isFlagKey(value: string): value is FlagKey {
	return Object.hasOwn(FLAGS, value);
}

/** Every flag, off — the shape a caller gets before any database read. */
export function allFlagsDisabled(): Record<FlagKey, boolean> {
	return Object.fromEntries(FLAG_KEYS.map((k) => [k, false])) as Record<
		FlagKey,
		boolean
	>;
}
