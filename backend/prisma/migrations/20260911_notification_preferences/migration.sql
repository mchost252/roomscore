-- Persist per-user notification delivery preferences.
ALTER TABLE "User" ADD COLUMN "notificationPreferences" TEXT;
