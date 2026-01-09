const cron = require('node-cron');
const NotificationService = require('./notificationService');
const PushNotificationService = require('./pushNotificationService');
const ChatMessage = require('../models/ChatMessage');
const Room = require('../models/Room');
const logger = require('../utils/logger');

// Send scheduled notifications every 5 minutes
cron.schedule('*/5 * * * *', async () => {
  try {
    logger.info('Running scheduled notifications job...');
    const count = await NotificationService.sendScheduledNotifications();
    logger.info(`Sent ${count} scheduled notifications`);
  } catch (error) {
    logger.error('Error in scheduled notifications job:', error);
  }
});

// Clean up old notifications daily at 2 AM
cron.schedule('0 2 * * *', async () => {
  try {
    logger.info('Running notification cleanup job...');
    const count = await NotificationService.cleanupOldNotifications(30);
    logger.info(`Cleaned up ${count} old notifications`);
  } catch (error) {
    logger.error('Error in notification cleanup job:', error);
  }
});

// Clean up old chat messages based on room retention settings
cron.schedule('0 3 * * *', async () => {
  try {
    logger.info('Running chat message cleanup job...');
    const rooms = await Room.find({ isActive: true });
    
    let totalDeleted = 0;
    for (const room of rooms) {
      const retentionDays = room.settings.messageRetentionDays || 30;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const result = await ChatMessage.deleteMany({
        roomId: room._id,
        createdAt: { $lt: cutoffDate }
      });

      totalDeleted += result.deletedCount;
    }
    
    logger.info(`Cleaned up ${totalDeleted} old chat messages`);
  } catch (error) {
    logger.error('Error in chat message cleanup job:', error);
  }
});

// Send daily task reminders at 8 AM
cron.schedule('0 8 * * *', async () => {
  try {
    logger.info('Running daily task reminder job...');
    const rooms = await Room.find({ isActive: true }).populate('members.userId');
    
    let reminderCount = 0;
    for (const room of rooms) {
      const today = new Date();
      const dayOfWeek = today.getDay();
      
      // Get today's tasks
      const todayTasks = room.tasks.filter(task => {
        if (!task.isActive) return false;
        if (task.frequency === 'daily') return true;
        if (task.frequency === 'weekly' && task.daysOfWeek.includes(dayOfWeek)) return true;
        if (task.frequency === 'monthly') return true;
        return false;
      });

      // Send reminders to all members
      for (const member of room.members) {
        if (member.userId && member.userId.notificationSettings?.taskReminders) {
          for (const task of todayTasks) {
            // Create in-app notification
            await NotificationService.notifyTaskReminder(
              member.userId._id,
              task,
              room
            );
            
            // Send push notification
            try {
              await PushNotificationService.notifyTaskReminder(
                member.userId._id,
                task.title,
                room.name,
                room._id.toString()
              );
            } catch (pushErr) {
              logger.error('Push notification error for task reminder:', pushErr);
            }
            
            reminderCount++;
          }
        }
      }
    }
    
    logger.info(`Sent ${reminderCount} task reminders`);
  } catch (error) {
    logger.error('Error in task reminder job:', error);
  }
});

// Deactivate expired rooms daily at 1 AM
cron.schedule('0 1 * * *', async () => {
  try {
    logger.info('Running expired rooms cleanup job...');
    const now = new Date();
    
    // Find all active rooms that have expired
    const expiredRooms = await Room.find({
      isActive: true,
      expiresAt: { $lte: now }
    }).populate('members.userId', '_id');
    
    let deactivatedCount = 0;
    for (const room of expiredRooms) {
      // Get all member IDs for notifications
      const memberIds = room.members
        .map(m => m.userId?._id?.toString())
        .filter(Boolean);
      
      // Deactivate the room
      room.isActive = false;
      room.deletedAt = now;
      await room.save();
      
      // Notify all members that the room has expired
      for (const memberId of memberIds) {
        try {
          await NotificationService.createNotification({
            userId: memberId,
            type: 'room_expired',
            title: `Room Expired`,
            message: `${room.name} has reached its end date and is now closed`,
            relatedRoom: room._id
          });
        } catch (err) {
          logger.error('Error creating room expired notification:', err);
        }
      }
      
      deactivatedCount++;
      logger.info(`Deactivated expired room: ${room.name}`);
    }
    
    logger.info(`Deactivated ${deactivatedCount} expired rooms`);
  } catch (error) {
    logger.error('Error in expired rooms cleanup job:', error);
  }
});

// Warn rooms expiring soon (3 days before) - daily at 9 AM
cron.schedule('0 9 * * *', async () => {
  try {
    logger.info('Running room expiry warning job...');
    const now = new Date();
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const twoDaysFromNow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
    
    // Find rooms expiring in ~3 days (between 2-3 days from now to avoid duplicate warnings)
    const expiringRooms = await Room.find({
      isActive: true,
      expiresAt: { 
        $gte: twoDaysFromNow,
        $lte: threeDaysFromNow 
      }
    }).populate('members.userId', '_id');
    
    let warnedCount = 0;
    for (const room of expiringRooms) {
      // Get owner ID for notification
      const ownerId = room.owner.toString();
      
      try {
        await NotificationService.createNotification({
          userId: ownerId,
          type: 'room_expiring_soon',
          title: `Room Expiring Soon`,
          message: `${room.name} will expire in 3 days`,
          relatedRoom: room._id
        });
        warnedCount++;
      } catch (err) {
        logger.error('Error creating room expiry warning notification:', err);
      }
    }
    
    logger.info(`Sent ${warnedCount} room expiry warnings`);
  } catch (error) {
    logger.error('Error in room expiry warning job:', error);
  }
});

logger.info('Cron jobs initialized');

module.exports = {};
