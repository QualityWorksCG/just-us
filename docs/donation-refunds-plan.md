# Donation refunds — deferred design and launch runbook

Written 2026-09-22. Refunds are **not** a launch feature. This document records
(1) why the platform is safe to launch without one, (2) the manual procedure the
client follows in the meantime, and (3) the agreed design for a later phase, so
the decisions do not have to be re-made when that phase is funded.

---

## 1. Why launch without it is safe

**The terms already cover it.** §3 says donations are gifts and "generally
non-refundable except where required by law or expressly stated at the time of
giving." §4 says any refund that is made is net of third-party processing fees,
and that chargebacks and reversals on a donation are the receiving firm's
liability. Nothing at checkout promises a refund, so nothing is "expressly stated
at the time of giving." This is the same shape GoFundMe uses: no change-of-mind
window, refunds at the platform's discretion.

**The inbound side already works.** The account webhook
(`apps/web/src/app/api/stripe/webhook/route.ts`) handles `charge.refunded` and
`charge.dispute.created`: the donation row moves to `refunded`, `Case.raisedCents`
and `donorsCount` decrement, and the admin revenue page reports refunded rows
separately from revenue. So a refund issued from the Stripe dashboard, or a
chargeback the donor raises with their bank, is reflected in-app with no code
change. The launch checklist already smoke-tests this ("Refund a test donation →
`charge.refunded` reflected in-app").

**What is missing is only the *outbound* side** — a way for a donor or an admin
to trigger a refund from inside JustUs. Until that exists, the Stripe dashboard is
the tool.

---

## 2. Launch runbook — refunds by hand (client)

### 2a. Set the payout hold — do this before launch

Connected accounts are created with Stripe's default payout schedule (US: daily,
two-business-day delay). Set the platform default to a **7-day delay** in the live
Stripe dashboard under Connect → Settings → Payouts. Nothing in code sets this
today; if a later phase adds it to `createPayoutAccount` in
`packages/payments/src/connect.ts`, the dashboard default becomes the fallback.

Why: a refund on a destination charge pulls the gift back from the firm's
connected balance. If the firm has already been paid out, the balance goes
negative and, because accounts are created with `losses_collector: "application"`,
**JustUs is liable to Stripe for the shortfall** (terms §4 makes it a debt the firm
owes JustUs, but JustUs has fronted it). A 7-day hold means any refund decided
within a week finds the money still there.

### 2b. Issuing a discretionary refund

Only where required by law, or where the platform decides to (misuse, case
removed, attorney withdrew). Change-of-mind requests may be declined; the terms
say so.

1. Find the donation in the Stripe dashboard (search the donor's email, or the
   `caseId` in the payment's metadata).
2. **Refund.** Choose the amount:
   - *Net of processing fees*, which is what the terms promise: refund
     `charge total − Stripe's fee` (the fee is on the charge's balance
     transaction; e.g. a $100 gift is charged at $105.00 and refunded at ~$101.65).
   - *In full*, if the client prefers; the platform then absorbs Stripe's fee.
3. Tick **Reverse the transfer** so the gift comes back from the firm's connected
   account. Tick **Refund the application fee** so the platform's 5% goes back too;
   otherwise the platform keeps its fee on a refunded gift.
   Note: on a partial refund Stripe reverses the transfer and fee
   *proportionally*, which leaves a few dollars in the wrong place between the
   firm and the platform. Acceptable for one-off manual refunds; the later phase
   does the reversal exactly.
4. Nothing else. The webhook marks the row refunded and corrects the case total.
   Confirm on `/revenue` that the row shows "Refunded."

### 2c. Freezing a suspicious case

If a case is reported for fraud or removed by moderation, **before refunding
anyone**, stop money leaving:

1. Stripe dashboard → Connect → the case's connected account (its
   `metadata.caseId` names the case) → Payouts → set schedule to **Manual**.
2. Then refund donors per 2b while the balance is still held.
3. Money already paid out before the freeze is recovered from the firm under
   terms §4.

### 2d. What still happens regardless of policy

Donors can always dispute a charge with their bank. That debits the platform
balance the same way a refund does, and the webhook already treats a dispute as
a reversal on arrival. The refund policy controls voluntary refunds only.

---

## 3. Later phase — agreed design

Decisions below were settled in September 2026 and should not need reopening.

### 3a. Policy

| Phase after payment | Where the money is | Refund path |
|---|---|---|
| Within **48 hours** | Held in connected balance | **Automatic.** Signed-in donor self-serves. |
| After 48h, before day 7 | Held in connected balance | **Admin decides.** Approving costs the platform nothing. |
| After day 7 | Paid out to the firm's bank | **Admin decides**, rare, reasoned. Reversal pushes the balance negative. |

- **Who bears what.** The **donor** bears Stripe's processing fee (as the terms
  already say). The firm returns the whole gift. The platform returns its 5% fee.
  For a $100 gift charged at $105: donor gets ~$101.65 back, firm ends at $0,
  platform ends at $0.
- **Guests** (no account) go through support and the admin path.
- **Discretionary path** stated in the terms with a one-year horizon: misuse, a
  removed case, an attorney who withdraws, or where required by law.
- **Payout hold** of 7 days, set in code on account creation.
- **Velocity check.** More than a small number of refunds from one donor or card
  in a rolling 30 days sends the request to the admin queue instead of
  processing it.
- **Feature flag** `donation_refunds_self_serve` (in `packages/flags`). Off means
  the donor button files a request for admin approval; on means it processes.

### 3b. Stripe mechanics — why two calls

