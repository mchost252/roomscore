const express = require('express');
const router = express.Router();
const { prisma } = require('../config/database');
const { nanoid } = require('nanoid');
const NotificationService = require('../services/notificationService');
const PushNotificationService = require('../services/pushNotificationService');
const { protect, isRoomOwner, isRoomAdmin, isRoomMember } = require('../middleware/auth');
const { validate, createRoomSchema, updateRoomSchema, updateRoomDpSchema, updateMemberRoleSchema, joinRoomSchema, sendMessageSchema } = require('../middleware/validation');
const logger = require('../utils/logger');
const { evaluateAndUnlock } = require('../services/trophyService');

function parseReactions(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function fireTrophyCheck(userId) {
  if (!userId) return;
  evaluateAndUnlock(userId).catch((err) =>
    logger.error(`Trophy evaluation failed for ${userId}:`, err.message),
  );
}

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

const activeRoomWhere = () => ({
  isActive: true,
  OR: [
    { endDate: null },
    { endDate: { gt: new Date() } }
  ]
});
const normalizeRoomTaskType = (type) => type === 'weekly' ? 'daily' : (type || 'daily');
const roomTaskAppearsToday = (task) => {
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0];
  if (normalizeRoomTaskType(task.taskType) === 'one-time') {
    return !!task.dueDate && new Date(task.dueDate).toISOString().split('T')[0] === dateStr;
  }
  if (normalizeRoomTaskType(task.taskType) === 'custom') {
    return (task.daysOfWeek || '').split(',').map(Number).includes(today.getDay());
  }
  return true;
};

