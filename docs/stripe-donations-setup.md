# Donations — Stripe setup runbook

How to get donations working end-to-end against the Stripe **sandbox**, in the
order the steps actually depend on each other.

Where the code stands today:

- `Donation` exists in the schema (`packages/db/prisma/schema/case.prisma`) and
  the donor screens already read from it — `packages/db/src/donations.ts`,
  `apps/web/src/app/(app)/donations/page.tsx`. Nothing writes rows.
- The donate CTA is a placeholder toast —
  `apps/web/src/components/public-case-actions.tsx:9`.
- `Case.raisedCents` / `Case.donorsCount` exist and are never incremented.
- No Stripe dependency, no env vars, no API routes, no connected-account model.

So the work is: decide the money model → configure the sandbox → wire keys and
webhooks → add the schema → build four routes → test with sandbox values.

---

## Step 0 — Lock three decisions first (do this before touching Stripe)

These change what you configure in the dashboard, so they can't be deferred.

### 0a. Who receives the money?

The repo currently says both things:

- **Attorney holds it** — `apps/web/src/components/landing-faq.tsx:13`,
  `apps/web/src/app/page.tsx:112`, and `apps/web/src/app/terms/page.tsx:84`:
  "Funds route directly into a case-specific account held by the retained
  attorney… JustUs's own balance never receives a donated dollar."
- **Plaintiff holds it** — `apps/web/src/app/cases/[id]/page.tsx:220`: "Funds go
  to {owner}'s account — {owner} pays the attorney directly." `Case.payoutType`
  is likewise commented as "How the plaintiff receives raised funds."

**Resolved: neither — it's per case.** Either the plaintiff or the retained
attorney may set up the receiving account, decided on the case. That is better
than picking a winner, because it makes *both* existing copy variants true
statements rather than making one of them a lie — each case states which applies.

The schema this produced (Step 5): `PayoutAccount` is keyed to a **user of any
role**, and `Case.payoutRecipient` + `Case.payoutAccountId` record who this case
pays and which account it is bound to. One resolver serves both; nothing in the
charge path branches on role.

Three consequences that follow, and none of them are the schema's problem:

1. **Terms §4 must change.** `apps/web/src/app/terms/page.tsx:84` promises funds
   "route directly into a case-specific account held by the retained attorney".
   That is false for plaintiff-recipient cases. The non-custody half — "JustUs's
   own balance never receives a donated dollar" — survives untouched, and is the
   part that actually matters.
2. **The donor must be told which, per case, before confirming.** This is why
   `payoutRecipient` is stored rather than inferred at render time. A donor
   deciding to give partly on "the attorney holds it" must not be shown that
   sentence on a case where the plaintiff holds it.
3. **Plaintiff-as-recipient carries different risk.** An attorney receiving case
   funds has client-trust-account obligations behind them; a plaintiff receiving
   donations "for legal fees" into a personal account has none. That is a
   diversion risk donors cannot see. Worth being a deliberate product decision
   rather than a side effect of the flexibility.

Either way, **both roles now need Connect onboarding UI** — the plaintiff side is
new work that the attorney-only plan didn't have.

### 0b. Who absorbs Stripe's processing fee?

Your published math (`apps/web/src/app/page.tsx:565-585`) is $100 in → $5 fee →
**$95 to the attorney**. That works only if JustUs eats Stripe's cut.

With Connect **destination charges** and no `on_behalf_of`, that is exactly the
default: the full amount transfers to the connected account, your
`application_fee_amount` transfers back, and Stripe's fee comes out of *your*
portion. So on a $100 donation at 2.9% + $0.30:

| | |
|---|---|
| Donor pays | $100.00 |
| Attorney receives | $95.00 ✅ matches the published copy |
| JustUs gross fee | $5.00 |
| Stripe fee (from JustUs) | −$3.20 |
| **JustUs net** | **$1.80** |

Two things follow, and you should decide on them now rather than discover them
in the sandbox:

- ✅ **Break-even is $14.29, and a $15 floor is enforced.**
  `STRIPE_MIN_DONATION_CENTS=1500`, validated server-side by
  `validateDonationAmount()` in `@just-us/payments`. Below the floor a donation
  *costs* JustUs money — a $10 gift nets −$0.09, a $5 gift −$0.20.
