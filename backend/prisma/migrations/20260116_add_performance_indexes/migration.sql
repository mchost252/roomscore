-- Add performance indexes for faster queries

-- Room indexes for public room queries and owner queries
CREATE INDEX IF NOT EXISTS "Room_isPrivate_isActive_idx" ON "Room"("isPrivate", "isActive");
CREATE INDEX IF NOT EXISTS "Room_ownerId_isActive_idx" ON "Room"("ownerId", "isActive");

-- RoomTask composite index for active tasks
CREATE INDEX IF NOT EXISTS "RoomTask_roomId_isActive_idx" ON "RoomTask"("roomId", "isActive");
