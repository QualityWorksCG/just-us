"use server";

import { createCase } from "@just-us/db/cases";
import { z } from "zod";

import { requireRole } from "@/lib/auth-server";

const createCaseSchema = z.object({
	title: z.string().trim().min(3, "Give your case a title."),
	category: z.string().trim().min(1, "Choose a category."),
	location: z.string().trim().min(1, "Choose a location."),
	summary: z.string().trim().min(1, "Add a one-line summary."),
	story: z.string().trim().min(10, "Tell your story."),
	// Whole cents; must be a positive integer.
	goalCents: z.number().int().positive("Enter the agreed fee."),
	attorney: z
		.object({
			name: z.string().optional(),
			firm: z.string().optional(),
			area: z.string().optional(),
			location: z.string().optional(),
		})
		.nullish(),
	evidence: z
		.array(z.object({ name: z.string(), size: z.number() }))
		.optional(),
});

export type CreateCaseInput = z.infer<typeof createCaseSchema>;

export type CreateCaseResult =
	| { ok: true; caseId: string }
	| { ok: false; error: string; fieldErrors?: Record<string, string> };

export async function createCaseAction(
	input: CreateCaseInput,
): Promise<CreateCaseResult> {
	// Only a plaintiff may submit a case; verified session is implied.
	const { session } = await requireRole("plaintiff");

	const parsed = createCaseSchema.safeParse(input);
	if (!parsed.success) {
		const fieldErrors: Record<string, string> = {};
		for (const issue of parsed.error.issues) {
			const key = issue.path[0];
			if (typeof key === "string" && !fieldErrors[key])
				fieldErrors[key] = issue.message;
		}
		return {
			ok: false,
			error: "Please fix the highlighted fields.",
			fieldErrors,
		};
	}

	try {
		const created = await createCase({
			ownerId: session.user.id,
			title: parsed.data.title,
			category: parsed.data.category,
			location: parsed.data.location,
			summary: parsed.data.summary,
			story: parsed.data.story,
			goalCents: parsed.data.goalCents,
			attorney: parsed.data.attorney ?? null,
			evidence: parsed.data.evidence,
		});
		return { ok: true, caseId: created.id };
	} catch {
		return {
			ok: false,
			error: "Could not create your case. Please try again.",
		};
	}
}
