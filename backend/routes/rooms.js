const express = require('express');
const router = express.Router();
const Room = require('../models/Room');
const User = require('../models/User');
const ChatMessage = require('../models/ChatMessage');
const TaskCompletion = require('../models/TaskCompletion');
const UserRoomProgress = require('../models/UserRoomProgress');
const NotificationService = require('../services/notificationService');
const PushNotificationService = require('../services/pushNotificationService');
const { protect, isRoomOwner, isRoomMember } = require('../middleware/auth');
const { validate, createRoomSchema, updateRoomSchema, joinRoomSchema, sendMessageSchema } = require('../middleware/validation');
const logger = require('../utils/logger');

// @route   GET /api/rooms
// @desc    Get all rooms for current user
// @access  Private
router.get('/', protect, async (req, res, next) => {
  try {
    const { type } = req.query;
    
    let query = { isActive: true };
    
    if (type === 'public') {
      // Get public rooms that user is NOT a member of
      // Don't populate avatar - too slow
      const rooms = await Room.find({
        isPublic: true,
        isActive: true,
        owner: { $ne: req.user.id },
        'members.userId': { $ne: req.user.id }
      })
      .populate('owner', 'username _id')
      .populate('members.userId', 'username _id')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean()
      .maxTimeMS(15000);
      
      return res.json({
        success: true,
        count: rooms.length,
        rooms
      });
    }
    
    // Get user's rooms (owned or member)
    // Don't populate avatar - too slow
    const rooms = await Room.find({
      $or: [
        { owner: req.user.id },
        { 'members.userId': req.user.id }
      ],
      isActive: true
    })
    .populate('owner', 'username _id')
    .populate('members.userId', 'username _id')
    .sort({ updatedAt: -1 })
    .lean()
    .maxTimeMS(15000);

    res.json({
      success: true,
      count: rooms.length,
      rooms
    });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/rooms
// @desc    Create a new room
// @access  Private
router.post('/', protect, validate(createRoomSchema), async (req, res, next) => {
  try {
    const { name, description, isPublic, maxMembers, settings } = req.body;

    const room = await Room.create({
      name,
      description,
      owner: req.user.id,
      isPublic: isPublic || false,
      maxMembers: maxMembers || 50,
      settings: settings || {},
      members: [{
        userId: req.user.id,
        role: 'owner',
        points: 0
      }]
    });

    await room.populate('owner', 'username _id');
    await room.populate('members.userId', 'username _id');

    // Emit socket event
    const io = req.app.get('io');
    io.emit('room:created', { room });

    logger.info(`Room created: ${room.name} by ${req.user.email}`);
    res.status(201).json({
      success: true,
      room
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/rooms/:id
// @desc    Get room details
// @access  Private (must be member)
router.get('/:id', protect, isRoomMember, async (req, res, next) => {
  try {
    await req.room.populate('owner', 'username _id');
    await req.room.populate('members.userId', 'username _id');

    res.json({
      success: true,
      room: req.room
    });
  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/rooms/:id
// @desc    Update room
// @access  Private (owner only)
router.put('/:id', protect, isRoomOwner, validate(updateRoomSchema), async (req, res, next) => {
  try {
    const { name, description, isPublic, maxMembers, settings } = req.body;

    const updateFields = {};
    if (name) updateFields.name = name;
    if (description !== undefined) updateFields.description = description;
    if (isPublic !== undefined) updateFields.isPublic = isPublic;
    if (maxMembers) updateFields.maxMembers = maxMembers;
    if (settings) updateFields.settings = { ...req.room.settings, ...settings };

    const room = await Room.findByIdAndUpdate(
      req.params.id,
      updateFields,
      { new: true, runValidators: true }
    ).populate('owner', 'username _id')
     .populate('members.userId', 'username _id');

    // Emit socket event
    const io = req.app.get('io');
    io.to(room._id.toString()).emit('room:updated', { room });

    logger.info(`Room updated: ${room.name}`);
    res.json({
      success: true,
      room
    });
  } catch (error) {
    next(error);
  }
});

// @route   DELETE /api/rooms/:id
// @desc    Delete room (soft delete)
// @access  Private (owner only)
router.delete('/:id', protect, isRoomOwner, async (req, res, next) => {
  try {
    // Get all room members (exclude owner)
    const roomMembers = req.room.members
      .map(m => m.userId.toString())
      .filter(userId => userId !== req.user.id);

    req.room.isActive = false;
    req.room.deletedAt = new Date();
    await req.room.save();

    // Notify members about room disbanding
    if (roomMembers.length > 0) {
      PushNotificationService.notifyRoomDisbanded(
        roomMembers,
        req.room.name
      ).catch(err => logger.error('Push notification error:', err));
    }

    // Emit socket event
    const io = req.app.get('io');
    io.to(req.room._id.toString()).emit('room:deleted', { roomId: req.room._id });

    logger.info(`Room deleted: ${req.room.name}`);
    res.json({
      success: true,
      message: 'Room deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/rooms/join
// @desc    Join a room with code or invite link
// @access  Private
router.post('/join', protect, validate(joinRoomSchema), async (req, res, next) => {
  try {
    const { joinCode, inviteLink } = req.body;

    let room;
    if (joinCode) {
      room = await Room.findOne({ joinCode: joinCode.toUpperCase(), isActive: true });
    } else if (inviteLink) {
      room = await Room.findOne({ inviteLink, isActive: true });
    }

    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found with provided code or link'
      });
    }

    // Check if already a member
    const isMember = room.members.some(m => m.userId.toString() === req.user.id);
    const isOwner = room.owner.toString() === req.user.id;

    if (isMember || isOwner) {
      return res.status(400).json({
        success: false,
        message: 'You are already a member of this room'
      });
    }

    // Get existing members before adding new one (for notifications)
    const existingMembers = room.members
      .map(m => m.userId.toString())
      .filter(userId => userId !== req.user.id);

    // Add member
    await room.addMember(req.user.id);
    await room.populate('owner', 'username _id');
    await room.populate('members.userId', 'username _id');

    // Create system message
    await ChatMessage.create({
      roomId: room._id,
      userId: req.user.id,
      message: `${req.user.username} joined the room`,
      messageType: 'system'
    });

    // Create in-app notifications for existing members (don't fail if notification fails)
    for (const memberId of existingMembers) {
      try {
        await NotificationService.createNotification({
          userId: memberId,
          type: 'member_joined',
          title: `New Member in ${room.name}`,
          message: `${req.user.username} joined the room`,
          relatedRoom: room._id
        });
      } catch (err) {
        logger.error('Error creating notification:', err);
      }
    }

    // Send push notifications to existing members
    if (existingMembers.length > 0) {
      PushNotificationService.notifyMemberJoined(
        existingMembers,
        req.user.username,
        room.name,
        room._id.toString()
      ).catch(err => logger.error('Push notification error:', err));
    }

    // Emit socket event
    const io = req.app.get('io');
    io.to(room._id.toString()).emit('member:joined', {
      roomId: room._id,
      user: req.user.toPublicProfile()
    });

    // Emit notification event to existing members
    existingMembers.forEach(memberId => {
      io.to(`user:${memberId}`).emit('notification', {
        type: 'member_joined',
        title: `New Member in ${room.name}`,
        message: `${req.user.username} joined the room`,
        roomId: room._id.toString()
      });
    });

    logger.info(`User ${req.user.email} joined room: ${room.name}`);
    res.json({
      success: true,
      room
    });
  } catch (error) {
    if (error.message.includes('already a member')) {
      return res.status(400).json({ success: false, message: error.message });
    }
    if (error.message.includes('maximum capacity')) {
      return res.status(400).json({ success: false, message: error.message });
    }
    next(error);
  }
});

// @route   DELETE /api/rooms/:id/leave
// @desc    Leave a room
// @access  Private
router.delete('/:id/leave', protect, isRoomMember, async (req, res, next) => {
  try {
    if (req.room.owner.toString() === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'Room owner cannot leave. Please transfer ownership or delete the room.'
      });
    }

    // Get remaining members before removal (for notifications)
    const remainingMembers = req.room.members
      .map(m => m.userId.toString())
      .filter(userId => userId !== req.user.id);

    await req.room.removeMember(req.user.id);
    
    // Delete all task completions for this user in this room
    await TaskCompletion.deleteMany({
      userId: req.user.id,
      roomId: req.room._id
    });
    
    // Delete user room progress
    await UserRoomProgress.deleteOne({
      userId: req.user.id,
      roomId: req.room._id
    });

    // Create system message
    await ChatMessage.create({
      roomId: req.room._id,
      userId: req.user.id,
      message: `${req.user.username} left the room`,
      messageType: 'system'
    });

    // Create in-app notifications for remaining members (don't fail if notification fails)
    for (const memberId of remainingMembers) {
      try {
        await NotificationService.createNotification({
          userId: memberId,
          type: 'member_left',
          title: `Member Left ${req.room.name}`,
          message: `${req.user.username} left the room`,
          relatedRoom: req.room._id
        });
      } catch (err) {
        logger.error('Error creating notification:', err);
      }
    }

    // Send push notifications
    if (remainingMembers.length > 0) {
      PushNotificationService.notifyMemberLeft(
        remainingMembers,
        req.user.username,
        req.room.name,
        req.room._id.toString()
      ).catch(err => logger.error('Push notification error:', err));
    }

    // Emit socket event
    const io = req.app.get('io');
    io.to(req.room._id.toString()).emit('member:left', {
      roomId: req.room._id,
      userId: req.user.id,
      username: req.user.username
    });

    // Emit notification event to remaining members
    remainingMembers.forEach(memberId => {
      io.to(`user:${memberId}`).emit('notification', {
        type: 'member_left',
        title: `Member Left ${req.room.name}`,
        message: `${req.user.username} left the room`,
        roomId: req.room._id.toString()
      });
    });

    logger.info(`User ${req.user.email} left room: ${req.room.name}`);
    res.json({
      success: true,
      message: 'Left room successfully'
    });
  } catch (error) {
    next(error);
  }
});

// @route   DELETE /api/rooms/:id/members/:userId
// @desc    Remove a member from room
// @access  Private (owner only)
router.delete('/:id/members/:userId', protect, isRoomOwner, async (req, res, next) => {
  try {
    const { userId } = req.params;

    if (userId === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'Cannot remove yourself. Use leave endpoint instead.'
      });
    }

    await req.room.removeMember(userId);

    const removedUser = await User.findById(userId);
    
    // Delete all task completions for this user in this room
    await TaskCompletion.deleteMany({
      userId: userId,
      roomId: req.room._id
    });
    
    // Delete user room progress
    await UserRoomProgress.deleteOne({
      userId: userId,
      roomId: req.room._id
    });

    // Create system message
    if (removedUser) {
      await ChatMessage.create({
        roomId: req.room._id,
        userId: req.user.id,
        message: `${removedUser.username} was removed from the room`,
        messageType: 'system'
      });
    }

    // Emit socket event
    const io = req.app.get('io');
    io.to(req.room._id.toString()).emit('member:kicked', {
      roomId: req.room._id,
      userId,
      username: removedUser ? (removedUser.username || removedUser.email) : 'User'
    });

    logger.info(`User ${userId} removed from room: ${req.room.name}`);
    res.json({
      success: true,
      message: 'Member removed successfully'
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/rooms/:id/leaderboard
// @desc    Get room leaderboard
// @access  Private (must be member)
router.get('/:id/leaderboard', protect, isRoomMember, async (req, res, next) => {
  try {
    const leaderboard = await req.room.getLeaderboard();

    res.json({
      success: true,
      leaderboard
    });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/rooms/:id/chat
// @desc    Send a chat message
// @access  Private (must be member)
router.post('/:id/chat', protect, isRoomMember, validate(sendMessageSchema), async (req, res, next) => {
  try {
    const { message } = req.body;

    const chatMessage = await ChatMessage.create({
      roomId: req.params.id,
      userId: req.user.id,
      message,
      messageType: 'text'
    });

    await chatMessage.populate('userId', 'username _id');

    // Get room members (exclude sender)
    const roomMembers = req.room.members
      .map(m => m.userId.toString())
      .filter(userId => userId !== req.user.id);

    // Truncate message for notification preview
    const messagePreview = message.length > 50 ? message.substring(0, 50) + '...' : message;

    // Create in-app notifications for all members (don't fail if notification fails)
    for (const memberId of roomMembers) {
      try {
        await NotificationService.createNotification({
          userId: memberId,
          type: 'new_chat',
          title: `${req.user.username} in ${req.room.name}`,
          message: messagePreview,
          relatedRoom: req.params.id
        });
      } catch (err) {
        logger.error('Error creating notification:', err);
      }
    }

    // Send push notifications (only if there are members)
    if (roomMembers.length > 0) {
      PushNotificationService.notifyNewChat(
        roomMembers,
        req.user.username,
        messagePreview,
        req.room.name,
        req.params.id
      ).catch(err => logger.error('Push notification error:', err));
    }

    // Emit socket event
    const io = req.app.get('io');
    io.to(req.params.id).emit('chat:message', { message: chatMessage });

    // Emit notification event to members
    roomMembers.forEach(memberId => {
      io.to(`user:${memberId}`).emit('notification', {
        type: 'new_chat',
        title: `${req.user.username} in ${req.room.name}`,
        message: messagePreview,
        roomId: req.params.id
      });
    });

    res.status(201).json({
      success: true,
      message: chatMessage
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/rooms/:id/chat
// @desc    Get chat messages
// @access  Private (must be member)
router.get('/:id/chat', protect, isRoomMember, async (req, res, next) => {
  try {
    const { limit = 50, before } = req.query;

    const query = {
      roomId: req.params.id,
      isDeleted: false
    };

    if (before) {
      query.createdAt = { $lt: new Date(before) };
    }

    const messages = await ChatMessage.find(query)
      .populate('userId', 'username _id')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    res.json({
      success: true,
      count: messages.length,
      messages: messages.reverse()
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
