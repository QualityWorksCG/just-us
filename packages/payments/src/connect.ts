/**
 * Connect account plumbing for donation payouts. **Server-only.**
 *
 * Built on the **Accounts v2** API (`/v2/core/accounts`). Stripe blocks Accounts
 * v1 creation for new Connect integrations — `accounts.create({ type: "express" })`
 * fails with a message pointing here — and gates v1 behind a dashboard opt-in
 * described as a compatibility scenario. v2 is the path for a new integration, and
 * it works on the stable SDK (22.4.0); no preview version header is needed for
 * anything below.
 *
 * **Recipients use the `recipient` configuration, not `merchant`.** Stripe's docs
 * are explicit: the recipient configuration "enables an Account to receive funds…
 * utilized if the Account will not be the Merchant of Record, such as with
 * Separate Charges & Transfers, or Destination Charges without `on_behalf_of`
 * set." That is exactly our model — JustUs is the merchant of record, the
 * recipient only receives. Requesting `merchant` instead would make them the
 * merchant of record and change who bears Stripe's fee, breaking the published
 * "$100 in → $95 to the recipient" math.
 *
 * `fees_collector` and `losses_collector` are both `application` (us), which is
 * the v2 equivalent of the old Express controller properties and what keeps
 * Stripe's cut coming out of our platform fee rather than the recipient's
 * transfer.
 *
 * **Recipient-agnostic.** Either a plaintiff or an attorney can hold the receiving
 * account (see `Case.payoutRecipient`), so nothing here assumes a role beyond the
 * one place it genuinely differs: the MCC.
 *
 * Nothing here writes to the database. These functions talk to Stripe and return
 * plain values; persisting the account id and the capability flags is the caller's
 * job, driven by the requirements webhook so the stored flags can never be staler
 * than Stripe's own view.
 */
import { stripe } from "./index";

/** What we ask Stripe to return alongside a created/retrieved account. */
const INCLUDE = [
	"configuration.recipient",
	"identity",
	"requirements",
] as const;

/** The only configuration these accounts have — see the module note. */
const CONFIGURATIONS = ["recipient"] as const;

/**
 * Whether a connected account can receive money and pay it out.
 *
 * `detailsSubmitted` is deliberately reported separately from `transfersEnabled`:
 * someone can finish the hosted flow and still be held for review, so "submitted"
 * answers *should we still nag them* while "transfers enabled" answers *can this
 * case accept a donation*. Conflating the two would open donations against an
 * account that cannot receive them.
 */
export type ConnectAccountStatus = {
	stripeAccountId: string;
	detailsSubmitted: boolean;
	transfersEnabled: boolean;
	payoutsEnabled: boolean;
};

/** Which side of a case is receiving — mirrors the `PayoutRecipient` enum. */
export type RecipientKind = "plaintiff" | "attorney";

/**
 * What Stripe's underwriters are told this account is for. Internal to Stripe, and
 * deliberately explicit that no goods or services are sold — a balance receiving
 * public money with an unexplained purpose is what triggers a hold.
 */
const PRODUCT_DESCRIPTION: Record<RecipientKind, string> = {
	plaintiff:
		"Receives donations from the public toward the legal fee for their own civil litigation, raised through the JustUs Financial platform. No goods or services are sold; donations are gifts and carry no financial return.",
	attorney:
		"Receives donations from the public toward legal fees for clients they represent in civil litigation, raised through the JustUs Financial platform. No goods or services are sold to donors; donations are gifts and carry no financial return.",
};

/**
 * Create a v2 account for a donation recipient.
 *
 * **MCC is not settable here.** It is a field on the `merchant` configuration, not
 * `recipient` — passing `configuration.recipient.mcc` is rejected outright as an
 * unknown field. Since these accounts are recipients and never merchants of
 * record, Stripe assigns the code itself during review. (An earlier version of
 * this file set `8111` for attorneys and would have failed every attorney's
 * onboarding.)
 *
 * `entity_type` is set **only for plaintiffs**, where the answer is never in
 * doubt: a plaintiff receiving donations toward their own lawsuit is an
 * individual. Supplying it skips Stripe's "Business type" step, which otherwise
 * asks a private person to choose between unregistered business, LLC, nonprofit,
 * and government entity — none of which describes them, and one of which
 * (nonprofit) would imply a tax-deductibility their donors do not get.
 *
 * For an attorney it is genuinely unknown — solo practitioner or firm — so it is
 * left unset and the hosted flow asks them.
 *
 * Only `stripe_balance.stripe_transfers` is requested. `stripe_balance.payouts`
 * shows up in the requirements Stripe raises but is not a requestable field on the
 * stable version — it is observed, not asked for. `bank_accounts` is preview-only
 * and rejected outright.
 */
