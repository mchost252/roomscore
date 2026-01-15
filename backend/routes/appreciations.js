const express = require('express');
const router = express.Router();
const { protect, isRoomMember } = require('../middleware/auth');
const { prisma } = require('../config/database');
const logger = require('../utils/logger');

const DAILY_LIMIT = 3; // Maximum appreciations per day per room

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
    
    // Check daily limit
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const usedToday = await prisma.appreciation.count({
      where: {
        roomId,
        fromUserId: req.user.id,
        createdAt: {
          gte: today,
          lt: tomorrow
        }
      }
    });
    
    if (usedToday >= DAILY_LIMIT) {
      return res.status(400).json({
        success: false,
        message: `You can only give ${DAILY_LIMIT} appreciations per day per room`
      });
    }
    
    // Check if already gave this type to this user today
    const existingAppreciation = await prisma.appreciation.findFirst({
      where: {
        roomId,
        fromUserId: req.user.id,
        toUserId,
        type,
        createdAt: {
          gte: today,
          lt: tomorrow
        }
      }
    });
    
    if (existingAppreciation) {
      return res.status(400).json({
        success: false,
        message: 'You have already given this appreciation today'
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
    const stats = await prisma.appreciation.groupBy({
      by: ['type'],
      where: {
        roomId,
        toUserId
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
      toUserId,
      stats: formattedStats
    });
    
    logger.info(`Appreciation (${type}) given in room ${roomId} from ${req.user.id} to ${toUserId}`);
    
    res.json({
      success: true,
      message: 'Appreciation given successfully',
      appreciation: { ...appreciation, _id: appreciation.id },
      stats: formattedStats
    });
    
  } catch (error) {
    logger.error('Error giving appreciation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to give appreciation'
    });
  }
});

// Get appreciation stats for a user in a room
router.get('/:roomId/user/:userId', protect, isRoomMember, async (req, res) => {
  try {
    const { roomId, userId } = req.params;
    
    const stats = await prisma.appreciation.groupBy({
      by: ['type'],
      where: {
        roomId,
        toUserId: userId
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
      stats: formattedStats
    });
    
  } catch (error) {
    logger.error('Error getting appreciation stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get appreciation stats'
    });
  }
});

// Get remaining appreciations for current user today
router.get('/:roomId/remaining', protect, isRoomMember, async (req, res) => {
  try {
    const { roomId } = req.params;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const usedToday = await prisma.appreciation.count({
      where: {
        roomId,
        fromUserId: req.user.id,
        createdAt: {
          gte: today,
          lt: tomorrow
        }
      }
    });
    
    const remaining = Math.max(0, DAILY_LIMIT - usedToday);
    
    res.json({
      success: true,
      dailyLimit: DAILY_LIMIT,
      usedToday,
      remaining
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
