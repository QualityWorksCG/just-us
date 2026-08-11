-- Invitations to an attorney the plaintiff brought themselves.
--
-- The "I have an attorney" path collected a name, a firm, and an email and then
-- did nothing with them: no email was sent, no attorney was ever linked, and the
-- typed name quietly removed the case from the attorney queue. A plaintiff who
-- named their own attorney ended up in the one place nobody was looking.
--
-- This table is the missing record. It carries the invite the way
-- `admin_invitation` does — the raw token is emailed, only its SHA-256 hash is
-- stored, and state is derived from the timestamps rather than kept in a column:
-- accepted > declined > revoked > expired > pending.
--
-- A *pending* row is what holds the case out of the queue from here on, in place
-- of the `attorneyName IS NULL` test the queue used to apply. That swap is the
-- point of the table: a declined or lapsed invitation stops being pending on its
-- own, so the case returns to the queue with no writes to `case` at all, and a
-- plaintiff whose attorney never answered is no longer stranded.
--
-- No `invitedById`: the inviter is always the case's owner, and a second copy of
-- `case.ownerId` could only ever drift from it. Cascades with the case, like
-- every other per-case record.

-- CreateTable
CREATE TABLE "case_invitation" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "declinedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "case_invitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "case_invitation_tokenHash_key" ON "case_invitation"("tokenHash");

-- CreateIndex
CREATE INDEX "case_invitation_caseId_idx" ON "case_invitation"("caseId");

-- CreateIndex
CREATE INDEX "case_invitation_email_idx" ON "case_invitation"("email");

-- AddForeignKey
ALTER TABLE "case_invitation" ADD CONSTRAINT "case_invitation_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "case"("id") ON DELETE CASCADE ON UPDATE CASCADE;
