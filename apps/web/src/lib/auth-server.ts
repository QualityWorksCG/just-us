import "server-only";

import {
	auth,
	type Permission,
	type Role,
	roleHasPermission,
} from "@just-us/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

/**
 * Server-side session + RBAC guards (JUS-9 / JUS-11).
 *
 * These run in Server Components, Route Handlers and Server Actions and are the
 * enforcement point — never trust the client. Access is denied here even if the
 * UI happens to render a link to a protected area.
 */

export type SessionUser = Awaited<ReturnType<typeof auth.api.getSession>>;

/** Raw session (or null). Prefer the require* helpers for protected code. */
export async function getSession() {
	return auth.api.getSession({ headers: await headers() });
}

/** The current user's role, or null if signed out. */
export async function getRole(): Promise<Role | null> {
	const session = await getSession();
	return (session?.user as { role?: Role } | undefined)?.role ?? null;
}

/** Require an authenticated session; redirect to /login otherwise. */
export async function requireSession() {
	const session = await getSession();
	if (!session?.user) {
		redirect("/login");
	}
	return session;
}

/**
 * Require an authenticated AND email-verified session. Unverified users are
 * bounced to /verify-email so the block is enforced server-side, not just in the
 * UI. (JUS-11)
 */
export async function requireVerifiedSession() {
	const session = await requireSession();
	if (!session.user.emailVerified) {
		redirect("/verify-email");
	}
	return session;
}

/**
 * Require a verified session that has also completed onboarding. First-time
 * users (verified but not yet onboarded) are sent to /onboarding to pick their
 * role. Use this to gate the app; the /onboarding page itself must use
 * requireVerifiedSession to avoid a redirect loop.
 */
export async function requireOnboarded() {
	const session = await requireVerifiedSession();
	if (!(session.user as { onboarded?: boolean }).onboarded) {
		redirect("/onboarding");
	}
	return session;
}

/**
 * Require the current user to hold one of the allowed roles. Verified session is
 * implied. Sends unauthorized users to /dashboard (their own home) rather than
 * leaking the existence of the resource. (JUS-9)
 */
export async function requireRole(...allowed: Role[]) {
	const session = await requireVerifiedSession();
	const role = (session.user as { role?: Role }).role;
	if (!role || !allowed.includes(role)) {
		redirect("/dashboard");
	}
	return { session, role };
}

/** Require the current user's role to grant a specific permission. (JUS-9) */
export async function requirePermission(permission: Permission) {
	const session = await requireVerifiedSession();
	const role = (session.user as { role?: Role }).role;
	if (!role || !roleHasPermission(role, permission)) {
		redirect("/dashboard");
	}
	return { session, role };
}
