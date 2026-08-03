import "dotenv/config";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { createEnv } from "@t3-oss/env-core";
import { config as loadEnv } from "dotenv";
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
};

export const env = createEnv({
	server: {
		DATABASE_URL: z.string().min(1),
		BETTER_AUTH_SECRET: z.string().min(32),
		// The app's public origin — used as Better Auth's baseURL and as the
		// trusted/CORS origin. On Vercel it defaults to the deployment URL.
		BETTER_AUTH_URL: z.url(),
		RESEND_API_KEY: z.string().min(1).optional(),
		// OpenAI key powering the case-wizard AI helpers (story polish, title
		// suggestions). Optional so the app still boots without it.
		OPENAI_API_KEY: z.string().min(1).optional(),
		// Vercel Blob read/write token for case image uploads. Optional so the
		// app boots without it (uploads simply fail with a clear error).
		BLOB_READ_WRITE_TOKEN: z.string().min(1).optional(),
		// Dedicated private Blob store for profile photos. The public case-image
		// store deliberately remains on BLOB_READ_WRITE_TOKEN.
		PRIVATE_AVATAR_STORE_ID: z.string().min(1).optional(),
		PRIVATE_AVATAR_READ_WRITE_TOKEN: z.string().min(1).optional(),
		EMAIL_SOURCE: z.string().min(1).default("just-us <onboarding@resend.dev>"),
		NODE_ENV: z
			.enum(["development", "production", "test"])
			.default("development"),
	},
	runtimeEnv: runtimeEnv,
	skipValidation: !!process.env.SKIP_ENV_VALIDATION,
	emptyStringAsUndefined: true,
});
