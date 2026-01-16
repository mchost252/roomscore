const express = require('express');
const router = express.Router();
const { protect, isRoomMember } = require('../middleware/auth');
const { prisma } = require('../config/database');
const logger = require('../utils/logger');
const NotificationService = require('../services/notificationService');

const DAILY_LIMIT = 3; // Maximum appreciations per 24 hours per room

// UTC day window (server time) so resets are consistent across devices.
const getUtcDayStart = (d = new Date()) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
const getUtcNextDayStart = (d = new Date()) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1));

// Give appreciation to a user
router.post('/:roomId', protect, isRoomMember, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { toUserId, type } = req.body;
    
    // Validate type
    if (!['star', 'fire', 'shield'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid appreciation type'
      });
    }
    
    // Cannot appreciate yourself
    if (toUserId === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'You cannot appreciate yourself'
      });
    }
    
    // Check if recipient is a room member
    const isMember = req.room.members.some(m => m.userId === toUserId);
    
    if (!isMember) {
      return res.status(400).json({
        success: false,
        message: 'User is not a member of this room'
      });
    }
    
    // Check UTC-day limit (consistent across devices)
    const windowStart = getUtcDayStart();
    const windowEnd = getUtcNextDayStart();

    const usedInWindow = await prisma.appreciation.count({
      where: {
        roomId,
        fromUserId: req.user.id,
        createdAt: { gte: windowStart, lt: windowEnd }
      }
    });
    
    if (usedInWindow >= DAILY_LIMIT) {
      return res.status(400).json({
        success: false,
        message: `You can only give ${DAILY_LIMIT} appreciations per day (UTC) per room`
      });
    }
    
    // Check if already gave this type to this user in the last 24h
    const existingAppreciation = await prisma.appreciation.findFirst({
      where: {
        roomId,
        fromUserId: req.user.id,
        toUserId,
        type,
        createdAt: { gte: windowStart, lt: windowEnd }
      }
    });
    
    if (existingAppreciation) {
      return res.status(400).json({
        success: false,
        message: 'You have already given this appreciation today (UTC)'
      });
    }
    
    // Record appreciation
    const appreciation = await prisma.appreciation.create({
      data: {
        roomId,
        fromUserId: req.user.id,
        toUserId,
        type
      }
    });
    
    // Get updated stats for the recipient
    // Stats are only for the last 24h (rolling)
    const stats = await prisma.appreciation.groupBy({
      by: ['type'],
      where: {
        roomId,
        toUserId,
        createdAt: { gte: windowStart, lt: windowEnd }
      },
      _count: {
        type: true
      }
    });
    
    const formattedStats = {
      star: 0,
      fire: 0,
      shield: 0
    };
    
    stats.forEach(s => {
      formattedStats[s.type] = s._count.type;
    });
    
    // Emit socket event
    const io = req.app.get('io');
    io.to(roomId).emit('appreciation:given', {
      appreciation: { ...appreciation, _id: appreciation.id },
      fromUserId: req.user.id,
      toUserId,
      type,
      stats: formattedStats,
      windowStart,
      windowEnd
    });
    
    // Create notification for recipient
    try {
      await NotificationService.createNotification({
        recipientId: toUserId,
        type: 'appreciation',
        title: '✨ New appreciation',
        message: `${req.user.username} sent you ${type === 'star' ? 'a ⭐ star' : type === 'fire' ? 'a 🔥 fire' : 'a 🛡️ shield'} in the room.`,
        roomId,
        data: { roomId, fromUserId: req.user.id, type }
      });
    } catch (notifyErr) {
      logger.warn('Failed to create appreciation notification:', notifyErr.message);
    }

    logger.info(`Appreciation (${type}) given in room ${roomId} from ${req.user.id} to ${toUserId}`);
    
    res.json({
      success: true,
      message: 'Appreciation given successfully',
      appreciation: { ...appreciation, _id: appreciation.id },
      stats: formattedStats,
      windowStart,
      windowEnd
    });
    
  } catch (error) {
    logger.error('Error giving appreciation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to give appreciation'
    });
  }
});

// Get appreciation stats for a user in a room (current UTC day)
router.get('/:roomId/user/:userId', protect, isRoomMember, async (req, res) => {
  try {
    const { roomId, userId } = req.params;
    
    const windowStart = getUtcDayStart();
    const windowEnd = getUtcNextDayStart();
    const stats = await prisma.appreciation.groupBy({
      by: ['type'],
      where: {
        roomId,
        toUserId: userId,
        createdAt: { gte: windowStart, lt: windowEnd }
      },
      _count: {
        type: true
      }
    });
    
    const formattedStats = {
      star: 0,
      fire: 0,
      shield: 0
    };
    
    stats.forEach(s => {
      formattedStats[s.type] = s._count.type;
    });
    
    res.json({
      success: true,
      stats: formattedStats,
      windowStart,
      windowEnd
    });
    
  } catch (error) {
    logger.error('Error getting appreciation stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get appreciation stats'
    });
  }
});

// Get appreciations the current user has sent in this room within the last 24h
// Used by the UI to disable already-sent appreciation buttons
router.get('/:roomId/sent', protect, isRoomMember, async (req, res) => {
  try {
    const { roomId } = req.params;
    const windowStart = getUtcDayStart();
    const windowEnd = getUtcNextDayStart();

    const sent = await prisma.appreciation.findMany({
      where: {
        roomId,
        fromUserId: req.user.id,
        createdAt: { gte: windowStart, lt: windowEnd }
      },
      select: {
        id: true,
        toUserId: true,
        type: true,
        createdAt: true
      }
    });

    res.json({
      success: true,
      windowStart,
      windowEnd,
      sent: sent.map(a => ({ ...a, _id: a.id }))
    });
  } catch (error) {
    logger.error('Error getting sent appreciations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get sent appreciations'
    });
  }
});

// Get remaining appreciations for current user (last 24h rolling)
router.get('/:roomId/remaining', protect, isRoomMember, async (req, res) => {
  try {
    const { roomId } = req.params;
    
    const windowStart = getUtcDayStart();
    const windowEnd = getUtcNextDayStart();

    const usedInWindow = await prisma.appreciation.count({
      where: {
        roomId,
        fromUserId: req.user.id,
        createdAt: { gte: windowStart, lt: windowEnd }
      }
    });

    const remaining = Math.max(0, DAILY_LIMIT - usedInWindow);
    
    res.json({
      success: true,
      dailyLimit: DAILY_LIMIT,
      usedInWindow,
      remaining,
      windowStart,
      windowEnd
    });
    
  } catch (error) {
    logger.error('Error getting remaining appreciations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get remaining appreciations'
    });
  }
});

module.exports = router;
