-- AlterTable: report category on conversation reports
ALTER TABLE "conversation_report" ADD COLUMN "category" TEXT NOT NULL DEFAULT 'other';
