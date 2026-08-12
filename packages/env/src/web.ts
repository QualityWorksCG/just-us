import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
	client: {
		/**
		 * Userback feedback widget access token. Public by design — the widget runs
		 * in the browser and the token identifies the project, not an account, so it
		 * ships in the client bundle like any `NEXT_PUBLIC_` value.
		 *
		 * Optional: unset means no widget renders at all. That is what makes it a
		 * per-environment switch — on in demo and QA where feedback is wanted, off
		 * in production, without a code change or a feature flag.
		 */
		NEXT_PUBLIC_USERBACK_TOKEN: z.string().min(1).optional(),
	},
	runtimeEnv: {
		NEXT_PUBLIC_USERBACK_TOKEN: process.env.NEXT_PUBLIC_USERBACK_TOKEN,
	},
	skipValidation: !!process.env.SKIP_ENV_VALIDATION,
	emptyStringAsUndefined: true,
});
