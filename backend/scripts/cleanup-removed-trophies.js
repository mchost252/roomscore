require('dotenv').config();
const { prisma, connectDatabase, disconnectDatabase } = require('../config/database');
const { TROPHIES } = require('../catalog/trophies');
const logger = require('../utils/logger');

/**
 * Removes UserTrophy rows whose trophyId no longer exists in the catalog.
 * Runs after catalog deduplication so orphaned unlocks (removed duplicate
 * trophies) don't linger in the DB. Orphans are already invisible to the
 * API (getTrophiesForUser maps over catalog ids), so this is hygiene —
 * but it keeps counts honest for any direct DB consumers.
 *
 * Usage:
 *   node scripts/cleanup-removed-trophies.js --all [--confirm]
 *   node scripts/cleanup-removed-trophies.js --user <id> [--confirm]
 *
 * Without --confirm the script only reports what it would delete.
 */

function parseArgs(argv) {
  const args = { mode: null, userId: null, confirm: false };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--all') args.mode = 'all';
    else if (arg === '--user') {
      args.mode = 'user';
      args.userId = argv[++i];
    } else if (arg === '--confirm') args.confirm = true;
    else {
      console.error('Unknown argument:', arg);
      process.exit(1);
    }
  }
  if (!args.mode) args.mode = 'all';
  if (args.mode === 'user' && !args.userId) {
    console.error('Usage: node scripts/cleanup-removed-trophies.js --user <userId> [--confirm]');
    process.exit(1);
  }
  return args;
}

async function findOrphans(where) {
  const rows = await prisma.userTrophy.findMany({
    where,
    select: { id: true, userId: true, trophyId: true, unlockedAt: true },
  });
  const catalogIds = new Set(TROPHIES.map((t) => t.id));
  return rows.filter((r) => !catalogIds.has(r.trophyId));
}

async function deleteOrphans(orphans) {
  // SQLite/Prisma deleteMany with `in` on id is fine at this scale.
  const ids = orphans.map((r) => r.id);
  let deleted = 0;
  const CHUNK = 500;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const res = await prisma.userTrophy.deleteMany({
      where: { id: { in: ids.slice(i, i + CHUNK) } },
    });
    deleted += res.count;
  }
  return deleted;
}

async function main() {
  const args = parseArgs(process.argv);

  try {
    await connectDatabase();

    const where = args.mode === 'user' ? { userId: args.userId } : undefined;
    if (args.mode === 'user') {
      const user = await prisma.user.findUnique({ where: { id: args.userId }, select: { id: true, email: true } });
      if (!user) throw new Error(`No user with id ${args.userId}`);
      logger.info(`[cleanup] scanning trophies for ${user.email} (${user.id})`);
    } else {
      logger.info('[cleanup] scanning all users for orphaned UserTrophy rows');
    }

    const orphans = await findOrphans(where);

    if (orphans.length === 0) {
      logger.info('[cleanup] no orphaned rows found. Nothing to do.');
      return;
    }

    const byTrophy = orphans.reduce((acc, r) => {
      acc[r.trophyId] = (acc[r.trophyId] || 0) + 1;
      return acc;
    }, {});
    logger.info(
      `[cleanup] found ${orphans.length} orphaned rows: ` +
      Object.entries(byTrophy).map(([id, n]) => `${id} x${n}`).join(', '),
    );

    if (!args.confirm) {
      logger.info('[cleanup] dry run — pass --confirm to delete these rows.');
      return;
    }

    const deleted = await deleteOrphans(orphans);
    logger.info(`[cleanup] deleted ${deleted} orphaned UserTrophy rows.`);
  } catch (err) {
    logger.error('Cleanup failed:', err);
    process.exitCode = 1;
  } finally {
    await disconnectDatabase();
  }
}

if (require.main === module) {
  main();
}

module.exports = { findOrphans, deleteOrphans };
