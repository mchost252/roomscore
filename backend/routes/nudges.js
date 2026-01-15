const express = require('express');
const router = express.Router();
const { protect, isRoomMember } = require('../middleware/auth');
const Room = require('../models/Room');
const Nudge = require('../models/Nudge');
const TaskCompletion = require('../models/TaskCompletion');
const ChatMessage = require('../models/ChatMessage');
const logger = require('../utils/logger');

// Send nudge to room
router.post('/:roomId', protect, isRoomMember, async (req, res) => {
  try {
    const { roomId } = req.params;
    
    // Check if user has completed any tasks today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const completionsToday = await TaskCompletion.countDocuments({
      userId: req.user.id,
      roomId,
      completedAt: {
        $gte: today,
        $lt: tomorrow
      }
    });
    
    if (completionsToday === 0) {
      return res.status(400).json({
        success: false,
        message: 'You must complete at least one task today before sending a nudge'
      });
    }
    
    // Check if user has already sent a nudge today
    const canSendNudge = await Nudge.canSendNudge(roomId, req.user.id);
    
    if (!canSendNudge) {
      return res.status(400).json({
        success: false,
        message: 'You can only send one nudge per day per room'
      });
    }
    
    // Record the nudge
    await Nudge.recordNudge(roomId, req.user.id);
    
    // Create system message in room
    const systemMessage = await ChatMessage.create({
      roomId,
      message: `✨ Your orbit is waiting – don't forget today's tasks.`,
      isSystemMessage: true
    });
    
    // Emit socket event
    const io = req.app.get('io');
    io.to(roomId).emit('chat:message', { message: systemMessage });
    
    logger.info(`Nudge sent in room ${roomId} by user ${req.user.id}`);
    
    res.json({
      success: true,
      message: 'Nudge sent successfully',
      systemMessage
    });
    
  } catch (error) {
    logger.error('Error sending nudge:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send nudge'
    });
  }
});

// Check if user can send nudge today
router.get('/:roomId/can-send', protect, isRoomMember, async (req, res) => {
  try {
    const { roomId } = req.params;
    
    // Check if user has completed any tasks today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const completionsToday = await TaskCompletion.countDocuments({
      userId: req.user.id,
      roomId,
      completedAt: {
        $gte: today,
        $lt: tomorrow
      }
    });
    
    const hasCompletedTask = completionsToday > 0;
    const canSend = await Nudge.canSendNudge(roomId, req.user.id);
    
    res.json({
      success: true,
      canSend: hasCompletedTask && canSend,
      hasCompletedTask,
      alreadySentToday: !canSend
    });
    
  } catch (error) {
    logger.error('Error checking nudge status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check nudge status'
    });
  }
});

module.exports = router;
