-- Stripe donations (Connect destination charges).
--
-- Hand-authored via `bun run db:migrate:sql`, per the README: there is no
-- SHADOW_DATABASE_URL, and `migrate dev` without a shadow database reports drift
-- and offers to reset, which drops data.
--
-- NOTE: `donation.stripeCheckoutSessionId` ends up NOT NULL, but it is added
-- nullable and backfilled first. Adding it NOT NULL outright only worked against
-- an empty table, and `donation` is not reliably empty: it had rows on dev, and
-- every database branched from dev inherited them. The single-statement version
-- failed with 23502 on dev and again on the preview database branched from it.
--
-- The constraint itself is not negotiable — it is what makes webhook redelivery
-- idempotent (see `markDonationSucceeded`) — so it is reached in three steps
-- instead of relaxed. Pre-existing rows predate payments entirely, so they have no
-- real Checkout session to point at; `legacy_<id>` is a unique placeholder that
-- satisfies the constraint and the unique index below, and cannot collide with a
-- real Stripe session id (those are prefixed `cs_`).
--
-- The steps are idempotent in the sense that matters here: run against a fresh
-- database the UPDATE simply matches nothing.

-- CreateEnum
CREATE TYPE "DonationStatus" AS ENUM ('pending', 'succeeded', 'failed', 'refunded');

-- AlterTable
ALTER TABLE "donation" ADD COLUMN     "donorEmail" TEXT,
ADD COLUMN     "feeCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "netCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "refundedAt" TIMESTAMP(3),
ADD COLUMN     "status" "DonationStatus" NOT NULL DEFAULT 'pending',
ADD COLUMN     "stripeAccountId" TEXT,
ADD COLUMN     "stripeCheckoutSessionId" TEXT,
ADD COLUMN     "stripePaymentIntentId" TEXT,
ADD COLUMN     "succeededAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill, then constrain. Both statements are no-ops on an empty table.
UPDATE "donation"
SET "stripeCheckoutSessionId" = 'legacy_' || "id"
WHERE "stripeCheckoutSessionId" IS NULL;

ALTER TABLE "donation" ALTER COLUMN "stripeCheckoutSessionId" SET NOT NULL;

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
