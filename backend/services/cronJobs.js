const cron = require('node-cron');
const NotificationService = require('./notificationService');
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
            await NotificationService.notifyTaskReminder(
              member.userId._id,
              task,
              room
            );
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

logger.info('Cron jobs initialized');

module.exports = {};
