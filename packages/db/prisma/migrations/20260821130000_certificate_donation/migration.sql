-- Per-donation certificates: link each certificate to the specific gift it
-- acknowledges. Nullable + unique so the older per-case certificates (donationId
-- null) coexist with one certificate per donation.
ALTER TABLE "certificate" ADD COLUMN "donationId" TEXT;
CREATE UNIQUE INDEX "certificate_donationId_key" ON "certificate"("donationId");
