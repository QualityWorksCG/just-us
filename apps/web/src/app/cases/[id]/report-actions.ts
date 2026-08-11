"use server";

import { reportTarget } from "@just-us/db/moderation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getSession } from "@/lib/auth-server";

/**
 * The public "report this campaign" action (Reg. & Ops §3–4).
 *
 * Open to anyone — a report needs no account, because the people best placed to
 * spot a problem are often not signed in. It records a Moderation Flag routed to
 * the admin queue; it does not itself hide anything. A signed-in reporter is
 * attributed (so repeat abuse is visible to admins); an anonymous one is not.
 *
 * `targetType` is "case" or "update"; the flag is threshold-held in the data
 * layer, so a single report never takes a live campaign down on its own.
 */
const reportSchema = z.object({
	targetType: z.enum(["case", "update"]),
	targetId: z.string().min(1),
	reason: z.string().trim().min(5, "Tell us what's wrong.").max(2000),
});

export type ReportActionResult = { ok: true } | { ok: false; error: string };

export async function reportCampaignAction(
	input: unknown,
): Promise<ReportActionResult> {
	const parsed = reportSchema.safeParse(input);
	if (!parsed.success) {
		return {
			ok: false,
			error:
				parsed.error.issues[0]?.message ?? "Add a short reason for the report.",
		};
	}

	// Attribute the report to a signed-in reporter when there is one; anonymous
	// reports are allowed and simply carry no reporter id.
	const session = await getSession();

	const res = await reportTarget({
		targetType: parsed.data.targetType,
		targetId: parsed.data.targetId,
		reason: parsed.data.reason,
		reporterId: session?.user.id ?? null,
	});
	if (!res.ok) {
		return { ok: false, error: "We couldn't find that to report." };
	}

	// If the report tipped the target into a hold, the public page should stop
	// showing it on next load.
	revalidatePath(`/cases/${parsed.data.targetId}`);
	revalidatePath(`/discover/${parsed.data.targetId}`);
	return { ok: true };
}
