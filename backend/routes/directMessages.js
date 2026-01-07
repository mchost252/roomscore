const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const DirectMessage = require('../models/DirectMessage');
const Friend = require('../models/Friend');
const User = require('../models/User');

// @route   GET /api/direct-messages/conversations
// @desc    Get user's conversations (list of friends with last message)
// @access  Private
router.get('/conversations', protect, async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Get all friends
    const friendships = await Friend.find({
      $or: [{ requester: userId }, { recipient: userId }],
      status: 'accepted'
    })
      .populate('requester', 'username avatar')
      .populate('recipient', 'username avatar');

    const conversations = [];

    for (const friendship of friendships) {
      const friendData = friendship.requester._id.toString() === userId 
        ? friendship.recipient 
        : friendship.requester;

      // Get last message
      const lastMessage = await DirectMessage.findOne({
        $or: [
          { sender: userId, recipient: friendData._id },
          { sender: friendData._id, recipient: userId }
        ]
      }).sort({ createdAt: -1 });

      // Count unread messages
      const unreadCount = await DirectMessage.countDocuments({
        sender: friendData._id,
        recipient: userId,
        isRead: false
      });

      conversations.push({
        friend: friendData,
        lastMessage: lastMessage || null,
        unreadCount
      });
    }

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

    const messages = await DirectMessage.find({
      $or: [
        { sender: userId, recipient: friendId },
        { sender: friendId, recipient: userId }
      ]
    })
      .populate('sender', 'username avatar')
      .populate('recipient', 'username avatar')
      .sort({ createdAt: 1 });

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

    await dm.populate('sender', 'username avatar');
    await dm.populate('recipient', 'username avatar');

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
