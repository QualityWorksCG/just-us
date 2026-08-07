import "dotenv/config";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { createEnv } from "@t3-oss/env-core";
import { config as loadEnv } from "dotenv";
import { z } from "zod";

// Monorepo: prefer apps/web/.env when cwd isn't the Next app root.
//
// Only a plain-Node consumer needs this — a script run from the repo root, where
// nothing else loads the file. Inside Next the walk is redundant twice over: the
// framework has already loaded apps/web/.env, and on Vercel the platform injects
// the environment directly.
//
// The guard is what keeps it that way, and it is load-bearing for the *build*, not
// the runtime. A path rooted at `process.cwd()` is unbounded to Turbopack's static
// analysis, so tracing this module — which every server route importing `env`
// pulls in — concluded the entire repository was a dependency of those routes and
// put it in their NFT list ("Encountered unexpected file in NFT list", with
// next.config.ts as the give-away). Turbopack inlines NEXT_RUNTIME, so gating on
// it removes the `fs` calls from bundled server code outright rather than leaving
// them to be traced.
if (!process.env.NEXT_RUNTIME) {
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
		// Vercel AI Gateway key for the in-app assistant. When set, model calls
		// route through the gateway; without it we fall back to direct OpenAI.
		AI_GATEWAY_API_KEY: z.string().min(1).optional(),
		// Overrides the assistant's default chat model. See @just-us/ai/provider.
		AI_CHAT_MODEL: z.string().min(1).optional(),
		// Vercel Blob read/write token. One public store holds both case images
		// and profile photos. Optional so the app boots without it (uploads
		// simply fail with a clear error).
		BLOB_READ_WRITE_TOKEN: z.string().min(1).optional(),
		// Stripe platform secret key — sandbox (`sk_test_`) in development, live in
		// production. Optional like the Blob token: without it the donation routes
		// refuse with a clear error rather than the whole app failing to boot.
		STRIPE_SECRET_KEY: z.string().min(1).optional(),
		// Signing secret for the account webhook endpoint — the donation ledger
		// (checkout.session.completed, charge.refunded, charge.dispute.created).
		// A webhook whose signature can't be verified must be rejected, so this is
		// required in practice wherever STRIPE_SECRET_KEY is set.
		STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
		// Signing secret for the *Connect* endpoint (account.updated), which tracks
		// attorney onboarding. Separate dashboard endpoint, separate secret. One
		// `stripe listen` session forwards both, so locally these two hold the same
		// whsec_ value; in preview and production they differ.
		STRIPE_CONNECT_WEBHOOK_SECRET: z.string().min(1).optional(),
		// Platform fee in basis points — 500 is the 5% the public copy promises to
		// the cent (see the fee breakdown on the landing page and terms §4). Held
		// here rather than hard-coded so Checkout, the stored donation row, and the
		// donor-facing breakdown all read one number and cannot disagree.
		STRIPE_PLATFORM_FEE_BPS: z.coerce
			.number()
			.int()
			.min(0)
			.max(10_000)
			.default(500),
		// Smallest donation accepted, in cents. Defaults to $15 because Stripe's
		// processing fee comes out of our platform fee on a destination charge, so
		// the 5% only covers the 2.9% + 30¢ above $14.29 — below that a gift costs
		// more to process than it earns. Not a hard technical limit: lower it and
		// small donations simply run at a loss. `minimumCoversProcessorFee` in
		// @just-us/payments/fees reports whether this still covers break-even at the
		// configured fee rate.
		STRIPE_MIN_DONATION_CENTS: z.coerce
			.number()
			.int()
			.min(1)
			.max(99_999_999)
			.default(1500),
		// Quick-pick donation amounts, in cents, comma-separated. These are the main
		// lever on average gift size and therefore on whether the platform earns
		// anything at all (see the fee arithmetic in @just-us/payments/fees), so they
		// are tunable without a deploy. Parsed to a sorted, deduplicated list;
		// anything below STRIPE_MIN_DONATION_CENTS is rejected here rather than
		// shipped as a button that always fails.
		STRIPE_DONATION_PRESETS: z
			.string()
			.default("2500,5000,10000,25000")
			.transform((raw, ctx) => {
				const parts = raw
					.split(",")
					.map((p) => p.trim())
					.filter(Boolean);
				const cents: number[] = [];
				for (const part of parts) {
					const n = Number(part);
					if (!Number.isInteger(n) || n <= 0) {
						ctx.addIssue({
							code: "custom",
							message: `"${part}" is not a whole number of cents`,
						});
						return z.NEVER;
					}
					cents.push(n);
				}
				return [...new Set(cents)].sort((a, b) => a - b);
			}),
		EMAIL_SOURCE: z.string().min(1).default("just-us <onboarding@resend.dev>"),
		NODE_ENV: z
			.enum(["development", "production", "test"])
			.default("development"),
	},
	runtimeEnv: runtimeEnv,
	skipValidation: !!process.env.SKIP_ENV_VALIDATION,
	emptyStringAsUndefined: true,
});
