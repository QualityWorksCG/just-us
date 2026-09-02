import prisma from "@just-us/db";

import { auth } from "./index";
import {
	DEFAULT_ROLE,
	isRole,
	type Role,
	requiresJurisdiction,
	SELF_SIGNUP_ROLES,
} from "./rbac";

export type SignUpInput = {
	name: string;
	email: string;
	password: string;
};

/**
 * Create an account with email/password. Role is NOT chosen here — new users
 * start on the default role and pick their real role during onboarding. A
 * verification email is sent as part of `signUpEmail`; no session is issued
 * until the address is confirmed. (JUS-8 / JUS-11)
 */
export async function signUpBasic(input: SignUpInput, requestHeaders: Headers) {
	await auth.api.signUpEmail({
		body: {
			name: input.name,
			email: input.email,
			password: input.password,
			// Where the verification link lands after auto sign-in. Sends the user
			// into the app; the onboarding guard routes them to /onboarding.
			callbackURL: "/dashboard",
		},
		headers: requestHeaders,
		asResponse: false,
	});
}

export type OnboardingInput = {
	role: string;
	/**
	 * Required for the roles in `JURISDICTION_ROLES` (plaintiff, attorney) and
	 * ignored for the rest — the caller validates it against the state allowlist.
	 */
	jurisdiction?: string;
	firmName?: string;
	barNumber?: string;
};

/**
 * Persist a user's one-time onboarding choices. The role is validated against
 * the self-selectable allowlist here (server-side) so onboarding can never grant
 * administrator or an unknown role. Attorney profile fields (firm, bar number)
 * are only stored when the chosen role is attorney, and jurisdiction only for the
 * roles that need it, so a role switch can never leave a stale value behind.
 * (JUS-12)
 */
export async function completeUserOnboarding(
	userId: string,
	input: OnboardingInput,
) {
	const role: Role =
		isRole(input.role) &&
		(SELF_SIGNUP_ROLES as readonly string[]).includes(input.role)
			? input.role
			: DEFAULT_ROLE;
	const isAttorney = role === "attorney";

	await prisma.user.update({
		where: { id: userId },
		data: {
			role,
			onboarded: true,
			jurisdiction: requiresJurisdiction(role)
				? (input.jurisdiction ?? null)
				: null,
			firmName: isAttorney ? (input.firmName ?? null) : null,
			barNumber: isAttorney ? (input.barNumber ?? null) : null,
		},
	});

	return { role };
}
