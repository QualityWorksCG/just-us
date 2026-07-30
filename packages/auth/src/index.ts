import { createPrismaClient } from "@just-us/db";
import { env } from "@just-us/env/server";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError, createAuthMiddleware } from "better-auth/api";
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
				"/sign-in/email": { window: 60, max: MAX_FAILED_ATTEMPTS },
				"/sign-in/magic-link": { window: 60, max: MAX_FAILED_ATTEMPTS },
				"/forget-password": { window: 60 * 5, max: 3 },
				"/request-password-reset": { window: 60 * 5, max: 3 },
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
			// Track failed attempts and lock the account after the threshold; reset
			// the counter on a successful sign-in.
			after: createAuthMiddleware(async (ctx) => {
				if (ctx.path !== "/sign-in/email") return;
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
					lockedUntil?: Date | string | null;
				} | null;
				if (!user) return;

				const failed = ctx.context.returned instanceof APIError;
				if (failed) {
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
				} else if (user.failedLoginAttempts || user.lockedUntil) {
					await ctx.context.adapter.update({
						model: "user",
						where: [{ field: "id", value: user.id }],
						update: { failedLoginAttempts: 0, lockedUntil: null },
					});
				}
			}),
		},

		// Session creation is the single point every sign-in passes through
		// (password and magic link alike), so the last-sign-in stamp lives here.
		// These merge with the admin plugin's own session.create.before ban check
		// rather than replacing it — every registered hook for a model runs.
		databaseHooks: {
			session: {
				create: {
					after: async (session, ctx) => {
						await ctx?.context.internalAdapter.updateUser(session.userId, {
							lastSignInAt: new Date(),
						});
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
				// (no silent passwordless account creation).
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
