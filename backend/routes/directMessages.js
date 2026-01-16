const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { prisma } = require('../config/database');
const NotificationService = require('../services/notificationService');
const PushNotificationService = require('../services/pushNotificationService');
const logger = require('../utils/logger');

// @route   GET /api/direct-messages/conversations
// @desc    Get user's conversations (list of friends with last message)
// @access  Private
router.get('/conversations', protect, async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Get all accepted friendships
    const friendships = await prisma.friend.findMany({
      where: {
        status: 'accepted',
        OR: [
          { fromUserId: userId },
          { toUserId: userId }
        ]
      },
      include: {
        fromUser: { select: { id: true, username: true } },
        toUser: { select: { id: true, username: true } }
      }
    });

    if (friendships.length === 0) {
      return res.json({ success: true, conversations: [] });
    }

    // Get friend IDs
    const friendIds = friendships.map(f => 
      f.fromUserId === userId ? f.toUserId : f.fromUserId
    );

    // Get last messages for each conversation
    const conversations = await Promise.all(friendships.map(async (friendship) => {
      const friendId = friendship.fromUserId === userId ? friendship.toUserId : friendship.fromUserId;
      const friendData = friendship.fromUserId === userId ? friendship.toUser : friendship.fromUser;

      // Get last message
      const lastMessage = await prisma.directMessage.findFirst({
        where: {
          OR: [
            { fromUserId: userId, toUserId: friendId },
            { fromUserId: friendId, toUserId: userId }
          ]
        },
        orderBy: { createdAt: 'desc' }
      });

      // Get unread count
      const unreadCount = await prisma.directMessage.count({
        where: {
          fromUserId: friendId,
          toUserId: userId,
          read: false
        }
      });

      return {
        friend: { ...friendData, _id: friendData.id },
        lastMessage: lastMessage ? { ...lastMessage, _id: lastMessage.id } : null,
        unreadCount
      };
    }));

    // Sort by last message time
    conversations.sort((a, b) => {
      const aTime = a.lastMessage?.createdAt || 0;
      const bTime = b.lastMessage?.createdAt || 0;
      return new Date(bTime) - new Date(aTime);
    });

    res.json({ success: true, conversations });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/direct-messages/:friendId
// @desc    Get messages with a specific friend
// @access  Private
router.get('/:friendId', protect, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const friendId = req.params.friendId;

    // Verify friendship exists
    const friendship = await prisma.friend.findFirst({
      where: {
        status: 'accepted',
        OR: [
          { fromUserId: userId, toUserId: friendId },
          { fromUserId: friendId, toUserId: userId }
        ]
      }
    });

    if (!friendship) {
      return res.status(403).json({ success: false, message: 'Not friends with this user' });
    }

    // Get messages
    const messages = await prisma.directMessage.findMany({
      where: {
        OR: [
          { fromUserId: userId, toUserId: friendId },
          { fromUserId: friendId, toUserId: userId }
        ]
      },
      include: {
        fromUser: { select: { id: true, username: true } },
        toUser: { select: { id: true, username: true } }
      },
      orderBy: { createdAt: 'asc' },
      take: 100
    });

    // Mark messages from friend as read
    await prisma.directMessage.updateMany({
      where: {
        fromUserId: friendId,
        toUserId: userId,
        read: false
      },
      data: { read: true }
    });

    // Format for frontend
    const formattedMessages = messages.map(m => ({
      ...m,
      _id: m.id,
      message: m.content,
      sender: { ...m.fromUser, _id: m.fromUser.id },
      recipient: { ...m.toUser, _id: m.toUser.id }
    }));

    res.json({ success: true, messages: formattedMessages });
  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/direct-messages/read/:friendId
// @desc    Mark all messages from friend as read
// @access  Private
router.put('/read/:friendId', protect, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const friendId = req.params.friendId;

    const result = await prisma.directMessage.updateMany({
      where: {
        fromUserId: friendId,
        toUserId: userId,
        read: false
      },
      data: { read: true }
    });

    // Notify sender via socket
    const io = req.app.get('io');
    if (io && result.count > 0) {
      io.to(`user:${friendId}`).emit('dm:read', {
        readBy: userId,
        readAt: new Date().toISOString()
      });
    }

    res.json({ success: true, markedRead: result.count });
  } catch (error) {
    next(error);
  }
});

// @route   DELETE /api/direct-messages/:friendId
// @desc    Clear direct message history with a specific friend
// @access  Private
router.delete('/:friendId', protect, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const friendId = req.params.friendId;

    // Verify friendship exists
    const friendship = await prisma.friend.findFirst({
      where: {
        status: 'accepted',
        OR: [
          { fromUserId: userId, toUserId: friendId },
          { fromUserId: friendId, toUserId: userId }
        ]
      }
    });

    if (!friendship) {
      return res.status(403).json({ success: false, message: 'Not friends with this user' });
    }

    const result = await prisma.directMessage.deleteMany({
      where: {
        OR: [
          { fromUserId: userId, toUserId: friendId },
          { fromUserId: friendId, toUserId: userId }
        ]
      }
    });

    res.json({ success: true, deleted: result.count });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/direct-messages/:friendId
// @desc    Send message to friend
// @access  Private
router.post('/:friendId', protect, async (req, res, next) => {
  try {
    const { message } = req.body;
    const userId = req.user.id;
    const friendId = req.params.friendId;

    if (!message || message.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Message cannot be empty' });
    }

    // Verify friendship
    const friendship = await prisma.friend.findFirst({
      where: {
        status: 'accepted',
        OR: [
          { fromUserId: userId, toUserId: friendId },
          { fromUserId: friendId, toUserId: userId }
        ]
      }
    });

    if (!friendship) {
      return res.status(403).json({ success: false, message: 'Not friends with this user' });
    }

    const dm = await prisma.directMessage.create({
      data: {
        fromUserId: userId,
        toUserId: friendId,
        content: message.trim(),
        read: false
      },
      include: {
        fromUser: { select: { id: true, username: true } },
        toUser: { select: { id: true, username: true } }
      }
    });

    // Format for frontend
    const formattedDm = {
      ...dm,
      _id: dm.id,
      message: dm.content,
      sender: { ...dm.fromUser, _id: dm.fromUser.id },
      recipient: { ...dm.toUser, _id: dm.toUser.id }
    };

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.to(`user:${friendId}`).emit('new_direct_message', formattedDm);
      io.to(`user:${friendId}`).emit('notification', {
        type: 'direct_message',
        title: `Message from ${req.user.username}`,
        message: message.trim().length > 50 ? message.trim().substring(0, 50) + '...' : message.trim(),
        senderId: userId
      });
    }

    // Create notification
    try {
      await NotificationService.createNotification({
        recipientId: friendId,
        type: 'direct_message',
        title: `Message from ${req.user.username}`,
        message: message.trim().length > 50 ? message.trim().substring(0, 50) + '...' : message.trim(),
        data: { senderId: userId }
      });
    } catch (err) {
      logger.error('Error creating DM notification:', err);
    }

    // Send push notification
    PushNotificationService.notifyDirectMessage(
      friendId,
      req.user.username,
      message.trim(),
      userId
    ).catch(err => logger.error('Push notification error for DM:', err));

    res.json({ success: true, message: formattedDm });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
