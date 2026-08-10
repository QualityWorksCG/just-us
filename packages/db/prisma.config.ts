import path from "node:path";

import dotenv from "dotenv";
import { defineConfig, env } from "prisma/config";

dotenv.config({
	path: "../../apps/web/.env",
});

/**
 * `prisma migrate dev` needs a second, throwaway database to detect drift and to
 * validate a new migration before writing it. Prisma normally creates one itself,
 * which needs CREATE DATABASE — a permission managed Postgres (Neon included)
 * generally withholds, so without this the command fails on connect.
 *
 * Point SHADOW_DATABASE_URL at any empty database you don't mind Prisma dropping
 * and recreating tables in; a Neon branch or a local Postgres both work. Only
 * `migrate dev` reads it. `migrate deploy`, `migrate status`, and the app itself
 * never do, so CI and production don't need it set — which is why it's optional
 * here rather than a required key.
 */
const shadowDatabase = process.env.SHADOW_DATABASE_URL
	? { shadowDatabaseUrl: env("SHADOW_DATABASE_URL") }
	: {};

/**
 * The same database, reached directly instead of through the connection pooler.
 *
 * **Every command in this file's scope is session-based, and a pooler breaks
 * sessions.** `migrate deploy` serialises itself with
 * `SELECT pg_advisory_lock(...)`, and a Postgres advisory lock belongs to a
 * *session*. Neon's `-pooler` endpoint is PgBouncer in transaction mode, where a
 * session is a backend borrowed between statements — so the lock is taken on one
 * backend, the migration runs on another, and a backend recycled while holding
 * the lock never releases it. On a build machine that surfaces as
 * `Error: P1002 — Timed out trying to acquire a postgres advisory lock`, raised
 * before a single migration is attempted and unfixable by retrying, because the
 * lock stays stuck until the compute suspends. It failed the `dev` deploy in
 * exactly that way.
 *
 * Prisma's own guidance is to run migrations over a direct connection. Only the
 * app needs the pooler, and only because it is serverless — the app builds its
 * own client from `DATABASE_URL` and is untouched by this.
 *
 * Applied here rather than in `scripts/postinstall.mjs` so it covers every path
 * to the database: `migrate deploy` on a build machine, and equally
 * `bun run db:migrate:deploy`, `migrate dev`, `migrate status`, `db push` and
 * `studio` run by hand. Fixing only the build script would leave the same P1002
 * waiting for whoever ran one of those.
 *
 * Derived rather than configured, so there is no second URL to keep in step
 * across four environments: Neon's direct host is the pooled one with `-pooler`
 * removed from the first label, and the pooler-only query flags come off with
 * it. Anything that is not a pooled URL — a plain host, localhost, an
 * unparseable value — is handed back untouched, so a bad URL fails inside the
 * Prisma command with Prisma's own error rather than here.
 */
function directConnection(raw: string): string {
	try {
		const url = new URL(raw);
		url.hostname = url.hostname.replace(/-pooler(?=\.|$)/, "");
		url.searchParams.delete("pgbouncer");
		url.searchParams.delete("connection_limit");
		return url.toString();
	} catch {
		return raw;
	}
}

// `env()` is kept as the fallback so an unset DATABASE_URL still produces
// Prisma's own "environment variable not found" error rather than a confusing
// one from here.
const datasourceUrl = process.env.DATABASE_URL
	? directConnection(process.env.DATABASE_URL)
	: env("DATABASE_URL");

export default defineConfig({
	schema: path.join("prisma", "schema"),
	migrations: {
		path: path.join("prisma", "migrations"),
	},
	datasource: {
		url: datasourceUrl,
		...shadowDatabase,
	},
});
