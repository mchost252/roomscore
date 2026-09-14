-- Keep room chat and direct-message conversation queries compatible with older production databases.
ALTER TABLE "ChatMessage" ADD COLUMN IF NOT EXISTS "replyToId" TEXT;
ALTER TABLE "ChatMessage" ADD COLUMN IF NOT EXISTS "replyToText" TEXT;
ALTER TABLE "ChatMessage" ADD COLUMN IF NOT EXISTS "reactions" JSONB;

CREATE TABLE IF NOT EXISTS "ConversationPreference" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "friendId" TEXT NOT NULL,
  "pinned" BOOLEAN NOT NULL DEFAULT false,
  "muted" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ConversationPreference_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ConversationPreference_userId_friendId_key"
    UNIQUE ("userId", "friendId")
);

CREATE INDEX IF NOT EXISTS "ConversationPreference_userId_pinned_idx"
  ON "ConversationPreference"("userId", "pinned");

CREATE TABLE IF NOT EXISTS "UserBlock" (
  "id" TEXT PRIMARY KEY,
  "blockerId" TEXT NOT NULL,
  "blockedId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserBlock_blockerId_blockedId_key"
    UNIQUE ("blockerId", "blockedId"),
  CONSTRAINT "UserBlock_blockerId_fkey"
    FOREIGN KEY ("blockerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "UserBlock_blockedId_fkey"
    FOREIGN KEY ("blockedId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "UserBlock_blockerId_idx" ON "UserBlock"("blockerId");
CREATE INDEX IF NOT EXISTS "UserBlock_blockedId_idx" ON "UserBlock"("blockedId");
