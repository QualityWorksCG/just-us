// Shared donor-facing case view model + mapper. Kept in a plain module (not the
// client card) so server pages can import the mapper without a client boundary.

export type DonorCase = {
	id: string;
	title: string;
	category: string;
	location: string;
	cover: string | null;
	owner: string;
	attorney: string | null;
	raised: number;
	goal: number;
	donors: number;
};

type CaseRow = {
	id: string;
	title: string;
	category: string;
	location: string;
	coverImageUrl: string | null;
	attorneyName: string | null;
	raisedCents: number;
	goalCents: number;
	donorsCount: number;
	owner?: { name: string | null } | null;
};

export function toDonorCase(c: CaseRow): DonorCase {
	return {
		id: c.id,
		title: c.title || "Untitled case",
		category: c.category,
		location: c.location,
		cover: c.coverImageUrl,
		owner: c.owner?.name ?? "A plaintiff",
		attorney: c.attorneyName,
		raised: c.raisedCents / 100,
		goal: c.goalCents / 100,
		donors: c.donorsCount,
	};
}
