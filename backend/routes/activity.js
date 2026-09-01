const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { prisma } = require('../config/database');
const logger = require('../utils/logger');

/**
 * User Activity API
 *
 * Powers the mobile Activity (Rhythm) screen:
 * - Per-day completion counts for a month (heatmap calendar)
 * - Active-days / consistency summary
 * - Current + best streak (with date ranges) and streak history
 * - Weekly rhythm buckets (W1-W5 percentages)
 *
 * Data sources: TaskCompletion.completionDate (room tasks, 'YYYY-MM-DD' strings)
 * and PersonalTask.completedAt (personal tasks).
 */

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

const toDateKey = (d) => d.toISOString().split('T')[0];

const addDays = (dateKey, n) => {
  const d = new Date(`${dateKey}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return toDateKey(d);
};

const daysInMonth = (year, monthIdx) => new Date(Date.UTC(year, monthIdx + 1, 0)).getUTCDate();

/**
 * Compute streak runs from a sorted list of unique 'YYYY-MM-DD' keys.
 * Returns runs [{ start, end, days }] longest-first.
 */
const computeStreakRuns = (sortedKeys) => {
  const runs = [];
  let runStart = null;
  let prev = null;
  let len = 0;
  for (const key of sortedKeys) {
    if (prev !== null && addDays(prev, 1) === key) {
      len += 1;
    } else {
      if (runStart !== null) runs.push({ start: runStart, end: prev, days: len });
      runStart = key;
      len = 1;
    }
    prev = key;
  }
  if (runStart !== null) runs.push({ start: runStart, end: prev, days: len });
  runs.sort((a, b) => b.days - a.days || (a.start < b.start ? 1 : -1));
  return runs;
};

/**
 * GET /me?month=YYYY-MM
 *
 * Returns real per-day activity for the authenticated user.
 */
router.get('/me', protect, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const month = typeof req.query.month === 'string' && MONTH_RE.test(req.query.month)
      ? req.query.month
      : toDateKey(new Date()).slice(0, 7);

    const [yearStr, monthStr] = month.split('-');
    const year = parseInt(yearStr, 10);
    const monthIdx = parseInt(monthStr, 10) - 1;
    const totalDays = daysInMonth(year, monthIdx);
    const monthStart = `${month}-01`;
    const monthEnd = `${month}-${String(totalDays).padStart(2, '0')}`;

    const todayKey = toDateKey(new Date());
    const isCurrentMonth = todayKey.startsWith(month);
    const elapsedDays = isCurrentMonth
      ? parseInt(todayKey.slice(8, 10), 10)
      : totalDays;

    // ── Per-day counts for the requested month ──
    const [roomCompletions, personalCompletions] = await Promise.all([
      prisma.taskCompletion.findMany({
        where: { userId, completionDate: { gte: monthStart, lte: monthEnd } },
        select: { completionDate: true },
      }),
      prisma.personalTask.findMany({
        where: {
          userId,
          isCompleted: true,
          completedAt: { gte: new Date(`${monthStart}T00:00:00.000Z`), lte: new Date(`${monthEnd}T23:59:59.999Z`) },
        },
        select: { completedAt: true },
      }),
    ]);

    const days = {};
    for (const c of roomCompletions) {
      days[c.completionDate] = (days[c.completionDate] || 0) + 1;
    }
    for (const p of personalCompletions) {
      if (!p.completedAt) continue;
      const key = toDateKey(p.completedAt);
      days[key] = (days[key] || 0) + 1;
    }

    const activeDays = Object.keys(days).filter((k) => days[k] > 0).length;
    const consistency = elapsedDays > 0
      ? Math.min(100, Math.round((activeDays / elapsedDays) * 100))
      : 0;

    // ── Weekly rhythm buckets (days 1-7, 8-14, 15-21, 22-28, 29-end) ──
    const weeklyRanges = [[1, 7], [8, 14], [15, 21], [22, 28], [29, totalDays]];
    const weekly = weeklyRanges.map(([from, to], index) => {
      const bucketEnd = Math.min(to, totalDays);
      const elapsedInBucket = Math.max(0, Math.min(bucketEnd, elapsedDays) - from + 1);
      if (elapsedInBucket === 0) return { week: `W${index + 1}`, percent: 0 };
      let active = 0;
      for (let d = from; d <= Math.min(bucketEnd, elapsedDays); d++) {
        const key = `${month}-${String(d).padStart(2, '0')}`;
        if (days[key] > 0) active += 1;
      }
      return { week: `W${index + 1}`, percent: Math.round((active / elapsedInBucket) * 100) };
    });

    // ── All-time streak computation ──
    const [allRoom, allPersonal] = await Promise.all([
      prisma.taskCompletion.findMany({
        where: { userId },
        select: { completionDate: true },
        distinct: ['completionDate'],
        orderBy: { completionDate: 'asc' },
      }),
      prisma.personalTask.findMany({
        where: { userId, isCompleted: true, completedAt: { not: null } },
        select: { completedAt: true },
        orderBy: { completedAt: 'asc' },
      }),
    ]);

    const allKeySet = new Set(allRoom.map((c) => c.completionDate));
    for (const p of allPersonal) allKeySet.add(toDateKey(p.completedAt));
    const allKeys = [...allKeySet].sort();

    const runs = computeStreakRuns(allKeys);
    const best = runs[0] || null;

    // Current streak: latest run counts only if it reaches today or yesterday
    const yesterdayKey = addDays(todayKey, -1);
    const lastKey = allKeys[allKeys.length - 1];
    const latestRun = runs.find((r) => r.end === lastKey) || null;
    let currentStreak = 0;
    if (latestRun && (latestRun.end === todayKey || latestRun.end === yesterdayKey)) {
      currentStreak = latestRun.days;
    }

    // Cross-check against globally tracked User streak fields
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { streak: true, longestStreak: true, totalTasksCompleted: true },
    });
    if (user) {
      currentStreak = Math.max(currentStreak, user.streak || 0);
      if (best && (user.longestStreak || 0) > best.days && allKeys.length === 0) {
        // No completion rows at all — trust stored aggregates without ranges
      }
    }

    const streakHistory = runs.slice(0, 3).map((r) => ({ start: r.start, end: r.end, days: r.days }));

    res.json({
      success: true,
      data: {
        month,
        days,
        activeDays,
        elapsedDays,
        daysInMonth: totalDays,
        consistency,
        currentStreak,
        bestStreak: best
          ? { days: best.days, start: best.start, end: best.end }
          : { days: user?.longestStreak || 0, start: null, end: null },
        streakHistory,
        weekly,
        totalTasksCompleted: user?.totalTasksCompleted || 0,
      },
    });
  } catch (error) {
    logger.error('Activity fetch failed:', error);
    next(error);
  }
});

module.exports = router;
