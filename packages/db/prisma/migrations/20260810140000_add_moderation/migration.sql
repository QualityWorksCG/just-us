-- CreateTable
CREATE TABLE "moderation_flag" (
    "id" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "category" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "confidence" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'open',
    "resolution" TEXT,
    "reporterId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,

    CONSTRAINT "moderation_flag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "moderation_flag_status_createdAt_idx" ON "moderation_flag"("status", "createdAt");
CREATE INDEX "moderation_flag_caseId_idx" ON "moderation_flag"("caseId");
CREATE INDEX "moderation_flag_targetType_targetId_status_idx" ON "moderation_flag"("targetType", "targetId", "status");

-- AddForeignKey
ALTER TABLE "moderation_flag" ADD CONSTRAINT "moderation_flag_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: moderation visibility gate on case + case_update
ALTER TABLE "case" ADD COLUMN "moderationStatus" TEXT NOT NULL DEFAULT 'ok';
ALTER TABLE "case_update" ADD COLUMN "moderationStatus" TEXT NOT NULL DEFAULT 'ok';
