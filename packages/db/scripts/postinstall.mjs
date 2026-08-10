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
 * Only a deployment whose database is its own may migrate.
 *
 * A branch that shares a database with other deployments must not: migrating
 * applies that branch's *unmerged* migrations to a database others depend on,
 * and a single failure is not confined to the branch that caused it. The failed
 * attempt is recorded in `_prisma_migrations`, and from that moment
 * `migrate deploy` refuses to run against that database at all (P3009) — so one
 * PR takes down every other PR and the shared environment with it. That is
 * exactly what happened when the stripe branch's `add_stripe_donations` failed
 * against the dev database and blocked every deployment behind it.
 *
 * Two ways a deployment qualifies:
 *
 *   - Its branch has a DATABASE_URL of its own in Vercel. Listed here rather
 *     than inferred, and kept as a floor: these branches must migrate, because
 *     shipping code ahead of its schema is the bug this whole script exists to
 *     prevent. If DB_DEDICATED were ever removed, they keep working.
 *
 *   - DB_DEDICATED is set, asserting that this deployment's DATABASE_URL is not
 *     the database any environment branch runs on. Set it once, on the Preview
 *     environment, *after* repointing the environment-wide preview DATABASE_URL
 *     at a database reserved for previews. Setting it while that URL still
 *     points at dev reintroduces the incident above, which is why the target
 *     host is logged below.
 */
const DATABASE_OWNING_BRANCHES = ["dev", "qa", "demo"];

// Scoped to preview builds specifically: production has its own DATABASE_URL,
// and CI has no VERCEL_GIT_COMMIT_REF at all, so neither should be judged by the
// branch list. An unknown ref with no DB_DEDICATED is treated as sharing — the
// safe direction, since guessing wrong here is what poisons a shared database.
const branch = process.env.VERCEL_GIT_COMMIT_REF;
const ownsItsDatabase =
	DATABASE_OWNING_BRANCHES.includes(branch) || !!process.env.DB_DEDICATED;
const sharesPreviewDatabase =
	process.env.VERCEL_ENV === "preview" && !ownsItsDatabase;

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

/** Host and database name only — never the credentials the URL also carries. */
function describeDatabase(url) {
	try {
		const { hostname, pathname } = new URL(url);
		return `${hostname}${pathname}`;
	} catch {
		return "(unparseable DATABASE_URL)";
	}
}

// Name the database about to be migrated. A preview build that prints the dev
// host is the DB_DEDICATED misconfiguration described above, and reading it here
// is far cheaper than discovering it from a poisoned `_prisma_migrations`.
//
// This prints DATABASE_URL's own host, which identifies the database but is not
// the endpoint the migration connects on: prisma.config.ts rewrites the pooled
// host to Neon's direct one, because migrations cannot hold their advisory lock
// through a pooler (P1002 — see the note there). Prisma's own `Datasource "db":
// … at <host>` line below is the authority on where it actually connected.
console.log(
	`[db] migrate deploy → ${describeDatabase(process.env.DATABASE_URL)}`,
);

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
