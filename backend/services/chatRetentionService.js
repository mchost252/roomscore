const { prisma } = require('../config/database');
const logger = require('../utils/logger');

// Runs periodic cleanup of room chat messages based on per-room retention.
// Retention is enforced both at read-time (GET /rooms/:id/chat) and via cleanup.

const DEFAULT_RETENTION_DAYS = 5;
const MAX_RETENTION_DAYS = 5;
const MIN_RETENTION_DAYS = 1;

const getCutoffDate = (days) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
};

async function runChatRetentionCleanup() {
  try {
    // Only select what we need
    const rooms = await prisma.room.findMany({
      where: { isActive: true },
      select: { id: true, chatRetentionDays: true }
    });

    if (!rooms.length) return;

    let totalDeleted = 0;

    for (const room of rooms) {
      const days = Math.min(
        MAX_RETENTION_DAYS,
        Math.max(MIN_RETENTION_DAYS, room.chatRetentionDays || DEFAULT_RETENTION_DAYS)
      );

      const cutoff = getCutoffDate(days);

      const result = await prisma.chatMessage.deleteMany({
        where: {
          roomId: room.id,
          createdAt: { lt: cutoff }
        }
      });

      totalDeleted += result.count || 0;
    }

    if (totalDeleted > 0) {
      logger.info(`Chat retention cleanup deleted ${totalDeleted} messages`);
    }
  } catch (err) {
    logger.error('Chat retention cleanup failed:', err);
  }
}

let interval = null;

function startChatRetentionCleanup() {
  if (interval) return;

  // Run once shortly after startup
  setTimeout(() => {
    runChatRetentionCleanup().catch(() => {});
  }, 15_000);

  // Then every 6 hours
  interval = setInterval(() => {
    runChatRetentionCleanup().catch(() => {});
  }, 6 * 60 * 60 * 1000);

  logger.info('Chat retention cleanup started (every 6 hours)');
}

function stopChatRetentionCleanup() {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
}

module.exports = {
  startChatRetentionCleanup,
  stopChatRetentionCleanup,
  runChatRetentionCleanup,
  MAX_RETENTION_DAYS,
  MIN_RETENTION_DAYS
};
