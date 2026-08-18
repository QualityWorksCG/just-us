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
	 * Every state the attorney says they are admitted in — at least one for the
	 * roles in `JURISDICTION_ROLES`, ignored for the rest. The caller validates each
	 * against the state allowlist.
	 *
	 * A list rather than a single value because a licence is per state and an
	 * attorney can hold several. The first becomes the primary
	 * (`User.jurisdiction`), and all of them become `AttorneyAdmission` rows — which
	 * is what every matching gate reads.
	 */
	jurisdictions?: string[];
	firmName?: string;
	barNumber?: string;
};

/**
 * Persist a user's one-time onboarding choices. The role is validated against
 * the self-selectable allowlist here (server-side) so onboarding can never grant
 * administrator or an unknown role. Attorney profile fields (firm, bar number)
 * are only stored when the chosen role is attorney, and jurisdictions only for the
 * roles that need them, so a role switch can never leave a stale value behind.
 * (JUS-12)
 *
 * The states are written twice on purpose, and to different ends: an
 * `AttorneyAdmission` row each, which is what decides the cases they may take, and
 * the first of them onto `User.jurisdiction`, which is the label the directory
 * leads with. All in one transaction — an attorney who is onboarded but holds no
 * admissions can see no queue at all, so the two must not be able to come apart.
 *
 * Every admission starts unverified. Onboarding is where an attorney tells us
 * where they practise; the bar check is what establishes it.
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
	// Deduplicated and order-preserving, so "the first one" is the first one they
	// picked and a double-submitted state cannot break the unique index.
	const states = requiresJurisdiction(role)
		? [...new Set((input.jurisdictions ?? []).filter(Boolean))]
		: [];

	await prisma.$transaction(async (tx) => {
		await tx.user.update({
			where: { id: userId },
			data: {
				role,
				onboarded: true,
				jurisdiction: states[0] ?? null,
				firmName: isAttorney ? (input.firmName ?? null) : null,
				barNumber: isAttorney ? (input.barNumber ?? null) : null,
			},
		});

		// A role switch must not leave admissions behind for a role that has none,
		// and re-running onboarding must not duplicate rows.
		await tx.attorneyAdmission.deleteMany({
			where: { userId, state: { notIn: states } },
		});
		for (const state of states) {
			const existing = await tx.attorneyAdmission.findUnique({
				where: { userId_state: { userId, state } },
				select: { id: true },
			});
			if (!existing) {
				await tx.attorneyAdmission.create({
					data: {
						userId,
						state,
						barNumber: isAttorney ? (input.barNumber ?? null) : null,
					},
				});
			}
		}
	});

	return { role };
}
