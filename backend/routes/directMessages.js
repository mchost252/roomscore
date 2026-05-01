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
// COMPATIBLE: Works with both SQLite and PostgreSQL
router.get('/conversations', protect, async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Get all accepted friendships
    // Get all friendships (both accepted and pending)
    const friendships = await prisma.friend.findMany({
      where: {
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

    // Separate friendships
    const acceptedFriendships = friendships.filter(f => f.status === 'accepted' || f.status === 'removed');
    const pendingRequests = friendships.filter(f => f.status === 'pending');

    // Build list of all counterpart user ids (accepted+removed+pending) so we can compute last message/unread uniformly
    const acceptedIds = acceptedFriendships.map(f => (f.fromUserId === userId ? f.toUserId : f.fromUserId));
    const pendingIds = pendingRequests.map(f => (f.fromUserId === userId ? f.toUserId : f.fromUserId));
    const allCounterpartIds = Array.from(new Set([...acceptedIds, ...pendingIds]));

    // Fetch recent messages across all counterpart users (including pending), to compute last message + unread.
    // Exclude messages soft-deleted by current user via deletedFor field.
    const allMessages = allCounterpartIds.length === 0 ? [] : await prisma.directMessage.findMany({
      where: {
        AND: [
          {
            OR: [
              { fromUserId: userId, toUserId: { in: allCounterpartIds } },
              { toUserId: userId, fromUserId: { in: allCounterpartIds } }
            ]
          },
          {
            OR: [
              { deletedFor: null },
              { NOT: { deletedFor: { contains: userId } } }
            ]
          }
        ]
      },
      orderBy: { createdAt: 'desc' },
      take: 200
    });

    const lastMessageMap = new Map();
    const unreadCountMap = new Map();
    for (const msg of allMessages) {
      const otherId = msg.fromUserId === userId ? msg.toUserId : msg.fromUserId;
      if (!lastMessageMap.has(otherId)) lastMessageMap.set(otherId, msg);
      if (msg.fromUserId === otherId && msg.toUserId === userId && !msg.read) {
        unreadCountMap.set(otherId, (unreadCountMap.get(otherId) || 0) + 1);
      }
    }

    // Add pending requests as conversations with request status (lastMessage comes from DM if available)
    const pendingConversations = pendingRequests.map(req => {
      const otherUserId = req.fromUserId === userId ? req.toUserId : req.fromUserId;
      const otherUser = req.fromUserId === userId ? req.toUser : req.fromUser;
      const isSentByMe = req.fromUserId === userId;
      const lastMessage = lastMessageMap.get(otherUserId);
      const unreadCount = unreadCountMap.get(otherUserId) || (isSentByMe ? 0 : 1);

      return {
        friend: { ...otherUser, _id: otherUser.id },
        lastMessage: lastMessage ? { ...lastMessage, _id: lastMessage.id, message: lastMessage.content } : null,
        unreadCount,
        requestStatus: isSentByMe ? 'pending_sent' : 'pending_received',
        requestId: req.id
      };
    });

    // Build conversations from accepted friendships
    const acceptedConversations = acceptedFriendships.map(friendship => {
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
        unreadCount,
        // Preserve friendship status so clients can distinguish 'accepted' vs 'removed'
        requestStatus: friendship.status
      };
    });

    // Combine accepted and pending conversations
    let conversations = [...acceptedConversations, ...pendingConversations];

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
        OR: [
          { deletedFor: null },
          { NOT: { deletedFor: { contains: userId } } }
        ]
      }
    });

    res.json({ success: true, unreadCount });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/direct-messages/:friendId
