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
	/** Collected by Checkout. For a guest, the only name we will ever have. */
	donorName?: string | null;
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
				...(input.donorName ? { donorName: input.donorName } : {}),
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

/**
 * One donation, looked up by the Checkout Session it was created for.
 *
 * This is what the case page reads when a donor lands back on it from Stripe with
 * `session_id` in the URL. The webhook that marks the row `succeeded` and folds it
 * into the case totals is delivered out-of-band, so on the first render after a
 * payment the row may still be `pending` — the page uses this status to tell "your
 * gift is landing" from "your gift landed" instead of silently showing stale
 * totals.
 *
 * Scoped to a case id by the caller so a session id from one case cannot be used
 * to read a donation on another, and deliberately returns **no donor identity** —
 * the URL that carries a session id is shareable, and nothing here should be.
 */
export async function getDonationForCheckoutSession(input: {
	stripeCheckoutSessionId: string;
	caseId: string;
}): Promise<{ status: string; amountCents: number } | null> {
	const donation = await prisma.donation.findFirst({
		where: {
			stripeCheckoutSessionId: input.stripeCheckoutSessionId,
			caseId: input.caseId,
		},
		select: { status: true, amountCents: true },
	});
	return donation ?? null;
}

/**
 * Pending donations on a case, oldest first — the reconciliation work-list.
 *
 * A row sits here when the donor was sent to Checkout but no
 * `checkout.session.completed` has been applied. Usually that means seconds of
 * webhook lag; it can also mean the delivery was lost, or that nothing is
 * forwarding webhooks at all (every local environment without `stripe listen`).
 * Either way the money may well have moved at Stripe while the case totals say it
 * did not, so these are re-checked against Stripe on read — see
 * `syncPendingDonationsForCase` in the web app.
 *
 * `newerThanMs` skips rows too young to be worth a Stripe round-trip: the donor
 * might still be on the payment screen. `olderThanMs` bounds how far back a page
 * render will reach — anything staler is a job for reconciliation, not a page view.
 */
export async function listPendingDonationsForCase(input: {
	caseId: string;
	limit?: number;
	newerThanMs?: number;
	olderThanMs?: number;
}) {
	const now = Date.now();
	return prisma.donation.findMany({
		where: {
			caseId: input.caseId,
			status: "pending",
			createdAt: {
				...(input.newerThanMs
					? { gte: new Date(now - input.newerThanMs) }
					: {}),
				...(input.olderThanMs
					? { lte: new Date(now - input.olderThanMs) }
					: {}),
			},
		},
		orderBy: { createdAt: "asc" },
		take: input.limit ?? 5,
		select: { id: true, stripeCheckoutSessionId: true },
	});
}

/**
 * Public backers of a case, newest paid first.
 *
 * Only `succeeded` rows: a pending donation is an unfinished checkout, and listing
 * one would show a gift that may never arrive. Returns the name Checkout collected
 * and nothing else identifying — **never the email**, which is on the row for
 * receipts and claiming, not for display.
 */
export async function listCaseBackers(caseId: string, take = 8) {
	return prisma.donation.findMany({
		where: { caseId, status: "succeeded" },
		orderBy: { succeededAt: "desc" },
		take,
		select: {
			id: true,
			donorId: true,
			donorName: true,
			amountCents: true,
			succeededAt: true,
		},
	});
}

/**
 * What this donor has already given to this case — the basis for showing them
 * "you backed this case" rather than making them wonder whether it registered.
 *
 * `donorEmail` matches a donation the donor made *before* signing in, so their own
 * guest gift is recognised. The caller must only pass it for a **verified** email,
 * for the same reason `claimGuestDonations` insists on one: anyone can type another
 * person's address into Checkout, and an unverified match would report a stranger's
 * giving back to them.
 */
export async function donorSupportForCase(input: {
	caseId: string;
	donorId: string;
	/** Only when the account's email is verified; otherwise null. */
	donorEmail: string | null;
}): Promise<{ totalCents: number; count: number }> {
	const result = await prisma.donation.aggregate({
		where: {
			caseId: input.caseId,
			status: "succeeded",
			OR: [
				{ donorId: input.donorId },
				...(input.donorEmail
					? [{ donorId: null, donorEmail: input.donorEmail }]
					: []),
			],
		},
		_sum: { amountCents: true },
		_count: { _all: true },
	});
	return {
		totalCents: result._sum.amountCents ?? 0,
		count: result._count._all,
	};
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
