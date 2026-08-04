import prisma from "./index";

/**
 * Donation ledger writes.
 *
 * `Case.raisedCents` / `Case.donorsCount` are a **cache** of this table. Every
 * write that changes a donation's status changes them in the same transaction, so
 * the public progress bar cannot drift from the ledger behind it — and that bar is
 * the number donors decide on.
 */

/**
 * Record a donation the donor has not paid for yet.
 *
 * Written before the browser is sent to Stripe Checkout, so a payment can never
 * succeed at Stripe with nothing recorded here. The row contributes nothing to
 * `raisedCents` until the webhook moves it to `succeeded`.
 */
export async function createPendingDonation(input: {
	/** Null for a guest donation — giving does not require an account. */
	donorId: string | null;
	caseId: string;
	amountCents: number;
	feeCents: number;
	netCents: number;
	stripeCheckoutSessionId: string;
	stripeAccountId: string;
	/** Unknown for a guest at this point; Checkout collects it and the webhook fills it. */
	donorEmail: string | null;
}) {
	return prisma.donation.create({
		data: {
			donorId: input.donorId,
			caseId: input.caseId,
			amountCents: input.amountCents,
			feeCents: input.feeCents,
			netCents: input.netCents,
			stripeCheckoutSessionId: input.stripeCheckoutSessionId,
			stripeAccountId: input.stripeAccountId,
			donorEmail: input.donorEmail,
			status: "pending",
		},
	});
}

/**
 * Attach a signed-in user's guest donations to their account.
 *
 * Called on sign-in. Matches on email, but **only when the account's email is
 * verified** — anyone can type someone else's address into Checkout, so an
 * unverified match would let a stranger pull another person's giving history into
 * their own. Verification is the proof of control that makes the match safe.
 *
 * Idempotent: rows already carrying a `donorId` are left alone, so a donation is
 * never reassigned away from the account that owns it.
 */
export async function claimGuestDonations(
	userId: string,
): Promise<{ claimed: number }> {
	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: { email: true, emailVerified: true },
	});
	if (!user?.emailVerified || !user.email) return { claimed: 0 };

	const result = await prisma.donation.updateMany({
		where: { donorId: null, donorEmail: user.email },
		data: { donorId: userId },
	});
	return { claimed: result.count };
}

/**
 * How to recognise "the same donor" for `donorsCount`.
 *
 * An account id when there is one; otherwise the email a guest gave. This matters
 * more than it looks: a naive `{ donorId: donation.donorId }` matches *every* guest
 * row when that value is null, so the second guest to back a case would be counted
 * as a repeat of the first and `donorsCount` would stop moving.
 *
 * Returns null when neither identifier exists, which the callers treat as a
 * distinct donor — undercounting a real person is worse than the reverse, and an
 * anonymous, email-less donation should not silently merge into someone else's.
 */
function sameDonorWhere(donation: {
	donorId: string | null;
	donorEmail: string | null;
}): { donorId: string } | { donorId: null; donorEmail: string } | null {
	if (donation.donorId) return { donorId: donation.donorId };
	if (donation.donorEmail) {
		return { donorId: null, donorEmail: donation.donorEmail };
	}
	return null;
}

/**
 * Mark a donation paid and fold it into the case totals.
 *
 * **Idempotent.** Stripe delivers `checkout.session.completed` more than once, and
 * a redelivery must not double-count. The guard is the status check inside the
 * transaction: `updateMany` with `status: "pending"` in the *where* clause returns
 * a count of 0 on a second delivery, and the increments are skipped. Doing this
 * with `update` + a prior read would leave a race between the read and the write
 * that two concurrent deliveries could both pass.
 *
 * `donorsCount` counts *donors*, not donations, so it only increments when this
 * donor has no other succeeded donation to this case.
 */
export async function markDonationSucceeded(input: {
	stripeCheckoutSessionId: string;
	stripePaymentIntentId: string | null;
	donorEmail: string | null;
}): Promise<{ applied: boolean }> {
	return prisma.$transaction(async (tx) => {
		const donation = await tx.donation.findUnique({
			where: { stripeCheckoutSessionId: input.stripeCheckoutSessionId },
			select: {
				id: true,
				caseId: true,
				donorId: true,
				donorEmail: true,
				amountCents: true,
			},
		});
		// No row means this session was not created by us — nothing to apply.
		if (!donation) return { applied: false };

		const claimed = await tx.donation.updateMany({
			where: { id: donation.id, status: "pending" },
			data: {
				status: "succeeded",
				succeededAt: new Date(),
				stripePaymentIntentId: input.stripePaymentIntentId,
				...(input.donorEmail ? { donorEmail: input.donorEmail } : {}),
			},
		});
		// Already applied by an earlier delivery of the same event.
		if (claimed.count === 0) return { applied: false };

		// Use the email the webhook just supplied, if any — for a guest it is the
		// only identifier, and it did not exist when the row was created.
		const identity = sameDonorWhere({
			donorId: donation.donorId,
			donorEmail: input.donorEmail ?? donation.donorEmail,
		});
		const priorFromDonor = identity
			? await tx.donation.count({
					where: {
						...identity,
						caseId: donation.caseId,
						status: "succeeded",
						id: { not: donation.id },
					},
				})
			: 0;

		await tx.case.update({
			where: { id: donation.caseId },
			data: {
				raisedCents: { increment: donation.amountCents },
				...(priorFromDonor === 0 ? { donorsCount: { increment: 1 } } : {}),
			},
		});
		return { applied: true };
	});
}

