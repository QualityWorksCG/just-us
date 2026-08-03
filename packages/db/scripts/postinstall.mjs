#!/usr/bin/env node
/**
 * Runs on every `bun install`: regenerates Prisma Client, then applies any
 * pending migrations — but only for local developer installs.
 *
 * `postinstall` also fires during CI and Vercel builds, where migrating from a
 * build machine is the wrong move: those environments share a database with
 * everyone else, and the deploy pipeline should decide when it changes. So the
 * migrate step bails out on CI/Vercel, when DATABASE_URL is unresolvable (fresh
 * clone with no .env yet), and whenever SKIP_DB_MIGRATE is set.
 *
 * A failed migration warns instead of throwing — a database that happens to be
 * asleep or unreachable shouldn't leave `bun install` in a failed state.
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
// migrate command itself would resolve.
loadEnv({
	path: path.resolve(dbRoot, "..", "..", "apps", "web", ".env"),
	quiet: true,
});

const skipReason = process.env.SKIP_DB_MIGRATE
	? "SKIP_DB_MIGRATE is set"
	: process.env.CI
		? "CI build — migrate as an explicit deploy step"
		: process.env.VERCEL
			? "Vercel build — migrate as an explicit deploy step"
			: !process.env.DATABASE_URL
				? "DATABASE_URL is not set"
				: null;

if (skipReason) {
	console.log(`[db] skipping migrate deploy: ${skipReason}`);
	process.exit(0);
}

try {
	prisma("migrate", "deploy");
} catch {
	console.warn(
		"\n[db] migrate deploy failed. Run `bun run db:migrate:deploy` once the database is reachable.",
	);
}
