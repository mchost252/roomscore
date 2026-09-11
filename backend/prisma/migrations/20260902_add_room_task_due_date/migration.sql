-- One-time room tasks need a calendar date. Legacy weekly rows remain valid
-- and are normalized to daily when read or updated by the API.
ALTER TABLE "RoomTask" ADD COLUMN "dueDate" TIMESTAMP(3);