/**
 * Mark a pending donation failed or abandoned. Touches no case totals — a pending
 * row never contributed to them.
 */
export async function markDonationFailed(
	stripePaymentIntentId: string,
): Promise<{ applied: boolean }> {
	const result = await prisma.donation.updateMany({
		where: { stripePaymentIntentId, status: "pending" },
		data: { status: "failed" },
	});
	return { applied: result.count > 0 };
}

/**
 * Reverse a succeeded donation — a refund or a won dispute.
 *
 * Only ever applied to a `succeeded` row, so a duplicate delivery cannot decrement
 * the case twice. `donorsCount` drops only when this was the donor's last standing
 * donation to the case.
 */
export async function markDonationRefunded(
	stripePaymentIntentId: string,
): Promise<{ applied: boolean }> {
	return prisma.$transaction(async (tx) => {
		const donation = await tx.donation.findFirst({
			where: { stripePaymentIntentId, status: "succeeded" },
			select: {
				id: true,
				caseId: true,
				donorId: true,
				donorEmail: true,
				amountCents: true,
			},
		});
		if (!donation) return { applied: false };

		const claimed = await tx.donation.updateMany({
			where: { id: donation.id, status: "succeeded" },
			data: { status: "refunded", refundedAt: new Date() },
		});
		if (claimed.count === 0) return { applied: false };

		const identity = sameDonorWhere(donation);
		const stillStanding = identity
			? await tx.donation.count({
					where: {
						...identity,
						caseId: donation.caseId,
						status: "succeeded",
					},
				})
			: 0;

		await tx.case.update({
			where: { id: donation.caseId },
			data: {
				raisedCents: { decrement: donation.amountCents },
				...(stillStanding === 0 ? { donorsCount: { decrement: 1 } } : {}),
			},
		});
		return { applied: true };
	});
}

/** A donor's donations, newest first, with the case + owner name for display. */
export async function listDonations(donorId: string) {
	return prisma.donation.findMany({
		where: { donorId, case: { deletedAt: null } },
		orderBy: { createdAt: "desc" },
		include: { case: { include: { owner: { select: { name: true } } } } },
	});
}

/** Aggregate donor giving stats: total given, distinct cases, given this year. */
export async function donorStats(donorId: string, year: number) {
	const [all, thisYear, cases] = await Promise.all([
		prisma.donation.aggregate({
			where: { donorId },
			_sum: { amountCents: true },
		}),
		prisma.donation.aggregate({
			where: { donorId, createdAt: { gte: new Date(year, 0, 1) } },
			_sum: { amountCents: true },
		}),
		prisma.donation.findMany({
			where: { donorId },
			distinct: ["caseId"],
			select: { caseId: true },
		}),
	]);
	return {
		totalCents: all._sum.amountCents ?? 0,
		thisYearCents: thisYear._sum.amountCents ?? 0,
		casesBacked: cases.length,
	};
}

/** The cases a donor is currently backing (distinct), with their giving total
 *  per case and the case data. Empty until donations exist. */
export async function listBackedCases(donorId: string, take?: number) {
	const grouped = await prisma.donation.groupBy({
		by: ["caseId"],
		where: { donorId, case: { deletedAt: null } },
		_sum: { amountCents: true },
		orderBy: { _max: { createdAt: "desc" } },
		take,
	});
	if (grouped.length === 0) return [];
	const cases = await prisma.case.findMany({
		where: { id: { in: grouped.map((g) => g.caseId) } },
		include: { owner: { select: { name: true } } },
	});
	const byId = new Map(cases.map((c) => [c.id, c]));
	return grouped
		.map((g) => {
			const c = byId.get(g.caseId);
			return c ? { case: c, givenCents: g._sum.amountCents ?? 0 } : null;
		})
		.filter(
			(x): x is { case: (typeof cases)[number]; givenCents: number } => !!x,
		);
}
