"use server";

import { bindCasePayout } from "@just-us/db/payouts";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireRole } from "@/lib/auth-server";

/**
 * Binding a case to its payout destination (donations).
 *
 * Plaintiff-only: the case owner decides who receives, because it is their case
 * and their fee arrangement. An attorney cannot point a case at their own account.
 */

const inputSchema = z.object({
	caseId: z.string().min(1),
	recipient: z.enum(["plaintiff", "attorney"]),
});

/** Human wording for each refusal `bindCasePayout` can return. */
const REASONS: Record<string, string> = {
	case_not_found: "That case couldn't be found.",
	already_live:
		"This case is already raising with a recipient set, so it's locked. Donors were shown who receives their money before they gave.",
	no_account:
		"That recipient hasn't finished payout setup yet. Ask them to complete it, then try again.",
	no_attorney_matched:
		"No attorney is matched to this case yet, so they can't be the recipient.",
};

export async function bindCasePayoutAction(
	input: z.input<typeof inputSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
	const { session } = await requireRole("plaintiff");
	const parsed = inputSchema.safeParse(input);
	if (!parsed.success)
		return { ok: false, error: "That selection isn't valid." };

	const result = await bindCasePayout({
		caseId: parsed.data.caseId,
		// Taken from the session, never from the form — otherwise a caller could
		// bind someone else's case by passing their id.
		ownerId: session.user.id,
		recipient: parsed.data.recipient,
	});

	if (!result.ok) {
		return {
			ok: false,
			error: REASONS[result.reason] ?? "Couldn't set the payout recipient.",
		};
	}

	revalidatePath(`/my-cases/${parsed.data.caseId}`);
	return { ok: true };
}
