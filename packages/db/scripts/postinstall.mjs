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
 * with no .env yet), whenever SKIP_DB_MIGRATE is set, and on any preview build
 * for a branch that does not own its own database — see
 * DATABASE_OWNING_BRANCHES below for why that last one matters.
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

/**
 * Branches with a DATABASE_URL of their own in Vercel, and so the only ones
 * entitled to migrate on a preview build.
 *
 * Every other branch — every feature branch, every PR — has no branch-specific
 * override and falls back to the environment-wide preview DATABASE_URL, which
 * points at a database these branches share. Migrating there applies a branch's
 * *unmerged* migrations to a database other deployments depend on, and a single
 * failure is not confined to the branch that caused it: the failed attempt is
 * recorded in `_prisma_migrations`, and from that moment `migrate deploy`
 * refuses to run against that database at all (P3009). One PR takes down every
 * other PR and the shared environment with it — which is exactly what happened
 * when the stripe branch's `add_stripe_donations` failed against the dev
 * database and blocked every deployment behind it.
 *
 * Keep this list in step with the branch-scoped DATABASE_URL entries in Vercel.
 */
const DATABASE_OWNING_BRANCHES = ["dev", "qa", "demo"];

// Scoped to preview builds specifically: production has its own DATABASE_URL,
// and CI has no VERCEL_GIT_COMMIT_REF at all, so neither should be judged by the
// branch list. An unknown ref on a preview build is treated as not owning a
// database — the safe direction, since guessing wrong here is what poisons a
// shared database.
const branch = process.env.VERCEL_GIT_COMMIT_REF;
const sharesPreviewDatabase =
	process.env.VERCEL_ENV === "preview" &&
	!DATABASE_OWNING_BRANCHES.includes(branch);

const skipReason = process.env.SKIP_DB_MIGRATE
	? "SKIP_DB_MIGRATE is set"
	: !process.env.DATABASE_URL
		? "DATABASE_URL is not set"
		: sharesPreviewDatabase
			? `branch ${branch ?? "(unknown)"} has no database of its own and shares the preview database`
			: null;

if (skipReason) {
	// Sharing the preview database is the one skip that is working as intended:
	// the preview is *meant* to run against whatever schema that database has,
	// and the whole point is to leave it untouched. The others mean a deployment
	// is about to serve traffic against an unknown schema, which on a deploy
	// build is worth saying loudly.
	console.log(
		isDeployBuild && !sharesPreviewDatabase
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
