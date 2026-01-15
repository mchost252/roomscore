const { prisma } = require('../config/database');
const { getIO } = require('../socket/io');
const logger = require('../utils/logger');

class NotificationService {
  // Create a notification
  static async createNotification({ recipientId, userId, type, title, message, roomId, data }) {
    try {
      // Support both recipientId and userId for backward compatibility
      const targetUserId = recipientId || userId;
      
      // Ensure userId is a string
      const userIdString = targetUserId?._id ? targetUserId._id.toString() : 
                          (typeof targetUserId === 'object' ? targetUserId.toString() : targetUserId);
      
      if (!userIdString) {
        logger.warn('No userId provided for notification');
        return null;
      }

      const notification = await prisma.notification.create({
        data: {
          userId: userIdString,
          type,
          title,
          message,
          data: data || null,
          read: false
        }
      });

      logger.info(`Notification created for user ${userIdString}: ${type}`);

      // Emit socket events
      try {
        const io = getIO();
        if (io) {
          const unreadCount = await prisma.notification.count({
            where: { userId: userIdString, read: false }
          });
          io.to(`user:${userIdString}`).emit('notification:new', { 
            notification: { ...notification, _id: notification.id, isRead: notification.read }
          });
          io.to(`user:${userIdString}`).emit('notification:unreadCount', { unreadCount });
        }
      } catch (emitErr) {
        logger.warn('Failed to emit socket event for notification:', emitErr.message);
      }

      return notification;
    } catch (error) {
      logger.error('Error creating notification:', error);
      // Don't throw - notifications should not break main functionality
      return null;
    }
  }

  // Notify task reminder
  static async notifyTaskReminder(userId, task, room) {
    return this.createNotification({
      recipientId: userId,
      type: 'task_reminder',
      title: 'Task Reminder',
      message: `Don't forget to complete "${task.title}" in ${room.name}`,
      roomId: room.id || room._id
    });
  }

  // Notify task deadline
  static async notifyTaskDeadline(userId, task, room) {
    return this.createNotification({
      recipientId: userId,
      type: 'task_deadline',
      title: 'Task Deadline Approaching',
      message: `Task "${task.title}" deadline is approaching in ${room.name}`,
      roomId: room.id || room._id
    });
  }

  // Notify achievement
  static async notifyAchievement(userId, achievementTitle, achievementMessage, room) {
    return this.createNotification({
      recipientId: userId,
      type: 'achievement',
      title: achievementTitle,
      message: achievementMessage,
      roomId: room?.id || room?._id
    });
  }

  // Notify room invite
  static async notifyRoomInvite(userId, room, invitedBy) {
    return this.createNotification({
      recipientId: userId,
      type: 'room_invite',
      title: 'Room Invitation',
      message: `${invitedBy.username} invited you to join ${room.name}`,
      roomId: room.id || room._id,
      data: { invitedBy: invitedBy.id || invitedBy._id }
    });
  }

  // Notify member joined
  static async notifyMemberJoined(userIds, newMember, room) {
    const notifications = [];
    for (const userId of userIds) {
      const notification = await this.createNotification({
        recipientId: userId,
        type: 'member_joined',
        title: 'New Member',
        message: `${newMember.username} joined ${room.name}`,
        roomId: room.id || room._id,
        data: { newMemberId: newMember.id || newMember._id }
      });
      if (notification) notifications.push(notification);
    }
    return notifications;
  }

  // Clean up old notifications
  static async cleanupOldNotifications(daysOld = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const result = await prisma.notification.deleteMany({
        where: {
          createdAt: { lt: cutoffDate },
          read: true
        }
      });

      logger.info(`Cleaned up ${result.count} old notifications`);
      return result.count;
    } catch (error) {
      logger.error('Error cleaning up notifications:', error);
      return 0;
    }
  }
}

module.exports = NotificationService;
