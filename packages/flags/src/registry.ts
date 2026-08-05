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
 * - A flag with no `defaultEnabled` is off until an administrator turns it on, so
 *   declaring one is safe to ship. `defaultEnabled: true` inverts that — the
 *   feature is live on deploy and the stored row only ever turns it off — so it
 *   belongs to features that are meant to launch, not to work in progress.
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
	/**
	 * State before anyone has touched the switch. Omit for work in progress;
	 * set true for a shipped feature that should be live on deploy, where the
	 * switch exists to turn it *off* without one.
	 */
	defaultEnabled?: boolean;
};

export const FLAGS = {
	aiAssistant: {
		label: "AI assistant",
		description:
			"Gates the in-app role-aware AI assistant — both its entry point in the app shell and the endpoint behind it. Off means no user can reach it and no model spend is possible.",
		defaultEnabled: true,
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

/** Whether a flag is on before any administrator has touched it. */
export function flagDefault(key: FlagKey): boolean {
	// Read through the interface: `as const` narrows each entry to its own literal
	// type, and the property is simply absent on flags that omit it.
	const definition: FlagDefinition = FLAGS[key];
	return definition.defaultEnabled ?? false;
}

/** Every flag at its declared default — the shape before any database read. */
export function defaultFlagState(): FlagState {
	return Object.fromEntries(
		FLAG_KEYS.map((k) => [k, flagDefault(k)]),
	) as FlagState;
}
