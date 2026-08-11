-- CreateTable
CREATE TABLE "certificate" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "donorId" TEXT,
    "donorEmail" TEXT,
    "recipientName" TEXT NOT NULL,
    "caseTitle" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "serial" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "emailedAt" TIMESTAMP(3),

    CONSTRAINT "certificate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "certificate_serial_key" ON "certificate"("serial");
CREATE UNIQUE INDEX "certificate_accessToken_key" ON "certificate"("accessToken");
CREATE UNIQUE INDEX "certificate_dedupeKey_key" ON "certificate"("dedupeKey");
CREATE INDEX "certificate_caseId_idx" ON "certificate"("caseId");
CREATE INDEX "certificate_donorId_idx" ON "certificate"("donorId");

-- AddForeignKey
ALTER TABLE "certificate" ADD CONSTRAINT "certificate_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "case"("id") ON DELETE CASCADE ON UPDATE CASCADE;
