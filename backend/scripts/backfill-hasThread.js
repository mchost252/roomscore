/**
 * One-time backfill: mark tasks that already have thread activity (nodes)
 * as hasThread=true so their social history stays reachable.
 *
 * Usage: node scripts/backfill-hasThread.js
 * Safe to re-run (idempotent).
 */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const nodes = await prisma.roomTaskNode.findMany({
    where: { taskId: { not: null } },
    distinct: ['taskId'],
    select: { taskId: true },
  });

  const taskIds = nodes.map(n => n.taskId).filter(Boolean);

  if (taskIds.length === 0) {
    console.log('No tasks with thread activity found. Nothing to backfill.');
    return;
  }

  const result = await prisma.roomTask.updateMany({
    where: { id: { in: taskIds } },
    data: { hasThread: true },
  });

  console.log(`Backfilled hasThread=true for ${result.count} task(s).`);
}

main()
  .catch((err) => {
    console.error('Backfill failed:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