export async function createPayoutAccount(input: {
	email: string;
	/** Display name Stripe shows the holder during onboarding. */
	displayName: string;
	/** Which side of the case is receiving. */
	recipientKind: RecipientKind;
	/**
	 * A public page describing what this account is for. Stripe *requires* a
	 * business URL (it raises `defaults.profile.business_url` as a requirement), so
	 * supplying it is the difference between the holder confirming a sensible value
	 * and being asked to invent a "business website" they don't have.
	 */
	businessUrl: string;
}): Promise<ConnectAccountStatus> {
	const account = await stripe().v2.core.accounts.create({
		contact_email: input.email,
		display_name: input.displayName,
		identity: {
			country: "us",
			...(input.recipientKind === "plaintiff"
				? { entity_type: "individual" as const }
				: {}),
		},
		configuration: {
			recipient: {
				capabilities: {
					stripe_balance: { stripe_transfers: { requested: true } },
				},
			},
		},
		// Stripe hosts the holder's own payouts dashboard, so JustUs never builds
		// or maintains one, and never sees a bank detail or tax ID.
		dashboard: "express",
		defaults: {
			currency: "usd",
			responsibilities: {
				fees_collector: "application",
				losses_collector: "application",
			},
			profile: {
				business_url: input.businessUrl,
				doing_business_as: input.displayName,
				// Stripe's docs call this internal-only, for risk and underwriting. An
				// account receiving public donations toward litigation with no stated
				// purpose is exactly the shape that gets held for review, so say plainly
				// what it is — including that nothing is being sold, which is the
				// question a reviewer is actually asking.
				product_description: PRODUCT_DESCRIPTION[input.recipientKind],
			},
		},
		include: [...INCLUDE],
	});
	return toStatus(account);
}

/**
 * A one-time hosted onboarding URL to redirect the recipient to.
 *
 * Account Links are single-use and short-lived, so this is called per redirect
 * rather than stored. `refreshUrl` is where Stripe sends them if the link has
 * expired or was already used — point it back at the action that mints a fresh
 * one, otherwise someone who takes a coffee break hits a dead end.
 */
export async function createOnboardingLink(input: {
	stripeAccountId: string;
	refreshUrl: string;
	returnUrl: string;
}): Promise<string> {
	const link = await stripe().v2.core.accountLinks.create({
		account: input.stripeAccountId,
		use_case: {
			type: "account_onboarding",
			account_onboarding: {
				configurations: [...CONFIGURATIONS],
				refresh_url: input.refreshUrl,
				return_url: input.returnUrl,
			},
		},
	});
	return link.url;
}

/**
 * Re-read an account's capabilities from Stripe.
 *
 * Needed on the onboarding return URL: landing there means the holder *left* the
 * flow, not that they finished it. Check the result before telling anyone they're
 * set up.
 */
export async function fetchAccountStatus(
	stripeAccountId: string,
): Promise<ConnectAccountStatus> {
	const account = await stripe().v2.core.accounts.retrieve(stripeAccountId, {
		include: [...INCLUDE],
	});
	return toStatus(account);
}

/**
 * A link into the holder's own Stripe Express dashboard, where they see their
 * payouts.
 *
 * This is the **v1** login-link endpoint applied to a v2 account id — v2 accounts
 * are still `acct_…` and there is no v2 equivalent on the stable version. Stripe
 * rejects it until onboarding completes, so callers must gate on
 * `detailsSubmitted` rather than surface the raw error. Unverified end to end
 * until an account finishes the hosted flow (Step 7).
 */
export async function createExpressDashboardLink(
	stripeAccountId: string,
): Promise<string> {
	const link = await stripe().accounts.createLoginLink(stripeAccountId);
	return link.url;
}

/**
 * Map a v2 account onto the flags we store.
 *
 * `transfersEnabled` is the donation gate and comes from the capability status
 * being exactly `active` — anything else (`restricted`, `pending`, `unsupported`,
 * absent) must read as false, so this tests for the one good value rather than
 * excluding known-bad ones. A capability Stripe adds a new status for would
 * otherwise silently open the gate.
 *
 * `detailsSubmitted` is derived rather than reported: v2 has no
 * `details_submitted`. It means **nothing is currently blocking**, not "no
 * outstanding requirements at all" — Stripe permanently keeps `eventually_due`
 * entries (a future SSN or date-of-birth ask, say) on accounts that are fully
 * active, so counting those would leave a working account reading as unfinished
 * forever. Only `past_due` and `currently_due` deadlines actually need the holder.
 */
function toStatus(account: {
	id: string;
	configuration?: {
		recipient?: {
			capabilities?: {
				stripe_balance?: {
					stripe_transfers?: { status?: string } | null;
					payouts?: { status?: string } | null;
				} | null;
			} | null;
		} | null;
	} | null;
	requirements?: {
		entries?: Array<{
			awaiting_action_from?: string;
			minimum_deadline?: { status?: string } | null;
		}> | null;
	} | null;
}): ConnectAccountStatus {
	const balance =
		account.configuration?.recipient?.capabilities?.stripe_balance;
	const entries = account.requirements?.entries ?? [];
	const blocking = entries.some(
		(e) =>
			e.awaiting_action_from === "user" &&
			BLOCKING_DEADLINES.has(e.minimum_deadline?.status ?? ""),
	);
	return {
		stripeAccountId: account.id,
		detailsSubmitted: !blocking,
		transfersEnabled: balance?.stripe_transfers?.status === "active",
		payoutsEnabled: balance?.payouts?.status === "active",
	};
}

/**
 * Requirement deadlines that genuinely need the holder now. `eventually_due` is
 * deliberately excluded — Stripe keeps such entries on fully active accounts, so
 * treating them as outstanding would leave a working account reading as unfinished
 * forever. See `toStatus`.
 */
const BLOCKING_DEADLINES = new Set(["past_due", "currently_due"]);
