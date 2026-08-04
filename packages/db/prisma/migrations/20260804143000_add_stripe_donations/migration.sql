-- Stripe donations (Connect destination charges).
--
-- Hand-authored via `bun run db:migrate:sql`, per the README: there is no
-- SHADOW_DATABASE_URL, and `migrate dev` without a shadow database reports drift
-- and offers to reset, which drops data.
--
-- NOTE: `donation.stripeCheckoutSessionId` is added NOT NULL with no default.
-- That is only valid because `donation` is empty (0 rows when this was written) —
-- donations were never wired up. If any row exists when this runs, Postgres will
-- reject it, and the fix is to backfill or drop those rows first, not to relax the
-- constraint: it is what makes webhook redelivery idempotent.

-- CreateEnum
CREATE TYPE "DonationStatus" AS ENUM ('pending', 'succeeded', 'failed', 'refunded');

-- AlterTable
ALTER TABLE "donation" ADD COLUMN     "donorEmail" TEXT,
ADD COLUMN     "feeCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "netCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "refundedAt" TIMESTAMP(3),
ADD COLUMN     "status" "DonationStatus" NOT NULL DEFAULT 'pending',
ADD COLUMN     "stripeAccountId" TEXT,
ADD COLUMN     "stripeCheckoutSessionId" TEXT NOT NULL,
ADD COLUMN     "stripePaymentIntentId" TEXT,
ADD COLUMN     "succeededAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "attorney_payout_account" (
    "id" TEXT NOT NULL,
    "attorneyId" TEXT NOT NULL,
    "stripeAccountId" TEXT NOT NULL,
    "detailsSubmitted" BOOLEAN NOT NULL DEFAULT false,
    "chargesEnabled" BOOLEAN NOT NULL DEFAULT false,
    "payoutsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "syncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attorney_payout_account_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "attorney_payout_account_attorneyId_key" ON "attorney_payout_account"("attorneyId");

-- CreateIndex
CREATE UNIQUE INDEX "attorney_payout_account_stripeAccountId_key" ON "attorney_payout_account"("stripeAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "donation_stripeCheckoutSessionId_key" ON "donation"("stripeCheckoutSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "donation_stripePaymentIntentId_key" ON "donation"("stripePaymentIntentId");

-- CreateIndex
CREATE INDEX "donation_status_idx" ON "donation"("status");

-- AddForeignKey
ALTER TABLE "attorney_payout_account" ADD CONSTRAINT "attorney_payout_account_attorneyId_fkey" FOREIGN KEY ("attorneyId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
