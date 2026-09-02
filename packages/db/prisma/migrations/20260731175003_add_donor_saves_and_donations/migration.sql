-- CreateTable
CREATE TABLE "saved_case" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_case_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "donation" (
    "id" TEXT NOT NULL,
    "donorId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "donation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "saved_case_userId_idx" ON "saved_case"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "saved_case_userId_caseId_key" ON "saved_case"("userId", "caseId");

-- CreateIndex
CREATE INDEX "donation_donorId_idx" ON "donation"("donorId");

-- CreateIndex
CREATE INDEX "donation_caseId_idx" ON "donation"("caseId");

-- AddForeignKey
ALTER TABLE "saved_case" ADD CONSTRAINT "saved_case_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "donation" ADD CONSTRAINT "donation_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "case"("id") ON DELETE CASCADE ON UPDATE CASCADE;
