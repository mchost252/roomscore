const express = require('express');
const router = express.Router();
const { protect, isRoomMember } = require('../middleware/auth');
const Room = require('../models/Room');
const Appreciation = require('../models/Appreciation');
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
    const room = await Room.findById(roomId);
    const isMember = room.members.some(m => 
      m.userId.toString() === toUserId || m.userId._id?.toString() === toUserId
    );
    
    if (!isMember) {
      return res.status(400).json({
        success: false,
        message: 'User is not a member of this room'
      });
    }
    
    // Check daily limit
    const canGive = await Appreciation.canGiveAppreciation(roomId, req.user.id, DAILY_LIMIT);
    
    if (!canGive) {
      return res.status(400).json({
        success: false,
        message: `You can only give ${DAILY_LIMIT} appreciations per day per room`
      });
    }
    
    // Record appreciation
    const appreciation = await Appreciation.recordAppreciation(
      roomId,
      req.user.id,
      toUserId,
      type
    );
    
    // Get updated stats for the recipient
    const stats = await Appreciation.getUserStats(roomId, toUserId);
    
    // Emit socket event
    const io = req.app.get('io');
    io.to(roomId).emit('appreciation:given', {
      appreciation,
      toUserId,
      stats
    });
    
    logger.info(`Appreciation (${type}) given in room ${roomId} from ${req.user.id} to ${toUserId}`);
    
    res.json({
      success: true,
      message: 'Appreciation given successfully',
      appreciation,
      stats
    });
    
  } catch (error) {
    logger.error('Error giving appreciation:', error);
    
    if (error.message === 'You have already given this appreciation today') {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    
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
    
    const stats = await Appreciation.getUserStats(roomId, userId);
    
    res.json({
      success: true,
      stats
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
    
    const usedToday = await Appreciation.getDailyCount(roomId, req.user.id);
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
