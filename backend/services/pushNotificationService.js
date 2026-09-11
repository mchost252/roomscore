const webpush = require('web-push');
const { prisma } = require('../config/database');
const logger = require('../utils/logger');
const NotificationService = require('./notificationService');

// Configure web-push with VAPID keys (only if they exist)
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const pushNotificationsEnabled = !!(vapidPublicKey && vapidPrivateKey);

if (pushNotificationsEnabled) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@roomscore.com',
    vapidPublicKey,
    vapidPrivateKey
  );
  console.log('✅ Push notifications enabled');
} else {
  console.log('⚠️  Push notifications disabled (VAPID keys not configured)');
}

class PushNotificationService {
  static getNotificationType(payload) {
    const type = payload?.data?.notificationType || payload?.data?.type;
    return {
      new_task: 'room_task_created',
      task_completed: 'task_completed',
      new_message: 'direct_message',
      friend_request: 'friend_request',
      friend_accepted: 'friend_request_accepted',
      nudge: 'nudge_received',
      task_reminder: 'task_reminder',
    }[type] || type;
  }

  // Send push notification to a user
  static async sendToUser(userId, payload) {
    // Skip if push notifications not configured
    if (!pushNotificationsEnabled) {
      return { success: false, reason: 'Push notifications not configured' };
    }

    try {
      const notificationType = this.getNotificationType(payload);
      if (notificationType && !(await NotificationService.shouldDeliver(userId, notificationType, 'push'))) {
        return { success: false, reason: 'Blocked by notification preferences' };
      }
      const [user, devices] = await Promise.all([
        prisma.user.findUnique({
        where: { id: userId },
        select: { pushSubscription: true }
        }),
        prisma.pushDevice.findMany({
          where: { userId, enabled: true },
        }),
      ]);

      const legacy = user?.pushSubscription;
      const legacySubscription = typeof legacy === 'string' ? JSON.parse(legacy) : legacy;
      const subscriptions = devices.map(device => {
        const value = typeof device.subscription === 'string'
          ? JSON.parse(device.subscription)
          : device.subscription;
        return { id: device.id, value };
      }).filter(device => device.value?.endpoint && device.value?.keys);
      if (legacySubscription?.endpoint && legacySubscription?.keys &&
          !subscriptions.some(device => device.value.endpoint === legacySubscription.endpoint)) {
        subscriptions.push({ id: null, value: legacySubscription });
      }
      if (subscriptions.length === 0) {
        return { success: false, reason: 'No active subscription' };
      }

      const results = await Promise.all(subscriptions.map(async ({ id, value }) => {
        try {
          if (value.endpoint?.startsWith('ExponentPushToken[') || value.endpoint?.startsWith('ExpoPushToken[')) {
            const expoResponse = await fetch('https://exp.host/--/api/v2/push/send', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ to: value.endpoint, ...payload }),
            });
            if (!expoResponse.ok) throw new Error(`Expo push returned ${expoResponse.status}`);
            return true;
          }
          await webpush.sendNotification({
            endpoint: value.endpoint,
            keys: { p256dh: value.keys.p256dh, auth: value.keys.auth },
          }, JSON.stringify(payload));
          return true;
        } catch (error) {
          if (error.statusCode === 404 || error.statusCode === 410) {
            if (id) await prisma.pushDevice.delete({ where: { id } }).catch(() => {});
          }
          logger.warn(`Push delivery failed for user ${userId}:`, error.message);
          return false;
        }
      }));
      const delivered = results.filter(Boolean).length;
      logger.info(`Push notification delivered to ${userId} on ${delivered}/${results.length} devices`);
      return delivered > 0 ? { success: true } : { success: false, reason: 'Delivery failed' };
    } catch (error) {
      // If subscription is invalid, clear it
      if (error.statusCode === 410) {
        try {
          await prisma.user.update({ where: { id: userId }, data: { pushSubscription: null } });
        } catch (_) {}
      }
      logger.error('Error in sendToUser:', error);
      return { success: false, error: error.message };
    }
  }

  // Send push notification to multiple users
  static async sendToUsers(userIds, payload) {
    const results = [];
    
    for (const userId of userIds) {
      const result = await this.sendToUser(userId, payload);
      results.push({ userId, ...result });
    }

    return results;
  }

  // Notify new task created
  static async notifyNewTask(roomMembers, task, roomName, creatorUsername) {
    const payload = {
      title: `New Task in ${roomName}`,
      body: `${creatorUsername} created: ${task.title}`,
      icon: '/icon-192x192.png',
      badge: '/badge-72x72.png',
      tag: 'new-task',
      data: {
        type: 'room_task_created',
        roomId: task.roomId,
        taskId: task._id,
        url: `/rooms/${task.roomId}`
      }
    };

    return await this.sendToUsers(roomMembers, payload);
  }

  // Notify task completion
  static async notifyTaskCompletion(roomMembers, task, completedByUsername, roomName) {
    const payload = {
      title: `Task Completed in ${roomName}`,
      body: `${completedByUsername} completed: ${task.title}`,
      icon: '/icon-192x192.png',
      badge: '/badge-72x72.png',
      tag: 'task-completed',
      data: {
        type: 'task_completed',
        roomId: task.roomId,
        taskId: task._id,
        url: `/rooms/${task.roomId}`
      }
    };

    return await this.sendToUsers(roomMembers, payload);
  }

  // Notify new chat message
  static async notifyNewChat(roomMembers, senderUsername, messagePreview, roomName, roomId) {
    const payload = {
      title: `${senderUsername} in ${roomName}`,
      body: messagePreview,
      icon: '/icon-192x192.png',
      badge: '/badge-72x72.png',
      tag: `chat-${roomId}`,
      renotify: true,
      data: {
        type: 'room_updated',
        roomId: roomId,
        url: `/rooms/${roomId}`
      }
    };

    return await this.sendToUsers(roomMembers, payload);
  }

  // Notify member joined room
  static async notifyMemberJoined(roomMembers, joinedUsername, roomName, roomId) {
    const payload = {
      title: `New Member in ${roomName}`,
      body: `${joinedUsername} joined the room`,
      icon: '/icon-192x192.png',
      badge: '/badge-72x72.png',
      tag: 'member-joined',
      data: {
        type: 'room_joined',
        roomId: roomId,
        url: `/rooms/${roomId}`
      }
    };

    return await this.sendToUsers(roomMembers, payload);
  }

  // Notify member left room
  static async notifyMemberLeft(roomMembers, leftUsername, roomName, roomId) {
    const payload = {
      title: `Member Left ${roomName}`,
      body: `${leftUsername} left the room`,
      icon: '/icon-192x192.png',
      badge: '/badge-72x72.png',
      tag: 'member-left',
      data: {
        type: 'room_left',
        roomId: roomId,
        url: `/rooms/${roomId}`
      }
    };

    return await this.sendToUsers(roomMembers, payload);
  }

  // Notify room deleted/disbanded
  static async notifyRoomDisbanded(roomMembers, roomName) {
    const payload = {
      title: `Room Disbanded`,
      body: `${roomName} has been disbanded by the owner`,
      icon: '/icon-192x192.png',
      badge: '/badge-72x72.png',
      tag: 'room-disbanded',
      data: {
        type: 'room_disbanded',
        url: '/rooms'
      }
    };

    return await this.sendToUsers(roomMembers, payload);
  }

  // Notify new direct message
  static async notifyDirectMessage(recipientId, senderUsername, messagePreview, senderId) {
    const payload = {
      title: `Message from ${senderUsername}`,
      body: messagePreview.length > 100 ? messagePreview.substring(0, 100) + '...' : messagePreview,
      icon: '/icon-192x192.png',
      badge: '/badge-72x72.png',
      tag: `dm-${senderUsername}`,
      renotify: true,
      data: {
        type: 'direct_message',
        senderId,
        url: senderId ? `/messages/${senderId}` : '/messages'
      }
    };

    return await this.sendToUser(recipientId, payload);
  }

  // Notify friend request received
  static async notifyFriendRequest(recipientId, senderUsername) {
    const payload = {
      title: 'New Friend Request',
      body: `${senderUsername} sent you a friend request`,
      icon: '/icon-192x192.png',
      badge: '/badge-72x72.png',
      tag: 'friend-request',
      data: {
        type: 'friend_request',
        url: '/friends'
      }
    };

    return await this.sendToUser(recipientId, payload);
  }

  // Notify friend request accepted
  static async notifyFriendAccepted(requesterId, accepterUsername) {
    const payload = {
      title: 'Friend Request Accepted',
      body: `${accepterUsername} accepted your friend request`,
      icon: '/icon-192x192.png',
      badge: '/badge-72x72.png',
      tag: 'friend-accepted',
      data: {
        type: 'friend_request_accepted',
        url: '/friends'
      }
    };

    return await this.sendToUser(requesterId, payload);
  }

  // Notify task reminder
  static async notifyTaskReminder(userId, taskTitle, roomName, roomId) {
    const payload = {
      title: `Task Reminder`,
      body: `Don't forget to complete "${taskTitle}" in ${roomName}`,
      icon: '/icon-192x192.png',
      badge: '/badge-72x72.png',
      tag: `task-reminder-${roomId}`,
      data: {
        type: 'task_reminder',
        roomId: roomId,
        url: `/rooms/${roomId}`
      }
    };

    return await this.sendToUser(userId, payload);
  }

  // Notify nudge to room members
  static async notifyNudge(recipientIds, senderUsername, roomName, roomId) {
    const payload = {
      title: `🔔 Nudge from ${roomName}`,
      body: `${senderUsername} reminded the room: Your orbit is waiting – don't forget today's tasks!`,
      icon: '/icon-192x192.png',
      badge: '/badge-72x72.png',
      tag: `nudge-${roomId}`,
      data: {
        type: 'nudge_received',
        roomId: roomId,
        url: `/rooms/${roomId}`
      }
    };

    return await this.sendToUsers(recipientIds, payload);
  }
}

module.exports = PushNotificationService;
