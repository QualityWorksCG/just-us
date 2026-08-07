/**
 * The attorney bar-standing badge, as a pill. Shared by the admin users table
 * and the user-detail screen so a lawyer reads the same status in both places
 * (JUS-13).
 *
 * Distinct from email verification: a lawyer can have a verified email and still
 * need their bar standing reviewed, which is why the table can't lean on
 * `emailVerified` for them. `unverified` (and a missing profile) is deliberately
 * an action colour, not a neutral grey — it's a to-do for the administrator, not
 * a settled state.
 */
export type VerificationBadge = { text: string; cls: string; dot: string };

export function verificationBadge(
	status: string | null | undefined,
): VerificationBadge {
	switch (status) {
		case "verified":
			return {
				text: "Verified",
				cls: "bg-green-soft text-green-deep",
				dot: "bg-success",
			};
		case "pending":
			return {
				text: "Check running",
				cls: "bg-brass-wash text-brass-deep",
				dot: "bg-brass-deep",
			};
		case "needs_review":
			return {
				text: "Needs review",
				cls: "bg-warn/10 text-warn-deep",
				dot: "bg-warn-deep",
			};
		case "rejected":
			return {
				text: "Rejected",
				cls: "bg-danger/10 text-danger",
				dot: "bg-danger",
			};
		default:
			// unverified, or no profile row yet — needs the administrator to act.
			return {
				text: "Needs action",
				cls: "bg-warn/10 text-warn-deep",
				dot: "bg-warn-deep",
			};
	}
}
