const webpush = require('web-push');
const { prisma } = require('../config/database');
const logger = require('../utils/logger');

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
  // Send push notification to a user
  static async sendToUser(userId, payload) {
    // Skip if push notifications not configured
    if (!pushNotificationsEnabled) {
      return { success: false, reason: 'Push notifications not configured' };
    }

    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { pushSubscription: true }
      });

      if (!user?.pushSubscription?.endpoint || !user.pushSubscription?.keys) {
        return { success: false, reason: 'No active subscription' };
      }

      const pushSubscription = {
        endpoint: user.pushSubscription.endpoint,
        keys: {
          p256dh: user.pushSubscription.keys.p256dh,
          auth: user.pushSubscription.keys.auth
        }
      };

      await webpush.sendNotification(pushSubscription, JSON.stringify(payload));
      logger.info(`Push notification sent to user ${userId}`);
      return { success: true };
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
        type: 'new_task',
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
        type: 'new_chat',
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
        type: 'member_joined',
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
        type: 'member_left',
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
        type: 'friend_accepted',
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
        type: 'nudge',
        roomId: roomId,
        url: `/rooms/${roomId}`
      }
    };

    return await this.sendToUsers(recipientIds, payload);
  }
}

module.exports = PushNotificationService;
