"use server";

import { expressInterest, withdrawInterest } from "@just-us/db/representation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireRole } from "@/lib/auth-server";
import { notifyExpressionOfInterest } from "@/lib/notify";

/**
 * The attorney side of the Seeking Representation queue (JUS-25).
 *
 * Expressing interest is the *only* thing an attorney can do to a case they have
 * no relationship with. There is deliberately no action here that sends anything
 * to the plaintiff — no message, no note, no contact request — because the
 * plaintiff must be the one to initiate contact after seeing the interest on
 * their dashboard. That rule is enforced at this boundary rather than by leaving
 * a field out of a form:
 *
 *   - the schema is `.strict()`, so a hand-rolled payload carrying a `message`
 *     is rejected outright instead of quietly ignored, and
 *   - the only parameter is a case id. There is nothing to attach a message to
 *     even if the schema let one through.
 */
const expressInterestSchema = z.object({ caseId: z.string().min(1) }).strict();

export type ExpressInterestActionResult =
	| { ok: true }
	| { ok: false; error: string };

/** Record this attorney's interest in representing a seeking case. */
export async function expressInterestAction(
	input: unknown,
): Promise<ExpressInterestActionResult> {
	const { session } = await requireRole("attorney");

	const parsed = expressInterestSchema.safeParse(input);
	if (!parsed.success) {
		return { ok: false, error: "Couldn't record your interest." };
	}

	try {
		const res = await expressInterest(parsed.data.caseId, session.user.id);
		if (!res.ok) {
			return { ok: false, error: FAILURE_MESSAGES[res.reason] };
		}
		// Tell the plaintiff interest arrived (in-app + email). This is a
		// system-generated nudge to check their dashboard — it carries only the
		// attorney's name, no attorney-authored message, so the "no channel until
		// the plaintiff reaches out" rule above still holds.
		await notifyExpressionOfInterest(res.interestId).catch(() => {});
		// The queue list and the dashboard's expressions/caseload both read this.
		revalidatePath("/queue");
		revalidatePath("/home");
		return { ok: true };
	} catch {
		return {
			ok: false,
			error: "Couldn't record your interest. Please try again.",
		};
	}
}

const withdrawInterestSchema = z.object({ caseId: z.string().min(1) }).strict();

/**
 * Withdraw this attorney's expression of interest — the undo for an accidental
 * tap on the queue's Express interest CTA. Refused once the plaintiff has already
 * taken the interest forward, since that is a match to unwind, not a click to take
 * back.
 */
export async function withdrawInterestAction(
	input: unknown,
): Promise<ExpressInterestActionResult> {
	const { session } = await requireRole("attorney");

	const parsed = withdrawInterestSchema.safeParse(input);
	if (!parsed.success) {
		return { ok: false, error: "Couldn't withdraw your interest." };
	}

	try {
		const res = await withdrawInterest(parsed.data.caseId, session.user.id);
		if (!res.ok) {
			return { ok: false, error: WITHDRAW_FAILURE_MESSAGES[res.reason] };
		}
		revalidatePath("/queue");
		revalidatePath("/home");
		return { ok: true };
	} catch {
		return {
			ok: false,
			error: "Couldn't withdraw your interest. Please try again.",
		};
	}
}

const WITHDRAW_FAILURE_MESSAGES = {
	not_found:
		"There's no expression of interest to withdraw — it may already be gone.",
	already_matched:
		"This plaintiff has already taken your interest forward, so it can't be withdrawn here.",
} as const;

const FAILURE_MESSAGES = {
	not_verified:
		"Your bar standing has to be verified before you can express interest. Verify it on your directory profile, then try again.",
	// The queue already withholds other states' cases, so this is only reached from
	// a stale tab or a hand-made request — but it says what to do about it anyway,
	// because the honest fix is a real one.
	not_admitted:
		"You can only put yourself forward for cases in a state you're admitted in. Add that state on your directory profile and verify your bar standing there.",
	unavailable:
		"This case is no longer seeking representation. It's been matched, funded, or withdrawn.",
	already_expressed: "You've already expressed interest in this case.",
} as const;
