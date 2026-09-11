CREATE TABLE "FocusSession" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "taskId" TEXT,
  "taskTitle" TEXT,
  "mode" TEXT NOT NULL DEFAULT 'deep',
  "durationMinutes" INTEGER NOT NULL DEFAULT 25,
  "soundUsed" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "reward" INTEGER,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "abandonedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FocusSession_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "FocusSession_userId_idx" ON "FocusSession"("userId");
CREATE INDEX "FocusSession_status_idx" ON "FocusSession"("status");
ALTER TABLE "FocusSession" ADD CONSTRAINT "FocusSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
