-- One Stripe connected account per case, instead of one per person.
--
-- A firm running three cases now onboards three times and holds three `acct_…`
-- ids. The point is isolation: each case's donations sit in their own balance, so
-- a chargeback or refund on one case cannot be taken out of another client's
-- money, and each account carries its own external bank account so a firm can
-- route different cases to different internal accounts. Neither is possible with
-- one shared connected account.
--
-- Two changes, and both are additive on purpose — no existing row is rewritten:
--
--   1. `userId` loses its unique index and keeps a plain one. An attorney holds
--      one account per case they represent, so the old constraint would have
--      refused the second case outright.
--   2. `caseId` is added, unique, nullable. Unique because one account belongs to
--      one case. Nullable because the accounts created before this migration were
--      firm-wide, with cases already bound to them: they have no single case to
--      claim, and forcing one would either invent a link or require deleting an
--      account that may already hold money. Every account created from now on
--      sets it. See `PayoutAccount.caseId`.
--
-- `caseId` is separate from `case.payoutAccountId` rather than replacing it.
-- `caseId` records which case an account was *opened for* — the key onboarding
-- resumes on, which exists before the case is bound. `case.payoutAccountId`
-- records the destination donations are *routed to*, frozen once donors have been
-- shown a recipient. The two agree in the ordinary path and must be able to
-- disagree during onboarding and across a change of counsel.
--
-- ON DELETE SET NULL, not CASCADE: a hard-deleted case must not take an account
-- that received real money with it. (Cases are soft-deleted anyway.)

-- DropIndex
DROP INDEX "payout_account_userId_key";

-- AlterTable
ALTER TABLE "payout_account" ADD COLUMN     "caseId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "payout_account_caseId_key" ON "payout_account"("caseId");

-- CreateIndex
CREATE INDEX "payout_account_userId_idx" ON "payout_account"("userId");

-- AddForeignKey
ALTER TABLE "payout_account" ADD CONSTRAINT "payout_account_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "case"("id") ON DELETE SET NULL ON UPDATE CASCADE;
