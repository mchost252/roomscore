const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { protect } = require('../middleware/auth');
const DirectMessage = require('../models/DirectMessage');
const Friend = require('../models/Friend');
const User = require('../models/User');
const NotificationService = require('../services/notificationService');
const PushNotificationService = require('../services/pushNotificationService');
const logger = require('../utils/logger');

// @route   GET /api/direct-messages/conversations
// @desc    Get user's conversations (list of friends with last message)
// @access  Private
router.get('/conversations', protect, async (req, res, next) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.id);

    // Get all friends with avatars for profile pictures
    const friendships = await Friend.find({
      $or: [{ requester: userId }, { recipient: userId }],
      status: 'accepted'
    })
      .populate('requester', 'username _id avatar')
      .populate('recipient', 'username _id avatar')
      .lean()
      .maxTimeMS(10000);

    if (friendships.length === 0) {
      return res.json({ success: true, conversations: [] });
    }

    // Get friend IDs as ObjectIds
    const friendIds = friendships.map(f => 
      f.requester._id.toString() === userId.toString() ? f.recipient._id : f.requester._id
    );

    // Get last messages and unread counts in parallel with aggregation
    const [lastMessages, unreadCounts] = await Promise.all([
      // Get last message for each conversation using aggregation
      DirectMessage.aggregate([
        {
          $match: {
            $or: [
              { sender: userId, recipient: { $in: friendIds } },
              { sender: { $in: friendIds }, recipient: userId }
            ]
          }
        },
        { $sort: { createdAt: -1 } },
        {
          $group: {
            _id: {
              $cond: [
                { $eq: ['$sender', userId] },
                '$recipient',
                '$sender'
              ]
            },
            lastMessage: { $first: '$$ROOT' }
          }
        }
      ]),
      // Get unread counts for each friend
      DirectMessage.aggregate([
        {
          $match: {
            sender: { $in: friendIds },
            recipient: userId,
            isRead: false
          }
        },
        {
          $group: {
            _id: '$sender',
            count: { $sum: 1 }
          }
        }
      ])
    ]);

    // Create lookup maps for O(1) access
    const lastMessageMap = new Map();
    lastMessages.forEach(m => {
      lastMessageMap.set(m._id.toString(), m.lastMessage);
    });

    const unreadCountMap = new Map();
    unreadCounts.forEach(u => {
      unreadCountMap.set(u._id.toString(), u.count);
    });

    // Build conversations array
    const conversations = friendships.map(friendship => {
      const friendData = friendship.requester._id.toString() === userId.toString() 
        ? friendship.recipient 
        : friendship.requester;
      
      const friendIdStr = friendData._id.toString();
      
      return {
        friend: friendData,
        lastMessage: lastMessageMap.get(friendIdStr) || null,
        unreadCount: unreadCountMap.get(friendIdStr) || 0
      };
    });

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

    // Validate friendId is a valid MongoDB ObjectId (24 hex chars)
    if (!friendId || !/^[a-fA-F0-9]{24}$/.test(friendId)) {
      return res.status(400).json({ 
        success: false, 
        message: `Invalid friend ID format: ${friendId}` 
      });
    }

    // Verify friendship exists
    const friendship = await Friend.findOne({
      $or: [
        { requester: userId, recipient: friendId },
        { requester: friendId, recipient: userId }
      ],
      status: 'accepted'
    });

    if (!friendship) {
      return res.status(403).json({ success: false, message: 'Not friends with this user' });
    }

    // Limit to last 100 messages for performance, sorted newest first then reversed
    // Include avatar for profile pictures
    const messages = await DirectMessage.find({
      $or: [
        { sender: userId, recipient: friendId },
        { sender: friendId, recipient: userId }
      ]
    })
      .populate('sender', 'username _id avatar')
      .populate('recipient', 'username _id avatar')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean()
      .maxTimeMS(15000); // Timeout query after 15 seconds
    
    // Reverse to get chronological order (oldest first)
    messages.reverse();

    // Mark messages from friend as read
    await DirectMessage.updateMany(
      { sender: friendId, recipient: userId, isRead: false },
      { isRead: true, readAt: new Date() }
    );

    res.json({ success: true, messages });
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

    // Validate friendId
    if (!friendId || !/^[a-fA-F0-9]{24}$/.test(friendId)) {
      return res.status(400).json({ success: false, message: 'Invalid friend ID' });
    }

    // Mark all unread messages from this friend as read
    const result = await DirectMessage.updateMany(
      { sender: friendId, recipient: userId, isRead: false },
      { isRead: true, readAt: new Date() }
    );

    // Notify sender via socket that messages were read
    const io = req.app.get('io');
    if (io && result.modifiedCount > 0) {
      io.to(`user:${friendId}`).emit('dm:read', {
        readBy: userId,
        messageIds: [], // Empty means all messages
        readAt: new Date().toISOString()
      });
    }

    res.json({ success: true, markedRead: result.modifiedCount });
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

    // Validate friendId is a valid MongoDB ObjectId (24 hex chars)
    if (!friendId || !/^[a-fA-F0-9]{24}$/.test(friendId)) {
      return res.status(400).json({ 
        success: false, 
        message: `Invalid friend ID format: ${friendId}` 
      });
    }

    if (!message || message.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Message cannot be empty' });
    }

    // Verify friendship
    const friendship = await Friend.findOne({
      $or: [
        { requester: userId, recipient: friendId },
        { requester: friendId, recipient: userId }
      ],
      status: 'accepted'
    });

    if (!friendship) {
      return res.status(403).json({ success: false, message: 'Not friends with this user' });
    }

    const dm = await DirectMessage.create({
      sender: userId,
      recipient: friendId,
      message: message.trim()
    });

    // Include avatar for profile pictures
    await dm.populate('sender', 'username _id avatar');
    await dm.populate('recipient', 'username _id avatar');

    // Emit socket event for real-time delivery
    const io = req.app.get('io');
    if (io) {
      io.to(`user:${friendId}`).emit('new_direct_message', dm);
      
      // Also emit notification event for immediate UI update
      io.to(`user:${friendId}`).emit('notification', {
        type: 'direct_message',
        title: `Message from ${req.user.username}`,
        message: message.trim().length > 50 ? message.trim().substring(0, 50) + '...' : message.trim(),
        senderId: userId
      });
    }

    // Create in-app notification for the recipient
    try {
      await NotificationService.createNotification({
        userId: friendId,
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
      message.trim()
    ).catch(err => logger.error('Push notification error for DM:', err));

    res.json({ success: true, message: dm });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
