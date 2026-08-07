/**
 * Donation fee arithmetic.
 *
 * Pure functions, no environment and no Stripe import — **safe to import from
 * client components**. The fee rate itself lives in `STRIPE_PLATFORM_FEE_BPS`,
 * which only the server can read, so a server component resolves the rate (see
 * `platformFeeBps` in the package root) and passes it into these functions. That
 * is the same split `@just-us/flags` uses: `./registry` is pure data, the
 * package root touches the database.
 *
 * The point of centralising this is that the donor-facing breakdown, the amount
 * sent to Stripe as `application_fee_amount`, and the `feeCents` stored on the
 * donation row are all the same number by construction. The public copy promises
 * the fee "shown to the cent" before confirming (terms §4, the landing-page fee
 * breakdown), which is only true if one function produces all three.
 */

const BPS_DIVISOR = 10_000;

export type DonationBreakdown = {
	/** What the donor is charged. */
	amountCents: number;
	/** JustUs's platform fee, sent to Stripe as `application_fee_amount`. */
	feeCents: number;
	/** What lands in the connected account. */
	netCents: number;
	/** The rate used, so a stored breakdown stays explainable after a rate change. */
	feeBps: number;
};

/**
 * The platform fee on `amountCents` at `feeBps` basis points.
 *
 * Rounds half-up to the cent, and never exceeds the donation itself — Stripe
 * rejects an `application_fee_amount` larger than the charge, and a fee that ate
 * the whole gift would be wrong long before Stripe complained.
 */
export function feeCentsAtBps(amountCents: number, feeBps: number): number {
	assertWholeCents(amountCents, "amountCents");
	if (!Number.isInteger(feeBps) || feeBps < 0 || feeBps > BPS_DIVISOR) {
		throw new RangeError(
			`feeBps must be an integer between 0 and ${BPS_DIVISOR}, got ${feeBps}`,
		);
	}
	const fee = Math.round((amountCents * feeBps) / BPS_DIVISOR);
	return Math.min(fee, amountCents);
}

/** The full donor-facing split of a donation at `feeBps`. */
export function breakdownAtBps(
	amountCents: number,
	feeBps: number,
): DonationBreakdown {
	const feeCents = feeCentsAtBps(amountCents, feeBps);
	return { amountCents, feeCents, netCents: amountCents - feeCents, feeBps };
}

/**
 * The donation amount at which the platform fee exactly covers Stripe's
 * processing fee, in cents.
 *
 * Worth surfacing rather than burying: on a Connect destination charge without
 * `on_behalf_of`, Stripe's fee is deducted from *our* application fee, not from
 * the connected account's transfer. That is what makes the published "$100 in →
 * $95 to the attorney" math true — but it also means every donation below this
 * threshold costs JustUs more to process than the fee collects. At 5% against
 * 2.9% + 30¢ the break-even is $14.29.
 *
 * Returns `Infinity` when the platform rate can never cover the processor rate.
 */
export function feeBreakEvenCents(
	feeBps: number,
	processor: { percentBps: number; fixedCents: number },
): number {
	const marginBps = feeBps - processor.percentBps;
	if (marginBps <= 0) return Number.POSITIVE_INFINITY;
	return Math.ceil((processor.fixedCents * BPS_DIVISOR) / marginBps);
}

/** Stripe's standard US card pricing, for use with `feeBreakEvenCents`. */
export const STRIPE_US_CARD_PRICING = {
	percentBps: 290,
	fixedCents: 30,
} as const;

/**
 * Ceiling on a single donation, in cents — Stripe's own per-charge limit for
 * card payments ($999,999.99). Not a product policy: a validator that only
 * checks the floor lets a fat-fingered or hostile amount through to Stripe and
 * turns a clear rejection into an opaque API error.
 */
export const MAX_DONATION_CENTS = 99_999_999;

export type DonationAmountRejection =
	| "not_whole_cents"
	| "below_minimum"
	| "above_maximum";

export type DonationAmountCheck =
	| { ok: true }
	| { ok: false; reason: DonationAmountRejection; message: string };

/**
 * Whether an amount may be donated, given the configured floor.
 *
 * Returns a result rather than throwing, because both callers want to *render*
 * the outcome: the amount form shows it inline as the donor types, and the
 * checkout route returns it as a 400. The message is produced here so those two
 * can never disagree about what the floor is or how it's worded — the server is
 * the authority on the amount, and the copy should come from the same place as
 * the rule.
 *
 * Pure: the caller supplies `minCents` (the server reads it from
 * `STRIPE_MIN_DONATION_CENTS`), so this stays importable from client components.
 */
export function checkDonationAmount(
	amountCents: number,
	minCents: number,
): DonationAmountCheck {
	if (!Number.isInteger(amountCents) || amountCents < 0) {
		return {
			ok: false,
			reason: "not_whole_cents",
			message: "Enter a whole dollar-and-cents amount.",
		};
	}
	if (amountCents < minCents) {
		return {
			ok: false,
			reason: "below_minimum",
			message: `The minimum donation is ${formatUsd(minCents)}.`,
		};
	}
	if (amountCents > MAX_DONATION_CENTS) {
		return {
			ok: false,
			reason: "above_maximum",
			message: `A single donation cannot exceed ${formatUsd(MAX_DONATION_CENTS)}.`,
		};
	}
	return { ok: true };
}

/**
 * Whether the configured floor actually covers the processor's cut.
 *
 * A floor and a fee rate that were consistent when chosen stop being consistent
 * the moment either moves, and the relationship is far more sensitive than it
 * looks: drop the platform fee from 5% to 3% and break-even leaps from $14.29 to
 * **$300.00**, because the margin over Stripe's 2.9% collapses from 2.1 points to
 * 0.1. At or below 2.9% no donation of any size covers the fixed 30¢, and this
 * returns `Infinity`. This makes that drift detectable instead of silent — surface
 * it on an admin screen or assert it at startup rather than rediscovering it in a
 * reconciliation report.
 */
export function minimumCoversProcessorFee(
	minCents: number,
	feeBps: number,
	processor: {
		percentBps: number;
		fixedCents: number;
	} = STRIPE_US_CARD_PRICING,
): { ok: boolean; breakEvenCents: number } {
	const breakEvenCents = feeBreakEvenCents(feeBps, processor);
	return { ok: minCents >= breakEvenCents, breakEvenCents };
}

/** Cents as plain USD, for the messages above. */
function formatUsd(cents: number): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
	}).format(cents / 100);
}

function assertWholeCents(value: number, label: string): void {
	if (!Number.isInteger(value) || value < 0) {
		throw new RangeError(
			`${label} must be a non-negative integer number of cents, got ${value}`,
		);
	}
}
