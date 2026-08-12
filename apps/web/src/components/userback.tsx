"use client";

import { useEffect } from "react";

import { authClient } from "@/lib/auth-client";

/**
 * The Userback feedback widget.
 *
 * Loaded from a client component rather than pasted into the document so the
 * signed-in user can be attached to whatever they report. A bug report that
 * arrives with an account on it is actionable; the same report anonymous is
 * usually a round trip asking who sent it.
 *
 * Mounted once in the root layout, so it is present on the public site as well as
 * behind sign-in. An anonymous visitor is a supported Userback configuration, not
 * a degraded one.
 *
 * The identity comes from `authClient.useSession()` rather than from a server
 * prop **on purpose**: reading the session in the root layout would touch cookies
 * there, which makes every route in the app dynamic and gives up static
 * generation of the marketing pages. The header on this same layout already reads
 * the session this way. It also means signing in updates the identity without a
 * reload.
 *
 * Renders no DOM of its own — the widget injects and positions its own button.
 */

declare global {
	interface Window {
		Userback?: {
			access_token?: string;
			user_data?: {
				id: string;
				info?: { name?: string; email?: string };
			};
		};
	}
}

const SCRIPT_SRC = "https://static.userback.io/widget/v1.js";
/** Marks our injected tag so a re-render can recognise it. */
const SCRIPT_ID = "userback-widget";

export function Userback({ token }: { token: string }) {
	const { data: session } = authClient.useSession();
	// Destructured to primitives so the effect below depends on the identity
	// itself. Depending on the session object would re-run it on every refetch,
	// since that returns a new object each time even when nothing changed.
	const id = session?.user?.id;
	const name = session?.user?.name;
	const email = session?.user?.email;

	useEffect(() => {
		// The config object is read by the widget as it boots, so it has to exist
		// before the script does. Assigning it on every run also means a sign-in
		// that happens without a full reload updates the identity the next report
		// carries, instead of leaving the widget attributing it to nobody.
		window.Userback = {
			...window.Userback,
			access_token: token,
			user_data: id
				? {
						id,
						info: {
							...(name ? { name } : {}),
							...(email ? { email } : {}),
						},
					}
				: undefined,
		};

		// Inject once. Client-side navigation re-runs this effect, and a second tag
		// would boot a second widget — two feedback buttons stacked on each other.
		if (document.getElementById(SCRIPT_ID)) return;

		const script = document.createElement("script");
		script.id = SCRIPT_ID;
		script.src = SCRIPT_SRC;
		script.async = true;
		document.head.appendChild(script);

		// Deliberately no cleanup that removes the script. Unmounting the tag would
		// not unload the widget it already booted, and re-adding it on the next
		// mount would. The widget is meant to live for the whole session.
	}, [token, id, name, email]);

	return null;
}
