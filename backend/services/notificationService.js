const Notification = require('../models/Notification');
const { getIO } = require('../socket/io');
const logger = require('../utils/logger');

class NotificationService {
  // Create a notification
  static async createNotification({ userId, type, title, message, relatedRoom, relatedTask, data }) {
    try {
      // Ensure userId is a string (ObjectId), not an object
      const userIdString = userId._id ? userId._id.toString() : userId.toString();
      
      // Ensure relatedRoom and relatedTask are strings if provided
      const relatedRoomString = relatedRoom ? (relatedRoom._id ? relatedRoom._id.toString() : relatedRoom.toString()) : null;
      const relatedTaskString = relatedTask ? (relatedTask._id ? relatedTask._id.toString() : relatedTask.toString()) : null;
      
      const notification = await Notification.create({
        userId: userIdString,
        type,
        title,
        message,
        relatedRoom: relatedRoomString,
        relatedTask: relatedTaskString,
        data,
        sentAt: new Date()
      });

      logger.info(`Notification created for user ${userIdString}: ${type}`);

      // Emit socket events for new notification and updated unread count
      try {
        const io = getIO();
        if (io) {
          const unreadCount = await Notification.countDocuments({ userId: userIdString, isRead: false });
          io.to(`user:${userIdString}`).emit('notification:new', { notification });
          io.to(`user:${userIdString}`).emit('notification:unreadCount', { unreadCount });
        }
      } catch (emitErr) {
        logger.warn('Failed to emit socket event for notification:', emitErr.message);
      }

      return notification;
    } catch (error) {
      logger.error('Error creating notification:', error);
      throw error;
    }
  }

  // Schedule a notification
  static async scheduleNotification({ userId, type, title, message, scheduledFor, relatedRoom, relatedTask, data }) {
    try {
      const notification = await Notification.create({
        userId,
        type,
        title,
        message,
        scheduledFor,
        relatedRoom,
        relatedTask,
        data
      });

      logger.info(`Notification scheduled for user ${userId} at ${scheduledFor}`);
      return notification;
    } catch (error) {
      logger.error('Error scheduling notification:', error);
      throw error;
    }
  }

  // Send pending scheduled notifications
  static async sendScheduledNotifications() {
    try {
      const now = new Date();
      const pendingNotifications = await Notification.find({
        scheduledFor: { $lte: now },
        sentAt: null
      });

      for (const notification of pendingNotifications) {
        notification.sentAt = now;
        await notification.save();
        
        // Here you could emit socket event or send push notification
        logger.info(`Scheduled notification sent to user ${notification.userId}`);
      }

      return pendingNotifications.length;
    } catch (error) {
      logger.error('Error sending scheduled notifications:', error);
      throw error;
    }
  }

  // Notify task reminder
  static async notifyTaskReminder(userId, task, room) {
    return this.createNotification({
      userId,
      type: 'task_reminder',
      title: 'Task Reminder',
      message: `Don't forget to complete "${task.title}" in ${room.name}`,
      relatedRoom: room._id,
      relatedTask: task._id
    });
  }

  // Notify task deadline
  static async notifyTaskDeadline(userId, task, room) {
    return this.createNotification({
      userId,
      type: 'task_deadline',
      title: 'Task Deadline Approaching',
      message: `Task "${task.title}" deadline is approaching in ${room.name}`,
      relatedRoom: room._id,
      relatedTask: task._id
    });
  }

  // Notify achievement
  static async notifyAchievement(userId, achievementTitle, achievementMessage, room) {
    return this.createNotification({
      userId,
      type: 'achievement',
      title: achievementTitle,
      message: achievementMessage,
      relatedRoom: room._id
    });
  }

  // Notify room invite
  static async notifyRoomInvite(userId, room, invitedBy) {
    return this.createNotification({
      userId,
      type: 'room_invite',
      title: 'Room Invitation',
      message: `${invitedBy.username} invited you to join ${room.name}`,
      relatedRoom: room._id,
      data: { invitedBy: invitedBy._id }
    });
  }

  // Notify member joined
  static async notifyMemberJoined(userIds, newMember, room) {
    const notifications = [];
    for (const userId of userIds) {
      const notification = await this.createNotification({
        userId,
        type: 'member_joined',
        title: 'New Member',
        message: `${newMember.username} joined ${room.name}`,
        relatedRoom: room._id,
        data: { newMemberId: newMember._id }
      });
      notifications.push(notification);
    }
    return notifications;
  }

  // Clean up old notifications
  static async cleanupOldNotifications(daysOld = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const result = await Notification.deleteMany({
        createdAt: { $lt: cutoffDate },
        isRead: true
      });

      logger.info(`Cleaned up ${result.deletedCount} old notifications`);
      return result.deletedCount;
    } catch (error) {
      logger.error('Error cleaning up notifications:', error);
      throw error;
    }
  }
}

module.exports = NotificationService;
