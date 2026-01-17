const express = require('express');
const router = express.Router();
const { protect, isRoomMember } = require('../middleware/auth');
const { prisma } = require('../config/database');
const logger = require('../utils/logger');
const NotificationService = require('../services/notificationService');
const PushNotificationService = require('../services/pushNotificationService');

// Helper to get today's date string (UTC)
const getTodayString = () => new Date().toISOString().split('T')[0];

// Send nudge to room
router.post('/:roomId', protect, isRoomMember, async (req, res) => {
  try {
    const { roomId } = req.params;
    const todayStr = getTodayString();
    
    // Check if user has completed any tasks today
    const completionsToday = await prisma.taskCompletion.count({
      where: {
        userId: req.user.id,
        roomId,
        completionDate: todayStr
      }
    });
    
    if (completionsToday === 0) {
      return res.status(400).json({
        success: false,
        message: 'You must complete at least one task today before sending a nudge'
      });
    }
    
    // Check if user has already sent a nudge today (UTC)
    const today = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()));
    const tomorrow = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate() + 1));
    
    const existingNudge = await prisma.nudge.findFirst({
      where: {
        roomId,
        senderId: req.user.id,
        createdAt: {
          gte: today,
          lt: tomorrow
        }
      }
    });
    
    if (existingNudge) {
      return res.status(400).json({
        success: false,
        message: 'You can only send one nudge per day per room'
      });
    }
    
    // Record the nudge
    await prisma.nudge.create({
      data: {
        roomId,
        senderId: req.user.id,
        message: "Your orbit is waiting – don't forget today's tasks."
      }
    });
    
    // Create system message in room
    const systemMessage = await prisma.chatMessage.create({
      data: {
        roomId,
        content: `✨ Your orbit is waiting – don't forget today's tasks.`,
        type: 'system'
      }
    });
    
    // Format for frontend
    const formattedMessage = {
      ...systemMessage,
      _id: systemMessage.id,
      roomId,
      message: systemMessage.content,
      messageType: 'system',
      type: 'system',
      isSystemMessage: true
    };
    
    // Emit socket event
    const io = req.app.get('io');
    io.to(roomId).emit('chat:message', { message: formattedMessage });

    // Create notifications for all room members (except sender)
    try {
      const roomMembers = req.room.members || [];
      const recipientIds = roomMembers
        .map(m => m.userId)
        .filter(uid => uid && uid !== req.user.id);

      // In-app notifications
      await Promise.allSettled(
        recipientIds.map(uid => NotificationService.createNotification({
          recipientId: uid,
          type: 'nudge',
          title: '🔔 Nudge from your room',
          message: `${req.user.username} nudged the room: don't forget today's tasks.`,
          roomId,
          data: { roomId, senderId: req.user.id }
        }))
      );

      // Push notifications
      if (recipientIds.length > 0) {
        PushNotificationService.notifyNudge(
          recipientIds,
          req.user.username,
          req.room.name,
          roomId
        ).catch(err => logger.warn('Push notification error for nudge:', err.message));
      }
    } catch (notifyErr) {
      logger.warn('Failed to create nudge notifications:', notifyErr.message);
    }
    
    logger.info(`Nudge sent in room ${roomId} by user ${req.user.id}`);
    
    res.json({
      success: true,
      message: 'Nudge sent successfully',
      systemMessage: formattedMessage
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
    const todayStr = getTodayString();
    
    // Check if user has completed any tasks today
    const completionsToday = await prisma.taskCompletion.count({
      where: {
        userId: req.user.id,
        roomId,
        completionDate: todayStr
      }
    });
    
    const hasCompletedTask = completionsToday > 0;
    
    // Check if already sent nudge today (UTC)
    const today = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()));
    const tomorrow = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate() + 1));
    
    const existingNudge = await prisma.nudge.findFirst({
      where: {
        roomId,
        senderId: req.user.id,
        createdAt: {
          gte: today,
          lt: tomorrow
        }
      }
    });
    
    const alreadySentToday = !!existingNudge;
    
    res.json({
      success: true,
      canSend: hasCompletedTask && !alreadySentToday,
      hasCompletedTask,
      alreadySentToday
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
