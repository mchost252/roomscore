const express = require('express');
const router = express.Router();
const { prisma } = require('../config/database');
const NotificationService = require('../services/notificationService');
const PushNotificationService = require('../services/pushNotificationService');
const { protect, isRoomMember } = require('../middleware/auth');
const { validate, createTaskSchema, updateTaskSchema } = require('../middleware/validation');
const logger = require('../utils/logger');

// Helper to get today's date string (YYYY-MM-DD)
const getTodayString = () => new Date().toISOString().split('T')[0];

// @route   GET /api/rooms/:roomId/tasks
// @desc    Get today's tasks for room
// @access  Private (must be member)
router.get('/:roomId/tasks', protect, isRoomMember, async (req, res, next) => {
  try {
    if (!prisma) {
      return res.status(500).json({ success: false, message: 'Database not initialized' });
    }
    
    const todayStr = getTodayString();

    // Get all active tasks for this room
    const tasks = await prisma.roomTask.findMany({
      where: {
        roomId: req.params.roomId,
        isActive: true
      }
    });

    // Get completions for today (for current user)
    const userCompletions = await prisma.taskCompletion.findMany({
      where: {
        userId: req.user.id,
        roomId: req.params.roomId,
        completionDate: todayStr
      }
    });

    // Get ALL completions for today (to show who completed what)
    const allCompletions = await prisma.taskCompletion.findMany({
      where: {
        roomId: req.params.roomId,
        completionDate: todayStr
      },
      include: {
        user: { select: { id: true, username: true, avatar: true } }
      }
    });

    const completedTaskIds = new Set(userCompletions.map(c => c.taskId));

    // Get ALL task assignments for these tasks
    let allAssignments = [];
    if (tasks.length > 0) {
      allAssignments = await prisma.roomTaskAssignment.findMany({
        where: {
          taskId: { in: tasks.map(t => t.id) }
        },
        include: {
          user: { select: { id: true, username: true, avatar: true } }
        }
      });
    }

    // Mark tasks as completed and add completion info + join status
    const tasksWithStatus = tasks.map(task => {
      const taskCompletions = allCompletions.filter(c => c.taskId === task.id);
      const taskAssignments = allAssignments.filter(a => a.taskId === task.id);
      const userAssignment = taskAssignments.find(a => a.userId === req.user.id);
      
      return {
        ...task,
        _id: task.id,
        isCompleted: completedTaskIds.has(task.id),
        completionId: userCompletions.find(c => c.taskId === task.id)?.id,
        // User's join status
        isJoined: userAssignment?.status === 'accepted',
        status: userAssignment?.status === 'accepted' ? 'accepted' : 'spectator',
        completedBy: taskCompletions.map(c => ({
          userId: c.user.id,
          _id: c.user.id,
          username: c.user.username,
          avatar: c.user.avatar,
          completedAt: c.completedAt
        })),
        assignments: taskAssignments.map(a => ({
          userId: a.user.id,
          username: a.user.username,
          avatar: a.user.avatar,
          status: a.status
        }))
      };
    });

    res.json({
      success: true,
      date: todayStr,
      count: tasksWithStatus.length,
      tasks: tasksWithStatus
    });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/rooms/:roomId/tasks
// @desc    Create a new task
// @access  Private (must be member, check permissions)
router.post('/:roomId/tasks', protect, isRoomMember, validate(createTaskSchema), async (req, res, next) => {
  try {
    const { title, description, points, taskType, frequency, daysOfWeek } = req.body;

    // Check permissions (only owner can create tasks for now)
    const isOwner = req.room.ownerId === req.user.id;

    if (!isOwner) {
      return res.status(403).json({
        success: false,
        message: 'Only room owner can create tasks'
      });
    }

    // Determine taskType - support both taskType and frequency fields
    const finalTaskType = taskType || frequency || 'daily';

    // Validate daysOfWeek for custom frequency
    let finalDaysOfWeek = [];
    if (finalTaskType === 'custom' && Array.isArray(daysOfWeek)) {
      finalDaysOfWeek = daysOfWeek.filter(d => d >= 0 && d <= 6);
    }

    // Convert daysOfWeek array to comma-separated string for Prisma
    let daysOfWeekString = null;
    if (finalDaysOfWeek && finalDaysOfWeek.length > 0) {
      daysOfWeekString = finalDaysOfWeek.join(',');
    }

    const task = await prisma.roomTask.create({
      data: {
        roomId: req.params.roomId,
        title,
        description: description || null,
        taskType: finalTaskType,
        daysOfWeek: daysOfWeekString,
        points: points || 10,
        isActive: true
      }
    });

    // Get room members (exclude creator)
    const roomMembers = req.room.members
      .filter(m => m.userId !== req.user.id)
      .map(m => m.userId);

    // Create notifications for all members
    for (const memberId of roomMembers) {
      try {
        await NotificationService.createNotification({
          recipientId: memberId,
          type: 'new_task',
          title: `New Task in ${req.room.name}`,
          message: `${req.user.username} created: ${title}`,
          roomId: req.params.roomId
        });
      } catch (err) {
        logger.error('Error creating notification:', err);
      }
    }

    // Send push notifications
    if (roomMembers.length > 0) {
      PushNotificationService.notifyNewTask(
        roomMembers,
        { ...task, roomId: req.params.roomId },
        req.room.name,
        req.user.username
      ).catch(err => logger.error('Push notification error:', err));
    }

    // Emit socket event
    const io = req.app.get('io');
    io.to(req.params.roomId).emit('task:created', {
      roomId: req.params.roomId,
      task: { ...task, _id: task.id }
    });

    logger.info(`Task created in room ${req.room.name}: ${title}`);
    res.status(201).json({
      success: true,
      task: { ...task, _id: task.id }
    });
  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/rooms/:roomId/tasks/:taskId
// @desc    Update a task
// @access  Private (owner only)
router.put('/:roomId/tasks/:taskId', protect, isRoomMember, validate(updateTaskSchema), async (req, res, next) => {
  try {
    const task = await prisma.roomTask.findUnique({
      where: { id: req.params.taskId }
    });

    if (!task || task.roomId !== req.params.roomId) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    // Check permissions (only owner can update)
    const isOwner = req.room.ownerId === req.user.id;

    if (!isOwner) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this task'
      });
    }

    // Update fields
    const { title, description, points, taskType, isActive } = req.body;
    const updateData = {};

    if (title) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (points) updateData.points = points;
    if (taskType) updateData.taskType = taskType;
    if (isActive !== undefined) updateData.isActive = isActive;

    const updatedTask = await prisma.roomTask.update({
      where: { id: req.params.taskId },
      data: updateData
    });

    // Emit socket event
    const io = req.app.get('io');
    io.to(req.params.roomId).emit('task:updated', {
      roomId: req.params.roomId,
      task: { ...updatedTask, _id: updatedTask.id }
    });

    logger.info(`Task updated in room ${req.room.name}: ${updatedTask.title}`);
    res.json({
      success: true,
      task: { ...updatedTask, _id: updatedTask.id }
    });
  } catch (error) {
    next(error);
  }
});

// @route   DELETE /api/rooms/:roomId/tasks/:taskId
// @desc    Delete a task
// @access  Private (owner only)
router.delete('/:roomId/tasks/:taskId', protect, isRoomMember, async (req, res, next) => {
  try {
    const task = await prisma.roomTask.findUnique({
      where: { id: req.params.taskId }
    });

    if (!task || task.roomId !== req.params.roomId) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    // Check permissions (only owner can delete)
    const isOwner = req.room.ownerId === req.user.id;

    if (!isOwner) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this task'
      });
    }

    // Soft delete - set isActive to false (preserves history)
    await prisma.roomTask.update({
      where: { id: req.params.taskId },
      data: { isActive: false }
    });

    // Emit socket event
    const io = req.app.get('io');
    io.to(req.params.roomId).emit('task:deleted', {
      roomId: req.params.roomId,
      taskId: req.params.taskId
    });

    logger.info(`Task deleted from room ${req.room.name}: ${task.title}`);
    res.json({
      success: true,
      message: 'Task deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/rooms/:roomId/tasks/:taskId/complete
// @desc    Mark task as complete
// @access  Private (must be member)
router.post('/:roomId/tasks/:taskId/complete', protect, isRoomMember, async (req, res, next) => {
  try {
    const task = await prisma.roomTask.findUnique({
      where: { id: req.params.taskId }
    });

    if (!task || task.roomId !== req.params.roomId) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    if (!task.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Task is not active'
      });
    }

    const todayStr = getTodayString();

    // Check if already completed today
    const existingCompletion = await prisma.taskCompletion.findUnique({
      where: {
        taskId_userId_completionDate: {
          taskId: req.params.taskId,
          userId: req.user.id,
          completionDate: todayStr
        }
      }
    });

    if (existingCompletion) {
      return res.status(400).json({
        success: false,
        message: 'Task already completed today'
      });
    }

    // Create completion record
    const completion = await prisma.taskCompletion.create({
      data: {
        userId: req.user.id,
        roomId: req.params.roomId,
        taskId: req.params.taskId,
        pointsAwarded: task.points,
        completionDate: todayStr
      }
    });

    // Update user stats
    await prisma.user.update({
      where: { id: req.user.id },
      data: {
        totalTasksCompleted: { increment: 1 },
        lastActive: new Date()
      }
    });

    // Update room member points
    await prisma.roomMember.updateMany({
      where: {
        roomId: req.params.roomId,
        userId: req.user.id
      },
      data: {
        points: { increment: task.points }
      }
    });

    // Update or create user room progress with proper streak logic
    const existingProgress = await prisma.userRoomProgress.findUnique({
      where: {
        userId_roomId: {
          userId: req.user.id,
          roomId: req.params.roomId
        }
      }
    });

    // Calculate streak updates using user's timezone
    const userTimezone = req.user.timezone || 'UTC';
    
    // Helper to get today's date in user's timezone
    const getUserLocalDate = (tz) => {
      const d = new Date();
      const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
      return formatter.format(d); // Returns YYYY-MM-DD
    };
    
    const userTodayStr = getUserLocalDate(userTimezone);
    const userTodayStart = new Date(userTodayStr + 'T00:00:00Z');
    const userYesterdayStart = new Date(userTodayStart);
    userYesterdayStart.setUTCDate(userYesterdayStart.getUTCDate() - 1);
    const now = new Date();

    let newStreak = 1;
    let newLongestStreak = 1;
    
    if (existingProgress) {
      const lastCompletion = existingProgress.lastCompletionDate;
      
      if (lastCompletion) {
        const lastCompletionDate = new Date(lastCompletion);
        const lastCompletionDay = new Date(Date.UTC(
          lastCompletionDate.getUTCFullYear(),
          lastCompletionDate.getUTCMonth(),
          lastCompletionDate.getUTCDate()
        ));
        
        // Check if last completion was today (already completed today, no streak change)
        if (lastCompletionDay.getTime() === userTodayStart.getTime()) {
          newStreak = existingProgress.currentStreak;
          newLongestStreak = existingProgress.longestStreak;
        }
        // Check if last completion was yesterday (continue streak)
        else if (lastCompletionDay.getTime() === userYesterdayStart.getTime()) {
          newStreak = existingProgress.currentStreak + 1;
          newLongestStreak = Math.max(existingProgress.longestStreak, newStreak);
        }
        // Otherwise reset streak to 1
        else {
          newStreak = 1;
          newLongestStreak = Math.max(existingProgress.longestStreak, 1);
        }
      }
      
      await prisma.userRoomProgress.update({
        where: { id: existingProgress.id },
        data: {
          tasksCompletedToday: { increment: 1 },
          totalPoints: { increment: task.points },
          lastCompletionDate: now,
          currentStreak: newStreak,
          longestStreak: newLongestStreak
        }
      });
    } else {
      await prisma.userRoomProgress.create({
        data: {
          userId: req.user.id,
          roomId: req.params.roomId,
          tasksCompletedToday: 1,
          totalPoints: task.points,
          lastCompletionDate: now,
          currentStreak: 1,
          longestStreak: 1
        }
      });
    }
    
    // Also update the user's global streak
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { streak: true, longestStreak: true, lastStreakDate: true }
    });
    
    let globalStreak = 1;
    let globalLongestStreak = user?.longestStreak || 1;
    
    if (user?.lastStreakDate) {
      const lastStreakDay = new Date(user.lastStreakDate);
      const lastStreakDayStart = new Date(Date.UTC(
        lastStreakDay.getUTCFullYear(),
        lastStreakDay.getUTCMonth(),
        lastStreakDay.getUTCDate()
      ));
      
      if (lastStreakDayStart.getTime() === userTodayStart.getTime()) {
        // Already completed today, keep current streak
        globalStreak = user.streak;
      } else if (lastStreakDayStart.getTime() === userYesterdayStart.getTime()) {
        // Continue streak
        globalStreak = user.streak + 1;
        globalLongestStreak = Math.max(globalLongestStreak, globalStreak);
      } else {
        // Reset streak
        globalStreak = 1;
      }
    }
    
    await prisma.user.update({
      where: { id: req.user.id },
      data: {
        streak: globalStreak,
        longestStreak: globalLongestStreak,
        lastStreakDate: now
      }
    });

    // Update room streak (first completion of the day updates room streak)
    const room = await prisma.room.findUnique({
      where: { id: req.params.roomId },
      select: { streak: true, longestStreak: true, lastActivityDate: true }
    });

    if (room) {
      let roomStreak = 1;
      let roomLongestStreak = room.longestStreak || 1;

      if (room.lastActivityDate) {
        const lastActivityDay = new Date(room.lastActivityDate);
        const lastActivityDayStart = new Date(Date.UTC(
          lastActivityDay.getUTCFullYear(),
          lastActivityDay.getUTCMonth(),
          lastActivityDay.getUTCDate()
        ));

        if (lastActivityDayStart.getTime() === userTodayStart.getTime()) {
          // Already had activity today, keep current streak
          roomStreak = room.streak;
        } else if (lastActivityDayStart.getTime() === userYesterdayStart.getTime()) {
          // Continue room streak
          roomStreak = room.streak + 1;
          roomLongestStreak = Math.max(roomLongestStreak, roomStreak);
        } else {
          // Reset room streak
          roomStreak = 1;
        }
      }

      await prisma.room.update({
        where: { id: req.params.roomId },
        data: {
          streak: roomStreak,
          longestStreak: roomLongestStreak,
          lastActivityDate: now
        }
      });
    }

    // Get updated leaderboard
    const leaderboard = await prisma.roomMember.findMany({
      where: { roomId: req.params.roomId },
      include: {
        user: { select: { id: true, username: true, avatar: true } }
      },
      orderBy: { points: 'desc' }
    });

    // Get room members (exclude completer)
    const roomMembers = req.room.members
      .filter(m => m.userId !== req.user.id)
      .map(m => m.userId);

    // Create notifications
    for (const memberId of roomMembers) {
      try {
        await NotificationService.createNotification({
          recipientId: memberId,
          type: 'task_completed',
          title: `Task Completed in ${req.room.name}`,
          message: `${req.user.username} completed: ${task.title}`,
          roomId: req.params.roomId
        });
      } catch (err) {
        logger.error('Error creating notification:', err);
      }
    }

    // Send push notifications
    if (roomMembers.length > 0) {
      PushNotificationService.notifyTaskCompletion(
        roomMembers,
        { ...task, roomId: req.params.roomId },
        req.user.username,
        req.room.name
      ).catch(err => logger.error('Push notification error:', err));
    }

    // Emit socket events
    const io = req.app.get('io');
    io.to(req.params.roomId).emit('task:completed', {
      roomId: req.params.roomId,
      taskId: req.params.taskId,
      userId: req.user.id,
      username: req.user.username,
      avatar: req.user.avatar,
      points: task.points,
      leaderboard: leaderboard.map(m => ({
        _id: m.id,
        oderId: m.userId,
        user: { ...m.user, _id: m.user.id },
        points: m.points,
        role: m.role
      }))
    });

    logger.info(`Task completed by ${req.user.email}: ${task.title}`);
    res.status(201).json({
      success: true,
      completion: { ...completion, _id: completion.id },
      pointsAwarded: task.points
    });
  } catch (error) {
    next(error);
  }
});

// @route   DELETE /api/rooms/:roomId/tasks/:taskId/complete
// @desc    Unmark task completion
// @access  Private (must be member)
router.delete('/:roomId/tasks/:taskId/complete', protect, isRoomMember, async (req, res, next) => {
  try {
    const todayStr = getTodayString();

    const completion = await prisma.taskCompletion.findUnique({
      where: {
        taskId_userId_completionDate: {
          taskId: req.params.taskId,
          userId: req.user.id,
          completionDate: todayStr
        }
      }
    });

    if (!completion) {
      return res.status(404).json({
        success: false,
        message: 'Completion not found for today'
      });
    }

    // Remove points from room member
    await prisma.roomMember.updateMany({
      where: {
        roomId: req.params.roomId,
        userId: req.user.id
      },
      data: {
        points: { decrement: completion.pointsAwarded }
      }
    });

    // Update user stats
    await prisma.user.update({
      where: { id: req.user.id },
      data: {
        totalTasksCompleted: { decrement: 1 }
      }
    });

    // Delete completion
    await prisma.taskCompletion.delete({
      where: { id: completion.id }
    });

    // Get updated leaderboard
    const leaderboard = await prisma.roomMember.findMany({
      where: { roomId: req.params.roomId },
      include: {
        user: { select: { id: true, username: true, avatar: true } }
      },
      orderBy: { points: 'desc' }
    });

    // Emit socket event
    const io = req.app.get('io');
    io.to(req.params.roomId).emit('task:uncompleted', {
      roomId: req.params.roomId,
      taskId: req.params.taskId,
      oderId: req.user.id,
      leaderboard: leaderboard.map(m => ({
        _id: m.id,
        oderId: m.userId,
        user: { ...m.user, _id: m.user.id },
        points: m.points,
        role: m.role
      }))
    });

    logger.info(`Task completion removed by ${req.user.email}`);
    res.json({
      success: true,
      message: 'Task completion removed'
    });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/rooms/:roomId/tasks/:taskId/join
// @desc    Join a task (become participant)
// @access  Private (must be room member)
router.post('/:roomId/tasks/:taskId/join', protect, isRoomMember, async (req, res, next) => {
  try {
    const task = await prisma.roomTask.findUnique({
      where: { id: req.params.taskId }
    });

    if (!task || task.roomId !== req.params.roomId) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    if (!task.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Task is not active'
      });
    }

    // Check if already joined (has an assignment)
    const existingAssignment = await prisma.roomTaskAssignment.findUnique({
      where: {
        taskId_userId: {
          taskId: req.params.taskId,
          userId: req.user.id
        }
      }
    });

    if (existingAssignment) {
      if (existingAssignment.status === 'accepted') {
        return res.status(400).json({
          success: false,
          message: 'Already joined this task'
        });
      }
      // Re-apply if previously rejected or pending
      if (existingAssignment.status === 'rejected') {
        return res.status(400).json({
          success: false,
          message: 'Cannot rejoin - was previously removed. Contact room owner.'
        });
      }
    }

    // Create assignment
    const assignment = await prisma.roomTaskAssignment.upsert({
      where: {
        taskId_userId: {
          taskId: req.params.taskId,
          userId: req.user.id
        }
      },
      create: {
        taskId: req.params.taskId,
        userId: req.user.id,
        status: 'accepted',
        assignedBy: req.user.id
      },
      update: {
        status: 'accepted'
      }
    });

    // Emit socket event
    const io = req.app.get('io');
    io.to(req.params.roomId).emit('task:joined', {
      roomId: req.params.roomId,
      taskId: req.params.taskId,
      userId: req.user.id,
      username: req.user.username
    });

    logger.info(`User ${req.user.email} joined task: ${task.title}`);
    res.status(201).json({
      success: true,
      message: 'Joined task successfully',
      assignment: { ...assignment, _id: assignment.id }
    });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/rooms/:roomId/tasks/:taskId/leave
// @desc    Leave a task (remove participation)
// @access  Private (must be room member)
router.post('/:roomId/tasks/:taskId/leave', protect, isRoomMember, async (req, res, next) => {
  try {
    const task = await prisma.roomTask.findUnique({
      where: { id: req.params.taskId }
    });

    if (!task || task.roomId !== req.params.roomId) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    // Check if joined
    const existingAssignment = await prisma.roomTaskAssignment.findUnique({
      where: {
        taskId_userId: {
          taskId: req.params.taskId,
          userId: req.user.id
        }
      }
    });

    if (!existingAssignment || existingAssignment.status !== 'accepted') {
      return res.status(400).json({
        success: false,
        message: 'Not a participant of this task'
      });
    }

    // Update assignment status to rejected (soft delete - prevents rejoin)
    await prisma.roomTaskAssignment.update({
      where: { id: existingAssignment.id },
      data: { status: 'rejected' }
    });

    // Emit socket event
    const io = req.app.get('io');
    io.to(req.params.roomId).emit('task:left', {
      roomId: req.params.roomId,
      taskId: req.params.taskId,
      userId: req.user.id,
      username: req.user.username
    });

    logger.info(`User ${req.user.email} left task: ${task.title}`);
    res.json({
      success: true,
      message: 'Left task successfully'
    });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/rooms/:roomId/tasks/:taskId/assign
// @desc    Assign task to user
// @access  Private (must be member)
router.post('/:roomId/tasks/:taskId/assign', protect, isRoomMember, async (req, res, next) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    const task = await prisma.roomTask.findUnique({
      where: { id: req.params.taskId }
    });

    if (!task || task.roomId !== req.params.roomId) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    // Check if user is a room member
    const roomMember = await prisma.roomMember.findUnique({
      where: {
        roomId_userId: {
          roomId: req.params.roomId,
          userId: userId
        }
      }
    });

    if (!roomMember) {
      return res.status(404).json({
        success: false,
        message: 'User is not a member of this room'
      });
    }

    // Check if already assigned
    const existingAssignment = await prisma.roomTaskAssignment.findUnique({
      where: {
        taskId_userId: {
          taskId: req.params.taskId,
          userId: userId
        }
      }
    });

    if (existingAssignment) {
      return res.status(400).json({
        success: false,
        message: 'Task already assigned to this user'
      });
    }

    // Create assignment
    const assignment = await prisma.roomTaskAssignment.create({
      data: {
        taskId: req.params.taskId,
        userId: userId,
        assignedBy: req.user.id
      }
    });

    // Emit socket event
    const io = req.app.get('io');
    io.to(req.params.roomId).emit('task:assigned', {
      roomId: req.params.roomId,
      taskId: req.params.taskId,
      userId: userId,
      assignedBy: req.user.id
    });

    res.status(201).json({
      success: true,
      assignment: { ...assignment, _id: assignment.id }
    });
  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/rooms/:roomId/tasks/:taskId/assign/:userId
// @desc    Update task assignment status
// @access  Private (must be member)
router.put('/:roomId/tasks/:taskId/assign/:userId', protect, isRoomMember, async (req, res, next) => {
  try {
    const { status } = req.body;
    
    if (!status || !['pending', 'accepted', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be pending, accepted, or rejected'
      });
    }

    const assignment = await prisma.roomTaskAssignment.findUnique({
      where: {
        taskId_userId: {
          taskId: req.params.taskId,
          userId: req.params.userId
        }
      }
    });

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'Assignment not found'
      });
    }

    // Only the assigned user can update their status, or owner can update any
    const isOwner = req.room.ownerId === req.user.id;
    const isAssignedUser = req.user.id === req.params.userId;

    if (!isOwner && !isAssignedUser) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this assignment'
      });
    }

    const updatedAssignment = await prisma.roomTaskAssignment.update({
      where: { id: assignment.id },
      data: { status: status }
    });

    // Update task status if all assignments are accepted
    const task = await prisma.roomTask.findUnique({
      where: { id: req.params.taskId }
    });

    const allAssignments = await prisma.roomTaskAssignment.findMany({
      where: { taskId: req.params.taskId }
    });

    if (allAssignments.length > 0) {
      const allAccepted = allAssignments.every(a => a.status === 'accepted');
      const hasRunning = allAssignments.some(a => a.status === 'accepted');

      let newTaskStatus = task.status;
      if (allAccepted) {
        newTaskStatus = 'completed';
      } else if (hasRunning) {
        newTaskStatus = 'running';
      } else {
        newTaskStatus = 'upcoming';
      }

      if (newTaskStatus !== task.status) {
        await prisma.roomTask.update({
          where: { id: req.params.taskId },
          data: { status: newTaskStatus }
        });
      }
    }

    // Emit socket event
    const io = req.app.get('io');
    io.to(req.params.roomId).emit('task:assignment_updated', {
      roomId: req.params.roomId,
      taskId: req.params.taskId,
      userId: req.params.userId,
      status: status,
      taskStatus: newTaskStatus || task.status
    });

    res.json({
      success: true,
      assignment: { ...updatedAssignment, _id: updatedAssignment.id }
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/rooms/:roomId/tasks/calendar
// @desc    Get tasks organized by date for calendar view
// @access  Private (must be member)
router.get('/:roomId/tasks/calendar', protect, isRoomMember, async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Start date and end date are required'
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    // Get all tasks for the room
    const tasks = await prisma.roomTask.findMany({
      where: {
        roomId: req.params.roomId,
        isActive: true
      }
    });

    // Get all completions in the date range
    const completions = await prisma.taskCompletion.findMany({
      where: {
        roomId: req.params.roomId,
        completedAt: {
          gte: start,
          lte: end
        }
      },
      include: {
        user: { select: { id: true, username: true, avatar: true } }
      }
    });

    // Get all assignments
    const assignments = await prisma.roomTaskAssignment.findMany({
      where: {
        taskId: { in: tasks.map(t => t.id) }
      },
      include: {
        user: { select: { id: true, username: true, avatar: true } }
      }
    });

    // Organize tasks by date
    const tasksByDate = {};
    const currentDate = new Date(start);
    
    while (currentDate <= end) {
      const dateStr = currentDate.toISOString().split('T')[0];
      tasksByDate[dateStr] = [];
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Helper to check if task should appear on a specific date
    const shouldTaskAppearOnDate = (task, date) => {
      const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
      
      if (task.taskType === 'daily') {
        return true;
      } else if (task.taskType === 'weekly') {
        return dayOfWeek === 1; // Every Monday
      } else if (task.taskType === 'custom' && task.daysOfWeek) {
        const days = task.daysOfWeek.split(',').map(d => parseInt(d));
        return days.includes(dayOfWeek);
      }
      return false;
    };

    // Add tasks to appropriate dates
    tasks.forEach(task => {
      const currentDate = new Date(start);
      while (currentDate <= end) {
        if (shouldTaskAppearOnDate(task, currentDate)) {
          const dateStr = currentDate.toISOString().split('T')[0];
          
          // Get completions for this task and date
          const taskCompletions = completions.filter(c => 
            c.taskId === task.id && 
            c.completionDate === dateStr
          );

          // Get assignments for this task
          const taskAssignments = assignments.filter(a => a.taskId === task.id);

          tasksByDate[dateStr].push({
            ...task,
            _id: task.id,
            completions: taskCompletions.map(c => ({
              userId: c.user.id,
              username: c.user.username,
              avatar: c.user.avatar,
              completedAt: c.completedAt
            })),
            assignments: taskAssignments.map(a => ({
              userId: a.user.id,
              username: a.user.username,
              avatar: a.user.avatar,
              status: a.status,
              assignedAt: a.assignedAt
            }))
          });
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }
    });

    res.json({
      success: true,
      startDate: startDate,
      endDate: endDate,
      tasksByDate: tasksByDate
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/rooms/:roomId/tasks/:taskId/nodes
// @desc    Get all nodes for a room task (timeline/proof/messages)
// @access  Private (must be member)
router.get('/:roomId/tasks/:taskId/nodes', protect, isRoomMember, async (req, res, next) => {
  try {
    const nodes = await prisma.roomTaskNode.findMany({
      where: {
        taskId: req.params.taskId,
        roomId: req.params.roomId
      },
      include: {
        user: { select: { id: true, username: true, avatar: true } }
      },
      orderBy: { createdAt: 'asc' }
    });

    res.json({
      success: true,
      count: nodes.length,
      nodes: nodes.map(n => ({
        ...n,
        _id: n.id
      }))
    });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/rooms/:roomId/tasks/:taskId/nodes
// @desc    Create a new node (PROOF, MESSAGE, SYSTEM_ALERT)
// @access  Private (must be member)
router.post('/:roomId/tasks/:taskId/nodes', protect, isRoomMember, async (req, res, next) => {
  try {
    const { type, content, mediaUrl, status, clientReferenceId } = req.body;

    // Validate task belongs to room
    const task = await prisma.roomTask.findUnique({
      where: { id: req.params.taskId }
    });

    if (!task || task.roomId !== req.params.roomId) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    const node = await prisma.roomTaskNode.create({
      data: {
        roomId: req.params.roomId,
        taskId: req.params.taskId,
        userId: req.user.id,
        type: type || 'MESSAGE',
        content: content || null,
        mediaUrl: mediaUrl || null,
        status: status || 'PENDING'
      },
      include: {
        user: { select: { id: true, username: true, avatar: true } }
      }
    });

    // Echo back the clientReferenceId if provided
    const safeNode = { ...node, _id: node.id };
    if (clientReferenceId) safeNode.clientReferenceId = clientReferenceId;

    // Emit socket event for real-time sync
    const io = req.app.get('io');
    io.to(req.params.roomId).emit('thread:node_created', {
      roomId: req.params.roomId,
      taskId: req.params.taskId,
      node: safeNode
    });

    logger.info(`Task node created by ${req.user.email}: ${node.type}`);
    res.status(201).json({
      success: true,
      node: safeNode
    });
  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/rooms/:roomId/tasks/:taskId/nodes/:nodeId
// @desc    Update node (vouch, approve, update content)
// @access  Private (must be member)
router.put('/:roomId/tasks/:taskId/nodes/:nodeId', protect, isRoomMember, async (req, res, next) => {
  try {
    const { content, status, vouch } = req.body;

    // Find existing node
    const existingNode = await prisma.roomTaskNode.findUnique({
      where: { id: req.params.nodeId }
    });

    if (!existingNode || existingNode.taskId !== req.params.taskId) {
      return res.status(404).json({
        success: false,
        message: 'Node not found'
      });
    }

    const updateData = {};
    if (content !== undefined) updateData.content = content;
    if (status !== undefined) updateData.status = status;
    if (vouch === true) {
      updateData.vouchCount = { increment: 1 };
    }

    const updatedNode = await prisma.roomTaskNode.update({
      where: { id: req.params.nodeId },
      data: updateData,
      include: {
        user: { select: { id: true, username: true, avatar: true } }
      }
    });

    // Prepare safe patch object to send to clients
    const safePatch = {};
    if (content !== undefined) safePatch.content = updatedNode.content;
    if (status !== undefined) safePatch.status = updatedNode.status;
    if (vouch === true) safePatch.vouchCount = updatedNode.vouchCount;

    // Emit socket event
    const io = req.app.get('io');
    io.to(req.params.roomId).emit('thread:node_updated', {
      roomId: req.params.roomId,
      taskId: req.params.taskId,
      nodeId: req.params.nodeId,
      patch: safePatch
    });

    res.json({
      success: true,
      node: { ...updatedNode, _id: updatedNode.id }
    });
  } catch (error) {
    next(error);
  }
});

// @route   DELETE /api/rooms/:roomId/tasks/:taskId/nodes/:nodeId
// @desc    Delete a node
// @access  Private (owner only - node owner or room owner)
router.delete('/:roomId/tasks/:taskId/nodes/:nodeId', protect, isRoomMember, async (req, res, next) => {
  try {
    const node = await prisma.roomTaskNode.findUnique({
      where: { id: req.params.nodeId }
    });

    if (!node || node.taskId !== req.params.taskId) {
      return res.status(404).json({
        success: false,
        message: 'Node not found'
      });
    }

    // Only node owner or room owner can delete
    const isNodeOwner = node.userId === req.user.id;
    const isRoomOwner = req.room.ownerId === req.user.id;

    if (!isNodeOwner && !isRoomOwner) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this node'
      });
    }

    await prisma.roomTaskNode.delete({
      where: { id: req.params.nodeId }
    });

    // Emit socket event
    const io = req.app.get('io');
    io.to(req.params.roomId).emit('thread:node_deleted', {
      roomId: req.params.roomId,
      taskId: req.params.taskId,
      nodeId: req.params.nodeId
    });

    res.json({
      success: true,
      message: 'Node deleted'
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/rooms/:roomId/tasks/status
// @desc    Get tasks grouped by status
// @access  Private (must be member)
router.get('/:roomId/tasks/status', protect, isRoomMember, async (req, res, next) => {
  try {
    const tasks = await prisma.roomTask.findMany({
      where: {
        roomId: req.params.roomId,
        isActive: true
      },
      include: {
        assignments: {
          include: {
            user: { select: { id: true, username: true, avatar: true } }
          }
        },
        completions: {
          where: {
            completionDate: getTodayString()
          },
          include: {
            user: { select: { id: true, username: true, avatar: true } }
          }
        }
      }
    });

    // Group tasks by status
    const groupedTasks = {
      completed: [],
      running: [],
      upcoming: [],
      rejected: []
    };

    tasks.forEach(task => {
      const status = task.status || 'upcoming';
      groupedTasks[status].push({
        ...task,
        _id: task.id,
        completions: task.completions.map(c => ({
          userId: c.user.id,
          username: c.user.username,
          avatar: c.user.avatar,
          completedAt: c.completedAt
        })),
        assignments: task.assignments.map(a => ({
          userId: a.user.id,
          username: a.user.username,
          avatar: a.user.avatar,
          status: a.status,
          assignedAt: a.assignedAt
        }))
      });
    });

    res.json({
      success: true,
      tasks: groupedTasks
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
