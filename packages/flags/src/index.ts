/**
 * Database-backed flag state (JUS-13). **Server-only** — this module imports
 * Prisma, so importing it from a client component pulls Node built-ins into the
 * browser bundle and fails the build. Client components import
 * `@just-us/flags/registry` instead, which is pure data.
 */
import prisma from "@just-us/db";

import {
	defaultFlagState,
	FLAG_KEYS,
	type FlagKey,
	type FlagState,
	flagDefault,
	isFlagKey,
} from "./registry";

export {
	defaultFlagState,
	FLAG_KEYS,
	FLAGS,
	type FlagDefinition,
	type FlagKey,
	type FlagState,
	flagDefault,
	isFlagKey,
} from "./registry";

/**
 * Read every declared flag's state (JUS-13).
 *
 * Starts from the registry's declared defaults and layers stored rows on top,
 * which gives two properties for free: a flag nobody has toggled reads as
 * whatever it declares, and a stored row for a flag that has since been removed
 * from the registry is ignored rather than leaking into the result.
 *
 * Callers in the web app should use the cached wrapper in `lib/flags-server`
 * rather than calling this directly, so one request makes one query.
 */
export async function readFlags(): Promise<FlagState> {
	const state = defaultFlagState();
	const rows = await prisma.featureFlag.findMany({
		where: { key: { in: FLAG_KEYS } },
		select: { key: true, enabled: true },
	});
	for (const row of rows) {
		if (isFlagKey(row.key)) state[row.key] = row.enabled;
	}
	return state;
}

/** Whether a single flag is on. Unset flags fall back to their declared default. */
export async function isFeatureEnabled(key: FlagKey): Promise<boolean> {
	const row = await prisma.featureFlag.findUnique({
		where: { key },
		select: { enabled: true },
	});
	return row?.enabled ?? flagDefault(key);
}

/**
 * Turn a flag on or off. Upsert rather than update so the first toggle of a
 * newly-declared flag doesn't need a seeded row.
 *
 * This does NOT check permissions — callers must gate it. In the web app that's
 * the administrator-guarded server action.
 */
export async function setFlag(
	key: FlagKey,
	enabled: boolean,
	updatedBy?: string,
): Promise<void> {
	await prisma.featureFlag.upsert({
		where: { key },
		create: { key, enabled, updatedBy: updatedBy ?? null },
		update: { enabled, updatedBy: updatedBy ?? null },
	});
}
