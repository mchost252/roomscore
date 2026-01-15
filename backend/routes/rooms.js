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
      .populate('members.userId', 'username _id avatar')
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
    .populate('members.userId', 'username _id avatar')
    .sort({ updatedAt: -1 })
    .lean()
    .maxTimeMS(15000);

    // Get today's date for task completion status
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

    // Get all task completions for today for this user across all their rooms
    const roomIds = rooms.map(r => r._id);
    const userCompletions = await TaskCompletion.find({
      userId: req.user.id,
      roomId: { $in: roomIds },
      completionDate: { $gte: today, $lt: tomorrow }
    }).lean();

    // Create a Set of completed task IDs for quick lookup
    const completedTaskIds = new Set(userCompletions.map(c => c.taskId.toString()));

    // Add isCompleted status to each task in each room
    const roomsWithTaskStatus = rooms.map(room => ({
      ...room,
      tasks: (room.tasks || []).map(task => ({
        ...task,
        isCompleted: completedTaskIds.has(task._id.toString())
      }))
    }));

    res.json({
      success: true,
      count: roomsWithTaskStatus.length,
      rooms: roomsWithTaskStatus
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
    const { name, description, isPublic, maxMembers, settings, duration, requireApproval } = req.body;

    // Calculate expiry date based on duration (max 1 month)
    const expiresAt = Room.calculateExpiryDate(duration || '1_month');

    const room = await Room.create({
      name,
      description,
      owner: req.user.id,
      isPublic: isPublic || false,
      maxMembers: maxMembers || 50,
      duration: duration || '1_month',
      expiresAt,
      settings: {
        ...settings,
        requireApproval: requireApproval || false
      },
      members: [{
        userId: req.user.id,
        role: 'owner',
        points: 0
      }]
    });

    await room.populate('owner', 'username _id');
    await room.populate('members.userId', 'username _id avatar');

    // Emit socket event
    const io = req.app.get('io');
    io.emit('room:created', { room });

    logger.info(`Room created: ${room.name} by ${req.user.email}, expires: ${expiresAt}`);
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
    await req.room.populate('members.userId', 'username _id avatar');

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
     .populate('members.userId', 'username _id avatar');

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

    // Check if room has expired
    if (room.expiresAt && new Date() > room.expiresAt) {
      return res.status(400).json({
        success: false,
        message: 'This room has expired and is no longer accepting members'
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

    // Check if already in pending list
    const isPending = room.pendingMembers?.some(m => m.userId.toString() === req.user.id);
    if (isPending) {
      return res.status(400).json({
        success: false,
        message: 'Your request to join is pending approval'
      });
    }

    // If room requires approval, add to pending list instead
    if (room.settings?.requireApproval) {
      await room.addPendingMember(req.user.id);
      
      // Notify room owner about the join request
      try {
        await NotificationService.createNotification({
          userId: room.owner,
          type: 'join_request',
          title: `Join Request for ${room.name}`,
          message: `${req.user.username} wants to join your room`,
          relatedRoom: room._id,
          data: { requesterId: req.user.id }
        });
      } catch (err) {
        logger.error('Error creating join request notification:', err);
      }

      // Emit socket event to owner
      const io = req.app.get('io');
      io.to(`user:${room.owner}`).emit('notification', {
        type: 'join_request',
        title: `Join Request for ${room.name}`,
        message: `${req.user.username} wants to join your room`,
        roomId: room._id.toString(),
        requesterId: req.user.id
      });

      io.to(`user:${room.owner}`).emit('room:joinRequest', {
        roomId: room._id,
        user: req.user.toPublicProfile()
      });

      logger.info(`User ${req.user.email} requested to join room: ${room.name}`);
      return res.json({
        success: true,
        pending: true,
        message: 'Your request to join has been sent to the room owner for approval'
      });
    }

    // Get existing members before adding new one (for notifications)
    const existingMembers = room.members
      .map(m => m.userId.toString())
      .filter(userId => userId !== req.user.id);

    // Add member directly (no approval required)
    await room.addMember(req.user.id);
    await room.populate('owner', 'username _id');
    await room.populate('members.userId', 'username _id avatar');

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
    if (error.message.includes('Already requested')) {
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
    const { message, replyTo } = req.body;

    const chatMessage = await ChatMessage.create({
      roomId: req.params.id,
      userId: req.user.id,
      message,
      messageType: 'text',
      replyTo: replyTo || null
    });

    await chatMessage.populate('userId', 'username _id');
    if (chatMessage.replyTo) {
      await chatMessage.populate('replyTo', 'message userId createdAt');
    }

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
      .populate('replyTo', 'message userId createdAt')
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

// @route   GET /api/rooms/:id/pending-members
// @desc    Get pending member requests (owner only)
// @access  Private (owner only)
router.get('/:id/pending-members', protect, isRoomOwner, async (req, res, next) => {
  try {
    await req.room.populate('pendingMembers.userId', 'username email _id avatar');
    
    res.json({
      success: true,
      pendingMembers: req.room.pendingMembers || []
    });
  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/rooms/:id/approve-member/:userId
// @desc    Approve a pending member
// @access  Private (owner only)
router.put('/:id/approve-member/:userId', protect, isRoomOwner, async (req, res, next) => {
  try {
    const { userId } = req.params;
    
    await req.room.approvePendingMember(userId);
    await req.room.populate('owner', 'username _id');
    await req.room.populate('members.userId', 'username _id avatar');

    const approvedUser = await User.findById(userId);
    
    // Create system message
    if (approvedUser) {
      await ChatMessage.create({
        roomId: req.room._id,
        userId: userId,
        message: `${approvedUser.username} joined the room`,
        messageType: 'system'
      });
    }

    // Notify the approved user
    try {
      await NotificationService.createNotification({
        userId: userId,
        type: 'join_approved',
        title: `Welcome to ${req.room.name}!`,
        message: `Your request to join ${req.room.name} has been approved`,
        relatedRoom: req.room._id
      });
    } catch (err) {
      logger.error('Error creating approval notification:', err);
    }

    // Emit socket events
    const io = req.app.get('io');
    
    // Notify approved user
    io.to(`user:${userId}`).emit('notification', {
      type: 'join_approved',
      title: `Welcome to ${req.room.name}!`,
      message: `Your request to join ${req.room.name} has been approved`,
      roomId: req.room._id.toString()
    });

    io.to(`user:${userId}`).emit('room:joinApproved', {
      room: req.room
    });

    // Notify room members
    if (approvedUser) {
      io.to(req.room._id.toString()).emit('member:joined', {
        roomId: req.room._id,
        user: approvedUser.toPublicProfile()
      });
    }

    logger.info(`User ${userId} approved to join room: ${req.room.name}`);
    res.json({
      success: true,
      message: 'Member approved successfully',
      room: req.room
    });
  } catch (error) {
    if (error.message.includes('not found in pending')) {
      return res.status(404).json({ success: false, message: error.message });
    }
    if (error.message.includes('maximum capacity')) {
      return res.status(400).json({ success: false, message: error.message });
    }
    next(error);
  }
});

// @route   PUT /api/rooms/:id/reject-member/:userId
// @desc    Reject a pending member
// @access  Private (owner only)
router.put('/:id/reject-member/:userId', protect, isRoomOwner, async (req, res, next) => {
  try {
    const { userId } = req.params;
    
    await req.room.rejectPendingMember(userId);

    // Notify the rejected user
    try {
      await NotificationService.createNotification({
        userId: userId,
        type: 'join_rejected',
        title: `Request Declined`,
        message: `Your request to join ${req.room.name} was not approved`,
        relatedRoom: req.room._id
      });
    } catch (err) {
      logger.error('Error creating rejection notification:', err);
    }

    // Emit socket event
    const io = req.app.get('io');
    io.to(`user:${userId}`).emit('notification', {
      type: 'join_rejected',
      title: `Request Declined`,
      message: `Your request to join ${req.room.name} was not approved`,
      roomId: req.room._id.toString()
    });

    io.to(`user:${userId}`).emit('room:joinRejected', {
      roomId: req.room._id
    });

    logger.info(`User ${userId} rejected from room: ${req.room.name}`);
    res.json({
      success: true,
      message: 'Member request rejected'
    });
  } catch (error) {
    if (error.message.includes('not found in pending')) {
      return res.status(404).json({ success: false, message: error.message });
    }
    next(error);
  }
});

// @route   PUT /api/rooms/:id/settings
// @desc    Update room settings (including requireApproval)
// @access  Private (owner only)
router.put('/:id/settings', protect, isRoomOwner, async (req, res, next) => {
  try {
    const { requireApproval, allowMemberTaskCreation, timezone } = req.body;

    const updateFields = {};
    if (typeof requireApproval === 'boolean') {
      updateFields['settings.requireApproval'] = requireApproval;
    }
    if (typeof allowMemberTaskCreation === 'boolean') {
      updateFields['settings.allowMemberTaskCreation'] = allowMemberTaskCreation;
    }
    if (timezone) {
      updateFields['settings.timezone'] = timezone;
    }

    const room = await Room.findByIdAndUpdate(
      req.params.id,
      { $set: updateFields },
      { new: true, runValidators: true }
    ).populate('owner', 'username _id')
     .populate('members.userId', 'username _id avatar');

    // Emit socket event
    const io = req.app.get('io');
    io.to(room._id.toString()).emit('room:updated', { room });

    logger.info(`Room settings updated: ${room.name}`);
    res.json({
      success: true,
      room
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
