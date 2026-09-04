-- CreateEnum
CREATE TYPE "CaseJurisdiction" AS ENUM ('state', 'federal');

-- AlterTable
ALTER TABLE "attorney_profile" ADD COLUMN     "federalVerificationStatus" "VerificationStatus" NOT NULL DEFAULT 'unverified',
ADD COLUMN     "federalVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "practicesFederal" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "case" ADD COLUMN     "jurisdiction" "CaseJurisdiction" NOT NULL DEFAULT 'state';