- ⚠️ **The floor stops the bleeding; it does not create margin.** At exactly $15,
  JustUs nets **$0.01**. Real contribution only arrives further up:

  | Donation | Recipient gets | JustUs nets |
  |---|---|---|
  | $15 | $14.25 | $0.01 |
  | $25 | $23.75 | $0.22 |
  | $50 | $47.50 | $0.75 |
  | $100 | $95.00 | $1.80 |
  | $250 | $237.50 | $4.95 |

  So the unit economics depend on average gift size, not on the floor. If most
  donations land near $15 the platform roughly breaks even at scale. The optional
  tip the copy already mentions is the lever that changes that, and it is not
  built.
- **The fee rate and the floor are coupled, sharply.** Drop the platform fee from
  5% to 3% and break-even leaps from $14.29 to **$300.00**, because the margin
  over Stripe's 2.9% collapses from 2.1 points to 0.1; at or below 2.9% no
  donation of any size covers the fixed 30¢. `minimumCoversProcessorFee()` exists
  to make that detectable — call it if you ever change either number.
- **Do not set `on_behalf_of`.** It shifts Stripe's fee onto the connected
  account, which breaks the $95 promise.

### 0c. Donations open only on `live` cases

`live` already means attorney matched + fee set (`packages/db/prisma/schema/case.prisma`),
so this needs no schema change — but the donate button must be gated on
`status === "live"` **and** the attorney's connected account having
`charges_enabled`. Decide what a `seeking` case shows instead (recommendation:
keep today's "coming soon" copy, worded as "this case isn't raising yet").

---

## Step 1 — Configure the Stripe sandbox — ✅ enough to proceed

Sandbox account `acct_1TvAM1DdBJ8YEcil`. Connect is enabled and the secret key
works — verified by calling the API. Done:

1. ✅ **Connect enabled.**
2. ✅ **Sandbox secret key** in `apps/web/.env` (`sk_test_…`). No publishable key
   needed while donations use hosted Checkout (Step 6b).
3. ✅ **Payment methods** — cards. Keep BNPL and anything with delayed settlement
   or awkward refund semantics off until refunds are proven out.

**Deliberately deferred to Step 8 (go-live), not forgotten.** Production is a
*different Stripe account* from the sandbox, so every one of these has to be set
again on the live account anyway — doing them in the sandbox now is throwaway
work:

- **Connect branding** — ✅ actually already applied. `account.settings.branding`
  reads empty over the API, but the hosted onboarding flow renders in JustUs brass,
  so the branding the v2 flow uses is stored somewhere that read doesn't cover.
  Corrects an earlier note in this file that said Express onboarding would appear
  unbranded. Nothing to do.
- **Display name / statement descriptor** — both read "JustUs Financial sandbox"
  → `JUSTUS FINANCIAL SANDB`. Correct for a sandbox. On the live account set the
  display name properly, which fixes the descriptor at the same time, and make it
  something a donor recognises three weeks later (`JUSTUS DONATION`) or they will
  dispute it.
- **Platform profile** — the questionnaire about what your platform does, who
  gets paid, and who eats losses. This, not the platform's MCC, is what Stripe's
  risk review actually reads for a legal-donations platform. Required before live
  Connect.
- **Platform MCC** is `5734` (Computer Software Stores), inherited from the
  industry picked at signup. Leave it: it describes JustUs, a software platform.
  ⚠️ Correction to earlier guidance in this file: we do **not** set `8111` on
  connected accounts either. `mcc` is a field on the `merchant` configuration, and
  ours are `recipient`-only — passing `configuration.recipient.mcc` is rejected as
  an unknown field. Stripe assigns the code during review.

⚠️ **RESOLVED, and not as expected: Express / Accounts v1 is dead for us.**
`accounts.create({ type: "express" })` fails outright:

> Stripe no longer recommends Accounts v1 for new Connect integrations. Create
> connected accounts with `POST /v2/core/accounts` instead. […] If your
> integration requires v1 account creation for a supported compatibility
> scenario, enable Accounts v1 support in the Dashboard.

We took **Accounts v2** rather than the v1 compatibility opt-in — a greenfield
integration should not start on the path Stripe gates as legacy. See Step 6a for
what that changed. Everything below that mentions "Express accounts" means the v2
`recipient` configuration with `dashboard: "express"`.

Webhook endpoints are Step 4 — in local dev the Stripe CLI mints its own signing
secret, and deployed endpoints are configured per environment.

---

## Step 2 — Add the payments package and dependency — ✅ done

`packages/payments` (`@just-us/payments`) exists, follows the `auth`/`db`/`flags`
convention, and is declared as a dependency of `web`:

- `src/index.ts` — server-only Stripe client, lazily constructed so a missing key
  fails the donation path rather than the whole app. Exposes `platformFeeBps()`,
  `platformFeeCents()`, `donationBreakdown()`.
- `src/fees.ts` — **pure**, no env and no Stripe import, so client components can
  import it. Takes the rate as an argument; the server resolves the rate and
  passes it down. Same split as `@just-us/flags` `./registry` vs the root.
- `src/connect.ts` — Express account create, hosted onboarding links, account
  status re-read, Express dashboard login link. No database writes.

⚠️ **Order matters here.** `bun add stripe --cwd packages/payments` only works
*after* `packages/payments/package.json` exists — run it before and bun walks up
to the nearest package.json and silently adds the dependency to the **repo root**
instead. Write the package.json first, then:

```bash
bun add stripe --cwd packages/payments
# add "@just-us/payments": "workspace:*" to apps/web/package.json, then:
bun install
```

Prisma writes stay in `packages/db/src/donations.ts` alongside the existing
readers, not in the payments package.

No `apiVersion` is passed to the Stripe constructor: stripe-node's types accept
only the version the SDK itself pins (`2026-07-29.dahlia` in 22.4.0), so the API
version is pinned by pinning the dependency, and an SDK upgrade is a deliberate
API version bump.

---

## Step 3 — Env vars — ✅ done (webhook secrets pending Step 4)

Add to the server schema in `packages/env/src/server.ts`, following the existing
optional-so-the-app-still-boots pattern used for `BLOB_READ_WRITE_TOKEN`:

```ts
STRIPE_SECRET_KEY: z.string().min(1).optional(),
STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
STRIPE_CONNECT_WEBHOOK_SECRET: z.string().min(1).optional(),
STRIPE_PLATFORM_FEE_BPS: z.coerce.number().int().min(0).max(10_000).default(500),
```

Then:

1. Add the same keys with comments to `apps/web/.env.example`.
2. Put real sandbox values in `apps/web/.env` (gitignored).
3. `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` only if you go the Elements route —
   hosted Checkout needs no client key, so `packages/env/src/web.ts` can stay empty.

Optional-not-required means donations degrade to a clear error instead of
breaking the whole app when keys are absent, which is what the blob/OpenAI keys
already do.

---

## Step 4 — Stripe CLI and local webhook forwarding — ✅ done

Stripe CLI 1.45.0 installed via `brew install stripe/stripe-cli/stripe`, and both
signing secrets are in `apps/web/.env`.

**`stripe login` is not required.** The interactive browser pairing flow can be
skipped entirely by passing the key the repo already has:

```bash
KEY=$(grep '^STRIPE_SECRET_KEY=' apps/web/.env | cut -d= -f2-)
stripe listen --print-secret --api-key "$KEY"   # prints the whsec_ and exits
```

`--print-secret` is the right tool at this stage: it yields the secret without
running a forwarder, so the secret can go into `.env` before the routes it
forwards to exist. The secret is stable across runs, so this is a one-time step.

For actual testing (Step 7), run the forwarder in a terminal alongside
`bun run dev` — note the app is on **3001**, not 3000:

```bash
stripe listen --api-key "$KEY" \
  --forward-to localhost:3001/api/stripe/webhook \
  --forward-connect-to localhost:3001/api/stripe/connect-webhook
```

One `whsec_…` covers both forwards, which is why `STRIPE_WEBHOOK_SECRET` and
`STRIPE_CONNECT_WEBHOOK_SECRET` hold the same value locally and different values
once deployed.

⚠️ **The command above does not deliver v2 account events.** Accounts v2 emits
**thin events**, which need their own flags — `--forward-connect-to` will not carry
them. For the connect webhook, run a second listener:

```bash
stripe listen --api-key "$KEY" \
  --thin-events 'v2.core.account[requirements].updated,v2.core.account[configuration.recipient].capability_status_updated' \
  --forward-thin-to localhost:3001/api/stripe/connect-webhook
```

Deployed, these are **event destinations**
(`stripe.v2.core.eventDestinations.create` with `event_payload: "thin"`), not
classic webhook endpoints — a separate Dashboard/API object from the v1 endpoint
that carries `checkout.session.completed`.

**Verified end to end** against a throwaway listener before the real routes
existed — `stripe trigger checkout.session.completed` produced
`checkout.session.completed` (plus `charge.succeeded`, `payment_intent.*`,
`product.created`, `price.created`), and a metadata write to a connected account
produced `account.updated` on the `--forward-connect-to` endpoint. Every event's
signature verified via `stripe.webhooks.constructEventAsync(rawBody, sig, secret)`.

⚠️ **`stripe trigger account.updated --stripe-account <acct>` does not work** —
the fixture tries to *create* an account, and Stripe rejects that on behalf of a
connected account with a 403 ("Connect platforms cannot create new accounts on
behalf of their connected accounts"). To exercise the Connect endpoint, write to
an existing connected account instead:

```bash
stripe post /v1/accounts/<acct_id> -d "metadata[probe]=1" --api-key "$KEY"
```

⚠️ **API version drift.** The sandbox's default API version is
`2026-06-24.dahlia` (what the CLI reports, and what webhook payloads are
serialized as), while stripe-node 22.4.0's TypeScript types describe
`2026-07-29.dahlia`. Signature verification doesn't care, but the runtime payload
shape can differ slightly from the types. Either set the webhook endpoint's API
version to match the SDK when creating the deployed endpoints, or keep the gap in
mind when trusting `event.data.object` types.

Once deployed, create the two endpoints in the Dashboard (Developers → Webhooks):
one normal endpoint for `checkout.session.completed` /
`payment_intent.payment_failed` / `charge.refunded` / `charge.dispute.created`,
and one **Connect** endpoint for `account.updated`. Each has its own signing
secret — sync them with `bun run env:preview` / `bun run env:production`.

---

## Step 5 — Schema changes — ✅ done

Two migrations, both applied to `neondb`. Hand-authored from
`bun run db:migrate:sql` because there is no `SHADOW_DATABASE_URL` and
`migrate dev` without one reports drift and offers a reset.

- `20260804143000_add_stripe_donations` — the donation ledger.
- `20260804151500_payout_account_is_recipient_agnostic` — reworked the payout
  account to be role-neutral once the recipient became dynamic (Step 0a). It
  drops `attorney_payout_account` and creates `payout_account`; safe because the
  first table was added hours earlier, never written to, and held 0 rows. Prisma
  emits drop+create because it cannot detect renames. The pair could be squashed
  by hand into one migration since neither has shipped — but `db:migrate:sql`
  diffs against the *live* database, so a squash would silently omit anything
  already applied. Not worth the trap.

What landed:

- **`PayoutAccount`** in the new `payments.prisma` — keyed to a **user of any
  role**, unique on both `userId` and `stripeAccountId`. One Stripe account per
  human: Stripe KYCs a person once, and an attorney representing nine cases
  cannot be verified nine times. Every capability flag is a cache of Stripe's
  view, written only by `account.updated` and the create call. `chargesEnabled` is
  the donation gate; `detailsSubmitted` is deliberately separate so "keep nagging
  them" and "can this case take money" stay distinct.
- **`PayoutRecipient`** enum: `plaintiff | attorney`.
- **`Case.payoutRecipient` + `Case.payoutAccountId`** — who this case pays, and
  the account it is **bound** to. Bound rather than resolved live through
  `match.attorney.payoutAccount`, because otherwise re-matching a case
  mid-campaign would silently redirect money donors gave on the basis of a stated
  recipient. `ON DELETE RESTRICT` for the same reason. Indexed for the
  reconciliation direction, since Postgres does not index foreign keys itself.
- **`DonationStatus`** enum: `pending | succeeded | failed | refunded`.
- **`Donation` extended** with `feeCents`, `netCents`, `status`,
  `stripeCheckoutSessionId` (unique), `stripePaymentIntentId` (unique, nullable),
  `stripeAccountId`, `donorEmail`, `updatedAt`, `succeededAt`, `refundedAt`, plus
  an index on `status`.
- **`User.payoutAccount`** back-relation.

`Case.payoutType` (the wizard's "how do you want funds" field) now overlaps this
and is largely superseded — Connect onboarding collects the method itself. Left in
place because the wizard still writes it; worth removing when the wizard is
touched.

**One resolver, no role branching.** The charge path reads
`case.payoutAccount.{stripeAccountId, chargesEnabled}` and never asks what role
the holder has. Verified against the database by binding the same live case first
to a plaintiff's account and then to an attorney's, resolving the destination
correctly both times, confirming the gate refuses when `chargesEnabled` is false
or no account is bound, and confirming `P2002` on a second account for one user.

⚠️ `stripeCheckoutSessionId` was added **NOT NULL with no default**, which is only
valid because `donation` had 0 rows. That's noted in the migration file: if a row
ever exists, backfill or drop it rather than relaxing the constraint — it is what
makes webhook redelivery idempotent.

**Verified against the real database** by walking the whole lifecycle and rolling
it back: `pending` insert with a $100 breakdown (fee 500, net 9500) → single
transaction flipping to `succeeded` while incrementing `Case.raisedCents`/
`donorsCount` → a duplicate insert on the same session id correctly rejected with
`P2002` → `listDonations`/`donorStats` returning the row and
`{totalCents: 10000, casesBacked: 1}` with no change needed to the existing
readers. Then deleted, with the case counters restored to 0/0.

### Original plan, for reference

One migration. Edit the `.prisma` files, then `bun run db:migrate` (or
`db:migrate:sql` + hand-author, per the README, if you have no shadow database).

**a. Connected account state.** Recommend a new `AttorneyPayoutAccount` model
(or fields on `AttorneyProfile`): `stripeAccountId` unique,
`detailsSubmitted`, `chargesEnabled`, `payoutsEnabled`, `updatedAt`. Written
only by the `account.updated` webhook and the create call — never by a form.
`chargesEnabled` is the flag the donate button gates on.

**b. Extend `Donation`.** Today it's `donorId / caseId / amountCents / createdAt`.
Add:

- `stripeCheckoutSessionId` **@unique** and `stripePaymentIntentId` — the unique
  constraint is what makes webhook replay idempotent, which matters because
  Stripe *will* deliver `checkout.session.completed` more than once.
- `feeCents` — the fee as charged, not recomputed later from a changed bps.
- `netCents` — what the recipient actually received.
- `status` enum: `pending | succeeded | refunded | failed`. Rows are created
  `pending` at Checkout creation, flipped by the webhook.
- `stripeAccountId` — which connected account it landed in, denormalised so a
  receipt stays truthful after a re-match.
- `donorEmail` — Checkout collects it; needed for receipts.

Keep `raisedCents` / `donorsCount` on `Case` as the incremented cache, updated in
the **same transaction** as the donation status flip so the public progress bar
can't drift from the ledger.

---

## Step 6 — Server actions and webhook routes

**Correction to the original plan: these are server actions, not API routes.**
Every mutation in this codebase is a server action with a zod input schema and a
`requireRole` guard (see `app/(app)/profile/actions.ts`); the only API routes are
Better Auth's catch-all and the two Blob upload authorizers. Following that gets
CSRF handling, typed results, and `revalidatePath` for free. **Webhooks stay
routes** — Stripe posts to them, so they have no choice.

### 6a — Payout onboarding ✅ done, verified live

`app/(app)/settings/payout-actions.ts`: `startPayoutOnboarding`,
`refreshPayoutStatus`, `openPayoutDashboard`. Guarded by
`requireRole("plaintiff", "attorney")` — either can be the recipient, and nobody
else ever receives donated money. Query layer in `packages/db/src/payouts.ts`.

**This is where Accounts v1 died and v2 took over** (see Step 1). What that
changed, all in `packages/payments/src/connect.ts`:

- `stripe.v2.core.accounts.create()` / `stripe.v2.core.accountLinks.create()`,
  both on the **stable** SDK 22.4.0 — no preview version header needed.
- **`configuration.recipient`, deliberately not `merchant`.** Stripe's docs: the
  recipient configuration "enables an Account to receive funds… utilized if the
  Account will not be the Merchant of Record, such as with Separate Charges &
  Transfers, or **Destination Charges without `on_behalf_of` set**." That is
  precisely our model. Requesting `merchant` would make the recipient the merchant
  of record and move Stripe's fee onto them, breaking the $95 promise. My first
  attempt used `merchant` and was wrong.
- `defaults.responsibilities.fees_collector` / `losses_collector` = `application`
  — the v2 equivalent of Express controller properties, and what keeps Stripe's
  cut coming out of our 5%.
- `dashboard: "express"` still exists in v2, so Stripe still hosts the holder's
  payouts dashboard.
- Only `stripe_balance.stripe_transfers` is requestable. `stripe_balance.payouts`
  appears in the requirements Stripe raises but is **not** a create-time field —
  observe it, don't ask for it. `bank_accounts` is preview-only and rejected. `mcc`
  is a `merchant` field and is rejected on `recipient` — Stripe assigns it.
- **`defaults.profile` is pre-filled**, because Stripe *requires* a business URL
  (`defaults.profile.business_url` appears as a requirement otherwise) and a private
  plaintiff has no "business website" to give. Attorneys point at their public
  directory page (`/attorneys/<id>`); plaintiffs point at the platform, where the
  activity actually happens. `product_description` is also set — Stripe's docs call
  it internal-only underwriting text, and an account receiving public money toward
  litigation with no stated purpose is precisely the shape that gets held for
  review, so it says plainly that nothing is sold and donations are gifts.
  Verified: pre-filling clears the `business_url` requirement for both kinds.
- **What is deliberately left to the hosted flow:** bank account, terms-of-service
  acceptance (date + IP), and date of birth. Those are KYC facts we must not assert
  on someone's behalf even though the API would accept them.
- `identity.entity_type` is set to `individual` **for plaintiffs only**, where the
  answer is never in doubt. That skips Stripe's "Business type" step, which
  otherwise asks a private person to choose between unregistered business, LLC,
  nonprofit, and government entity — none of which describes them, and one of which
  (nonprofit) implies a tax-deductibility their donors do not get. Left unset for
  attorneys, who may be a solo practitioner or a firm.
- v2 has no `details_submitted`, so it is **derived** from no requirement entry
  having `awaiting_action_from: "user"`.
- Column renamed `chargesEnabled` → `transfersEnabled`
  (`20260804164500_payout_transfers_enabled`). These accounts never charge
  anyone; the gate is whether they may *receive* a transfer. The old name pointed
  at the wrong concept in the one place a wrong name moves money.

Landing on the return URL still does **not** mean onboarding finished — Stripe
sends the holder there whether they completed or abandoned it. `refreshPayoutStatus`
re-reads from Stripe on return rather than trusting the redirect.

✅ **Resolved (was an open question):** v2 requirement changes arrive as **thin
events** and need `stripe listen --thin-events … --forward-thin-to` locally, and
**event destinations** (`event_payload: "thin"`) once deployed — see Step 4.
`--forward-connect-to` does not carry them.

### 6b — Binding a case to its destination ✅ done

`app/(app)/my-cases/[id]/payout-actions.ts` + `components/dashboard/case-payout.tsx`,
rendered on the case manage page. Plaintiff-only: the case owner decides who
receives, because it is their case and their fee arrangement.

Shows *both* candidates' onboarding state rather than two bare radio buttons — a
recipient the plaintiff can select but not use has to explain itself. Locked once
the case is `live`, because donors were shown a recipient before they gave.
`ownerId` comes from the session, never the form.

### 6c — Starting a donation ✅ done

`app/cases/[id]/donate-actions.ts` + `packages/payments/src/checkout.ts`.

- Uses `getSession` rather than `requireRole`: `requireRole` *redirects*, and a
  redirect out of a button click reads as a silent failure. Every refusal is
  returned so the button can say what happened.
- **Any verified role may donate**, not just `donor` — a plaintiff or attorney
  backing someone else's case is a real thing to want to do. ⚠️ Note the wrinkle:
  `/donations` history is `requireRole("donor")`, so a plaintiff who donates cannot
  see their own history until that is widened.
- **Self-dealing guard:** the case owner cannot donate to their own case. It would
  inflate the public progress bar with their own money and pay a fee to do it.
- The amount is validated server-side (`validateDonationAmount`) and the fee is
  computed inside `createDonationCheckout`, so what Stripe is told and what the row
  stores come from one function.
- The `pending` row is written *before* the redirect, so a completed payment always
  has a row to land on.

### 6d — Webhooks ✅ done

Two routes, the only API routes in this feature because Stripe posts to them.

`api/stripe/webhook` — the ledger. `runtime = "nodejs"`, raw body via
`request.text()`, `constructEventAsync`. Handles
`checkout.session.completed` (only when `payment_status === "paid"`),
`checkout.session.expired`, `checkout.session.async_payment_failed`,
`payment_intent.payment_failed`, `charge.refunded`, `charge.dispute.created`.
Unknown types are acknowledged, not errored, or Stripe retries them forever. A
handler failure returns 500 **on purpose** so Stripe retries rather than losing a
paid donation.

`api/stripe/connect-webhook` — the recipient gate. Verified with
`webhooks.signature.verifyHeaderAsync`, not `constructEventAsync`: the signature
scheme is identical but `constructEvent` types its result as a v1 `Stripe.Event`,
which a thin event is not. **The payload's contents are ignored entirely** — the
account is re-read from Stripe, so two deliveries arriving out of order cannot
write a stale capability state over a newer one.

**Idempotency lives in `packages/db/src/donations.ts`**, as status-conditional
`updateMany` calls rather than read-then-write, so two concurrent deliveries cannot
both pass. Verified against the database across ten transitions: redelivered
success doesn't double-count; the same donor giving twice leaves `donorsCount` at 1;
a second donor takes it to 2; refunding a donor's only gift drops it back; a
redelivered refund doesn't double-decrement; refunding one of two gifts from one
donor leaves the count alone; unknown session and payment-intent ids are no-ops.

### 6e — Amount picker ✅ done

`components/public-case-actions.tsx` — presets, custom amount, and the fee shown
**to the cent** (terms §4 and `page.tsx:118` both promise it, so it's a
requirement). Imports `@just-us/payments/fees` only, never the package root, or the
platform secret key lands in the browser bundle. The fee *rate* is passed from the
server rather than hardcoded, so the number a donor reads is the number charged.

Presets are configurable via `STRIPE_DONATION_PRESETS` (default
`2500,5000,10000,25000`). Presets below the floor are dropped rather than rendered
as buttons that always fail — and dropped rather than thrown, because this renders
on a **public** page and one env typo should not 500 it. `donationPresetsDiagnostic()`
is how you find out it happened.

Also needed alongside it: **binding a case to a destination.** Something has to
set `payoutRecipient` + `payoutAccountId` before a case can go `live` — most
naturally the case wizard's payout step, where the plaintiff either onboards
themselves or nominates the attorney. A case with no bound account cannot accept
donations, which is the correct failure but a confusing one if nothing ever asks.

**b. `POST /api/donations/checkout`** — signed-in donor, `live` case, and the
case's **bound payout account** has `chargesEnabled` true. Read the destination
from `case.payoutAccount`, never from `case.match.attorney` — the binding is the
whole point (Step 5). Create the Checkout Session:

```ts
mode: "payment",
line_items: [{ price_data: { currency: "usd", unit_amount: amountCents,
  product_data: { name: `Donation — ${case.title}` } }, quantity: 1 }],
payment_intent_data: {
  application_fee_amount: feeCents,          // 5% — Stripe's fee comes out of this
  transfer_data: { destination: stripeAccountId },
  // no on_behalf_of — see Step 0b
},
metadata: { caseId, donorId },               // how the webhook finds its way home
success_url: `${origin}/cases/${id}?donated={CHECKOUT_SESSION_ID}`,
cancel_url: `${origin}/cases/${id}`,
```

Write the `pending` Donation row here, then redirect the browser to
`session.url`. Validate `amountCents` server-side (minimum from Step 0b, and a
sane maximum) — never trust a client-supplied amount or fee.

**c. `POST /api/stripe/webhook`** — the ledger. `export const runtime = "nodejs"`,
read the **raw** body with `await request.text()`, verify with
`stripe.webhooks.constructEventAsync(body, sig, secret)`. On
`checkout.session.completed`: in one transaction, flip the donation to
`succeeded` and increment `Case.raisedCents` / `donorsCount` (only count a
first-time donor). Return 200 fast; do email sends outside the critical path.
Handle `charge.refunded` and `charge.dispute.created` by decrementing.

**d. `POST /api/stripe/connect-webhook`** — `account.updated` only. Mirror
`details_submitted` / `charges_enabled` / `payouts_enabled` onto the payout
account row.

**e. Replace the placeholder** in
`apps/web/src/components/public-case-actions.tsx` with a real amount picker
showing the fee breakdown to the cent before confirming — the copy on
`page.tsx:118` ("5% shown to the cent") and `terms/page.tsx:80` both promise
that, so it's a requirement, not polish.

**Preset amounts — configurable, decided, built here (not before).**

Presets are not cosmetic: they are the **main lever on average gift size**, and
average gift size is what the unit economics ride on (see 0b). The *lowest* preset
matters most — anchoring at $25 instead of $15 moves JustUs's net per gift from
$0.01 to $0.22, roughly 20×. That is why they should be tunable without a code
change, and why the choice deserves to be deliberate.

Settled design, to avoid re-litigating it at implementation time:

- **Env-configured**, matching `STRIPE_PLATFORM_FEE_BPS` and
  `STRIPE_MIN_DONATION_CENTS`: `STRIPE_DONATION_PRESETS=2500,5000,10000,25000`,
  parsed to a sorted `number[]`. Same tier as the other money terms.
- **Validated against the floor at parse time.** A preset below
  `STRIPE_MIN_DONATION_CENTS` renders a button that always fails — reject it in
  the env schema rather than shipping a dead control.
- **Always offer a custom amount**, floored by the same
  `checkDonationAmount()` the presets pass by construction.
- **Suggested default: $25 / $50 / $100 / $250**, skewed above the floor for the
  reason above.
- **Not per-case, and not admin-editable at runtime — for now.** Per-case presets
  would let a plaintiff set them, which is more surface than it's worth before
  anything works. Runtime admin editing is the genuinely nicer version, but
  `FeatureFlag` is boolean-only by design (see `flags.prisma`), so it needs a new
  non-boolean settings store plus UI on the Configuration screen. That is its own
  slice of work and should not gate donations functioning end to end. An env var
  gets ~90% of the value now; promote it to admin-editable once there is a reason
  to change presets weekly rather than quarterly.

Consider putting the whole thing behind a flag in `packages/flags/src/registry.ts`
(`donations`) — the registry is built for exactly this, and it lets you deploy
the routes before the CTA goes live.

---

## Step 7 — Test in the sandbox

Attorney onboarding (Express hosted flow accepts these test values):

| Field | Value |
|---|---|
| Phone verification code | `000000` |
| SSN / tax ID | `000000000` |
| Date of birth | `1901-01-01` (triggers successful ID verification) |
| Address line 1 | `address_full_match` |
| Bank routing / account | `110000000` / `000123456789` |

Donations:

| Card | Behaviour |
|---|---|
| `4242 4242 4242 4242` | succeeds |
| `4000 0000 0000 0002` | declined |
| `4000 0025 0000 3155` | requires 3DS authentication |

Verify, in order:

1. Attorney with no Connect account → donate button is disabled with a reason.
2. Attorney completes onboarding → `account.updated` lands, `chargesEnabled`
   flips, button enables.
3. `$100` donation → Donation row `succeeded`, `feeCents` 500,
   `Case.raisedCents` +10000, `donorsCount` +1.
4. In the Stripe Dashboard, the connected account's balance shows **$95.00** and
   your platform balance shows the application fee minus Stripe's cut. If the
   attorney got $92.10, `on_behalf_of` slipped in somewhere.
5. Second donation from the same donor → `donorsCount` does **not** increment
   twice.
6. Resend the same `checkout.session.completed` from the Dashboard (or
   `stripe events resend <id>`) → nothing double-counts.
7. Declined card → row ends `failed`, `raisedCents` untouched.
8. Refund from the Dashboard → row `refunded`, `raisedCents` decrements.
9. `/donations` and the donor dashboard render the real row (they already read
   from `listDonations` / `donorStats`).

---

## Step 8 — Before live keys

- Sandbox keys must never reach production. Sync per environment
  (`bun run env:production`) and use a **restricted** key for the platform
  rather than the full secret key.
- Complete the real Connect platform onboarding — live Connect needs your actual
  business details, and Stripe reviews platforms in legal-adjacent verticals.
- **Work through the deferred list in Step 1** — Connect branding, display name,
  statement descriptor, platform profile. None of it carries over from the
  sandbox, and the statement descriptor in particular is a dispute-rate problem
  if a donor can't recognise the charge.
- **Negative-balance liability sits with the platform.** If a donor disputes and
  the attorney's balance is empty, JustUs pays. Given the 5% net is ~$1.80 per
  $100, a single chargeback wipes out roughly 60 donations of margin. Know your
  exposure before launch.
- Receipts must not imply tax deductibility — Terms already frames donations as
  gifts with no return, and JustUs isn't a 501(c)(3).
- ✅ **Money-routing copy rewritten for dynamic recipients** — see the Step 0a
  section. Terms §4, the Privacy Policy, the landing page, the FAQ, the attorney
  profile, and the plaintiff dashboard no longer claim the attorney holds funds;
  the public case page now states the actual recipient for *that* case. The
  non-custody claim was kept everywhere — it stays true. **Have a lawyer read
  Terms §4 and Privacy §4 before launch:** the trust-account carve-out is a
  substantive disclosure about who bears what obligation, not just wording.

---

## Suggested order of work

1. Step 0 decisions (blocking — everything else forks on 0a).
2. Steps 1–4: sandbox configured, keys in `.env`, `stripe listen` running.
3. Step 5 migration.
4. Step 6d + 6a: Connect onboarding first — nothing can be donated to until an
   recipient (plaintiff or attorney) is onboarded and the case is bound.
5. Step 6b + 6c: Checkout and the webhook ledger.
6. Step 6e: the donor-facing UI.
7. Step 7 test pass, then Step 8.
