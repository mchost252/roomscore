-- Keep existing production databases compatible with the current Prisma User model.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "notificationPreferences" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "xp" INTEGER NOT NULL DEFAULT 0;
