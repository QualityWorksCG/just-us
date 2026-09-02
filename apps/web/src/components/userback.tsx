"use client";

import loadUserback, {
	getUserback,
	type UserbackWidget as UserbackInstance,
} from "@userback/widget";
import { useEffect } from "react";

import { authClient } from "@/lib/auth-client";

/**
 * The Userback feedback widget.
 *
 * Uses Userback's own `@userback/widget` package rather than hand-injecting their
 * loader script, so the script URL, boot sequence and API surface are the
 * vendor's problem and not ours to keep in step with.
 *
 * Mounted once in the root layout, so it covers the public site as well as
 * everything behind sign-in. An anonymous visitor is a supported configuration,
 * not a degraded one.
 *
 * The identity comes from `authClient.useSession()` rather than a server prop **on
 * purpose**: reading the session in the root layout would touch cookies there,
 * which makes every route dynamic and gives up static generation of the marketing
 * pages. The header on this same layout already reads the session this way. It
 * also means signing in attaches the account without a reload.
 *
 * Renders no DOM of its own — the widget injects and positions its own button.
 */

/** Identifying fields Userback shows against a report. */
type UserInfo = { name?: string; email?: string };

/**
 * The in-flight (or settled) init, module-scoped.
 *
 * `getUserback()` only answers once init has *resolved*, so two effect runs in
 * quick succession — a client-side navigation, or React's development double
 * invoke — could both find no widget and both boot one, leaving two feedback
 * buttons stacked. Holding the promise here means the second caller waits on the
 * first instead of racing it.
 */
let initialising: Promise<UserbackInstance> | null = null;

function initUserback(
	token: string,
	userData: { id: string; info: UserInfo } | undefined,
): Promise<UserbackInstance> {
	initialising ??= loadUserback(token, userData ? { user_data: userData } : {});
	return initialising;
}

export function UserbackWidget({ token }: { token: string }) {
	const { data: session } = authClient.useSession();
	// Destructured to primitives so the effect depends on the identity itself.
	// Depending on the session object would re-run it on every refetch, since that
	// returns a new object each time even when nothing changed.
	const id = session?.user?.id;
	const name = session?.user?.name;
	const email = session?.user?.email;

	useEffect(() => {
		const info: UserInfo = {
			...(name ? { name } : {}),
			...(email ? { email } : {}),
		};

		// Already booted: just tell it who this is now. This is the path that
		// matters after signing in — the widget came up anonymous on the public page
		// and has to pick up the account without a reload.
		const existing = getUserback();
		if (existing) {
			if (id) existing.identify(id, info);
			return;
		}

		initUserback(token, id ? { id, info } : undefined)
			.then((widget) => {
				// The session usually resolves *after* init, so identify again here
				// rather than relying on the options passed above having had it.
				if (id) widget.identify(id, info);
			})
			.catch((error) => {
				// A feedback widget that fails to load must not take a page down with
				// it, and there is nothing for a visitor to act on.
				console.error("[userback]", error);
				// Cleared so a later mount can retry rather than awaiting a promise
				// that already rejected.
				initialising = null;
			});

		// Deliberately no cleanup that destroys the widget. In the root layout this
		// never unmounts in normal use, and tearing it down on a transient unmount
		// would cost the visitor an open feedback form.
	}, [token, id, name, email]);

	return null;
}
