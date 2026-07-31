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

export default defineConfig({
	schema: path.join("prisma", "schema"),
	migrations: {
		path: path.join("prisma", "migrations"),
	},
	datasource: {
		url: env("DATABASE_URL"),
		...shadowDatabase,
	},
});
