const express = require('express');
const router = express.Router();
const { prisma } = require('../config/database');
const { nanoid } = require('nanoid');
const NotificationService = require('../services/notificationService');
const PushNotificationService = require('../services/pushNotificationService');
const { protect, isRoomOwner, isRoomMember } = require('../middleware/auth');
const { validate, createRoomSchema, updateRoomSchema, joinRoomSchema, sendMessageSchema } = require('../middleware/validation');
const logger = require('../utils/logger');

// Helper to generate join code
const generateJoinCode = () => nanoid(8).toUpperCase();

// Helper to calculate expiry date
const calculateExpiryDate = (duration) => {
  const now = new Date();
  switch (duration) {
    case '1_week': return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    case '2_weeks': return new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    case '1_month': return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    default: return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  }
};

// Helper to format room response
const formatRoomResponse = (room) => ({
  ...room,
  _id: room.id, // For frontend compatibility
  isPublic: !room.isPrivate, // Frontend compatibility - convert isPrivate to isPublic
  requireApproval: room.requireApproval || false,
  owner: room.owner ? { ...room.owner, _id: room.owner.id } : { _id: room.ownerId },
  // IMPORTANT: Only return active members (exclude pending)
  members: room.members?.filter(m => m.status === 'active').map(m => ({
    ...m,
    _id: m.id,
    userId: m.user ? { ...m.user, _id: m.user.id } : { _id: m.userId }
  })) || [],
  tasks: room.tasks?.map(t => ({ ...t, _id: t.id })) || []
});

