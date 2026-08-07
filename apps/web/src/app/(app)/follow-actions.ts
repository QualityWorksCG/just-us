"use server";

import { followCase, unfollowCase } from "@just-us/db/follows";
import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireVerifiedSession } from "@/lib/auth-server";

const schema = z
	.object({ caseId: z.string().min(1), follow: z.boolean() })
	.strict();

export type FollowActionResult = { ok: true } | { ok: false; error: string };

/**
 * Follow or unfollow a case (JUS-33). Any signed-in, verified user may — it's a
 * public "notify me about this case", distinct from a donor's private save.
 */
export async function toggleFollowAction(
	input: unknown,
): Promise<FollowActionResult> {
	const session = await requireVerifiedSession();

	const parsed = schema.safeParse(input);
	if (!parsed.success) {
		return { ok: false, error: "Couldn't update following." };
	}

	try {
		if (parsed.data.follow) {
			await followCase(session.user.id, parsed.data.caseId);
		} else {
			await unfollowCase(session.user.id, parsed.data.caseId);
		}
		revalidatePath(`/cases/${parsed.data.caseId}` as Route);
		revalidatePath(`/discover/${parsed.data.caseId}` as Route);
		return { ok: true };
	} catch {
		return { ok: false, error: "Couldn't update following. Please try again." };
	}
}
