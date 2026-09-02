-- AlterTable
ALTER TABLE "case_update" ADD COLUMN "attachments" JSONB;
ALTER TABLE "case_update" ADD COLUMN "editedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "case_follow" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "case_follow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "case_follow_caseId_idx" ON "case_follow"("caseId");

-- CreateIndex
CREATE UNIQUE INDEX "case_follow_userId_caseId_key" ON "case_follow"("userId", "caseId");

-- AddForeignKey
ALTER TABLE "case_follow" ADD CONSTRAINT "case_follow_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "case"("id") ON DELETE CASCADE ON UPDATE CASCADE;
