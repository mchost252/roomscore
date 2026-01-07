const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const Friend = require('../models/Friend');
const User = require('../models/User');
const NotificationService = require('../services/notificationService');

// @route   POST /api/friends/request
// @desc    Send friend request
// @access  Private
router.post('/request', protect, async (req, res, next) => {
  try {
    const { recipientId } = req.body;
    const requesterId = req.user.id;

    if (requesterId === recipientId) {
      return res.status(400).json({ success: false, message: 'Cannot send friend request to yourself' });
    }

    // Check if recipient exists
    const recipient = await User.findById(recipientId);
    if (!recipient) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Check if friendship already exists (in either direction)
    const existing = await Friend.findOne({
      $or: [
        { requester: requesterId, recipient: recipientId },
        { requester: recipientId, recipient: requesterId }
      ]
    });

    if (existing) {
      if (existing.status === 'accepted') {
        return res.status(400).json({ success: false, message: 'Already friends' });
      }
      if (existing.status === 'pending') {
        return res.status(400).json({ success: false, message: 'Friend request already sent' });
      }
    }

    // Create friend request
    const friendRequest = await Friend.create({
      requester: requesterId,
      recipient: recipientId,
      status: 'pending'
    });

    // Send notification
    await NotificationService.createNotification({
      userId: recipientId,
      type: 'friend_request',
      title: 'New Friend Request',
      message: `${req.user.username} sent you a friend request`,
      relatedRoom: null,
      data: { requesterId }
    });

    res.json({ success: true, friendRequest });
  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/friends/accept/:requestId
// @desc    Accept friend request
// @access  Private
router.put('/accept/:requestId', protect, async (req, res, next) => {
  try {
    const friendRequest = await Friend.findById(req.params.requestId);

    if (!friendRequest) {
      return res.status(404).json({ success: false, message: 'Friend request not found' });
    }

    // Only recipient can accept
    if (friendRequest.recipient.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    if (friendRequest.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Request already processed' });
    }

    friendRequest.status = 'accepted';
    await friendRequest.save();

    // Notify requester
    await NotificationService.createNotification({
      userId: friendRequest.requester,
      type: 'friend_accepted',
      title: 'Friend Request Accepted',
      message: `${req.user.username} accepted your friend request`,
      relatedRoom: null
    });

    res.json({ success: true, friendRequest });
  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/friends/reject/:requestId
// @desc    Reject friend request
// @access  Private
router.put('/reject/:requestId', protect, async (req, res, next) => {
  try {
    const friendRequest = await Friend.findById(req.params.requestId);

    if (!friendRequest) {
      return res.status(404).json({ success: false, message: 'Friend request not found' });
    }

    // Only recipient can reject
    if (friendRequest.recipient.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    friendRequest.status = 'rejected';
    await friendRequest.save();

    res.json({ success: true, message: 'Friend request rejected' });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/friends
// @desc    Get user's friends list
// @access  Private
router.get('/', protect, async (req, res, next) => {
  try {
    const userId = req.user.id;

    const friendships = await Friend.find({
      $or: [{ requester: userId }, { recipient: userId }],
      status: 'accepted'
    })
      .populate('requester', 'username email avatar totalPoints currentStreak')
      .populate('recipient', 'username email avatar totalPoints currentStreak');

    // Extract friend data (the other person in the friendship)
    const friends = friendships.map(f => {
      const friend = f.requester._id.toString() === userId ? f.recipient : f.requester;
      return {
        _id: friend._id,
        username: friend.username,
        email: friend.email,
        avatar: friend.avatar,
        totalPoints: friend.totalPoints,
        currentStreak: friend.currentStreak,
        friendsSince: f.createdAt
      };
    });

    res.json({ success: true, friends });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/friends/requests
// @desc    Get pending friend requests (received)
// @access  Private
router.get('/requests', protect, async (req, res, next) => {
  try {
    const requests = await Friend.find({
      recipient: req.user.id,
      status: 'pending'
    }).populate('requester', 'username email avatar');

    res.json({ success: true, requests });
  } catch (error) {
    next(error);
  }
});

// @route   DELETE /api/friends/:friendId
// @desc    Remove friend
// @access  Private
router.delete('/:friendId', protect, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const friendId = req.params.friendId;

    const friendship = await Friend.findOne({
      $or: [
        { requester: userId, recipient: friendId },
        { requester: friendId, recipient: userId }
      ],
      status: 'accepted'
    });

    if (!friendship) {
      return res.status(404).json({ success: false, message: 'Friendship not found' });
    }

    await friendship.deleteOne();

    res.json({ success: true, message: 'Friend removed' });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/friends/search
// @desc    Search users to add as friends
// @access  Private
router.get('/search', protect, async (req, res, next) => {
  try {
    const { query } = req.query;

    if (!query || query.trim().length < 2) {
      return res.json({ success: true, users: [] });
    }

    const users = await User.find({
      _id: { $ne: req.user.id }, // Exclude self
      username: { $regex: query, $options: 'i' }
    })
      .select('username email avatar totalPoints currentStreak')
      .limit(10);

    res.json({ success: true, users });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
