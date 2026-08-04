-- Guest donations: giving no longer requires an account.
--
-- `donation.donorId` becomes nullable. A guest is identified by `donorEmail`, which
-- is what lets `donorsCount` stay meaningful and lets the donations be attached to
-- an account the donor creates later (see `claimGuestDonations`). `donorName` is
-- added so a receipt can address a person rather than an email.
--
-- ALSO REPAIRS A TRUNCATED MIGRATION. 20260804151500 was hand-authored by piping
-- `db:migrate:sql` through a sed range ending at the first line matching
-- "ON UPDATE CASCADE;", which cut everything after the first foreign key — so
-- `payout_account_userId_fkey` was never created and `payout_account.userId` had no
-- referential integrity to `user`. Nothing exercised it (no user has been deleted),
-- and the diff that produced this file picked it up. Restored below.

-- AlterTable
ALTER TABLE "donation" ADD COLUMN     "donorName" TEXT,
ALTER COLUMN "donorId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "donation_donorEmail_idx" ON "donation"("donorEmail");

-- AddForeignKey (repair — see note above)
ALTER TABLE "payout_account" ADD CONSTRAINT "payout_account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
