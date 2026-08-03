-- A plaintiff's jurisdiction is a property of the case, not of the person: one
-- plaintiff can run cases in different states, so a single value on the profile
-- was wrong for all but one of them. It now lives on `case.location`, chosen per
-- case in the wizard, and nothing asks a plaintiff for one at sign-up.
--
-- `user.jurisdiction` stays: for an attorney it is their licensing state, which
-- really is a fact about the person and gates bar verification and the
-- directory. This only clears the plaintiff values that no longer mean anything.
--
-- Data-only — the column itself is unchanged, so there is nothing to roll back
-- structurally, and a cleared state is recoverable from that plaintiff's own
-- cases if it is ever wanted.
UPDATE "user"
SET "jurisdiction" = NULL
WHERE "role" = 'plaintiff'
  AND "jurisdiction" IS NOT NULL;
