const { prisma } = require('../config/database');
const logger = require('../utils/logger');
const { getIO } = require('../socket/io');
const { TROPHIES, getTrophy, listTrophies } = require('../catalog/trophies');

/**
 * Per-criterion evaluators.
 *
 * Each evaluator returns { unlocked: boolean, progress: number (0-100) }.
 *
 * Stub criteria return { unlocked: false, progress: 0 }.
 *
 * For task_count, scope means:
 *   'all'      -> User.totalTasksCompleted
 *   'personal' -> count of completed PersonalTask rows
 *   'room'     -> count of TaskCompletion rows
 */
async function evaluateCriterion(criterion, userId) {
  if (!criterion) return { unlocked: false, progress: 0 };

  switch (criterion.type) {
    case 'task_count': {
      const value = await getTaskCount(userId, criterion.scope);
      const progress = clamp(Math.floor((value / criterion.threshold) * 100), 0, 100);
      return { unlocked: value >= criterion.threshold, progress, value };
    }

    case 'active_days': {
      const value = await getActiveDayCount(userId);
      const progress = clamp(Math.floor((value / criterion.threshold) * 100), 0, 100);
      return { unlocked: value >= criterion.threshold, progress, value };
    }

    case 'streak': {
      const value = await getLongestStreak(userId);
      const progress = clamp(Math.floor((value / criterion.threshold) * 100), 0, 100);
      return { unlocked: value >= criterion.threshold, progress, value };
    }

    case 'room_joined': {
      const value = await prisma.roomMember.count({ where: { userId } });
      const progress = clamp(Math.floor((value / criterion.threshold) * 100), 0, 100);
      return { unlocked: value >= criterion.threshold, progress, value };
    }

    case 'room_created': {
      const value = await prisma.room.count({ where: { ownerId: userId } });
      const progress = clamp(Math.floor((value / criterion.threshold) * 100), 0, 100);
      return { unlocked: value >= criterion.threshold, progress, value };
    }

    case 'room_task_count': {
      const value = await prisma.taskCompletion.count({ where: { userId } });
      const progress = clamp(Math.floor((value / criterion.threshold) * 100), 0, 100);
      return { unlocked: value >= criterion.threshold, progress, value };
    }

    case 'dm_count': {
      const value = await prisma.directMessage.count({
        where: { OR: [{ fromUserId: userId }, { toUserId: userId }] },
      });
      const progress = clamp(Math.floor((value / criterion.threshold) * 100), 0, 100);
      return { unlocked: value >= criterion.threshold, progress, value };
    }

    case 'chat_messages': {
      const value = await prisma.chatMessage.count({ where: { userId } });
      const progress = clamp(Math.floor((value / criterion.threshold) * 100), 0, 100);
      return { unlocked: value >= criterion.threshold, progress, value };
    }

    case 'category_breadth': {
      // Count distinct categories (excluding legendary) where the user has >=1 trophy.
      const unlockedRows = await prisma.userTrophy.findMany({
        where: { userId, unlockedAt: { not: null } },
        select: { trophyId: true },
      });
      const categories = new Set();
      for (const row of unlockedRows) {
        const t = getTrophy(row.trophyId);
        if (t && t.category !== 'legendary') categories.add(t.category);
      }
      const value = categories.size;
      const progress = clamp(Math.floor((value / criterion.threshold) * 100), 0, 100);
      return { unlocked: value >= criterion.threshold, progress, value };
    }

    case 'all_non_legendary_unlocked': {
      const implementable = listTrophies({ includeStubs: false }).filter((t) => t.category !== 'legendary');
      const unlockedRows = await prisma.userTrophy.findMany({
        where: { userId, unlockedAt: { not: null } },
        select: { trophyId: true },
      });
      const unlockedSet = new Set(unlockedRows.map((r) => r.trophyId));
      const missing = implementable.filter((t) => !unlockedSet.has(t.id));
      const total = implementable.length;
      const done = total - missing.length;
      const progress = total === 0 ? 0 : Math.floor((done / total) * 100);
      return { unlocked: missing.length === 0 && total > 0, progress, value: done };
    }

    case 'composite': {
      // Stub for future "all of" trophies. Currently unused.
      return { unlocked: false, progress: 0 };
    }

    // Stub types — return locked but don't error.
    case 'focus_total_minutes':
    case 'focus_longest_session_min':
    case 'focus_uninterrupted':
    case 'learning_count':
    case 'learning_days':
    case 'growth_improvement':
    case 'growth_personal_best':
    case 'priority_count':
    case 'mission_count':
      return { unlocked: false, progress: 0 };

    default:
      logger.warn(`Unknown trophy criterion type: ${criterion.type}`);
      return { unlocked: false, progress: 0 };
  }
}

// ── Data fetchers ─────────────────────────────────────────────────────
async function getTaskCount(userId, scope) {
  if (scope === 'personal') {
    return prisma.personalTask.count({ where: { userId, isCompleted: true } });
  }
  if (scope === 'room') {
    return prisma.taskCompletion.count({ where: { userId } });
  }
  // 'all' — use the cached counter when scope matches, else sum
  // We trust User.totalTasksCompleted as the source of truth for 'all'.
  // (It is incremented in personalTasks.js and tasks.js on completion.)
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { totalTasksCompleted: true },
  });
  return user?.totalTasksCompleted ?? 0;
}

