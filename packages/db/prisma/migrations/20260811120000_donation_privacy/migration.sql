-- AlterTable: donor privacy preference
ALTER TABLE "user" ADD COLUMN "donationsAnonymous" BOOLEAN NOT NULL DEFAULT false;
