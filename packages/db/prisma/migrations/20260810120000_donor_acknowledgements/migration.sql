-- Donor acknowledgements: one thank-you per successful donation, exactly once.
--
-- Two independent paths mark a donation succeeded — the Stripe webhook, which
-- Stripe redelivers by design, and the read-time reconciliation that catches a
-- donation up when a delivery is late or (locally, without `stripe listen`) never
-- arrives at all. Sending from either of them without a record would mail the same
-- donor twice for one gift.
--
-- `donation_acknowledgement` is that record, and the unique constraint on
-- "donationId" is the whole mechanism: the row is inserted *before* the provider is
-- called, so a second attempt loses on the constraint rather than racing a check.
-- Recording after the send instead would leave a crash mid-send indistinguishable
-- from a send that never happened, and the next webhook delivery would repeat it.
--
-- `case.thankYouNote` is the plaintiff's own words, written once and carried into
-- every acknowledgement. Nullable, and null is a real state: the email then sends
-- as a plain confirmation rather than signing a generic line with a real name.

-- CreateEnum
CREATE TYPE "DonationAcknowledgementStatus" AS ENUM ('sent', 'skipped', 'failed');

-- AlterTable
ALTER TABLE "case" ADD COLUMN "thankYouNote" TEXT;

-- CreateTable
CREATE TABLE "donation_acknowledgement" (
    "id" TEXT NOT NULL,
    "donationId" TEXT NOT NULL,
    "recipientEmail" TEXT,
    "status" "DonationAcknowledgementStatus" NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "donation_acknowledgement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "donation_acknowledgement_donationId_key" ON "donation_acknowledgement"("donationId");

-- CreateIndex
CREATE INDEX "donation_acknowledgement_status_createdAt_idx" ON "donation_acknowledgement"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "donation_acknowledgement" ADD CONSTRAINT "donation_acknowledgement_donationId_fkey" FOREIGN KEY ("donationId") REFERENCES "donation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
