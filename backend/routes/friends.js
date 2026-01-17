const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { prisma } = require('../config/database');
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
    const recipient = await prisma.user.findUnique({
      where: { id: recipientId }
    });
    if (!recipient) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Check if friendship already exists (in either direction)
    const existing = await prisma.friend.findFirst({
      where: {
        OR: [
          { fromUserId: requesterId, toUserId: recipientId },
          { fromUserId: recipientId, toUserId: requesterId }
        ]
      }
    });

    if (existing) {
      if (existing.status === 'accepted') {
        return res.status(400).json({ success: false, message: 'Already friends with this user' });
      }
      if (existing.status === 'pending') {
        // Check if the request is FROM current user or TO current user
        if (existing.fromUserId === requesterId) {
          return res.status(400).json({ success: false, message: 'Friend request already sent' });
        } else {
          return res.status(400).json({ success: false, message: 'This user already sent you a friend request. Check your pending requests!' });
        }
      }
      if (existing.status === 'rejected') {
        // Delete old rejected request and allow new one
        await prisma.friend.delete({ where: { id: existing.id } });
      }
    }

    // Create friend request
    let friendRequest;
    try {
      friendRequest = await prisma.friend.create({
        data: {
          fromUserId: requesterId,
          toUserId: recipientId,
          status: 'pending'
        }
      });
    } catch (createError) {
      // Handle unique constraint violation (P2002)
      if (createError.code === 'P2002') {
        return res.status(400).json({ 
          success: false, 
          message: 'Friend request already exists or you are already friends' 
        });
      }
      throw createError;
    }

    // Send in-app notification
    await NotificationService.createNotification({
      recipientId,
      type: 'friend_request',
      title: 'New Friend Request',
      message: `${req.user.username} sent you a friend request`,
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
        requestId: friendRequest.id
      });
      
      io.to(`user:${recipientId}`).emit('friend:request', {
        request: { ...friendRequest, _id: friendRequest.id },
        requester: {
          _id: requesterId,
          username: req.user.username
        }
      });
    }

    res.json({ success: true, friendRequest: { ...friendRequest, _id: friendRequest.id } });
  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/friends/accept/:requestId
