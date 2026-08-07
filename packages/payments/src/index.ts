/**
 * Stripe platform client. **Server-only** — this module reads
 * `STRIPE_SECRET_KEY`, so importing it from a client component leaks the
 * platform credential into the browser bundle. Client components that need the
 * fee arithmetic import `@just-us/payments/fees`, which is pure.
 *
 * Money never routes through JustUs. Donations are Connect **destination
 * charges**: the charge is created on the platform, the full amount transfers to
 * the recipient's connected account, and `application_fee_amount` comes back to
 * us. Deliberately *without* `on_behalf_of` — setting it would move Stripe's
 * processing fee onto the connected account and break the published "$100 in →
 * $95 to the recipient" promise. The recipient is the operating account of the firm
 * representing the case, one per case — see `Case.payoutRecipient` and
 * `PayoutAccount`. See also `./fees`.
 */
import { env } from "@just-us/env/server";
import Stripe from "stripe";
import type { DonationAmountCheck, DonationBreakdown } from "./fees";
import { breakdownAtBps, checkDonationAmount, feeCentsAtBps } from "./fees";

export {
	breakdownAtBps,
	checkDonationAmount,
	type DonationAmountCheck,
	type DonationAmountRejection,
	type DonationBreakdown,
	feeBreakEvenCents,
	feeCentsAtBps,
	MAX_DONATION_CENTS,
	minimumCoversProcessorFee,
	STRIPE_US_CARD_PRICING,
} from "./fees";

/**
 * The SDK's own types, re-exported so a caller can name a `Stripe.Event` without
 * importing the SDK itself.
 *
 * This package is the only place that depends on `stripe`, and it stays that way:
 * a webhook route that reached for `import type Stripe from "stripe"` resolved
 * locally through Bun's hoisting but failed on the build machine, because the app
 * never declared the dependency it was using. Re-exporting keeps the SDK behind
 * this boundary, where the dependency is declared.
 */
export type { Stripe };

/** Thrown when a donation path is reached without Stripe configured. */
export class PaymentsNotConfiguredError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "PaymentsNotConfiguredError";
	}
}

let client: Stripe | null = null;

/**
 * The platform Stripe client.
 *
 * Constructed lazily rather than at module load, because `STRIPE_SECRET_KEY` is
 * optional: the app has to boot without it and fail only on the donation paths,
 * the same way uploads fail without a Blob token. Eager construction here would
 * turn a missing key into a crash on any import of this package.
 *
 * No `apiVersion` is passed — the SDK pins its own (`2026-07-29.dahlia` in
 * 22.4.0) and its types accept only that literal, so the version is pinned by
 * pinning the dependency. Upgrading the SDK is therefore a deliberate API
 * version bump, which is the behaviour we want.
 */
export function stripe(): Stripe {
	if (!env.STRIPE_SECRET_KEY) {
		throw new PaymentsNotConfiguredError(
			"Donations are not configured yet. Please try again later.",
		);
	}
	client ??= new Stripe(env.STRIPE_SECRET_KEY);
	return client;
}

/** Whether donations can run at all in this environment. */
export function isPaymentsConfigured(): boolean {
	return Boolean(env.STRIPE_SECRET_KEY);
}

/** The configured platform fee rate in basis points (500 = 5%). */
export function platformFeeBps(): number {
	return env.STRIPE_PLATFORM_FEE_BPS;
}

/** The platform fee on a donation, at the configured rate. */
export function platformFeeCents(amountCents: number): number {
	return feeCentsAtBps(amountCents, env.STRIPE_PLATFORM_FEE_BPS);
}

/**
 * The donor-facing split of a donation, at the configured rate. Resolve this in
 * a server component and pass it to the client — don't recompute it in the
 * browser, or the number shown can drift from the number charged.
 */
export function donationBreakdown(amountCents: number): DonationBreakdown {
	return breakdownAtBps(amountCents, env.STRIPE_PLATFORM_FEE_BPS);
}

/** The smallest donation accepted, at the configured floor. */
export function minDonationCents(): number {
	return env.STRIPE_MIN_DONATION_CENTS;
}

/**
 * Quick-pick amounts for the donate form, in cents.
 *
 * Presets at or above the floor only. A preset below it would render a button that
 * always fails validation, so those are dropped rather than shown — and if that
 * leaves nothing, the floor itself is offered so the form is never empty.
 *
 * Dropping rather than throwing is deliberate: these are read while rendering a
 * **public** case page, and a typo in one env var should not 500 a page donors are
 * reading. `donationPresetsDiagnostic` is how you find out it happened.
 */
export function donationPresets(): number[] {
	const min = env.STRIPE_MIN_DONATION_CENTS;
	const usable = env.STRIPE_DONATION_PRESETS.filter((cents) => cents >= min);
	return usable.length > 0 ? usable : [min];
}

/**
 * Which configured presets are unusable, and why. Nothing calls this in the
 * request path — it exists so a misconfiguration is *findable* rather than only
 * visible as a quietly shorter row of buttons. Surface it on the admin
 * Configuration screen or assert on it in CI.
 */
export function donationPresetsDiagnostic(): {
	ok: boolean;
	droppedBelowMinimum: number[];
	minCents: number;
} {
	const min = env.STRIPE_MIN_DONATION_CENTS;
	const dropped = env.STRIPE_DONATION_PRESETS.filter((cents) => cents < min);
	return {
		ok: dropped.length === 0,
		droppedBelowMinimum: dropped,
		minCents: min,
	};
}

/**
 * Whether an amount may be donated, at the configured floor.
 *
 * **The checkout route must call this** before creating a Session. The amount
 * arrives from the browser, so the floor is only real if the server enforces it —
 * a client-side check is a courtesy to honest donors, not a control.
 */
export function validateDonationAmount(
	amountCents: number,
): DonationAmountCheck {
	return checkDonationAmount(amountCents, env.STRIPE_MIN_DONATION_CENTS);
}
