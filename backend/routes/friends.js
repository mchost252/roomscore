const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const Friend = require('../models/Friend');
const User = require('../models/User');
const NotificationService = require('../services/notificationService');
const PushNotificationService = require('../services/pushNotificationService');
const logger = require('../utils/logger');

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

    // Send in-app notification
    await NotificationService.createNotification({
      userId: recipientId,
      type: 'friend_request',
      title: 'New Friend Request',
      message: `${req.user.username} sent you a friend request`,
      relatedRoom: null,
      data: { requesterId }
    });

    // Send push notification
    PushNotificationService.notifyFriendRequest(
      recipientId,
      req.user.username
    ).catch(err => logger.error('Push notification error for friend request:', err));

    // Emit socket event for real-time notification
    const io = req.app.get('io');
    if (io) {
      io.to(`user:${recipientId}`).emit('notification', {
        type: 'friend_request',
        title: 'New Friend Request',
        message: `${req.user.username} sent you a friend request`,
        requesterId,
        requestId: friendRequest._id
      });
      
      // Also emit specific friend request event for UI updates
      io.to(`user:${recipientId}`).emit('friend:request', {
        request: friendRequest,
        requester: {
          _id: requesterId,
          username: req.user.username
        }
      });
    }

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

    // Notify requester with in-app notification
    await NotificationService.createNotification({
      userId: friendRequest.requester,
      type: 'friend_accepted',
      title: 'Friend Request Accepted',
      message: `${req.user.username} accepted your friend request`,
      relatedRoom: null
    });

    // Send push notification
    PushNotificationService.notifyFriendAccepted(
      friendRequest.requester.toString(),
      req.user.username
    ).catch(err => logger.error('Push notification error for friend acceptance:', err));

    // Emit socket event for real-time notification
    const io = req.app.get('io');
    if (io) {
      io.to(`user:${friendRequest.requester}`).emit('notification', {
        type: 'friend_accepted',
        title: 'Friend Request Accepted',
        message: `${req.user.username} accepted your friend request`,
        friendId: req.user.id
      });
      
      // Also emit specific friend accepted event for UI updates
      io.to(`user:${friendRequest.requester}`).emit('friend:accepted', {
        friend: {
          _id: req.user.id,
          username: req.user.username
        }
      });
    }

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

    // Run two parallel queries instead of $or - often faster
    const [asRequester, asRecipient] = await Promise.all([
      Friend.find({ requester: userId, status: 'accepted' })
        .populate('recipient', 'username _id totalPoints currentStreak')
        .select('recipient createdAt')
        .lean()
        .maxTimeMS(5000),
      Friend.find({ recipient: userId, status: 'accepted' })
        .populate('requester', 'username _id totalPoints currentStreak')
        .select('requester createdAt')
        .lean()
        .maxTimeMS(5000)
    ]);

    // Extract friend data
    const friends = [
      ...asRequester.map(f => ({
        _id: f.recipient._id,
        username: f.recipient.username,
        totalPoints: f.recipient.totalPoints || 0,
        currentStreak: f.recipient.currentStreak || 0,
        friendsSince: f.createdAt
      })),
      ...asRecipient.map(f => ({
        _id: f.requester._id,
        username: f.requester.username,
        totalPoints: f.requester.totalPoints || 0,
        currentStreak: f.requester.currentStreak || 0,
        friendsSince: f.createdAt
      }))
    ];

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
    })
      .populate('requester', 'username email')
      .lean()
      .maxTimeMS(10000);

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
      .select('username totalPoints currentStreak')
      .limit(10)
      .lean()
      .maxTimeMS(10000);

    res.json({ success: true, users });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
