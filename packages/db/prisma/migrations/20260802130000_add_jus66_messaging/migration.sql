-- JUS-66: one-to-one plaintiff/attorney messaging and its minimal
-- notification and moderation foundations. This migration intentionally only
-- adds the JUS-66 schema; it does not attempt to fold unrelated historical
-- schema drift into this ticket.

CREATE TYPE "MessageEmailDeliveryStatus" AS ENUM ('sent', 'skipped', 'failed');
CREATE TYPE "ConversationReportStatus" AS ENUM ('open', 'resolved');

CREATE TABLE "conversation" (
    "id" TEXT NOT NULL,
    "plaintiffId" TEXT NOT NULL,
    "attorneyId" TEXT NOT NULL,
    "caseId" TEXT,
    "plaintiffActiveAt" TIMESTAMP(3),
    "attorneyActiveAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "conversation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    CONSTRAINT "message_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "message_notification_preference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "message_notification_preference_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "conversation_notification_setting" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "conversation_notification_setting_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "message_email_delivery" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "status" "MessageEmailDeliveryStatus" NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    CONSTRAINT "message_email_delivery_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "conversation_report" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "ConversationReportStatus" NOT NULL DEFAULT 'open',
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "conversation_report_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "conversation_plaintiffId_attorneyId_key" ON "conversation"("plaintiffId", "attorneyId");
CREATE INDEX "conversation_plaintiffId_updatedAt_idx" ON "conversation"("plaintiffId", "updatedAt");
CREATE INDEX "conversation_attorneyId_updatedAt_idx" ON "conversation"("attorneyId", "updatedAt");
CREATE INDEX "conversation_caseId_idx" ON "conversation"("caseId");
CREATE INDEX "message_conversationId_createdAt_idx" ON "message"("conversationId", "createdAt");
CREATE INDEX "message_authorId_createdAt_idx" ON "message"("authorId", "createdAt");
CREATE INDEX "message_conversationId_readAt_idx" ON "message"("conversationId", "readAt");
CREATE UNIQUE INDEX "message_notification_preference_userId_key" ON "message_notification_preference"("userId");
CREATE UNIQUE INDEX "conversation_notification_setting_conversationId_userId_key" ON "conversation_notification_setting"("conversationId", "userId");
CREATE INDEX "conversation_notification_setting_userId_idx" ON "conversation_notification_setting"("userId");
CREATE UNIQUE INDEX "message_email_delivery_messageId_key" ON "message_email_delivery"("messageId");
CREATE INDEX "message_email_delivery_recipientId_createdAt_idx" ON "message_email_delivery"("recipientId", "createdAt");
CREATE INDEX "conversation_report_status_createdAt_idx" ON "conversation_report"("status", "createdAt");
CREATE INDEX "conversation_report_conversationId_idx" ON "conversation_report"("conversationId");

ALTER TABLE "conversation" ADD CONSTRAINT "conversation_plaintiffId_fkey" FOREIGN KEY ("plaintiffId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_attorneyId_fkey" FOREIGN KEY ("attorneyId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "case"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "message" ADD CONSTRAINT "message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "message" ADD CONSTRAINT "message_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "message_notification_preference" ADD CONSTRAINT "message_notification_preference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "conversation_notification_setting" ADD CONSTRAINT "conversation_notification_setting_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "conversation_notification_setting" ADD CONSTRAINT "conversation_notification_setting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "message_email_delivery" ADD CONSTRAINT "message_email_delivery_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "message_email_delivery" ADD CONSTRAINT "message_email_delivery_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "conversation_report" ADD CONSTRAINT "conversation_report_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "conversation_report" ADD CONSTRAINT "conversation_report_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "conversation_report" ADD CONSTRAINT "conversation_report_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
