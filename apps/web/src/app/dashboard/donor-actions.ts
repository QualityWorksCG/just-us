"use server";

import { saveCase, unsaveCase } from "@just-us/db/saves";
import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth-server";

export type SaveResult = { ok: true; saved: boolean } | { ok: false };

/** Toggle whether the current donor has saved a case. */
export async function toggleSaveAction(
	caseId: string,
	nextSaved: boolean,
): Promise<SaveResult> {
	const { session } = await requireRole("donor");
	try {
		if (nextSaved) await saveCase(session.user.id, caseId);
		else await unsaveCase(session.user.id, caseId);
		revalidatePath("/dashboard/saved");
		revalidatePath("/dashboard/discover");
		revalidatePath("/dashboard");
		return { ok: true, saved: nextSaved };
	} catch {
		return { ok: false };
	}
}
