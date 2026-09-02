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
 *
 * **Product model:** the amount the donor picks is what goes to the case. The
 * platform fee is added on top, so "$100" means $100 to the firm and the donor
 * pays $100 + fee. Stripe's card processing fee is still taken from JustUs's
 * application fee (destination charge without `on_behalf_of`), not from the
 * firm's transfer.
 */

const BPS_DIVISOR = 10_000;

export type DonationBreakdown = {
	/** What the donor is charged (gift + platform fee). */
	amountCents: number;
	/** JustUs's platform fee, sent to Stripe as `application_fee_amount`. */
	feeCents: number;
	/** What lands in the connected account — the amount the donor selected. */
	netCents: number;
	/** The rate used, so a stored breakdown stays explainable after a rate change. */
	feeBps: number;
};

/**
 * The platform fee on a gift of `giftCents` at `feeBps` basis points.
 *
 * Rounds half-up to the cent, and never exceeds the gift itself — Stripe
 * rejects an `application_fee_amount` larger than the charge, and a fee that ate
 * the whole gift would be wrong long before Stripe complained.
 */
export function feeCentsAtBps(giftCents: number, feeBps: number): number {
	assertWholeCents(giftCents, "giftCents");
	if (!Number.isInteger(feeBps) || feeBps < 0 || feeBps > BPS_DIVISOR) {
		throw new RangeError(
			`feeBps must be an integer between 0 and ${BPS_DIVISOR}, got ${feeBps}`,
		);
	}
	const fee = Math.round((giftCents * feeBps) / BPS_DIVISOR);
	return Math.min(fee, giftCents);
}

/**
 * The full donor-facing split when the donor selects a gift of `giftCents`.
 *
 * `netCents` is the selected gift (to the case). `feeCents` is added on top.
 * `amountCents` is what Checkout charges.
 */
export function breakdownAtBps(
	giftCents: number,
	feeBps: number,
): DonationBreakdown {
	const feeCents = feeCentsAtBps(giftCents, feeBps);
	return {
		amountCents: giftCents + feeCents,
		feeCents,
		netCents: giftCents,
		feeBps,
	};
}

/**
 * The donation amount at which the platform fee exactly covers Stripe's
 * processing fee, in cents.
 *
 * Worth surfacing rather than burying: on a Connect destination charge without
 * `on_behalf_of`, Stripe's fee is deducted from *our* application fee, not from
 * the connected account's transfer. That is what makes "select $100 → $100 to
 * the attorney" hold for the firm — but it also means every donation below this
 * threshold costs JustUs more to process than the fee collects. At 5% against
 * 2.9% + 30¢ the break-even gift is a little above $14 (fee is on the gift;
 * Stripe is on gift + fee).
 *
 * Returns `Infinity` when the platform rate can never cover the processor rate.
 */
export function feeBreakEvenCents(
	feeBps: number,
	processor: { percentBps: number; fixedCents: number },
): number {
	// Solve fee(gift) >= stripe(gift + fee(gift)) for the smallest whole-cent gift.
	// fee = round(gift * feeBps / 10000); charge = gift + fee;
	// stripe ≈ charge * processor.percentBps / 10000 + fixed.
	// Approximate with continuous math, then ceil — callers use this as a floor check.
	const feeRate = feeBps / BPS_DIVISOR;
	const procRate = processor.percentBps / BPS_DIVISOR;
	// gift * feeRate >= (gift * (1 + feeRate)) * procRate + fixed
	// gift * (feeRate - (1 + feeRate) * procRate) >= fixed
	const margin = feeRate - (1 + feeRate) * procRate;
	if (margin <= 0) return Number.POSITIVE_INFINITY;
	return Math.ceil(processor.fixedCents / margin);
}

/** Stripe's standard US card pricing, for use with `feeBreakEvenCents`. */
export const STRIPE_US_CARD_PRICING = {
	percentBps: 290,
	fixedCents: 30,
} as const;

/**
 * Ceiling on a single donation charge, in cents — Stripe's own per-charge limit for
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
 * The largest gift whose *total charge* (gift + fee) still fits under Stripe's
 * per-charge ceiling. The ceiling is on the total, not the gift, so this is the
 * number the "too large" copy should quote: quoting the ceiling itself reads as
 * the gift limit and rejects a gift a cent under it once the fee is added on top.
 */
function maxGiftUnderCeiling(feeBps: number): number {
	if (feeBps <= 0) return MAX_DONATION_CENTS;
	let gift = Math.floor(MAX_DONATION_CENTS / (1 + feeBps / 10000));
	// Fee rounding can nudge the total across the line either way; settle it exactly
	// with a couple of one-cent steps rather than trusting the continuous bound.
	while (breakdownAtBps(gift, feeBps).amountCents > MAX_DONATION_CENTS)
		gift -= 1;
	while (breakdownAtBps(gift + 1, feeBps).amountCents <= MAX_DONATION_CENTS)
		gift += 1;
	return gift;
}

/**
 * Whether a selected gift amount may be donated, given the configured floor and
 * the fee rate (so gift + fee cannot exceed Stripe's charge ceiling).
 *
 * Returns a result rather than throwing, because both callers want to *render*
 * the outcome: the amount form shows it inline as the donor types, and the
 * checkout route returns it as a 400. The message is produced here so those two
 * can never disagree about what the floor is or how it's worded — the server is
 * the authority on the amount, and the copy should come from the same place as
 * the rule.
 *
 * Pure: the caller supplies `minCents` and `feeBps`, so this stays importable
 * from client components.
 */
export function checkDonationAmount(
	giftCents: number,
	minCents: number,
	feeBps = 0,
): DonationAmountCheck {
	if (!Number.isInteger(giftCents) || giftCents < 0) {
		return {
			ok: false,
			reason: "not_whole_cents",
			message: "Enter a whole dollar-and-cents amount.",
		};
	}
	if (giftCents < minCents) {
		return {
			ok: false,
			reason: "below_minimum",
			message: `The minimum donation is ${formatUsd(minCents)}.`,
		};
	}
	const { amountCents } = breakdownAtBps(giftCents, feeBps);
	if (amountCents > MAX_DONATION_CENTS) {
		return {
			ok: false,
			reason: "above_maximum",
			// The ceiling is on the total charge (gift + fee), so name the largest gift
			// that fits under it rather than the ceiling itself — otherwise a gift a
			// cent below the ceiling is rejected by the fee on top and the message
			// contradicts the number it just quoted.
			message:
				feeBps > 0
					? `The most you can give is ${formatUsd(
							maxGiftUnderCeiling(feeBps),
						)}. The platform fee is added on top.`
					: `A single donation cannot exceed ${formatUsd(MAX_DONATION_CENTS)}.`,
		};
	}
	return { ok: true };
}

/**
 * Whether the configured floor actually covers the processor's cut.
 *
 * A floor and a fee rate that were consistent when chosen stop being consistent
 * the moment either moves, and the relationship is far more sensitive than it
 * looks: drop the platform fee from 5% to 3% and break-even leaps, because the
 * margin over Stripe's 2.9% collapses. At or below ~2.9% no donation of any size
 * covers the fixed 30¢, and this returns `Infinity`. This makes that drift
 * detectable instead of silent — surface it on an admin screen or assert it at
 * startup rather than rediscovering it in a reconciliation report.
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
