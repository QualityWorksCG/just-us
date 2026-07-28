import prisma from "./index";

export type CaseAttorney = {
	name?: string;
	firm?: string;
	area?: string;
	location?: string;
};

export type CreateCaseInput = {
	ownerId: string;
	title: string;
	category: string;
	location: string;
	summary: string;
	story: string;
	/** Agreed attorney fee — the funding goal — in whole cents. */
	goalCents: number;
	attorney?: CaseAttorney | null;
	/** Uploaded evidence metadata; actual files aren't stored yet. */
	evidence?: { name: string; size: number }[];
};

/**
 * Persist a new case. Cases start in `pending_review` — nothing is public until
 * a person reviews it (JUS trust model). Returns the new id and status.
 */
export async function createCase(input: CreateCaseInput) {
	return prisma.case.create({
		data: {
			ownerId: input.ownerId,
			title: input.title,
			category: input.category,
			location: input.location,
			summary: input.summary,
			story: input.story,
			goalCents: input.goalCents,
			attorneyName: input.attorney?.name ?? null,
			attorneyFirm: input.attorney?.firm ?? null,
			attorneyArea: input.attorney?.area ?? null,
			attorneyLocation: input.attorney?.location ?? null,
			evidence: input.evidence?.length ? input.evidence : undefined,
		},
		select: { id: true, status: true },
	});
}

/** A plaintiff's own cases, newest first. */
export async function listOwnedCases(ownerId: string) {
	return prisma.case.findMany({
		where: { ownerId },
		orderBy: { createdAt: "desc" },
	});
}
