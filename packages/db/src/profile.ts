import prisma from "./index";

const JURISDICTION_ROLE_SET = new Set(["plaintiff", "attorney"]);

export class ProfileAccessError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "ProfileAccessError";
	}
}

export type ProfileUpdate = {
	/** Always derived from the authenticated session by the server action. */
	userId: string;
	name: string;
	/** Undefined preserves the current state; null intentionally clears it. */
	jurisdiction?: string | null;
	/** Undefined preserves the current image; null removes it. */
	image?: string | null;
};

/** The account details displayed on the self-service settings page. */
export async function getOwnProfile(userId: string) {
	return prisma.user.findUnique({
		where: { id: userId },
		select: {
			id: true,
			name: true,
			email: true,
			emailVerified: true,
			image: true,
			role: true,
			jurisdiction: true,
			createdAt: true,
		},
	});
}

/** Updates only the row identified by the signed-in user's id. */
export async function updateOwnProfile(input: ProfileUpdate) {
	return prisma.$transaction(async (tx) => {
		const current = await tx.user.findUnique({
			where: { id: input.userId },
			select: { id: true, role: true, jurisdiction: true, image: true },
		});

		if (!current) {
			throw new ProfileAccessError("Your account could not be found.");
		}

		if (
			input.jurisdiction !== undefined &&
			!JURISDICTION_ROLE_SET.has(current.role)
		) {
			throw new ProfileAccessError(
				"Jurisdiction is not available for this account type.",
			);
		}

		const profile = await tx.user.update({
			where: { id: input.userId },
			data: {
				name: input.name,
				...(input.jurisdiction !== undefined
					? { jurisdiction: input.jurisdiction }
					: {}),
				...(input.image !== undefined ? { image: input.image } : {}),
			},
			select: {
				id: true,
				name: true,
				image: true,
				jurisdiction: true,
			},
		});

		return {
			profile,
			previousImage: current.image,
		};
	});
}
