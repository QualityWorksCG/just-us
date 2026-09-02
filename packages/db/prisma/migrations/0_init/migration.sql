-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "FeeApproach" AS ENUM ('flat', 'hourly', 'contingency', 'quoted_per_case');

-- CreateEnum
CREATE TYPE "ModerationStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('unverified', 'pending', 'verified', 'needs_review', 'rejected');

-- CreateEnum
CREATE TYPE "CaseOutcome" AS ENUM ('won', 'settled', 'ongoing', 'other');

-- CreateEnum
CREATE TYPE "CaseStatus" AS ENUM ('draft', 'seeking', 'live', 'closed');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('pending', 'viewed', 'accepted', 'declined');

-- CreateEnum
CREATE TYPE "MatchOrigin" AS ENUM ('directory', 'bring_your_own', 'expressed_interest');

-- CreateTable
CREATE TABLE "attorney_profile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "legalName" TEXT,
    "firmName" TEXT,
    "officeCity" TEXT,
    "officeState" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "websiteUrl" TEXT,
    "headshotUrl" TEXT,
    "practiceAreas" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "practiceAreaShares" JSONB,
    "admittedYear" INTEGER,
    "education" TEXT,
    "languages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "acceptingNewCases" BOOLEAN NOT NULL DEFAULT true,
    "virtualConsultation" BOOLEAN NOT NULL DEFAULT false,
    "feeApproach" "FeeApproach",
    "feeRangeMinCents" INTEGER,
    "feeRangeMaxCents" INTEGER,
    "bio" TEXT,
    "background" TEXT,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'unverified',
    "verifiedAt" TIMESTAMP(3),
    "bioStatus" "ModerationStatus" NOT NULL DEFAULT 'pending',
    "bioReviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attorney_profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attorney_verification" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "status" "VerificationStatus" NOT NULL,
    "confidence" INTEGER NOT NULL DEFAULT 0,
    "isLicensedAttorney" BOOLEAN,
    "inGoodStanding" BOOLEAN,
    "licenseStatusText" TEXT,
    "matchedName" TEXT,
    "matchedBarNumber" TEXT,
    "matchedJurisdiction" TEXT,
    "disciplinaryNotes" TEXT,
    "summary" TEXT NOT NULL,
    "officialRecordUrl" TEXT,
    "sources" JSONB NOT NULL,
    "checkedName" TEXT,
    "checkedJurisdiction" TEXT,
    "model" TEXT NOT NULL,
    "triggeredBy" TEXT,
    "overriddenBy" TEXT,
    "overriddenReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attorney_verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attorney_review" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "quote" TEXT NOT NULL,
    "byline" TEXT NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attorney_review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attorney_case_record" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "amount" TEXT,
    "outcome" "CaseOutcome" NOT NULL DEFAULT 'other',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attorney_case_record_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'donor',
    "onboarded" BOOLEAN NOT NULL DEFAULT false,
    "jurisdiction" TEXT,
    "firmName" TEXT,
    "barNumber" TEXT,
    "banned" BOOLEAN,
    "banReason" TEXT,
    "banExpires" TIMESTAMP(3),
    "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "lastSignInAt" TIMESTAMP(3),

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,
    "impersonatedBy" TEXT,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rateLimit" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "lastRequest" BIGINT NOT NULL,

    CONSTRAINT "rateLimit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "story" TEXT NOT NULL,
    "evidence" JSONB,
    "coverImageUrl" TEXT,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "attorneyName" TEXT,
    "attorneyFirm" TEXT,
    "attorneyArea" TEXT,
    "attorneyLocation" TEXT,
    "attorneyEmail" TEXT,
    "attorneyPhone" TEXT,
    "goalCents" INTEGER NOT NULL,
    "payoutType" TEXT,
    "raisedCents" INTEGER NOT NULL DEFAULT 0,
    "donorsCount" INTEGER NOT NULL DEFAULT 0,
    "viewsCount" INTEGER NOT NULL DEFAULT 0,
    "sharesCount" INTEGER NOT NULL DEFAULT 0,
    "status" "CaseStatus" NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "case_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attorney_request" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "attorneyId" TEXT NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "viewedAt" TIMESTAMP(3),

    CONSTRAINT "attorney_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_match" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "attorneyId" TEXT NOT NULL,
    "origin" "MatchOrigin" NOT NULL,
    "requestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "case_match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "featureFlag" (
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "featureFlag_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "admin_invitation" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "invitedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "admin_invitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "attorney_profile_userId_key" ON "attorney_profile"("userId");

-- CreateIndex
CREATE INDEX "attorney_profile_officeState_idx" ON "attorney_profile"("officeState");

-- CreateIndex
CREATE INDEX "attorney_profile_acceptingNewCases_idx" ON "attorney_profile"("acceptingNewCases");

-- CreateIndex
CREATE INDEX "attorney_verification_profileId_createdAt_idx" ON "attorney_verification"("profileId", "createdAt");

-- CreateIndex
CREATE INDEX "attorney_review_profileId_published_idx" ON "attorney_review"("profileId", "published");

-- CreateIndex
CREATE INDEX "attorney_case_record_profileId_year_idx" ON "attorney_case_record"("profileId", "year");

-- CreateIndex
CREATE INDEX "audit_log_createdAt_idx" ON "audit_log"("createdAt");

-- CreateIndex
CREATE INDEX "audit_log_actorId_idx" ON "audit_log"("actorId");

-- CreateIndex
CREATE INDEX "audit_log_targetId_idx" ON "audit_log"("targetId");

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "account"("userId");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- CreateIndex
CREATE INDEX "rateLimit_key_idx" ON "rateLimit"("key");

-- CreateIndex
CREATE INDEX "case_ownerId_idx" ON "case"("ownerId");

-- CreateIndex
CREATE INDEX "case_status_idx" ON "case"("status");

-- CreateIndex
CREATE INDEX "attorney_request_caseId_idx" ON "attorney_request"("caseId");

-- CreateIndex
CREATE INDEX "attorney_request_status_idx" ON "attorney_request"("status");

-- CreateIndex
CREATE UNIQUE INDEX "attorney_request_caseId_attorneyId_key" ON "attorney_request"("caseId", "attorneyId");

-- CreateIndex
CREATE UNIQUE INDEX "case_match_caseId_key" ON "case_match"("caseId");

-- CreateIndex
CREATE UNIQUE INDEX "case_match_requestId_key" ON "case_match"("requestId");

-- CreateIndex
CREATE INDEX "case_match_attorneyId_idx" ON "case_match"("attorneyId");

-- CreateIndex
CREATE UNIQUE INDEX "admin_invitation_tokenHash_key" ON "admin_invitation"("tokenHash");

-- CreateIndex
CREATE INDEX "admin_invitation_email_idx" ON "admin_invitation"("email");

-- AddForeignKey
ALTER TABLE "attorney_profile" ADD CONSTRAINT "attorney_profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attorney_verification" ADD CONSTRAINT "attorney_verification_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "attorney_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attorney_review" ADD CONSTRAINT "attorney_review_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "attorney_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attorney_case_record" ADD CONSTRAINT "attorney_case_record_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "attorney_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case" ADD CONSTRAINT "case_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attorney_request" ADD CONSTRAINT "attorney_request_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attorney_request" ADD CONSTRAINT "attorney_request_attorneyId_fkey" FOREIGN KEY ("attorneyId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_match" ADD CONSTRAINT "case_match_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_match" ADD CONSTRAINT "case_match_attorneyId_fkey" FOREIGN KEY ("attorneyId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_match" ADD CONSTRAINT "case_match_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "attorney_request"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_invitation" ADD CONSTRAINT "admin_invitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

