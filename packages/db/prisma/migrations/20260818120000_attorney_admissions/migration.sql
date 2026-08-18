-- Where an attorney is admitted to practise: one row per jurisdiction, each with
-- its own bar number and its own bar-standing check. Replaces the single
-- `user.jurisdiction` as the authority on which cases an attorney may take.
CREATE TABLE "attorney_admission" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "barNumber" TEXT,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'unverified',
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attorney_admission_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "attorney_admission_userId_state_key" ON "attorney_admission"("userId", "state");
CREATE INDEX "attorney_admission_userId_idx" ON "attorney_admission"("userId");
CREATE INDEX "attorney_admission_state_idx" ON "attorney_admission"("state");

ALTER TABLE "attorney_admission" ADD CONSTRAINT "attorney_admission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Every attorney's existing single jurisdiction becomes their first admission,
-- carrying the bar number and the badge already attached to it. Enforcement
-- reads admissions from here on, so without this backfill it would begin by
-- refusing every attorney already on the platform their own cases.
INSERT INTO "attorney_admission" (
    "id", "userId", "state", "barNumber", "verificationStatus", "verifiedAt", "createdAt", "updatedAt"
)
SELECT
    gen_random_uuid()::TEXT,
    u."id",
    u."jurisdiction",
    u."barNumber",
    COALESCE(p."verificationStatus", 'unverified'::"VerificationStatus"),
    p."verifiedAt",
    NOW(),
    NOW()
FROM "user" u
LEFT JOIN "attorney_profile" p ON p."userId" = u."id"
WHERE u."role" = 'attorney'
  AND u."jurisdiction" IS NOT NULL
  AND u."jurisdiction" <> '';