// @desc    Accept friend request
// @access  Private
router.put('/accept/:requestId', protect, async (req, res, next) => {
  try {
    const friendRequest = await prisma.friend.findUnique({
      where: { id: req.params.requestId }
    });

    if (!friendRequest) {
      return res.status(404).json({ success: false, message: 'Friend request not found' });
    }

    // Only recipient can accept
    if (friendRequest.toUserId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    if (friendRequest.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Request already processed' });
    }

    const updated = await prisma.friend.update({
      where: { id: req.params.requestId },
      data: { status: 'accepted' }
    });

    // Notify requester with in-app notification
    await NotificationService.createNotification({
      recipientId: friendRequest.fromUserId,
      type: 'friend_accepted',
      title: 'Friend Request Accepted',
      message: `${req.user.username} accepted your friend request`
    });

    // Send push notification
    PushNotificationService.notifyFriendAccepted(
      friendRequest.fromUserId,
      req.user.username
    ).catch(err => logger.error('Push notification error for friend acceptance:', err));

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.to(`user:${friendRequest.fromUserId}`).emit('notification', {
        type: 'friend_accepted',
        title: 'Friend Request Accepted',
        message: `${req.user.username} accepted your friend request`,
        friendId: req.user.id
      });
      
      io.to(`user:${friendRequest.fromUserId}`).emit('friend:accepted', {
        friend: {
          _id: req.user.id,
          username: req.user.username
        }
      });
    }

    res.json({ success: true, friendRequest: { ...updated, _id: updated.id } });
  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/friends/reject/:requestId
// @desc    Reject friend request
// @access  Private
router.put('/reject/:requestId', protect, async (req, res, next) => {
  try {
    const friendRequest = await prisma.friend.findUnique({
      where: { id: req.params.requestId }
    });

    if (!friendRequest) {
      return res.status(404).json({ success: false, message: 'Friend request not found' });
    }

    // Only recipient can reject
    if (friendRequest.toUserId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    await prisma.friend.update({
      where: { id: req.params.requestId },
      data: { status: 'rejected' }
    });

    res.json({ success: true, message: 'Friend request rejected' });
  } catch (error) {
    next(error);
  }
});

// @route   DELETE /api/friends/:friendId
// @desc    Remove a friend (unfriend). Also clears DM history.
// @access  Private
router.delete('/:friendId', protect, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const friendId = req.params.friendId;

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
      return res.status(404).json({ success: false, message: 'Friendship not found' });
    }

    await prisma.friend.delete({ where: { id: friendship.id } });

    // Clear direct message history between users
    await prisma.directMessage.deleteMany({
      where: {
        OR: [
          { fromUserId: userId, toUserId: friendId },
          { fromUserId: friendId, toUserId: userId }
        ]
      }
    });

    // Emit socket events so both users update UI
    const io = req.app.get('io');
    if (io) {
      io.to(`user:${userId}`).emit('friend:removed', { friendId });
      io.to(`user:${friendId}`).emit('friend:removed', { friendId: userId });
    }

    res.json({ success: true, message: 'Friend removed' });
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

    // Get friendships where user is either sender or receiver
    const friendships = await prisma.friend.findMany({
      where: {
        status: 'accepted',
        OR: [
          { fromUserId: userId },
          { toUserId: userId }
        ]
      },
      include: {
        fromUser: { select: { id: true, username: true, avatar: true, bio: true, streak: true, longestStreak: true, totalTasksCompleted: true } },
        toUser: { select: { id: true, username: true, avatar: true, bio: true, streak: true, longestStreak: true, totalTasksCompleted: true } }
      }
    });

    // Get total points for each friend from their room memberships
    const friendIds = friendships.map(f => f.fromUserId === userId ? f.toUserId : f.fromUserId);
    
    // Aggregate total points from RoomMember table
    const pointsData = await prisma.roomMember.groupBy({
      by: ['userId'],
      where: {
        userId: { in: friendIds }
      },
      _sum: {
        points: true
      }
    });
    
    // Create a map of userId -> totalPoints
    const pointsMap = {};
    pointsData.forEach(p => {
      pointsMap[p.userId] = p._sum.points || 0;
    });

    // Extract friend data with correct totalPoints
    const friends = friendships.map(f => {
      const friend = f.fromUserId === userId ? f.toUser : f.fromUser;
      return {
        _id: friend.id,
        username: friend.username,
        avatar: friend.avatar || null,
        bio: friend.bio || null,
        currentStreak: friend.streak || 0,
        longestStreak: friend.longestStreak || 0,
        totalPoints: pointsMap[friend.id] || 0,
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
    const requests = await prisma.friend.findMany({
      where: {
        toUserId: req.user.id,
        status: 'pending'
      },
      include: {
        fromUser: { select: { id: true, username: true, email: true } }
      }
    });

    // Format for frontend compatibility
    const formattedRequests = requests.map(r => ({
      ...r,
      _id: r.id,
      requester: { ...r.fromUser, _id: r.fromUser.id }
    }));

    res.json({ success: true, requests: formattedRequests });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/friends/requests/sent
// @desc    Get pending friend requests (sent by user)
// @access  Private
router.get('/requests/sent', protect, async (req, res, next) => {
  try {
    const requests = await prisma.friend.findMany({
      where: {
        fromUserId: req.user.id,
        status: 'pending'
      },
      include: {
        toUser: { select: { id: true, username: true, email: true } }
      }
    });

    // Format for frontend compatibility
    const formattedRequests = requests.map(r => ({
      ...r,
      _id: r.id,
      recipientId: r.toUserId,
      recipient: r.toUser ? { ...r.toUser, _id: r.toUser.id } : null
    }));

    res.json({ success: true, requests: formattedRequests });
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
      return res.status(404).json({ success: false, message: 'Friendship not found' });
    }

    await prisma.friend.delete({
      where: { id: friendship.id }
    });

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

    const users = await prisma.user.findMany({
      where: {
        id: { not: req.user.id },
        username: { contains: query, mode: 'insensitive' }
      },
      select: {
        id: true,
        username: true,
        streak: true,
        totalTasksCompleted: true
      },
      take: 10
    });

    // Format for frontend compatibility
    const formattedUsers = users.map(u => ({
      ...u,
      _id: u.id,
      totalPoints: u.totalTasksCompleted || 0,
      currentStreak: u.streak || 0
    }));

    res.json({ success: true, users: formattedUsers });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