Donations are destination charges with no `on_behalf_of`, so JustUs is merchant
of record and the refund is always debited from the **platform** balance. The
built-in `reverse_transfer` / `refund_application_fee` flags split a *partial*
refund proportionally, which strands a few dollars between firm and platform. So
the refund module makes two explicit calls, both with idempotency keys derived
from the donation id:

1. `refunds.create` for `charge total − balance_transaction.fee`, with both
   automatic flags **off**. The fee is read from the charge, not recomputed, so
   international cards refund the correct amount.
2. `transfers.createReversal` on `charge.transfer` for exactly `Donation.netCents`.

A `refund_pending` status brackets the two calls so a crash between them is
visible and reconcilable.

### 3c. Build list, in dependency order

1. **Payout hold** in `createPayoutAccount` (`packages/payments/src/connect.ts`),
   plus a one-off script for existing accounts.
2. **Migration.** `DonationStatus` gains `refund_pending`. `Donation` gains
   `stripeRefundId`, `stripeTransferReversalId`, `refundedCents`,
   `processingFeeCents`, `refundReason`, `refundRequestedAt`, `refundedById`.
   `PayoutAccount` gains `payoutsPaused`, `payoutsPausedAt`. Audit allowlist
   (`packages/db/src/audit.ts`) gains `donation.refund_requested`,
   `donation.refunded`, `donation.refund_failed`, `donation.refund_declined`,
   `payout.paused`, `payout.resumed`.
3. **Refund module** `packages/payments/src/refunds.ts`: the two-call refund
   above, plus `pausePayouts` / `resumePayouts` (schedule → manual and back).
4. **Ledger transitions** in `packages/db/src/donations.ts`:
   `beginDonationRefund` (succeeded → refund_pending, guarded by status and the
   48h check on `succeededAt`), `completeDonationRefund` (reuses the decrement
   logic in `markDonationRefunded`), `revertDonationRefund`,
   `refundEligibility` (returns the phase and release date), a velocity query.
   `listDonations` includes refunded rows.
5. **Flag** registered in `packages/flags/src/registry.ts`.
6. **Donor action + UI.** `apps/web/src/app/(app)/donations/refund-actions.ts`
   guarded by `requireSession` and ownership. "Request a refund" on eligible
   rows of the donations page; confirmation dialog shows the exact amount back
   and the fee kept, fetched live; "Refunded" badge on completed rows.
7. **Admin queue.** On `/revenue`: restore the "Refunded" tab, add a refund
   requests section (phase + release date), approve / decline / direct refund
   actions, all `requireAdministrator`. "Pause payouts" added to campaign
   moderation actions and fired automatically on case removal.
8. **Webhook.** Handle `refund.failed` (revert row, audit). Make
   `charge.refunded` tolerant of rows already `refund_pending` / `refunded`.
   Add the event to both dashboard endpoints and the launch checklist.
9. **Email + notifications.** `packages/email/src/donation-refunded.tsx`;
   `notifyDonationRefunded` in `apps/web/src/lib/notify.ts` also tells the
   plaintiff and attorney.
10. **Copy.** Terms §3 (48h window + discretionary path); §4 fee wording → "the
    fees actually charged by the processor, typically 2.9% + $0.30"; §4
    chargeback clause carves out voluntary in-window refunds; knowledge base
    line in `packages/ai/src/knowledge.ts`; Checkout line-item description;
    revenue page comment; both docs.

### 3d. Test plan

The repo has no test runner today. Add `bun test` scripts to
`packages/payments` and `packages/db` for the pure pieces.

**Unit.** Refund amount arithmetic; eligibility phase across the 48h and 7-day
boundaries; velocity threshold.

**Ledger, against a scratch Neon branch.** succeeded → pending → refunded
decrements once; redelivered `charge.refunded` on a refunded row is a no-op;
`refund.failed` restores row and totals; a donor with two gifts refunding one
keeps `donorsCount`.

**Stripe sandbox matrix** (`stripe listen` running, one onboarded sandbox
connected account):

| Scenario | Expected |
|---|---|
| Donate $100 (4242), refund at once | Donor ~$101.65 back; transfer reversed $100; firm balance $0; platform net $0 |
| Second refund attempt on same row | Rejected |
| `succeededAt` edited to >48h ago | No donor button; admin queue shows "held until" date |
| Admin approves held request | Same money flow as automatic |
| Admin declines | Row back to succeeded; audit entry |
| Four refunds from one donor in a month | Fourth lands in queue |
| Flag off | Donor button files a request only |
| Payouts paused, then refund | Reversal succeeds; balance shows held |
| Refund from Stripe dashboard | Webhook marks row refunded |
| International card 4000 0025 0000 0003 | Refund uses the actual (higher) fee |

**Manual QA** as donor, attorney, plaintiff, admin: exact amount shown before
confirm; case total drops; notifications and email arrive; audit entries; guest
sees a "contact support" line, not a button.

### 3e. Estimate

Two to three developer days for the build, plus a day of sandbox testing, plus
copy review by the client's lawyer.

---

## 4. Peer reference

- **GoFundMe** — no change-of-mind window; refunds at the platform's discretion;
  Giving Guarantee claims for misuse up to one year. Organizer can refund
  donors while funds are still on the platform; withdrawal any time, no goal or
  closing required.
- **Kickstarter** — all-or-nothing; funds held ~14 days after the campaign,
  refunds fee-free inside that hold.
- **Indiegogo** — funds held until campaign end; fixed funding only from
  September 2026; no refunds after payout.

JustUs is a gift platform like GoFundMe: funds route to the firm on success, the
goal is a target not a gate, and closing a case does not touch money.
