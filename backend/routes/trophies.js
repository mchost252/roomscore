const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { getTrophiesForUser, evaluateAndUnlock } = require('../services/trophyService');
const { groupByCategory, CATEGORIES, RARITY } = require('../catalog/trophies');
const logger = require('../utils/logger');

/**
 * @route   GET /api/trophies
 * @desc    Fetch the full trophy catalog + the current user's progress.
 *          Returns trophies grouped by category for the screen layout,
 *          plus a flat list for callers that want to render their own UI.
 * @access  Private
 */
router.get('/', protect, async (req, res, next) => {
  try {
    const trophies = await getTrophiesForUser(req.user.id);
    const grouped = groupByCategory(trophies);

    const summary = {
      total: trophies.length,
      unlocked: trophies.filter((t) => t.unlocked).length,
      byRarity: Object.keys(RARITY).reduce((acc, rarity) => {
        acc[rarity] = trophies.filter((t) => t.rarity === rarity && t.unlocked).length;
        return acc;
      }, {}),
    };

    res.json({
      success: true,
      data: {
        categories: CATEGORIES,
        rarity: RARITY,
        grouped,
        trophies,
        summary,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/trophies/unlocked
 * @desc    Just the unlocked trophies for the current user, newest first.
 * @access  Private
 */
router.get('/unlocked', protect, async (req, res, next) => {
  try {
    const trophies = await getTrophiesForUser(req.user.id);
    const unlocked = trophies
      .filter((t) => t.unlocked)
      .sort((a, b) => new Date(b.unlockedAt) - new Date(a.unlockedAt));
    res.json({ success: true, data: { trophies: unlocked, count: unlocked.length } });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/trophies/recompute
 * @desc    Force re-evaluation of all trophies for the current user.
 *          Useful after a backfill or schema change.
 * @access  Private
 */
router.post('/recompute', protect, async (req, res, next) => {
  try {
    const newlyUnlocked = await evaluateAndUnlock(req.user.id, { silent: true });
    res.json({
      success: true,
      data: { newlyUnlocked, count: newlyUnlocked.length },
    });
  } catch (error) {
    logger.error('Trophy recompute failed:', error);
    next(error);
  }
});

module.exports = router;