// @route   GET /api/rooms
// @desc    Get all rooms for current user
// @access  Private
router.get('/', protect, async (req, res, next) => {
  try {
    const { type } = req.query;
    
    if (type === 'public') {
      // Get public rooms that user is NOT a member of
      // Optimized: First get user's room IDs, then exclude them
      const t0 = Date.now();
      
      // Get IDs of rooms user is already in (faster than nested query)
      const userRoomIds = await prisma.roomMember.findMany({
        where: { userId: req.user.id },
        select: { roomId: true }
      });
      const excludeRoomIds = userRoomIds.map(r => r.roomId);
      
      // Get rooms user owns
      const ownedRooms = await prisma.room.findMany({
        where: { ownerId: req.user.id },
        select: { id: true }
      });
      const ownedRoomIds = ownedRooms.map(r => r.id);
      
      // Combine exclusions
      const allExcludeIds = [...new Set([...excludeRoomIds, ...ownedRoomIds])];
      
      const rooms = await prisma.room.findMany({
        where: {
          isPrivate: false,
          isActive: true,
          ...(allExcludeIds.length > 0 ? { id: { notIn: allExcludeIds } } : {})
        },
        select: {
          id: true,
          name: true,
          description: true,
          joinCode: true,
          isPrivate: true,
          maxMembers: true,
          chatRetentionDays: true,
          streak: true,
          ownerId: true,
          startDate: true,
          endDate: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          owner: { select: { id: true, username: true } },
          members: {
            select: {
              id: true,
              userId: true,
              role: true,
              points: true,
              status: true,
              joinedAt: true,
              user: { select: { id: true, username: true, avatar: true } }
            }
          },
          tasks: {
            where: { isActive: true },
            select: { id: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 30
      });
      logger.info(`GET /api/rooms?type=public returned ${rooms.length} rooms in ${Date.now() - t0}ms for user ${req.user.id}`);
      
      return res.json({
        success: true,
        count: rooms.length,
        rooms: rooms.map(formatRoomResponse)
      });
    }
    
    // Get user's rooms (owned or member)
    // Optimized: Use separate queries to avoid complex joins
    const t0 = Date.now();
    
    // Get room IDs user is a member of
    const memberRoomIds = await prisma.roomMember.findMany({
      where: { userId: req.user.id },
      select: { roomId: true }
    });
    const memberIds = memberRoomIds.map(r => r.roomId);
    
    // Get owned room IDs
    const ownedRoomIds = await prisma.room.findMany({
      where: { ownerId: req.user.id, isActive: true },
      select: { id: true }
    });
    const ownedIds = ownedRoomIds.map(r => r.id);
    
    // Combine and dedupe
    const allRoomIds = [...new Set([...memberIds, ...ownedIds])];
    
    if (allRoomIds.length === 0) {
      return res.json({ success: true, count: 0, rooms: [] });
    }
    
    const rooms = await prisma.room.findMany({
      where: {
        id: { in: allRoomIds },
        isActive: true
      },
      include: {
        owner: { select: { id: true, username: true } },
        members: {
          select: {
            id: true,
            userId: true,
            role: true,
            points: true,
            status: true,
            joinedAt: true,
            user: { select: { id: true, username: true, avatar: true } }
          }
        },
        tasks: {
          where: { isActive: true },
          select: {
            id: true,
            roomId: true,
            title: true,
            description: true,
            taskType: true,
            daysOfWeek: true,
            points: true,
            isActive: true,
            createdAt: true
          }
        }
      },
      orderBy: { updatedAt: 'desc' },
      take: 50
    });
    logger.info(`GET /api/rooms returned ${rooms.length} rooms in ${Date.now() - t0}ms for user ${req.user.id}`);

    // Get today's date for task completion status
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    // Get all task completions for today for this user across all their rooms
    const roomIds = rooms.map(r => r.id);
    const userCompletions = roomIds.length === 0
      ? []
      : await prisma.taskCompletion.findMany({
          where: {
            userId: req.user.id,
            roomId: { in: roomIds },
            completionDate: todayStr
          },
          select: { taskId: true }
        });

    // Create a Set of completed task IDs for quick lookup
    const completedTaskIds = new Set(userCompletions.map(c => c.taskId));

    // Add isCompleted status to each task in each room
    const roomsWithTaskStatus = rooms.map(room => {
      const formatted = formatRoomResponse(room);
      formatted.tasks = formatted.tasks.map(task => ({
        ...task,
        isCompleted: completedTaskIds.has(task.id)
      }));
      return formatted;
    });

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
    const { name, description, isPublic, maxMembers, tasks, duration, chatRetentionDays, requireApproval } = req.body;

    // Calculate expiry date based on duration (max 1 month)
    const endDate = calculateExpiryDate(duration || '1_month');
    const joinCode = generateJoinCode();

    // Validate chatRetentionDays (1-5)
    const retentionDays = chatRetentionDays ? Math.min(5, Math.max(1, parseInt(chatRetentionDays))) : 3;

    const room = await prisma.room.create({
      data: {
        name,
        description: description || null,
        ownerId: req.user.id,
        joinCode,
        isPrivate: !isPublic,
        requireApproval: requireApproval === true,
        maxMembers: maxMembers || 50,
        chatRetentionDays: retentionDays,
        endDate,
        members: {
          create: {
            userId: req.user.id,
            role: 'owner',
            points: 0
          }
        },
        tasks: tasks && tasks.length > 0 ? {
          create: tasks.map(task => {
            const taskType = task.taskType || task.frequency || 'daily';
            let daysOfWeek = [];
            if (taskType === 'custom' && Array.isArray(task.daysOfWeek)) {
              daysOfWeek = task.daysOfWeek.filter(d => d >= 0 && d <= 6);
            }
            return {
              title: task.title,
              description: task.description || null,
              taskType: taskType,
              daysOfWeek: daysOfWeek,
              points: Math.min(10, Math.max(1, task.points || 5)) // Clamp points to 1-10
            };
          })
        } : undefined
      },
      include: {
        owner: { select: { id: true, username: true } },
        members: {
          include: {
            user: { select: { id: true, username: true, avatar: true } }
          }
        },
        tasks: true
      }
    });

    // Emit socket event
    const io = req.app.get('io');
    io.emit('room:created', { room: formatRoomResponse(room) });

    logger.info(`Room created: ${room.name} by ${req.user.email}, expires: ${endDate}`);
    res.status(201).json({
      success: true,
      room: formatRoomResponse(room)
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
    res.json({
      success: true,
      room: formatRoomResponse(req.room)
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
    const { name, description, isPublic, maxMembers } = req.body;

    const updateData = {};
    if (name) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (isPublic !== undefined) updateData.isPrivate = !isPublic;
    if (maxMembers) updateData.maxMembers = maxMembers;

    const room = await prisma.room.update({
      where: { id: req.params.id },
      data: updateData,
      include: {
        owner: { select: { id: true, username: true } },
        members: {
          include: {
            user: { select: { id: true, username: true, avatar: true } }
          }
        },
        tasks: true
      }
    });

    // Emit socket event
    const io = req.app.get('io');
    io.to(room.id).emit('room:updated', { room: formatRoomResponse(room) });

    logger.info(`Room updated: ${room.name}`);
    res.json({
      success: true,
      room: formatRoomResponse(room)
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
      .filter(m => m.userId !== req.user.id)
      .map(m => m.userId);

    // Delete all related data in a transaction for data integrity
    await prisma.$transaction(async (tx) => {
      // Delete task completions for this room
      await tx.taskCompletion.deleteMany({
        where: { roomId: req.params.id }
      });

      // Delete user room progress
      await tx.userRoomProgress.deleteMany({
        where: { roomId: req.params.id }
      });

      // Delete room tasks
      await tx.roomTask.deleteMany({
        where: { roomId: req.params.id }
      });

      // Delete chat messages
      await tx.chatMessage.deleteMany({
        where: { roomId: req.params.id }
      });

      // Delete room members
      await tx.roomMember.deleteMany({
        where: { roomId: req.params.id }
      });

      // Delete appreciations related to this room
      await tx.appreciation.deleteMany({
        where: { roomId: req.params.id }
      });

      // Delete nudges related to this room
      await tx.nudge.deleteMany({
        where: { roomId: req.params.id }
      });

      // Finally, delete the room itself
      await tx.room.delete({
        where: { id: req.params.id }
      });
    });

    // Notify members about room disbanding
    if (roomMembers.length > 0) {
      PushNotificationService.notifyRoomDisbanded(
        roomMembers,
        req.room.name
      ).catch(err => logger.error('Push notification error:', err));
    }

    // Emit socket event
    const io = req.app.get('io');
    io.to(req.room.id).emit('room:deleted', { roomId: req.room.id });

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
// @desc    Join a room with code
// @access  Private
router.post('/join', protect, validate(joinRoomSchema), async (req, res, next) => {
  try {
    const { joinCode } = req.body;

    const room = await prisma.room.findFirst({
      where: { 
        joinCode: joinCode.toUpperCase(), 
        isActive: true 
      },
      include: {
        members: true
      }
    });

    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found with provided code'
      });
    }

    // Check if room has expired
    if (room.endDate && new Date() > room.endDate) {
      return res.status(400).json({
        success: false,
        message: 'This room has expired and is no longer accepting members'
      });
    }

    // Check if already a member
    const isMember = room.members.some(m => m.userId === req.user.id);
    const isOwner = room.ownerId === req.user.id;

    if (isMember || isOwner) {
      return res.status(400).json({
        success: false,
        message: 'You are already a member of this room'
      });
    }

    // Check room capacity (only count active members)
    const activeMembers = room.members.filter(m => m.status === 'active');
    if (activeMembers.length >= room.maxMembers) {
      return res.status(400).json({
        success: false,
        message: 'Room has reached maximum capacity'
      });
    }

    // Get existing members before adding new one (for notifications)
    const existingMembers = room.members.filter(m => m.status === 'active').map(m => m.userId);

    // Check if room requires approval
    const needsApproval = room.requireApproval === true;
    const memberStatus = needsApproval ? 'pending' : 'active';

    // Add member (pending or active based on requireApproval)
    await prisma.roomMember.create({
      data: {
        roomId: room.id,
        userId: req.user.id,
        role: 'member',
        points: 0,
        status: memberStatus
      }
    });

    // If needs approval, notify owner and return early
    if (needsApproval) {
      // Notify room owner
      await NotificationService.createNotification({
        recipientId: room.ownerId,
        type: 'join_request',
        title: `Join Request for ${room.name}`,
        message: `${req.user.username} wants to join your room`,
        roomId: room.id,
        data: { requesterId: req.user.id, requesterName: req.user.username }
      });

      // Emit socket event to owner
      const io = req.app.get('io');
      io.to(`user:${room.ownerId}`).emit('room:joinRequest', {
        roomId: room.id,
        roomName: room.name,
        user: { id: req.user.id, _id: req.user.id, username: req.user.username, avatar: req.user.avatar }
      });

      logger.info(`User ${req.user.email} requested to join room: ${room.name} (pending approval)`);
      return res.json({
        success: true,
        pending: true,
        message: 'Your join request has been sent. Waiting for owner approval.'
      });
    }

    // Create system message (only if approved)
    await prisma.chatMessage.create({
      data: {
        roomId: room.id,
        userId: req.user.id,
        content: `${req.user.username} joined the room`,
        type: 'system'
      }
    });

    // Get updated room
    const updatedRoom = await prisma.room.findUnique({
      where: { id: room.id },
      include: {
        owner: { select: { id: true, username: true } },
        members: {
          include: {
            user: { select: { id: true, username: true, avatar: true } }
          }
        },
        tasks: true
      }
    });

    // Create notifications for existing members
    for (const memberId of existingMembers) {
      try {
        await NotificationService.createNotification({
          recipientId: memberId,
          type: 'member_joined',
          title: `New Member in ${room.name}`,
          message: `${req.user.username} joined the room`,
          roomId: room.id
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
        room.id
      ).catch(err => logger.error('Push notification error:', err));
    }

    // Emit socket event
    const io = req.app.get('io');
    io.to(room.id).emit('member:joined', {
      roomId: room.id,
      user: { id: req.user.id, _id: req.user.id, username: req.user.username, avatar: req.user.avatar }
    });

    logger.info(`User ${req.user.email} joined room: ${room.name}`);
    res.json({
      success: true,
      room: formatRoomResponse(updatedRoom)
    });
  } catch (error) {
    next(error);
  }
});

// @route   DELETE /api/rooms/:id/leave
// @desc    Leave a room
// @access  Private
router.delete('/:id/leave', protect, isRoomMember, async (req, res, next) => {
  try {
    if (req.room.ownerId === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'Room owner cannot leave. Please transfer ownership or delete the room.'
      });
    }

    // Get remaining members before removal (for notifications)
    const remainingMembers = req.room.members
      .filter(m => m.userId !== req.user.id)
      .map(m => m.userId);

    // Remove member
    await prisma.roomMember.deleteMany({
      where: {
        roomId: req.room.id,
        userId: req.user.id
      }
    });
    
    // Delete all task completions for this user in this room
    await prisma.taskCompletion.deleteMany({
      where: {
        userId: req.user.id,
        roomId: req.room.id
      }
    });
    
    // Delete user room progress
    await prisma.userRoomProgress.deleteMany({
      where: {
        userId: req.user.id,
        roomId: req.room.id
      }
    });

    // Create system message
    await prisma.chatMessage.create({
      data: {
        roomId: req.room.id,
        userId: req.user.id,
        content: `${req.user.username} left the room`,
        type: 'system'
      }
    });

    // Create notifications for remaining members
    for (const memberId of remainingMembers) {
      try {
        await NotificationService.createNotification({
          recipientId: memberId,
          type: 'member_left',
          title: `Member Left ${req.room.name}`,
          message: `${req.user.username} left the room`,
          roomId: req.room.id
        });
      } catch (err) {
        logger.error('Error creating notification:', err);
      }
    }

    // Emit socket event to room and to the user who left
    const io = req.app.get('io');
    const eventData = {
      roomId: req.room.id,
      userId: req.user.id,
      username: req.user.username
    };
    
    // Emit to room (for other members)
    io.to(req.room.id).emit('member:left', eventData);
    
    // IMPORTANT: Also emit to the user's personal channel
    // because they've already left the room channel
    io.to(`user:${req.user.id}`).emit('member:left', eventData);

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

    const removedUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true }
    });

    // Remove member
    await prisma.roomMember.deleteMany({
      where: {
        roomId: req.room.id,
        userId: userId
      }
    });
    
    // Delete all task completions for this user in this room
    await prisma.taskCompletion.deleteMany({
      where: {
        userId: userId,
        roomId: req.room.id
      }
    });
    
    // Delete user room progress
    await prisma.userRoomProgress.deleteMany({
      where: {
        userId: userId,
        roomId: req.room.id
      }
    });

    // Create system message
    if (removedUser) {
      await prisma.chatMessage.create({
        data: {
          roomId: req.room.id,
          userId: req.user.id,
          content: `${removedUser.username} was removed from the room`,
          type: 'system'
        }
      });
    }

    // Emit socket event
    const io = req.app.get('io');
    io.to(req.room.id).emit('member:kicked', {
      roomId: req.room.id,
      oderId: userId,
      username: removedUser?.username || 'User'
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
    const leaderboard = await prisma.roomMember.findMany({
      where: { roomId: req.room.id },
      include: {
        user: { select: { id: true, username: true, avatar: true } }
      },
      orderBy: { points: 'desc' }
    });

    res.json({
      success: true,
      leaderboard: leaderboard.map(m => ({
        _id: m.id,
        oderId: m.userId,
        user: { ...m.user, _id: m.user.id },
        points: m.points,
        role: m.role
      }))
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
    const { message, replyToId, replyToText } = req.body;

    // If replyToId provided but no replyToText, try to fetch original message text
    let finalReplyToText = replyToText || null;
    if (replyToId && !finalReplyToText) {
      const originalMsg = await prisma.chatMessage.findUnique({
        where: { id: replyToId },
        select: { content: true }
      });
      finalReplyToText = originalMsg?.content?.substring(0, 100) || null;
    }

    const chatMessage = await prisma.chatMessage.create({
      data: {
        roomId: req.params.id,
        userId: req.user.id,
        content: message,
        type: 'user',
        replyToId: replyToId || null,
        replyToText: finalReplyToText
      },
      include: {
        user: { select: { id: true, username: true, avatar: true } }
      }
    });

    // Format for frontend compatibility
    const formattedMessage = {
      ...chatMessage,
      _id: chatMessage.id,
      roomId: req.params.id,
      message: chatMessage.content,
      messageType: chatMessage.type,
      type: chatMessage.type,
      userId: chatMessage.user ? { ...chatMessage.user, _id: chatMessage.user.id } : null,
      replyTo: chatMessage.replyToText ? { _id: chatMessage.replyToId, message: chatMessage.replyToText } : null
    };

    // Get room members (exclude sender)
    const roomMembers = req.room.members
      .filter(m => m.userId !== req.user.id)
      .map(m => m.userId);

    // Truncate message for notification preview
    const messagePreview = message.length > 50 ? message.substring(0, 50) + '...' : message;

    // Create notifications for all members
    for (const memberId of roomMembers) {
      try {
        await NotificationService.createNotification({
          recipientId: memberId,
          type: 'new_chat',
          title: `${req.user.username} in ${req.room.name}`,
          message: messagePreview,
          roomId: req.params.id
        });
      } catch (err) {
        logger.error('Error creating notification:', err);
      }
    }

    // Send push notifications
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
    io.to(req.params.id).emit('chat:message', { message: formattedMessage });

    res.status(201).json({
      success: true,
      message: formattedMessage
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

    // Enforce room chat retention (max 5 days)
    const retentionDays = Math.min(5, Math.max(1, req.room.chatRetentionDays || 5));
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);

    const whereClause = {
      roomId: req.params.id,
      createdAt: { gte: cutoff }
    };

    if (before) {
      // Combine before filter with retention cutoff
      whereClause.createdAt = { gte: cutoff, lt: new Date(before) };
    }

    const messages = await prisma.chatMessage.findMany({
      where: whereClause,
      include: {
        user: { select: { id: true, username: true, avatar: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit)
    });

    // Format and reverse for chronological order
    const formattedMessages = messages.reverse().map(m => ({
      ...m,
      _id: m.id,
      message: m.content,
      messageType: m.type,
      userId: m.user ? { ...m.user, _id: m.user.id } : null,
      replyTo: m.replyToText ? { _id: m.replyToId, message: m.replyToText } : null
    }));

    res.json({
      success: true,
      count: formattedMessages.length,
      messages: formattedMessages,
      retentionDays
    });
  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/rooms/:id/members/:userId/approve
// @desc    Approve a pending member
// @access  Private (owner only)
router.put('/:id/members/:userId/approve', protect, isRoomOwner, async (req, res, next) => {
  try {
    const { userId } = req.params;
    
    const member = await prisma.roomMember.findFirst({
      where: {
        roomId: req.room.id,
        userId: userId,
        status: 'pending'
      }
    });

    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Pending member not found'
      });
    }

    // Update member status to active
    await prisma.roomMember.update({
      where: { id: member.id },
      data: { status: 'active' }
    });

    // Get user info
    const approvedUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, avatar: true }
    });

    // Create system message
    await prisma.chatMessage.create({
      data: {
        roomId: req.room.id,
        userId: userId,
        content: `${approvedUser?.username || 'User'} joined the room`,
        type: 'system'
      }
    });

    // Notify the approved user
    await NotificationService.createNotification({
      recipientId: userId,
      type: 'join_approved',
      title: `Welcome to ${req.room.name}!`,
      message: 'Your join request has been approved',
      roomId: req.room.id
    });

    // Emit socket events
    const io = req.app.get('io');
    io.to(`user:${userId}`).emit('room:joinApproved', {
      roomId: req.room.id,
      roomName: req.room.name
    });
    io.to(req.room.id).emit('member:joined', {
      roomId: req.room.id,
      user: { id: userId, _id: userId, username: approvedUser?.username, avatar: approvedUser?.avatar }
    });

    logger.info(`User ${userId} approved to join room: ${req.room.name}`);
    res.json({
      success: true,
      message: 'Member approved successfully'
    });
  } catch (error) {
    next(error);
  }
});

// @route   DELETE /api/rooms/:id/members/:userId/reject
// @desc    Reject a pending member
// @access  Private (owner only)
router.delete('/:id/members/:userId/reject', protect, isRoomOwner, async (req, res, next) => {
  try {
    const { userId } = req.params;
    
    const member = await prisma.roomMember.findFirst({
      where: {
        roomId: req.room.id,
        userId: userId,
        status: 'pending'
      }
    });

    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Pending member not found'
      });
    }

    // Delete the pending member
    await prisma.roomMember.delete({
      where: { id: member.id }
    });

    // Notify the rejected user
    await NotificationService.createNotification({
      recipientId: userId,
      type: 'join_rejected',
      title: `Join Request Declined`,
      message: `Your request to join ${req.room.name} was declined`,
      roomId: req.room.id
    });

    // Emit socket event
    const io = req.app.get('io');
    io.to(`user:${userId}`).emit('room:joinRejected', {
      roomId: req.room.id,
      roomName: req.room.name
    });

    logger.info(`User ${userId} rejected from room: ${req.room.name}`);
    res.json({
      success: true,
      message: 'Member request rejected'
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/rooms/:id/pending
// @desc    Get pending member requests
// @access  Private (owner only)
router.get('/:id/pending', protect, isRoomOwner, async (req, res, next) => {
  try {
    const pendingMembers = await prisma.roomMember.findMany({
      where: {
        roomId: req.room.id,
        status: 'pending'
      },
      include: {
        user: { select: { id: true, username: true, avatar: true, email: true } }
      }
    });

    const formatted = pendingMembers.map(m => ({
      _id: m.id,
      userId: m.user ? { ...m.user, _id: m.user.id } : m.userId,
      requestedAt: m.joinedAt
    }));

    res.json({
      success: true,
      count: formatted.length,
      pendingMembers: formatted
    });
  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/rooms/:id/settings
// @desc    Update room settings
// @access  Private (owner only)
router.put('/:id/settings', protect, isRoomOwner, async (req, res, next) => {
  try {
    const { isPublic, chatRetentionDays, requireApproval } = req.body;

    const updateData = {};
    if (typeof isPublic === 'boolean') {
      updateData.isPrivate = !isPublic;
    }
    if (typeof requireApproval === 'boolean') {
      updateData.requireApproval = requireApproval;
    }

    if (chatRetentionDays !== undefined) {
      const days = Number(chatRetentionDays);
      if (!Number.isFinite(days) || days < 1 || days > 5) {
        return res.status(400).json({
          success: false,
          message: 'chatRetentionDays must be a number between 1 and 5'
        });
      }
      updateData.chatRetentionDays = days;
    }

    const room = await prisma.room.update({
      where: { id: req.params.id },
      data: updateData,
      include: {
        owner: { select: { id: true, username: true } },
        members: {
          include: {
            user: { select: { id: true, username: true, avatar: true } }
          }
        },
        tasks: true
      }
    });

    // Emit socket event
    const io = req.app.get('io');
    io.to(room.id).emit('room:updated', { room: formatRoomResponse(room) });

    logger.info(`Room settings updated: ${room.name}`);
    res.json({
      success: true,
      room: formatRoomResponse(room)
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
