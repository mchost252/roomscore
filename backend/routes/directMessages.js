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
// OPTIMIZED: Batch queries instead of N+1 Promise.all
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
        fromUser: { select: { id: true, username: true, avatar: true } },
        toUser: { select: { id: true, username: true, avatar: true } }
      }
    });

    if (friendships.length === 0) {
      return res.json({ success: true, conversations: [], totalUnread: 0 });
    }

    // Get friend IDs
    const friendIds = friendships.map(f => 
      f.fromUserId === userId ? f.toUserId : f.fromUserId
    );

    // OPTIMIZATION: Batch fetch all unread counts in ONE query using groupBy
    const unreadCounts = await prisma.directMessage.groupBy({
      by: ['fromUserId'],
      where: {
        fromUserId: { in: friendIds },
        toUserId: userId,
        read: false,
        NOT: { deletedFor: { has: userId } }
      },
      _count: { id: true }
    });
    
    // Create a map for quick lookup
    const unreadCountMap = new Map(
      unreadCounts.map(uc => [uc.fromUserId, uc._count.id])
    );

    // OPTIMIZATION: Fetch last messages in batch using raw query with DISTINCT ON
    // This gets the most recent message per conversation in a single query
    const lastMessagesRaw = await prisma.$queryRaw`
      SELECT DISTINCT ON (conversation_id) *
      FROM (
        SELECT 
          dm.*,
          CASE 
            WHEN dm."fromUserId" = ${userId} THEN dm."toUserId"
            ELSE dm."fromUserId"
          END as conversation_id
        FROM "DirectMessage" dm
        WHERE (
          (dm."fromUserId" = ${userId} AND dm."toUserId" = ANY(${friendIds}::text[]))
          OR 
          (dm."toUserId" = ${userId} AND dm."fromUserId" = ANY(${friendIds}::text[]))
        )
        AND NOT (${userId} = ANY(dm."deletedFor"))
        ORDER BY conversation_id, dm."createdAt" DESC
      ) sub
      ORDER BY conversation_id, "createdAt" DESC
    `;

    // Create map for last messages
    const lastMessageMap = new Map();
    for (const msg of lastMessagesRaw) {
      const friendId = msg.fromUserId === userId ? msg.toUserId : msg.fromUserId;
      lastMessageMap.set(friendId, msg);
    }

    // Build conversations from friendships
    const conversations = friendships.map(friendship => {
      const friendId = friendship.fromUserId === userId ? friendship.toUserId : friendship.fromUserId;
      const friendData = friendship.fromUserId === userId ? friendship.toUser : friendship.fromUser;
      const lastMessage = lastMessageMap.get(friendId);
      const unreadCount = unreadCountMap.get(friendId) || 0;

      return {
        friend: { ...friendData, _id: friendData.id },
        lastMessage: lastMessage ? { 
          ...lastMessage, 
          _id: lastMessage.id, 
          message: lastMessage.content 
        } : null,
        unreadCount
      };
    });

    // Calculate total unread
    const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);

    // Sort by last message time
    conversations.sort((a, b) => {
      const aTime = a.lastMessage?.createdAt || 0;
      const bTime = b.lastMessage?.createdAt || 0;
      return new Date(bTime) - new Date(aTime);
    });

    res.json({ success: true, conversations, totalUnread });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/direct-messages/unread-count
// @desc    Get total unread message count across all conversations
// @access  Private
router.get('/unread-count', protect, async (req, res, next) => {
  try {
    const userId = req.user.id;

    const unreadCount = await prisma.directMessage.count({
      where: {
        toUserId: userId,
        read: false,
        NOT: {
          deletedFor: { has: userId }
        }
      }
    });

    res.json({ success: true, unreadCount });
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

    // Get messages (excluding ones deleted by current user)
    const messages = await prisma.directMessage.findMany({
      where: {
        OR: [
          { fromUserId: userId, toUserId: friendId },
          { fromUserId: friendId, toUserId: userId }
        ],
        NOT: {
          deletedFor: { has: userId }
        }
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

    // Emit read receipt to sender via socket
    const io = req.app.get('io');
    if (io) {
      io.to(`user:${friendId}`).emit('dm:read', {
        readBy: userId,
        readAt: new Date().toISOString()
      });
    }

    // Format for frontend
    const formattedMessages = messages.map(m => ({
      ...m,
      _id: m.id,
      message: m.content,
      sender: { ...m.fromUser, _id: m.fromUser.id },
      recipient: { ...m.toUser, _id: m.toUser.id },
      isRead: m.read,
      replyTo: m.replyToText ? { _id: m.replyToId, message: m.replyToText } : null
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
// @desc    Clear direct message history with a specific friend (soft delete for current user only)
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

    // Soft delete: Add current user to deletedFor array instead of hard deleting
    // This way the other user still sees their messages
    const messages = await prisma.directMessage.findMany({
      where: {
        OR: [
          { fromUserId: userId, toUserId: friendId },
          { fromUserId: friendId, toUserId: userId }
        ]
      },
      select: { id: true, deletedFor: true }
    });

    // Update each message to add current user to deletedFor
    // If both users have deleted, permanently remove the message from DB
    let updatedCount = 0;
    let permanentlyDeletedCount = 0;
    
    for (const msg of messages) {
      if (!msg.deletedFor.includes(userId)) {
        // Check if the other user has already deleted this message
        const otherUserId = msg.deletedFor.length > 0 ? msg.deletedFor[0] : null;
        const bothDeleted = otherUserId && (otherUserId === friendId || msg.deletedFor.includes(friendId));
        
        if (bothDeleted || msg.deletedFor.includes(friendId)) {
          // Both users have now deleted - permanently remove from database
          await prisma.directMessage.delete({
            where: { id: msg.id }
          });
          permanentlyDeletedCount++;
        } else {
          // Only this user is deleting - add to deletedFor array
          await prisma.directMessage.update({
            where: { id: msg.id },
            data: {
              deletedFor: { push: userId }
            }
          });
          updatedCount++;
        }
      }
    }

    logger.info(`User ${userId} cleared chat with ${friendId}: ${updatedCount} soft-deleted, ${permanentlyDeletedCount} permanently deleted`);
    res.json({ 
      success: true, 
      deleted: updatedCount + permanentlyDeletedCount, 
      message: 'Chat history cleared for you' 
    });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/direct-messages/:friendId
// @desc    Send message to friend
// @access  Private
router.post('/:friendId', protect, async (req, res, next) => {
  try {
    const { message, replyTo } = req.body;
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

    // Get reply message text if replying
    let replyToText = null;
    if (replyTo) {
      const replyMsg = await prisma.directMessage.findUnique({
        where: { id: replyTo },
        select: { content: true }
      });
      replyToText = replyMsg?.content?.substring(0, 100) || null; // Limit to 100 chars
    }

    const dm = await prisma.directMessage.create({
      data: {
        fromUserId: userId,
        toUserId: friendId,
        content: message.trim(),
        read: false,
        replyToId: replyTo || null,
        replyToText: replyToText
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
      recipient: { ...dm.toUser, _id: dm.toUser.id },
      replyTo: replyToText ? { _id: replyTo, message: replyToText } : null
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