async function getActiveDayCount(userId) {
  // Active day = at least one room TaskCompletion OR completed PersonalTask on that date.
  const completionDates = await prisma.taskCompletion.findMany({
    where: { userId },
    select: { completionDate: true },
    distinct: ['completionDate'],
  });
  const set = new Set(completionDates.map((c) => c.completionDate));
  // Personal task completion dates
  const personal = await prisma.personalTask.findMany({
    where: { userId, isCompleted: true, completedAt: { not: null } },
    select: { completedAt: true },
  });
  for (const p of personal) {
    if (p.completedAt) set.add(p.completedAt.toISOString().split('T')[0]);
  }
  return set.size;
}

async function getLongestStreak(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { longestStreak: true },
  });
  return user?.longestStreak ?? 0;
}

// ── Public API ────────────────────────────────────────────────────────
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

/**
 * Evaluate all trophies for a user, upserting UserTrophy rows for any new
 * unlocks, and emitting socket events. Returns the array of newly unlocked
 * trophies.
 *
 * @param {string} userId
 * @param {object} [opts]
 * @param {boolean} [opts.silent]  if true, do not emit socket events
 * @returns {Promise<Array<object>>} newly unlocked trophies (with catalog data + unlockedAt)
 */
async function evaluateAndUnlock(userId, { silent = false } = {}) {
  if (!userId) return [];

  // Read existing state once so we know what was already unlocked.
  const existing = await prisma.userTrophy.findMany({
    where: { userId },
    select: { trophyId: true, unlockedAt: true },
  });
  const unlockedSet = new Set(
    existing.filter((r) => r.unlockedAt).map((r) => r.trophyId),
  );

  const newlyUnlocked = [];

  for (const trophy of TROPHIES) {
    if (unlockedSet.has(trophy.id)) continue;

    let result;
    try {
      result = await evaluateCriterion(trophy.criterion, userId);
    } catch (err) {
      logger.error(`Trophy evaluator failed for ${trophy.id}:`, err.message);
      continue;
    }

    // Upsert progress + unlock state
    await prisma.userTrophy.upsert({
      where: { userId_trophyId: { userId, trophyId: trophy.id } },
      create: {
        userId,
        trophyId: trophy.id,
        progress: result.progress,
        unlockedAt: result.unlocked ? new Date() : null,
      },
      update: {
        progress: result.progress,
        unlockedAt: result.unlocked ? new Date() : undefined,
      },
    });

    if (result.unlocked) {
      newlyUnlocked.push({
        ...trophy,
        unlockedAt: new Date().toISOString(),
        progress: 100,
      });
    }
  }

  // After the first pass, re-evaluate legendary 'composite' criteria so
  // 'complete-journey' and similar can fire when their prerequisites land.
  if (newlyUnlocked.length > 0) {
    const legendaryRecheck = await recheckLegendary(userId, unlockedSet);
    newlyUnlocked.push(...legendaryRecheck);
  }

  if (!silent && newlyUnlocked.length > 0) {
    emitUnlocks(userId, newlyUnlocked);
  }

  return newlyUnlocked;
}

async function recheckLegendary(userId, previouslyUnlockedSet) {
  const legendary = TROPHIES.filter((t) => t.category === 'legendary' && !previouslyUnlockedSet.has(t.id));
  const newly = [];
  for (const trophy of legendary) {
    let result;
    try {
      result = await evaluateCriterion(trophy.criterion, userId);
    } catch (err) {
      logger.error(`Legendary recheck failed for ${trophy.id}:`, err.message);
      continue;
    }
    if (!result.unlocked) continue;

    await prisma.userTrophy.upsert({
      where: { userId_trophyId: { userId, trophyId: trophy.id } },
      create: {
        userId,
        trophyId: trophy.id,
        progress: 100,
        unlockedAt: new Date(),
      },
      update: {
        progress: 100,
        unlockedAt: new Date(),
      },
    });

    newly.push({ ...trophy, unlockedAt: new Date().toISOString(), progress: 100 });
  }
  return newly;
}

/**
 * Read all trophies + the user's progress in one pass. Used by GET /api/trophies.
 */
async function getTrophiesForUser(userId) {
  const rows = await prisma.userTrophy.findMany({
    where: { userId },
    select: { trophyId: true, progress: true, unlockedAt: true },
  });
  const byId = new Map(rows.map((r) => [r.trophyId, r]));

  return TROPHIES.map((trophy) => {
    const row = byId.get(trophy.id);
    return {
      ...trophy,
      progress: row?.progress ?? 0,
      unlockedAt: row?.unlockedAt ?? null,
      unlocked: !!row?.unlockedAt,
    };
  });
}

function emitUnlocks(userId, trophies) {
  const io = getIO();
  if (!io) return;
  try {
    io.to(`user:${userId}`).emit('trophy:unlocked', { trophies });
  } catch (err) {
    logger.warn('Failed to emit trophy unlock:', err.message);
  }
}

module.exports = {
  evaluateAndUnlock,
  getTrophiesForUser,
  evaluateCriterion,
};