require('dotenv').config();
const { prisma, connectDatabase, disconnectDatabase } = require('../config/database');
const { evaluateAndUnlock } = require('../services/trophyService');
const logger = require('../utils/logger');

const BATCH_SIZE = 50;

async function backfillAll() {
  const startedAt = new Date();
  let skip = 0;
  let usersProcessed = 0;
  let totalUnlocks = 0;
  let totalRowsCreated = 0;
  let errors = 0;

  logger.info('=== Trophy backfill started ===');

  // First, create UserTrophy rows for every user that doesn't have any yet.
  // evaluateAndUnlock is idempotent and will skip trophies already unlocked,
  // but it relies on existing rows for "already unlocked" tracking. We just
  // let it run — it will create the row on the first pass.
  while (true) {
    const users = await prisma.user.findMany({
      skip,
      take: BATCH_SIZE,
      orderBy: { createdAt: 'asc' },
      select: { id: true, email: true, username: true },
    });

    if (users.length === 0) break;

    for (const user of users) {
      try {
        const before = await prisma.userTrophy.count({ where: { userId: user.id } });
        const newlyUnlocked = await evaluateAndUnlock(user.id, { silent: true });
        const after = await prisma.userTrophy.count({ where: { userId: user.id } });

        const created = after - before;
        totalRowsCreated += created;
        totalUnlocks += newlyUnlocked.length;
        usersProcessed++;

        logger.info(
          `[backfill] ${user.email} (${user.id}) -> ` +
          `+${created} rows, ${newlyUnlocked.length} unlocked ` +
          `(${newlyUnlocked.map((t) => t.id).join(', ') || 'none'})`,
        );
      } catch (err) {
        errors++;
        logger.error(`[backfill] failed for ${user.id}: ${err.message}`);
      }
    }

    skip += BATCH_SIZE;
  }

  const durationMs = Date.now() - startedAt.getTime();
  logger.info('=== Trophy backfill complete ===');
  logger.info(`Users processed: ${usersProcessed}`);
  logger.info(`UserTrophy rows created: ${totalRowsCreated}`);
  logger.info(`Trophies newly unlocked: ${totalUnlocks}`);
  logger.info(`Errors: ${errors}`);
  logger.info(`Duration: ${(durationMs / 1000).toFixed(1)}s`);
}

async function backfillOne(userId) {
  if (!userId) throw new Error('userId is required');
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true } });
  if (!user) throw new Error(`No user with id ${userId}`);

  logger.info(`[backfill-one] running for ${user.email} (${user.id})`);
  const newly = await evaluateAndUnlock(user.id, { silent: true });
  logger.info(`[backfill-one] unlocked: ${newly.length} -> ${newly.map((t) => t.id).join(', ') || 'none'}`);
  return newly;
}

async function main() {
  const arg = process.argv[2];

  try {
    await connectDatabase();

    if (arg === '--user') {
      const userId = process.argv[3];
      if (!userId) {
        console.error('Usage: node backfill-trophies.js --user <userId>');
        process.exit(1);
      }
      await backfillOne(userId);
    } else if (arg === '--all' || !arg) {
      await backfillAll();
    } else {
      console.error('Unknown argument:', arg);
      console.error('Usage:');
      console.error('  node scripts/backfill-trophies.js              # all users');
      console.error('  node scripts/backfill-trophies.js --user <id>  # one user');
      process.exit(1);
    }
  } catch (err) {
    logger.error('Backfill failed:', err);
    process.exitCode = 1;
  } finally {
    await disconnectDatabase();
  }
}

if (require.main === module) {
  main();
}

module.exports = { backfillAll, backfillOne };
