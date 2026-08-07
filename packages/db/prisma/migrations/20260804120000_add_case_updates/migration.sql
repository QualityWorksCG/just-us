-- CreateTable
CREATE TABLE "case_update" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "case_update_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "case_update_caseId_createdAt_idx" ON "case_update"("caseId", "createdAt");

-- AddForeignKey
ALTER TABLE "case_update" ADD CONSTRAINT "case_update_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "case"("id") ON DELETE CASCADE ON UPDATE CASCADE;
