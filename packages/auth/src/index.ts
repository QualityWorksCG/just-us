import { createPrismaClient } from "@just-us/db";
import { claimGuestDonations } from "@just-us/db/donations";
import { env } from "@just-us/env/server";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError, createAuthMiddleware, isAPIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { admin, magicLink } from "better-auth/plugins";
import { createAccessControl } from "better-auth/plugins/access";
import { adminAc, defaultStatements } from "better-auth/plugins/admin/access";

import {
	sendMagicLinkEmail,
	sendResetPasswordEmail,
	sendVerificationEmail,
} from "./lib/email";
import { DEFAULT_ROLE } from "./rbac";

/** Account lockout policy (JUS-8): lock after N consecutive failed sign-ins. */
export const MAX_FAILED_ATTEMPTS = 3;
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes
/**
 * IP rate limit for /sign-in/email. Kept above MAX_FAILED_ATTEMPTS so a
 * successful sign-in (which still counts against the IP budget) cannot make
 * the next wrong-password attempt look like an account lockout (JUS-77).
 */
export const SIGN_IN_RATE_LIMIT_MAX = 10;

/**
 * Admin-plugin access control. Only `administrator` carries admin-plugin
 * capabilities (user management, bans, impersonation); the other roles are
 * defined here so they exist as valid role values but hold no admin powers.
 * Business-level permissions live in the RBAC matrix (see ./rbac).
 */
const accessControl = createAccessControl(defaultStatements);
const roles = {
	administrator: accessControl.newRole(adminAc.statements),
	attorney: accessControl.newRole({}),
	plaintiff: accessControl.newRole({}),
	donor: accessControl.newRole({}),
};

