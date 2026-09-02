-- Rename payout_account.chargesEnabled -> transfersEnabled.
--
-- The column is the donation gate. Under Accounts v2 what it actually mirrors is
-- the `recipient` capability `stripe_balance.stripe_transfers` — whether the
-- account may *receive* a destination transfer. These accounts never charge
-- anyone: JustUs is the merchant of record, which is why the `recipient`
-- configuration is requested and `merchant` is not. "Charges enabled" named the
-- wrong thing in the one place a wrong name moves money.
--
-- A rename rather than drop+create, so the column keeps its data. The table is
-- empty regardless (nothing has onboarded yet).

ALTER TABLE "payout_account" RENAME COLUMN "chargesEnabled" TO "transfersEnabled";
