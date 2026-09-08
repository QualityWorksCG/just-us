-- Track when the representing attorney last viewed a case's evidence, so
-- evidence filed afterwards can be highlighted as new (JUS-100 follow-up).
ALTER TABLE "case" ADD COLUMN "attorneyEvidenceSeenAt" TIMESTAMP(3);
