import {
	adminClient,
	inferAdditionalFields,
	magicLinkClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
	plugins: [
		adminClient(),
		magicLinkClient(),
		// Mirror the server's user.additionalFields so they are typed on the client
		// and accepted by signUp.email(). Keep in sync with packages/auth/src/index.ts.
		inferAdditionalFields({
			user: {
				role: { type: "string" },
				firmName: { type: "string", required: false },
				barNumber: { type: "string", required: false },
				jurisdiction: { type: "string", required: false },
			},
		}),
	],
});
