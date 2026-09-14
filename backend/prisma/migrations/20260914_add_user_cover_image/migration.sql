-- Persist optional profile cover images.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "coverImage" TEXT;
