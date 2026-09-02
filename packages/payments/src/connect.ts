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
 * "select $100 → $100 to the recipient" math.
 *
 * `fees_collector` and `losses_collector` are both `application` (us), which is
 * the v2 equivalent of the old Express controller properties and what keeps
 * Stripe's cut coming out of our platform fee rather than the recipient's
 * transfer.
 *
 * `losses_collector: "application"` is a deliberate keep, not an oversight, and it
 * is what the terms have to be written against. On a destination charge with no
 * `on_behalf_of`, JustUs is the merchant of record: a chargeback is raised against
 * the platform's balance, and the only way to recover it from the firm is to reverse
 * the transfer. Stripe's alternative (`"stripe"`) makes Stripe — not the connected
 * account — carry negative balances, so it would not put the loss on the firm
 * either. Terms §4 therefore states the firm's liability and JustUs's right to
 * recover, rather than claiming Stripe debits them automatically. The reversal
 * itself is not wired up yet; the dispute webhook only marks the donation.
 *
 * **The account is a law firm's operating account.** The holder is the attorney
 * representing the case; the money lands in the firm's business checking account and
 * the attorney moves it into their IOLTA/trust account under their state bar's rules.
 * To Stripe this is an ordinary business onboarding: a firm name, an EIN, a business
 * bank account, through the standard hosted flow. Pointing Stripe at a trust account
 * instead would fail — those accounts reject the automated debit relationship Stripe
 * requires — and paying a private individual was the model this replaced.
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

/**
 * What Stripe's underwriters are told this account is for. Internal to Stripe, and
 * deliberately explicit that no goods or services are sold — a balance receiving
 * public money with an unexplained purpose is what triggers a hold. It also names
 * the trust-accounting step, because "law firm receives third-party money toward a
 * client's fees" is a shape a reviewer recognises and a bare "receives donations"
 * is not.
 */
const PRODUCT_DESCRIPTION =
	"A law firm's operating account receiving donations from the public toward legal fees for clients it represents in civil litigation, raised through the JustUs Financial platform. Funds are received as an advance payment of fees from third parties and handled under the firm's state bar trust-accounting rules. No goods or services are sold to donors; donations are gifts and carry no financial return.";

/**
 * Create a v2 account for a law firm receiving donations.
 *
 * **MCC is not settable here.** It is a field on the `merchant` configuration, not
 * `recipient` — passing `configuration.recipient.mcc` is rejected outright as an
 * unknown field. Since these accounts are recipients and never merchants of
 * record, Stripe assigns the code itself during review. (An earlier version of
 * this file set `8111` for attorneys and would have failed every attorney's
 * onboarding.)
 *
 * `entity_type` is left **unset** and the hosted flow asks. It is genuinely unknown
 * here — a solo practitioner may be an individual or a sole proprietorship while a
 * firm is a company — and guessing wrong is worse than one extra question: an
 * account created as `individual` cannot simply be re-declared as the firm it
 * actually is. This is the standard business onboarding, which is the whole reason
 * the operating account is the destination: firm name, EIN, business checking
 * account, no custom banking work on our side.
 *
 * Only `stripe_balance.stripe_transfers` is requested. `stripe_balance.payouts`
 * shows up in the requirements Stripe raises but is not a requestable field on the
 * stable version — it is observed, not asked for. `bank_accounts` is preview-only
 * and rejected outright.
 */
export async function createPayoutAccount(input: {
	email: string;
	/**
	 * Display name Stripe shows the holder during onboarding, and the
	 * `doing_business_as` on the account. The **firm's** name when we have one — this
	 * is the name that appears against the money, and a firm's account labelled with
	 * one partner's personal name is a mismatch a reviewer has to resolve.
	 */
	displayName: string;
	/**
	 * The case this account exists for. One account per case, so this is what makes an
	 * attorney's three accounts tellable apart — in their own Stripe dashboard list, in
	 * Stripe's emails to them, and to anyone at Stripe reviewing them.
	 *
	 * Appended to the display name rather than replacing the firm's, so the legal
	 * entity being verified still reads first.
	 */
	caseId: string;
	caseTitle: string;
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
		display_name: displayNameFor(input.displayName, input.caseTitle),
		identity: { country: "us" },
		// Which case this account belongs to, readable from Stripe's side. When a firm
		// holds several, this is what makes a balance, a payout or a dispute in the
		// dashboard traceable to a matter without going through our database.
		metadata: { caseId: input.caseId },
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
				// The firm alone, without the case. This is the trading name of the legal
				// entity Stripe is verifying; qualifying it with a matter would describe
				// something that is not a business.
				doing_business_as: input.displayName,
				// Stripe's docs call this internal-only, for risk and underwriting. An
				// account receiving public donations toward litigation with no stated
				// purpose is exactly the shape that gets held for review, so say plainly
				// what it is — including that nothing is being sold, which is the
				// question a reviewer is actually asking.
				product_description: `${PRODUCT_DESCRIPTION} This account receives for a single matter only: ${input.caseTitle}.`,
			},
		},
		include: [...INCLUDE],
	});
	return toStatus(account);
}

/**
 * "Firm — Case title", within Stripe's 100-character limit on `display_name`.
 *
 * The firm is never truncated and the case title gives way, because the display name's
 * first job is to name the entity being verified; telling matters apart is the second.
 * A firm name long enough to fill the field on its own is simply used alone.
 */
function displayNameFor(firm: string, caseTitle: string): string {
	const MAX = 100;
	const title = caseTitle.trim();
	if (!title) return firm.slice(0, MAX);
	const room = MAX - firm.length - " — ".length;
	if (room < 12) return firm.slice(0, MAX);
	return `${firm} — ${title.length > room ? `${title.slice(0, room - 1)}…` : title}`;
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
