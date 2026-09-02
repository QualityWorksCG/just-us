import { getSessionCookie } from "better-auth/cookies";
import { evlogMiddleware } from "evlog/next";
import { type NextRequest, NextResponse } from "next/server";

const logApiRequests = evlogMiddleware();

/**
 * Send signed-in visitors from the marketing landing page to their dashboard.
 *
 * The header already hides itself for a signed-in user ("signed-in users navigate
 * from the app shell, not the marketing header"), so without this redirect they
 * land on the marketing page with no navigation at all and no way back into the
 * app. Hiding the chrome and leaving the page reachable are the two halves of one
 * decision; this is the other half.
 *
 * Done here rather than in the page because `/` is statically prerendered.
 * Calling `getSession()` in the server component would read headers and deopt it
 * to dynamic, so every anonymous visitor to the busiest public page would pay for
 * an SSR render and a session lookup to answer a question only signed-in users
 * ask.
 *
 * This is a convenience redirect, not an access control. `getSessionCookie` only
 * checks that a session cookie is present — it does not validate it, which is why
 * it is cheap enough to run at the edge. A stale cookie sends the visitor to
 * `/home`, where `requireOnboarded` does the real check against the database
 * and forwards them to `/login`, `/verify-email`, or `/onboarding` as needed.
 * Nothing is protected on the strength of this test.
 */
export async function proxy(request: NextRequest) {
	if (request.nextUrl.pathname === "/") {
		return getSessionCookie(request)
			? NextResponse.redirect(new URL("/home", request.url))
			: NextResponse.next();
	}
	return logApiRequests(request);
}

export const config = {
	// `/` for the redirect above; `/api/*` for evlog's request logging. Kept as an
	// explicit list so the proxy never runs on page routes that need neither.
	matcher: ["/", "/api/:path*"],
};
