-- Persist the user's XP balance for future progress and rewards.
ALTER TABLE "User" ADD COLUMN "xp" INTEGER NOT NULL DEFAULT 0;
