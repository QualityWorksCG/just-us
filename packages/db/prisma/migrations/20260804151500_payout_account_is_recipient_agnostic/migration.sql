-- Make the payout recipient dynamic: either the plaintiff or the retained
-- attorney may receive donations, decided per case.
--
-- Replaces `attorney_payout_account` (keyed to an attorney) with
-- `payout_account` (keyed to any user). The DROP is safe: the table was added
-- earlier the same day in 20260804143000_add_stripe_donations, nothing ever
-- wrote to it, and it held 0 rows when this was authored. It is a rename in
-- intent — Prisma emits drop+create because it cannot detect renames.
--
-- `case.payoutAccountId` binds a case to its destination rather than resolving
-- it live through the matched attorney, so re-matching a case mid-campaign
-- cannot silently redirect money donors gave on the basis of a stated recipient.
-- ON DELETE RESTRICT for the same reason: an account with cases pointing at it
-- must not vanish underneath them.

-- CreateEnum
CREATE TYPE "PayoutRecipient" AS ENUM ('plaintiff', 'attorney');

-- DropForeignKey
ALTER TABLE "attorney_payout_account" DROP CONSTRAINT "attorney_payout_account_attorneyId_fkey";

-- AlterTable
ALTER TABLE "case" ADD COLUMN     "payoutAccountId" TEXT,
ADD COLUMN     "payoutRecipient" "PayoutRecipient";

-- DropTable
DROP TABLE "attorney_payout_account";

-- CreateTable
CREATE TABLE "payout_account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stripeAccountId" TEXT NOT NULL,
    "detailsSubmitted" BOOLEAN NOT NULL DEFAULT false,
    "chargesEnabled" BOOLEAN NOT NULL DEFAULT false,
    "payoutsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "syncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payout_account_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payout_account_userId_key" ON "payout_account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "payout_account_stripeAccountId_key" ON "payout_account"("stripeAccountId");

-- CreateIndex
CREATE INDEX "case_payoutAccountId_idx" ON "case"("payoutAccountId");

-- AddForeignKey
ALTER TABLE "case" ADD CONSTRAINT "case_payoutAccountId_fkey" FOREIGN KEY ("payoutAccountId") REFERENCES "payout_account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
