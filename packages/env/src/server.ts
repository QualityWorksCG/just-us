import "dotenv/config";
import { config as loadEnv } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

// Monorepo: prefer apps/web/.env when cwd isn't the Next app root.
for (const candidate of [
	resolve(process.cwd(), ".env"),
	resolve(process.cwd(), "apps/web/.env"),
	resolve(process.cwd(), "../../apps/web/.env"),
]) {
	if (existsSync(candidate)) {
		loadEnv({ path: candidate, quiet: true });
		break;
	}
}

function getVercelOrigin() {
	const vercelUrl =
		process.env.VERCEL_ENV === "production"
			? (process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL)
			: (process.env.VERCEL_URL ?? process.env.VERCEL_PROJECT_PRODUCTION_URL);
	if (!vercelUrl) return undefined;
	return vercelUrl.startsWith("http") ? vercelUrl : `https://${vercelUrl}`;
}

const vercelOrigin = getVercelOrigin();

const runtimeEnv = {
	...process.env,
	BETTER_AUTH_URL: process.env.BETTER_AUTH_URL ?? vercelOrigin,
	CORS_ORIGIN: process.env.CORS_ORIGIN ?? vercelOrigin,
};

export const env = createEnv({
	server: {
		DATABASE_URL: z.string().min(1),
		BETTER_AUTH_SECRET: z.string().min(32),
		BETTER_AUTH_URL: z.url(),
		CORS_ORIGIN: z.url(),
		RESEND_API_KEY: z.string().min(1).optional(),
		EMAIL_SOURCE: z.string().min(1).default("just-us <onboarding@resend.dev>"),
		// Invite code required to self-register as an administrator (JUS-11).
		// When unset, administrator sign-up is disabled entirely.
		ADMIN_INVITE_CODE: z.string().min(1).optional(),
		NODE_ENV: z
			.enum(["development", "production", "test"])
			.default("development"),
	},
	runtimeEnv: runtimeEnv,
	skipValidation: !!process.env.SKIP_ENV_VALIDATION,
	emptyStringAsUndefined: true,
});
