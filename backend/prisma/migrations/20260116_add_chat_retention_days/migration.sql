-- Add chatRetentionDays to Room (max 5 enforced at app layer)
ALTER TABLE "Room" ADD COLUMN IF NOT EXISTS "chatRetentionDays" INTEGER NOT NULL DEFAULT 5;
