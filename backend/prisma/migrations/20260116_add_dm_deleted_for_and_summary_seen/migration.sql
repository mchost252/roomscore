-- Add deletedFor array to DirectMessage for soft delete per user
ALTER TABLE "DirectMessage" ADD COLUMN "deletedFor" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Add lastSummarySeenDate to UserRoomProgress for tracking daily summary views
ALTER TABLE "UserRoomProgress" ADD COLUMN "lastSummarySeenDate" TEXT;
