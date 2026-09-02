import { env } from "@just-us/env/server";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../prisma/generated/client";

/**
 * Pin `sslmode` to the behavior `pg` gives it today, so the connection is
 * unchanged but the deprecation warning stops.
 *
 * `pg`/`pg-connection-string` currently treat `prefer`, `require` and
 * `verify-ca` as aliases for `verify-full`, and warn that a future major
 * (pg v9) will give them weaker libpq semantics instead. Rewriting those modes
 * to the explicit `verify-full` they already resolve to keeps the exact same,
 * fully-verified TLS the app runs with now — and won't silently loosen on
 * upgrade. Modes we don't touch (`disable`, `no-verify`, an unset mode for a
 * local socket) pass through untouched.
 */
function pinnedSslConnectionString(url: string): string {
	try {
		const parsed = new URL(url);
		const mode = parsed.searchParams.get("sslmode");
		if (mode && ["prefer", "require", "verify-ca"].includes(mode)) {
			parsed.searchParams.set("sslmode", "verify-full");
			return parsed.toString();
		}
		return url;
	} catch {
		// Not a parseable URL (e.g. a key=value DSN) — leave it as the caller gave it.
		return url;
	}
}

export function createPrismaClient() {
	const adapter = new PrismaPg({
		connectionString: pinnedSslConnectionString(env.DATABASE_URL),
	});
	return new PrismaClient({ adapter });
}

const prisma = createPrismaClient();
export default prisma;
