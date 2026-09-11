const express = require('express');
const router = express.Router();
const { prisma } = require('../config/database');
const { protect } = require('../middleware/auth');
const logger = require('../utils/logger');

// All routes are mounted at /api/me and require auth.

// @route   POST /api/me/focus-sessions
// @desc    Record a started focus session (mobile sends its client-generated id)
// @access  Private
router.post('/focus-sessions', protect, async (req, res, next) => {
  try {
    const { clientId, taskId, taskTitle, mode, durationMinutes, startedAt, soundUsed } = req.body;
    const node = await prisma.focusSession.upsert({
      where: { id: clientId || `fs_${Date.now()}` },
      update: {},
      create: {
        id: clientId || undefined,
        userId: req.user.id,
        taskId: taskId || null,
        taskTitle: taskTitle || null,
        mode: mode || 'deep',
        durationMinutes: Number(durationMinutes) || 25,
        soundUsed: soundUsed || null,
        status: 'ACTIVE',
        startedAt: startedAt ? new Date(startedAt) : new Date(),
      },
    });
    res.status(201).json({ success: true, session: { ...node, _id: node.id } });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/me/focus-sessions/:id/complete
// @desc    Mark a focus session completed, returns XP reward
// @access  Private
router.post('/focus-sessions/:id/complete', protect, async (req, res, next) => {
  try {
    const { completedAt } = req.body;
    const existing = await prisma.focusSession.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }
    // 1 XP per focused minute, minimum 5
    const reward = Math.max(5, Number(existing.durationMinutes) || 0);
    const node = await prisma.focusSession.update({
      where: { id: existing.id },
      data: {
        status: 'COMPLETED',
        completedAt: completedAt ? new Date(completedAt) : new Date(),
        reward,
      },
    });
    res.json({ success: true, reward, session: { ...node, _id: node.id } });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/me/focus-sessions/:id/abandon
// @desc    Mark a focus session abandoned
// @access  Private
router.post('/focus-sessions/:id/abandon', protect, async (req, res, next) => {
  try {
    const { abandonedAt } = req.body;
    const existing = await prisma.focusSession.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }
    await prisma.focusSession.update({
      where: { id: existing.id },
      data: {
        status: 'ABANDONED',
        abandonedAt: abandonedAt ? new Date(abandonedAt) : new Date(),
      },
    });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/me/focus-stats
// @desc    Aggregate focus stats for the current user
// @access  Private
router.get('/focus-stats', protect, async (req, res, next) => {
  try {
    const completed = await prisma.focusSession.findMany({
      where: { userId: req.user.id, status: 'COMPLETED' },
      orderBy: { completedAt: 'desc' },
    });

    const totalSessions = completed.length;
    const totalMinutes = completed.reduce((sum, s) => sum + (s.durationMinutes || 0), 0);
    const longestSession = completed.reduce((max, s) => Math.max(max, s.durationMinutes || 0), 0);

    // Current streak (consecutive days with completions)
    const days = new Set(
      completed.map((s) => new Date(s.completedAt || s.startedAt).toDateString()),
    );
    let currentStreak = 0;
    const today = new Date();
    for (let i = 0; i < 365; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      if (days.has(d.toDateString())) {
        currentStreak++;
      } else if (i > 0) {
        break;
      }
    }

    // Weekly minutes, Mon = 0
    const weeklyData = [0, 0, 0, 0, 0, 0, 0];
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    startOfWeek.setHours(0, 0, 0, 0);
    for (const s of completed) {
      const d = new Date(s.completedAt || s.startedAt);
      if (d >= startOfWeek) {
        weeklyData[(d.getDay() + 6) % 7] += s.durationMinutes || 0;
      }
    }

    res.json({ success: true, totalSessions, totalMinutes, currentStreak, longestSession, weeklyData });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