// Helper to format room response
const formatRoomResponse = (room) => ({
  ...room,
  _id: room.id, // For frontend compatibility
  isPublic: !room.isPrivate, // Frontend compatibility - convert isPrivate to isPublic
  requireApproval: room.requireApproval || false,
  isPremium: room.isPremium || false, // Room premium status
  premiumActivatedAt: room.premiumActivatedAt || null,
  coverImage: room.coverImage || null,
  roomDp: room.roomDp || null,
  owner: room.owner ? { ...room.owner, _id: room.owner.id } : { _id: room.ownerId },
  // IMPORTANT: Only return active members (exclude pending)
  members: room.members?.filter(m => m.status === 'active').map(m => ({
    ...m,
    _id: m.id,
    userId: m.user ? { ...m.user, _id: m.user.id } : { _id: m.userId }
  })) || [],
  tasks: room.tasks?.filter(roomTaskAppearsToday).map(t => ({ ...t, taskType: normalizeRoomTaskType(t.taskType), _id: t.id })) || []
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
          ...activeRoomWhere(),
          ...(allExcludeIds.length > 0 ? { id: { notIn: allExcludeIds } } : {})
        },
        select: {
          id: true,
          name: true,
          description: true,
          joinCode: true,
          isPrivate: true,
          requireApproval: true,
          maxMembers: true,
          chatRetentionDays: true,
          isPremium: true,
          premiumActivatedAt: true,
          streak: true,
          ownerId: true,
          startDate: true,
          endDate: true,
          isActive: true,
          coverImage: true,
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
    // Parallelise the two independent ID lookups before combining.
    const t0 = Date.now();

    const [memberRoomIds, ownedRoomIds] = await Promise.all([
      prisma.roomMember.findMany({
        where: { userId: req.user.id },
        select: { roomId: true }
      }),
      prisma.room.findMany({
        where: { ownerId: req.user.id, ...activeRoomWhere() },
        select: { id: true }
      }),
    ]);
    const memberIds = memberRoomIds.map(r => r.roomId);
    const ownedIds = ownedRoomIds.map(r => r.id);
    
    // Combine and dedupe
    const allRoomIds = [...new Set([...memberIds, ...ownedIds])];
    
    if (allRoomIds.length === 0) {
      return res.json({ success: true, count: 0, rooms: [] });
    }
    
    const rooms = await prisma.room.findMany({
      where: {
        id: { in: allRoomIds },
        ...activeRoomWhere()
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
            dueDate: true,
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
    const { name, description, isPublic, maxMembers, tasks, duration, chatRetentionDays, requireApproval, coverImage, roomDp } = req.body;

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
        coverImage: coverImage || null,
        roomDp: roomDp || null,
        members: {
          create: {
            userId: req.user.id,
            role: 'owner',
            points: 0
          }
        },
        tasks: tasks && tasks.length > 0 ? {
          create: tasks.map(task => {
            const taskType = normalizeRoomTaskType(task.taskType || task.frequency);
            if (taskType === 'one-time' && !task.dueDate) {
              throw new Error('One-time tasks require a date');
            }
            let daysOfWeek = '';
            if (taskType === 'custom' && Array.isArray(task.daysOfWeek)) {
              const validDays = task.daysOfWeek.filter(d => d >= 0 && d <= 6);
              daysOfWeek = validDays.join(',');
            }
            return {
              title: task.title,
              description: task.description || null,
              taskType: normalizeRoomTaskType(taskType),
              daysOfWeek: daysOfWeek || null,
               dueDate: normalizeRoomTaskType(taskType) === 'one-time' && task.dueDate ? new Date(task.dueDate) : null,
              points: Math.min(10, Math.max(1, task.points || 5)), // Clamp points to 1-10
              hasThread: task.hasThread === true
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
    fireTrophyCheck(req.user.id);
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
    const room = formatRoomResponse(req.room);

    // Join code is owner-private unless the owner opts to reveal it to all members.
    const isOwner = req.room.ownerId === req.user.id;
    if (!isOwner && !req.room.showJoinCode) {
      delete room.joinCode;
    }

    res.json({
      success: true,
      room
    });
  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/rooms/:id
// @desc    Update room
// @access  Private (owner or room admin)
router.put('/:id', protect, isRoomAdmin, validate(updateRoomSchema), async (req, res, next) => {
  try {
    const { name, description, isPublic, maxMembers, coverImage, roomDp } = req.body;

    const updateData = {};
    if (name) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (isPublic !== undefined) updateData.isPrivate = !isPublic;
    if (maxMembers) updateData.maxMembers = maxMembers;
    if (coverImage !== undefined) updateData.coverImage = coverImage;
    if (roomDp !== undefined) updateData.roomDp = roomDp;

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
    const roomEvent = { roomId: room.id, room: formatRoomResponse(room) };
    io.to(room.id).emit('room:updated', roomEvent);

    logger.info(`Room updated: ${room.name}`);
    res.json({
      success: true,
      room: formatRoomResponse(room)
    });
  } catch (error) {
    next(error);
  }
});

router.put('/:id/dp', protect, isRoomAdmin, validate(updateRoomDpSchema), async (req, res, next) => {
  try {
    const { roomDp } = req.body;

    const room = await prisma.room.update({
      where: { id: req.params.id },
      data: { roomDp },
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

    const io = req.app.get('io');
    const roomEvent = { roomId: room.id, room: formatRoomResponse(room) };
    io.to(room.id).emit('room:updated', roomEvent);

    res.json({ success: true, room: formatRoomResponse(room) });
  } catch (error) {
    next(error);
  }
});

// @route   DELETE /api/rooms/:id
// @desc    Delete room
// @access  Private (owner only)
router.delete('/:id', protect, isRoomOwner, async (req, res, next) => {
  try {
    // Get all room members (exclude owner)
    const roomMembers = req.room.members
      .filter(m => m.userId !== req.user.id)
      .map(m => m.userId);

    // Delete the room. Because of `onDelete: Cascade` in the Prisma schema,
    // this single command safely and instantly deletes all related tasks, 
    // members, chat messages, and completions without causing a SQLite deadlock.
    await prisma.room.delete({
      where: { id: req.params.id }
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
    if (io) {
      io.to(req.room.id).emit('room:deleted', { roomId: req.room.id });
    }

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
        type: 'room_invite',
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
          type: 'room_joined',
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
    fireTrophyCheck(req.user.id);
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
          type: 'room_left',
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
    
    if (io) {
      // Emit to room (for other members)
      io.to(req.room.id).emit('member:left', eventData);
      
      // IMPORTANT: Also emit to the user's personal channel
      // because they've already left the room channel
      io.to(`user:${req.user.id}`).emit('member:left', eventData);
      io.to(req.room.id).emit('room:membersUpdated', { roomId: req.room.id });
    }

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
// @access  Private (owner, or admin for regular members)
router.delete('/:id/members/:userId', protect, isRoomAdmin, async (req, res, next) => {
  try {
    const { userId } = req.params;

    if (userId === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'Cannot remove yourself. Use leave endpoint instead.'
      });
    }

    if (userId === req.room.ownerId) {
      return res.status(400).json({
        success: false,
        message: 'The room owner cannot be removed'
      });
    }

    // Admins may only remove regular members; demoting/removing another admin
    // stays an owner-only action.
    const target = req.room.members.find(m => m.userId === userId);
    if (req.roomRole === 'admin' && target?.role === 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only the room owner can remove an admin'
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
      userId,
      oderId: userId, // legacy key — older clients still read this
      username: removedUser?.username || 'User'
    });
    io.to(req.room.id).emit('room:membersUpdated', { roomId: req.room.id });
    // The removed user is no longer in the room socket channel.
    io.to(`user:${userId}`).emit('member:kicked', {
      roomId: req.room.id,
      userId,
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

// @route   PUT /api/rooms/:id/members/:userId/role
// @desc    Promote a member to admin, or demote an admin back to member
// @access  Private (owner only; admins cannot override member roles)
router.put('/:id/members/:userId/role', protect, isRoomOwner, validate(updateMemberRoleSchema), async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    if (userId === req.room.ownerId) {
      return res.status(400).json({
        success: false,
        message: "The room owner's role cannot be changed"
      });
    }

    const member = await prisma.roomMember.findFirst({
      where: {
        roomId: req.room.id,
        userId: userId,
        status: 'active'
      }
    });

    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member not found in this room'
      });
    }

    if (member.role === role) {
      return res.status(400).json({
        success: false,
        message: role === 'admin' ? 'Member is already an admin' : 'Member is already a regular member'
      });
    }

    await prisma.roomMember.update({
      where: { id: member.id },
      data: { role }
    });

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, avatar: true }
    });

    const promoted = role === 'admin';
    const username = targetUser?.username || 'User';

    // Create system message
    await prisma.chatMessage.create({
      data: {
        roomId: req.room.id,
        userId: req.user.id,
        content: promoted
          ? `${username} is now a room admin`
          : `${username} is no longer a room admin`,
        type: 'system'
      }
    });

    // Notify the affected member
    await NotificationService.createNotification({
      recipientId: userId,
      type: promoted ? 'room_role_promoted' : 'room_role_demoted',
      title: promoted ? `You're now an admin` : 'Admin access removed',
      message: promoted
        ? `You can now help manage ${req.room.name}`
        : `You're now a regular member of ${req.room.name}`,
      roomId: req.room.id
    });

    // Emit socket events
    const io = req.app.get('io');
    io.to(req.room.id).emit('member:roleChanged', {
      roomId: req.room.id,
      userId,
      role,
      username
    });
    io.to(`user:${userId}`).emit('room:roleChanged', {
      roomId: req.room.id,
      roomName: req.room.name,
      role
    });
    io.to(req.room.id).emit('room:membersUpdated', { roomId: req.room.id });

    logger.info(`User ${userId} role set to ${role} in room: ${req.room.name}`);
    res.json({
      success: true,
      message: promoted ? 'Member promoted to admin' : 'Admin demoted to member',
      member: {
        id: member.id,
        _id: member.id,
        userId: targetUser ? { ...targetUser, _id: targetUser.id } : { _id: userId },
        role
      }
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

    // Emit socket event IMMEDIATELY (don't wait for notifications)
    const io = req.app.get('io');
    io.to(req.params.id).emit('chat:message', { message: formattedMessage });

    // Send HTTP response IMMEDIATELY (don't wait for notifications)
    res.status(201).json({
      success: true,
      message: formattedMessage
    });

    // --- Everything below is non-blocking (fire-and-forget) ---
    // Get room members (exclude sender)
    const roomMembers = req.room.members
      .filter(m => m.userId !== req.user.id)
      .map(m => m.userId);

    // Truncate message for notification preview
    const messagePreview = message.length > 50 ? message.substring(0, 50) + '...' : message;

    // Create notifications for all members (non-blocking, parallel)
    Promise.allSettled(
      roomMembers.map(memberId =>
        NotificationService.createNotification({
          recipientId: memberId,
          type: 'room_updated',
          title: `${req.user.username} in ${req.room.name}`,
          message: messagePreview,
          roomId: req.params.id
        })
      )
    ).catch(err => logger.error('Error creating notifications:', err));

    // Send push notifications (already non-blocking)
    if (roomMembers.length > 0) {
      PushNotificationService.notifyNewChat(
        roomMembers,
        req.user.username,
        messagePreview,
        req.room.name,
        req.params.id
      ).catch(err => logger.error('Push notification error:', err));
    }

    fireTrophyCheck(req.user.id);
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/rooms/:id/chat
// @desc    Get chat messages - supports Delta Sync (last_id for efficiency)
// @access  Private (must be member)
router.get('/:id/chat', protect, isRoomMember, async (req, res, next) => {
  try {
    const { limit = 50, before, last_id } = req.query;

    // Enforce room chat retention (max 5 days)
    const retentionDays = Math.min(5, Math.max(1, req.room.chatRetentionDays || 5));
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);

    const whereClause = {
      roomId: req.params.id,
      createdAt: { gte: cutoff }
    };

    // DELTA SYNC: If last_id provided, only fetch messages after that
    if (last_id) {
      const lastMessage = await prisma.chatMessage.findUnique({
        where: { id: last_id },
        select: { createdAt: true }
      });
      
      if (lastMessage) {
        whereClause.createdAt = { gt: lastMessage.createdAt };
        logger.info(`[Delta Sync] Room ${req.params.id}: Fetching messages after ${last_id}`);
      }
    } else if (before) {
      // Legacy: Load older messages (pagination)
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
      status: m.status || 'sent', // sent, delivered, read
      userId: m.user ? { ...m.user, _id: m.user.id } : null,
      replyTo: m.replyToText ? { _id: m.replyToId, message: m.replyToText } : null,
      reactions: parseReactions(m.reactions)
    }));

    res.json({
      success: true,
      count: formattedMessages.length,
      messages: formattedMessages,
      retentionDays,
      deltaSync: !!last_id, // Tell client this was a delta sync
      syncFrom: last_id || null
    });
  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/rooms/:id/members/:userId/approve
// @desc    Approve a pending member
// @access  Private (owner or room admin)
router.put('/:id/members/:userId/approve', protect, isRoomAdmin, async (req, res, next) => {
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
      type: 'room_joined',
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
    io.to(req.room.id).emit('room:membersUpdated', { roomId: req.room.id });

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
// @access  Private (owner or room admin)
router.delete('/:id/members/:userId/reject', protect, isRoomAdmin, async (req, res, next) => {
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
    io.to(req.room.id).emit('room:membersUpdated', { roomId: req.room.id });

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
// @access  Private (owner or room admin)
router.get('/:id/pending', protect, isRoomAdmin, async (req, res, next) => {
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

// @route   PUT /api/rooms/:id/premium
// @desc    Activate or deactivate room premium
// @access  Private (owner only)
router.put('/:id/premium', protect, isRoomOwner, async (req, res, next) => {
  try {
    const { code, deactivate } = req.body;

    // Valid room premium codes
    const VALID_ROOM_CODES = ['ROOM-PREMIUM', 'ORBIT-ROOM-VIP', 'KRIOS-ROOM-ELITE'];

    if (deactivate) {
      // Deactivate premium
      const room = await prisma.room.update({
        where: { id: req.params.id },
        data: {
          isPremium: false,
          premiumActivatedAt: null
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

      // Emit socket event to all members
      const io = req.app.get('io');
      io.to(room.id).emit('room:premiumUpdated', { 
        roomId: room.id, 
        isPremium: false 
      });

      logger.info(`Room premium deactivated: ${room.name}`);
      return res.json({
        success: true,
        message: 'Room premium deactivated',
        room: formatRoomResponse(room)
      });
    }

    // Activate premium - validate code
    const upperCode = code?.toUpperCase()?.trim();
    if (!VALID_ROOM_CODES.includes(upperCode)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid room premium code'
      });
    }

    const room = await prisma.room.update({
      where: { id: req.params.id },
      data: {
        isPremium: true,
        premiumActivatedAt: new Date()
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

    // Emit socket event to all members
    const io = req.app.get('io');
    io.to(room.id).emit('room:premiumUpdated', { 
      roomId: room.id, 
      isPremium: true,
      premiumActivatedAt: room.premiumActivatedAt
    });

    logger.info(`Room premium activated: ${room.name}`);
    res.json({
      success: true,
      message: 'Room premium activated!',
      room: formatRoomResponse(room)
    });
  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/rooms/:id/settings
// @desc    Update room settings
// @access  Private (owner or room admin)
router.put('/:id/settings', protect, isRoomAdmin, async (req, res, next) => {
  try {
    const { isPublic, chatRetentionDays, requireApproval, showJoinCode } = req.body;

    const updateData = {};
    if (typeof isPublic === 'boolean') {
      updateData.isPrivate = !isPublic;
    }
    if (typeof requireApproval === 'boolean') {
      updateData.requireApproval = requireApproval;
    }
    if (typeof showJoinCode === 'boolean') {
      updateData.showJoinCode = showJoinCode;
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
    const roomEvent = { roomId: room.id, room: formatRoomResponse(room) };
    io.to(room.id).emit('room:updated', roomEvent);
    io.to(room.id).emit('room:settingsUpdated', roomEvent);

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
