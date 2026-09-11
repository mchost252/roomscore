const { prisma } = require('../config/database');
const { getIO } = require('../socket/io');
const logger = require('../utils/logger');
const {
  getNotificationMetadata,
  buildNotificationDedupeKey,
} = require('../utils/notificationContract');

class NotificationService {
  static defaultPreferences() {
    return {
      enabled: true,
      categories: {
        messages: true,
        social: true,
        rooms: true,
        tasks: true,
        achievements: true,
        system: true,
      },
      sound: true,
      vibration: true,
      quietHours: { enabled: false, start: '22:00', end: '07:00', timezone: 'UTC' },
    };
  }

  static parsePreferences(value) {
    const defaults = this.defaultPreferences();
    let parsed = {};
    if (typeof value === 'string' && value) {
      try { parsed = JSON.parse(value); } catch (_) { parsed = {}; }
    } else if (value && typeof value === 'object') {
      parsed = value;
    }
    return {
      ...defaults,
      ...parsed,
      categories: { ...defaults.categories, ...(parsed.categories || {}) },
      quietHours: { ...defaults.quietHours, ...(parsed.quietHours || {}) },
    };
  }

  static async getPreferences(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { notificationPreferences: true },
    });
    return this.parsePreferences(user?.notificationPreferences);
  }

  static async updatePreferences(userId, updates) {
    const current = await this.getPreferences(userId);
    const defined = Object.fromEntries(Object.entries(updates).filter(([, value]) => value !== undefined));
    const next = this.parsePreferences({
      ...current,
      ...defined,
      categories: { ...current.categories, ...(defined.categories || {}) },
      quietHours: { ...current.quietHours, ...(defined.quietHours || {}) },
    });
    await prisma.user.update({
      where: { id: userId },
      data: { notificationPreferences: JSON.stringify(next) },
    });
    return next;
  }

  static isWithinQuietHours(preferences, now = new Date()) {
    const quiet = preferences.quietHours;
    if (!quiet?.enabled || !quiet.start || !quiet.end) return false;
    let local = now;
    try {
      local = new Date(now.toLocaleString('en-US', { timeZone: quiet.timezone || 'UTC' }));
    } catch (_) {}
    const minutes = local.getHours() * 60 + local.getMinutes();
    const [startHour, startMinute] = quiet.start.split(':').map(Number);
    const [endHour, endMinute] = quiet.end.split(':').map(Number);
    const start = startHour * 60 + startMinute;
    const end = endHour * 60 + endMinute;
    return start === end ? true : start < end
      ? minutes >= start && minutes < end
      : minutes >= start || minutes < end;
  }

  static async shouldDeliver(userId, type, channel = 'push') {
    const preferences = await this.getPreferences(userId);
    const metadata = getNotificationMetadata(type);
    if (!preferences.enabled || preferences.categories[metadata.category] === false) return false;
    if (channel === 'push' && this.isWithinQuietHours(preferences)) return false;
    return true;
  }

  static async getUnreadSummary(userId) {
    const [notificationGroups, messageUnread, pendingFriendRequests] = await Promise.all([
      prisma.notification.groupBy({
        by: ['category'],
        where: { userId, read: false },
        _count: { id: true },
      }),
      prisma.directMessage.count({
        where: {
          toUserId: userId,
          read: false,
          OR: [
            { deletedFor: null },
            { NOT: { deletedFor: { contains: userId } } },
          ],
        },
      }),
      prisma.friend.count({
        where: { toUserId: userId, status: 'pending' },
      }),
    ]);

    const notifications = notificationGroups.reduce((sum, group) => sum + group._count.id, 0);
    const rooms = notificationGroups
      .filter(group => group.category === 'rooms')
      .reduce((sum, group) => sum + group._count.id, 0);
    const friendRequestNotifications = await prisma.notification.count({
      where: { userId, type: 'friend_request', read: false },
    });
    const friendRequests = pendingFriendRequests;
    const additionalFriendRequests = Math.max(0, friendRequests - friendRequestNotifications);
    const messages = messageUnread;

    return {
      total: notifications + messages + additionalFriendRequests,
      notifications,
      messages,
      friendRequests,
      rooms,
    };
  }

  // Create a notification
  static async createNotification({
    recipientId,
    userId,
    type,
    title,
    message,
    roomId,
    data,
    dedupeKey,
    entityId,
    occurrence,
  }) {
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

      const metadata = getNotificationMetadata(type);
      const resolvedDedupeKey = dedupeKey || (entityId
        ? buildNotificationDedupeKey({
            type,
            recipientId: userIdString,
            entityId,
            occurrence,
          })
        : null);
      const notificationData = {
        userId: userIdString,
        type,
        title,
        message,
        data: {
          ...(data || {}),
          ...(roomId ? { roomId } : {}),
        },
        category: metadata.category,
        priority: metadata.priority,
        dedupeKey: resolvedDedupeKey,
        read: false,
      };
      const notification = resolvedDedupeKey
        ? await prisma.notification.upsert({
            where: {
              userId_dedupeKey: {
                userId: userIdString,
                dedupeKey: resolvedDedupeKey,
              },
            },
            create: notificationData,
            update: {
              title,
              message,
              data: data || null,
              category: metadata.category,
              priority: metadata.priority,
              expiresAt: undefined,
            },
          })
        : await prisma.notification.create({ data: notificationData });

      logger.info(`Notification created for user ${userIdString}: ${type}`);

      // Emit socket events
      try {
        const io = getIO();
        if (io) {
          const unreadCount = await prisma.notification.count({
            where: { userId: userIdString, read: false }
          });
          if (await this.shouldDeliver(userIdString, type, 'realtime')) {
            io.to(`user:${userIdString}`).emit('notification:new', {
              notification: { ...notification, _id: notification.id, isRead: notification.read }
            });
          }
          io.to(`user:${userIdString}`).emit('notification:unreadCount', { unreadCount });
          this.getUnreadSummary(userIdString)
            .then(summary => io.to(`user:${userIdString}`).emit('notification:counts', summary))
            .catch(err => logger.warn('Failed to emit notification counts:', err.message));
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
        type: 'room_joined',
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