export function createAuth() {
	const prisma = createPrismaClient();

	return betterAuth({
		appName: "JustUs",
		database: prismaAdapter(prisma, {
			provider: "postgresql",
		}),

		// Single origin for the app: also the CORS/trusted origin.
		trustedOrigins: [env.BETTER_AUTH_URL],

		// Passwords are hashed with scrypt by default (bcrypt-equivalent KDF); the
		// plaintext is never persisted or logged. (JUS-8)
		emailAndPassword: {
			enabled: true,
			requireEmailVerification: true,
			resetPasswordTokenExpiresIn: 60 * 60,
			sendResetPassword: async ({ user, url }) => {
				await sendResetPasswordEmail({
					to: user.email,
					url,
					name: user.name,
				});
			},
		},

		// Every role must confirm their email before the account is active,
		// enforced server-side via requireEmailVerification above. (JUS-11)
		emailVerification: {
			sendOnSignUp: true,
			autoSignInAfterVerification: true,
			sendVerificationEmail: async ({ user, url }) => {
				await sendVerificationEmail({
					to: user.email,
					url,
					name: user.name,
				});
			},
		},

		// Role, onboarding state and attorney-profile fields are all set server-side
		// during onboarding (never trusted from the client), so input is disabled.
		// `onboarded` is exposed on the session so guards can gate the app on it.
		//
		// Every column the auth layer itself reads or writes must be declared here:
		// the adapter only maps fields it finds in the Better Auth schema and
		// silently drops the rest, so an undeclared column is invisible to
		// ctx.context.adapter and internalAdapter.
		user: {
			additionalFields: {
				onboarded: {
					type: "boolean",
					required: false,
					input: false,
					defaultValue: false,
				},
				firmName: { type: "string", required: false, input: false },
				barNumber: { type: "string", required: false, input: false },
				jurisdiction: { type: "string", required: false, input: false },
				failedLoginAttempts: { type: "number", required: false, input: false },
				lockedUntil: { type: "date", required: false, input: false },
				lastSignInAt: { type: "date", required: false, input: false },
			},
		},

		// Rate limiting + account lockout for repeated failed sign-ins. (JUS-8)
		rateLimit: {
			enabled: true,
			storage: "database",
			window: 60,
			max: 100,
			customRules: {
				"/sign-in/email": { window: 60, max: SIGN_IN_RATE_LIMIT_MAX },
				"/sign-in/magic-link": { window: 60, max: SIGN_IN_RATE_LIMIT_MAX },
				"/forget-password": { window: 60 * 5, max: 3 },
				"/request-password-reset": { window: 60 * 5, max: 3 },
				// Resend is offered to signed-out visitors on /verify-email (a sign-in
				// blocked on verification never gets a session), so it needs the same
				// treatment as the other unauthenticated send-me-an-email endpoints.
				"/send-verification-email": { window: 60 * 5, max: 3 },
			},
		},

		hooks: {
			before: createAuthMiddleware(async (ctx) => {
				// Every administrative mutation goes through a server action so it
				// carries an audit entry and the last-administrator rule; the admin
				// plugin is kept only for its sign-in ban check and access control, so
				// its HTTP surface is closed off entirely.
				if (ctx.path.startsWith("/admin/")) {
					throw new APIError("NOT_FOUND");
				}

				// Magic-link signup is disabled, but Better Auth still emails the link
				// and only rejects on click. Block unknown addresses before send so
				// unregistered users never receive a dead-end sign-in link. (JUS-78)
				if (ctx.path === "/sign-in/magic-link") {
					const email = String(
						(ctx.body as { email?: string })?.email ?? "",
					).toLowerCase();
					if (!email) return;
					const existing = await ctx.context.adapter.findOne({
						model: "user",
						where: [{ field: "email", value: email }],
					});
					if (!existing) {
						throw APIError.from("BAD_REQUEST", {
							message:
								"No account found for that email. Create an account first, then use the magic link to sign in.",
							code: "USER_NOT_FOUND",
						});
					}
					return;
				}

				// Reject sign-in for a locked account before credentials are checked.
				if (ctx.path !== "/sign-in/email") return;
				const email = String(
					(ctx.body as { email?: string })?.email ?? "",
				).toLowerCase();
				if (!email) return;
				const user = (await ctx.context.adapter.findOne({
					model: "user",
					where: [{ field: "email", value: email }],
				})) as { lockedUntil?: Date | string | null } | null;
				if (user?.lockedUntil && new Date(user.lockedUntil) > new Date()) {
					// A lockout is not a block — the client branches on this code to
					// tell the two apart (the admin plugin uses BANNED_USER).
					throw APIError.from("FORBIDDEN", {
						message:
							"This account is temporarily locked after too many failed sign-in attempts. Try again later or reset your password.",
						code: "ACCOUNT_LOCKED",
					});
				}
			}),
			// Count consecutive wrong-password attempts toward lockout. Successful
			// sign-ins clear the counter in session.create (below) — every auth
			// path that issues a session goes through that hook (JUS-77).
			after: createAuthMiddleware(async (ctx) => {
				if (ctx.path !== "/sign-in/email") return;
				// A new session means credentials were accepted; never treat that
				// as a failure (instanceof APIError is brittle across package copies).
				if (ctx.context.newSession) return;

				const returned = ctx.context.returned;
				if (!isAPIError(returned)) return;
				// Only bad credentials advance the lockout counter — not lock/
				// block/unverified responses, which would otherwise stack unfairly.
				if (returned.body?.code !== "INVALID_EMAIL_OR_PASSWORD") return;

				const email = String(
					(ctx.body as { email?: string })?.email ?? "",
				).toLowerCase();
				if (!email) return;
				const user = (await ctx.context.adapter.findOne({
					model: "user",
					where: [{ field: "email", value: email }],
				})) as {
					id: string;
					failedLoginAttempts?: number | null;
				} | null;
				if (!user) return;

				const attempts = (user.failedLoginAttempts ?? 0) + 1;
				const reached = attempts >= MAX_FAILED_ATTEMPTS;
				await ctx.context.adapter.update({
					model: "user",
					where: [{ field: "id", value: user.id }],
					update: {
						failedLoginAttempts: reached ? 0 : attempts,
						lockedUntil: reached
							? new Date(Date.now() + LOCK_DURATION_MS)
							: null,
					},
				});
			}),
		},

		// Session creation is the single point every sign-in passes through
		// (password and magic link alike), so the last-sign-in stamp and the
		// lockout-counter reset live here. These merge with the admin plugin's
		// own session.create.before ban check rather than replacing it — every
		// registered hook for a model runs.
		databaseHooks: {
			session: {
				create: {
					after: async (session, ctx) => {
						await ctx?.context.internalAdapter.updateUser(session.userId, {
							lastSignInAt: new Date(),
							failedLoginAttempts: 0,
							lockedUntil: null,
						});
						// Attach any donations this person made as a guest, now that an
						// account exists to attach them to. Donating requires no account, so
						// this is how "create an account to track your giving" actually
						// delivers — matched on a *verified* email only, see
						// claimGuestDonations. Failure must never block a sign-in: the
						// donations are already recorded and a later sign-in will retry.
						try {
							await claimGuestDonations(session.userId);
						} catch (error) {
							console.error("[auth] claimGuestDonations failed", error);
						}
					},
				},
			},
		},

		plugins: [
			admin({
				ac: accessControl,
				roles,
				defaultRole: DEFAULT_ROLE,
				adminRoles: ["administrator"],
				bannedUserMessage:
					"This account has been blocked. Contact support if you believe this is a mistake.",
			}),
			magicLink({
				// Magic link is a returning-user sign-in convenience, not a signup
				// path — accounts are created via the password form so we always
				// capture a name. An unknown email that clicks the link is rejected
				// (no silent passwordless account creation). The before-hook on
				// /sign-in/magic-link also refuses unknown emails so no link is sent.
				disableSignUp: true,
				sendMagicLink: async ({ email, url }, ctx) => {
					const name = (ctx?.body as { name?: string })?.name;
					await sendMagicLinkEmail({ to: email, url, name });
				},
			}),
			nextCookies(),
		],

		secret: env.BETTER_AUTH_SECRET,
		baseURL: env.BETTER_AUTH_URL,
	});
}

export const auth = createAuth();

export * from "./rbac";
