-- Add requireApproval field to Room
ALTER TABLE "Room" ADD COLUMN "requireApproval" BOOLEAN NOT NULL DEFAULT false;
