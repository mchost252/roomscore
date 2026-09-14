-- Keep notification and direct-message queries compatible with older production databases.
ALTER TABLE "DirectMessage" ADD COLUMN IF NOT EXISTS "deletedFor" TEXT;
ALTER TABLE "DirectMessage" ADD COLUMN IF NOT EXISTS "replyToId" TEXT;
ALTER TABLE "DirectMessage" ADD COLUMN IF NOT EXISTS "replyToText" TEXT;
ALTER TABLE "DirectMessage" ADD COLUMN IF NOT EXISTS "reactions" JSONB;
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "readAt" TIMESTAMP(3);
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "seenAt" TIMESTAMP(3);
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "dedupeKey" TEXT;
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "category" TEXT NOT NULL DEFAULT 'system';
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "priority" TEXT NOT NULL DEFAULT 'normal';
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
