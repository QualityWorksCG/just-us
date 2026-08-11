// Shared donor-facing case view model + mapper. Kept in a plain module (not the
// client card) so server pages can import the mapper without a client boundary.

export type DonorCase = {
	id: string;
	title: string;
	category: string;
	location: string;
	status: string;
	cover: string | null;
	owner: string;
	/** The plaintiff's uploaded profile photo (public Blob URL), or null for initials. */
	ownerImage: string | null;
	attorney: string | null;
	/** The matched attorney's photo, or null — an invited (unmatched) attorney has none. */
	attorneyImage: string | null;
	raised: number;
	goal: number;
	donors: number;
};

type CaseRow = {
	id: string;
	title: string;
	category: string;
	location: string;
	status: string;
	coverImageUrl: string | null;
	attorneyName: string | null;
	raisedCents: number;
	goalCents: number;
	donorsCount: number;
	owner?: { name: string | null; image?: string | null } | null;
	// The matched attorney, when one exists — the only attorney with an account
	// (and so a photo). A plaintiff-named/invited attorney has no match.
	match?: { attorney: { image: string | null } } | null;
};

export function toDonorCase(c: CaseRow): DonorCase {
	return {
		id: c.id,
		title: c.title || "Untitled case",
		category: c.category,
		location: c.location,
		status: c.status,
		cover: c.coverImageUrl,
		owner: c.owner?.name ?? "A plaintiff",
		ownerImage: c.owner?.image ?? null,
		attorney: c.attorneyName,
		attorneyImage: c.match?.attorney?.image ?? null,
		raised: c.raisedCents / 100,
		goal: c.goalCents / 100,
		donors: c.donorsCount,
	};
}
