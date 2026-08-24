-- Revert per-donation certificates back to per-case (issued on close). Remove the
-- per-donation rows minted under the previous approach, then drop the column.
DELETE FROM "certificate" WHERE "donationId" IS NOT NULL;
DROP INDEX IF EXISTS "certificate_donationId_key";
ALTER TABLE "certificate" DROP COLUMN "donationId";
