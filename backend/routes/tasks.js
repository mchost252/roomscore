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

    // Mark tasks as completed and add completion info
    const tasksWithStatus = tasks.map(task => {
      const taskCompletions = allCompletions.filter(c => c.taskId === task.id);
      
      return {
        ...task,
        _id: task.id,
        isCompleted: completedTaskIds.has(task.id),
        completionId: userCompletions.find(c => c.taskId === task.id)?.id,
        completedBy: taskCompletions.map(c => ({
          userId: c.user.id,
          _id: c.user.id,
          username: c.user.username,
          avatar: c.user.avatar,
          completedAt: c.completedAt
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
    const { title, description, points, taskType } = req.body;

    // Check permissions (only owner can create tasks for now)
    const isOwner = req.room.ownerId === req.user.id;

    if (!isOwner) {
      return res.status(403).json({
        success: false,
        message: 'Only room owner can create tasks'
      });
    }

    const task = await prisma.roomTask.create({
      data: {
        roomId: req.params.roomId,
        title,
        description: description || null,
        taskType: taskType || 'daily',
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

    await prisma.roomTask.delete({
      where: { id: req.params.taskId }
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
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
      return formatter.format(now); // Returns YYYY-MM-DD
    };
    
    const todayStr = getUserLocalDate(userTimezone);
    const todayStart = new Date(todayStr + 'T00:00:00Z');
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setUTCDate(yesterdayStart.getUTCDate() - 1);
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
        if (lastCompletionDay.getTime() === todayStart.getTime()) {
          newStreak = existingProgress.currentStreak;
          newLongestStreak = existingProgress.longestStreak;
        }
        // Check if last completion was yesterday (continue streak)
        else if (lastCompletionDay.getTime() === yesterdayStart.getTime()) {
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
      
      if (lastStreakDayStart.getTime() === todayStart.getTime()) {
        // Already completed today, keep current streak
        globalStreak = user.streak;
      } else if (lastStreakDayStart.getTime() === yesterdayStart.getTime()) {
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

        if (lastActivityDayStart.getTime() === todayStart.getTime()) {
          // Already had activity today, keep current streak
          roomStreak = room.streak;
        } else if (lastActivityDayStart.getTime() === yesterdayStart.getTime()) {
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

module.exports = router;
