-- AlterTable
ALTER TABLE "Room" ADD COLUMN "isPremium" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Room" ADD COLUMN "premiumActivatedAt" TIMESTAMP(3);
