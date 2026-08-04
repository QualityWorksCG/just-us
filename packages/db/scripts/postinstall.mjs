#!/usr/bin/env node
/**
 * Runs on every `bun install`: regenerates Prisma Client, then applies any
 * pending migrations.
 *
 * This also fires during Vercel and CI builds, and there it is the point of the
 * script: nothing else applies migrations. Vercel's build command is a plain
 * `next build`, so before this ran on the build machine a merge to `qa` shipped
 * new code against an old schema — which is exactly how QA ended up serving 500s
 * from `/home` and `/api/auth/get-session` (Prisma P2022, column not found).
 * Migrating here keeps schema and code arriving together, in one deploy.
 *
 * Concurrent deploys are safe: `migrate deploy` takes a Postgres advisory lock,
 * so a second build waits rather than racing. It only ever plays forward the
 * migrations already committed to the repo — it never generates SQL, never
 * resets, and never drops a column, so a build machine cannot invent a schema
 * change of its own.
 *
 * The migrate step is skipped when DATABASE_URL is unresolvable (a fresh clone
 * with no .env yet) and whenever SKIP_DB_MIGRATE is set.
 *
 * Failure handling differs by environment, deliberately:
 *   - On Vercel/CI a failed migration FAILS the build. Deploying code that its
 *     database cannot satisfy is the bug this script exists to prevent, and a
 *     warning there would be swallowed by build output and shipped anyway.
 *   - Locally it warns. A dev database that happens to be asleep or unreachable
 *     shouldn't leave `bun install` in a failed state.
 */
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { config as loadEnv } from "dotenv";

const dbRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const prismaBin = path.join(dbRoot, "node_modules", ".bin", "prisma");

function prisma(...args) {
	execFileSync(prismaBin, args, { cwd: dbRoot, stdio: "inherit" });
}

// Always safe: only writes generated client output, needs no database.
prisma("generate");

// Mirror prisma.config.ts so the guard below reads the same DATABASE_URL the
// migrate command itself would resolve. Absent on Vercel/CI, where the platform
// injects the environment directly.
loadEnv({
	path: path.resolve(dbRoot, "..", "..", "apps", "web", ".env"),
	quiet: true,
});

// A failed migration must fail the build wherever the build produces a
// deployment; see the note above.
const isDeployBuild = !!(process.env.VERCEL || process.env.CI);

const skipReason = process.env.SKIP_DB_MIGRATE
	? "SKIP_DB_MIGRATE is set"
	: !process.env.DATABASE_URL
		? "DATABASE_URL is not set"
		: null;

if (skipReason) {
	// On a deploy build this is not routine: the deployment is about to serve
	// traffic against whatever schema the database happens to have. Say so
	// loudly, but still let the intentional escape hatch work.
	console.log(
		isDeployBuild
			? `[db] WARNING: skipping migrate deploy on a deploy build: ${skipReason}. The deployment may run against an out-of-date schema.`
			: `[db] skipping migrate deploy: ${skipReason}`,
	);
	process.exit(0);
}

try {
	prisma("migrate", "deploy");
} catch (error) {
	if (isDeployBuild) {
		console.error(
			"\n[db] migrate deploy failed — failing the build rather than deploying code against an out-of-date schema.",
		);
		throw error;
	}
	console.warn(
		"\n[db] migrate deploy failed. Run `bun run db:migrate:deploy` once the database is reachable.",
	);
}