// @desc    Get messages with a specific friend (supports Delta Sync with last_id)
// @access  Private
router.get('/:friendId', protect, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const friendId = req.params.friendId;
    const { last_id, limit = 100 } = req.query;

    // Verify relationship exists (accepted OR pending OR removed)
    const friendship = await prisma.friend.findFirst({
      where: {
        status: { in: ['accepted', 'pending', 'removed'] },
        OR: [
          { fromUserId: userId, toUserId: friendId },
          { fromUserId: friendId, toUserId: userId }
        ]
      }
    });

    if (!friendship) {
      return res.status(403).json({ success: false, message: 'Not friends with this user' });
    }

    // Build where clause - Delta Sync support + deletedFor filtering
    const whereClause = {
      AND: [
        {
          OR: [
            { fromUserId: userId, toUserId: friendId },
            { fromUserId: friendId, toUserId: userId }
          ]
        },
        {
          OR: [
            { deletedFor: null },
            { NOT: { deletedFor: { contains: userId } } }
          ]
        }
      ]
    };

    // DELTA SYNC: If last_id provided, only fetch messages after that
    let isDeltaSync = false;
    if (last_id) {
      const lastMessage = await prisma.directMessage.findUnique({
        where: { id: String(last_id) },
        select: { createdAt: true }
      });
      
      if (lastMessage) {
        whereClause.AND.push({ createdAt: { gt: lastMessage.createdAt } });
        isDeltaSync = true;
        console.log(`[Delta Sync] DM ${friendId}: Fetching messages after ${last_id}`);
      }
    }

    // Get messages using the properly built whereClause (includes delta sync + deletedFor filter)
    const messages = await prisma.directMessage.findMany({
      where: whereClause,
      include: {
        fromUser: { select: { id: true, username: true } },
        toUser: { select: { id: true, username: true } }
      },
      orderBy: { createdAt: 'asc' },
      take: parseInt(limit)
    });

    // Mark messages from friend as read (idempotent) only if relationship is accepted.
    // While pending/removed, we avoid toggling read state to reduce UI thrash.
    if (friendship.status === 'accepted') {
      const result = await prisma.directMessage.updateMany({
        where: {
          fromUserId: friendId,
          toUserId: userId,
          read: false
        },
        data: { read: true }
      });

      const io = req.app.get('io');
      if (io && result.count > 0) {
        io.to(`user:${friendId}`).emit('dm:read', {
          readBy: userId,
          readAt: new Date().toISOString()
        });
      }
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

    res.json({ 
      success: true, 
      messages: formattedMessages,
      deltaSync: isDeltaSync,
      syncFrom: last_id || null
    });
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

    // Soft delete: append current userId into deletedFor string (comma-separated).
    // This way the other user still sees their messages. If both users deleted, we hard delete.
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
    
    const hasId = (csv, id) => {
      if (!csv) return false;
      return csv.split(',').map(s => s.trim()).filter(Boolean).includes(id);
    };

    for (const msg of messages) {
      const deletedForStr = msg.deletedFor || '';
      const alreadyDeletedByMe = hasId(deletedForStr, userId);
      if (alreadyDeletedByMe) continue;

      const alreadyDeletedByOther = hasId(deletedForStr, friendId);
      if (alreadyDeletedByOther) {
        await prisma.directMessage.delete({ where: { id: msg.id } });
        permanentlyDeletedCount++;
        continue;
      }

      const newDeletedFor = deletedForStr ? `${deletedForStr},${userId}` : userId;
      await prisma.directMessage.update({
        where: { id: msg.id },
        data: { deletedFor: newDeletedFor }
      });
      updatedCount++;
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

    // Find relationship row if it exists (either direction)
    let friendship = await prisma.friend.findFirst({
      where: {
        OR: [
          { fromUserId: userId, toUserId: friendId },
          { fromUserId: friendId, toUserId: userId }
        ]
      }
    });

    // WhatsApp-style message requests:
    // - If accepted: send normally
    // - If pending: requester can send up to 2 messages, recipient cannot send until accepted
    // - If removed/rejected/no row: create/convert to pending and allow requester to send up to 2
    const MAX_PENDING_MESSAGES = 2;
    const now = new Date();

    // Helper: ensure pending request exists where current user is requester
    const ensurePendingFromMe = async () => {
      if (friendship && friendship.status === 'pending') {
        if (friendship.fromUserId !== userId) {
          return { ok: false, error: 'WAITING_FOR_YOU_TO_ACCEPT' };
        }
        return { ok: true };
      }

      if (friendship && (friendship.status === 'removed' || friendship.status === 'rejected')) {
        friendship = await prisma.friend.update({
          where: { id: friendship.id },
          data: { fromUserId: userId, toUserId: friendId, status: 'pending', message: null }
        });
      }

      if (!friendship) {
        friendship = await prisma.friend.create({
          data: { fromUserId: userId, toUserId: friendId, status: 'pending', message: null }
        });
      }

      // Emit request events (recipient sees banner, sender gets confirmation)
      const io = req.app.get('io');
      if (io) {
        io.to(`user:${friendId}`).emit('friend:request', {
          request: { ...friendship, _id: friendship.id },
          requester: { _id: userId, username: req.user.username },
          message: null
        });
        const recipient = await prisma.user.findUnique({
          where: { id: friendId },
          select: { username: true }
        }).catch(() => null);

        io.to(`user:${userId}`).emit('friend:request_sent', {
          request: { ...friendship, _id: friendship.id },
          recipientId: friendId,
          recipientUsername: recipient?.username || 'User'
        });
      }

      return { ok: true };
    };

    // Accepted: OK
    if (friendship?.status === 'accepted') {
      // continue
    } else {
      const ensured = await ensurePendingFromMe();
      if (!ensured.ok) {
        return res.status(403).json({ success: false, code: ensured.error });
      }

      // Enforce 2-message limit for requester during pending
      const since = friendship.updatedAt || friendship.createdAt;
      const sentCount = await prisma.directMessage.count({
        where: {
          fromUserId: userId,
          toUserId: friendId,
          createdAt: { gte: since }
        }
      });
      if (sentCount >= MAX_PENDING_MESSAGES) {
        return res.status(403).json({ success: false, code: 'PENDING_LIMIT', message: 'Waiting for acceptance' });
      }
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
