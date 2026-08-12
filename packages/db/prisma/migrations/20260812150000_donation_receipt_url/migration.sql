-- Stripe's hosted receipt URL for a settled donation, shown to the donor on
-- their donations screen.
--
-- Nullable with no backfill and no default. Existing rows keep NULL because the
-- URL is only knowable from the charge at settlement, and re-deriving it for
-- historic donations would mean a Stripe read per row — a migration is the wrong
-- place for that. Those rows simply show no receipt link, which is the same
-- thing the column already means for a donation that never settled.
ALTER TABLE "donation" ADD COLUMN "stripeReceiptUrl" TEXT;
