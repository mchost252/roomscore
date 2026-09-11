-- Add recurrence metadata for native-style personal task scheduling.
ALTER TABLE "PersonalTask" ADD COLUMN "daysOfWeek" TEXT;
ALTER TABLE "PersonalTask" ADD COLUMN "allDay" BOOLEAN NOT NULL DEFAULT false;
