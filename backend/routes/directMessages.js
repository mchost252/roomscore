const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { protect } = require('../middleware/auth');
const DirectMessage = require('../models/DirectMessage');
const Friend = require('../models/Friend');
const User = require('../models/User');

// @route   GET /api/direct-messages/conversations
// @desc    Get user's conversations (list of friends with last message)
// @access  Private
router.get('/conversations', protect, async (req, res, next) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.id);

    // Get all friends - single query, don't populate avatar (too large)
    const friendships = await Friend.find({
      $or: [{ requester: userId }, { recipient: userId }],
      status: 'accepted'
    })
      .populate('requester', 'username _id')
      .populate('recipient', 'username _id')
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
    // Don't populate avatar - it's too large and slows queries significantly
    const messages = await DirectMessage.find({
      $or: [
        { sender: userId, recipient: friendId },
        { sender: friendId, recipient: userId }
      ]
    })
      .populate('sender', 'username _id')
      .populate('recipient', 'username _id')
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

    // Don't populate avatar - too large, frontend can get it from user data
    await dm.populate('sender', 'username _id');
    await dm.populate('recipient', 'username _id');

    // Emit socket event for real-time delivery
    const io = req.app.get('io');
    if (io) {
      io.to(`user:${friendId}`).emit('new_direct_message', dm);
    }

    res.json({ success: true, message: dm });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
