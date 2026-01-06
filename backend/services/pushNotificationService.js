const webpush = require('web-push');
const User = require('../models/User');
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
      const user = await User.findById(userId);
      
      if (!user || !user.notificationSettings.pushEnabled || !user.pushSubscriptions.length) {
        return { success: false, reason: 'No active subscriptions' };
      }

      const results = [];
      const failedSubscriptions = [];

      // Send to all user's subscriptions (multiple devices)
      for (const subscription of user.pushSubscriptions) {
        try {
          const pushSubscription = {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.keys.p256dh,
              auth: subscription.keys.auth
            }
          };

          await webpush.sendNotification(
            pushSubscription,
            JSON.stringify(payload)
          );

          results.push({ success: true, endpoint: subscription.endpoint });
          logger.info(`Push notification sent to user ${userId}`);
        } catch (error) {
          logger.error(`Failed to send push notification:`, error);
          
          // If subscription is no longer valid (410 Gone), mark for removal
          if (error.statusCode === 410) {
            failedSubscriptions.push(subscription._id);
          }
          
          results.push({ success: false, endpoint: subscription.endpoint, error: error.message });
        }
      }

      // Clean up invalid subscriptions
      if (failedSubscriptions.length > 0) {
        await User.findByIdAndUpdate(userId, {
          $pull: { pushSubscriptions: { _id: { $in: failedSubscriptions } } }
        });
        logger.info(`Removed ${failedSubscriptions.length} invalid subscriptions for user ${userId}`);
      }

      return { success: true, results };
    } catch (error) {
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
}

module.exports = PushNotificationService;
