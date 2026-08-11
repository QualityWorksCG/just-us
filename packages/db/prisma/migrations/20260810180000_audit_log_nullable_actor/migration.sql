-- Some audited acts have no account behind them. An attorney invited to a case
-- can decline straight from the emailed link without ever signing in, and the
-- previous NOT NULL forced that entry to name *somebody* — in practice the
-- plaintiff who sent the invitation, which makes the log read as though they
-- declined their own invitation. Nullable actor lets the record say "not signed
-- in" instead of naming the wrong person. Existing rows all have an actor, so
-- dropping the constraint changes nothing already written.
ALTER TABLE "audit_log" ALTER COLUMN "actorId" DROP NOT NULL;
