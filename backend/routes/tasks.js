const express = require('express');
const router = express.Router();
const Room = require('../models/Room');
const TaskCompletion = require('../models/TaskCompletion');
const UserRoomProgress = require('../models/UserRoomProgress');
const User = require('../models/User');
const Notification = require('../models/Notification');
const ChatMessage = require('../models/ChatMessage');
const NotificationService = require('../services/notificationService');
const PushNotificationService = require('../services/pushNotificationService');
const TaskValidationService = require('../services/taskValidationService');
const { protect, isRoomMember } = require('../middleware/auth');
const { validate, createTaskSchema, updateTaskSchema } = require('../middleware/validation');
const logger = require('../utils/logger');

// Helper function to check if task is available for date
const isTaskAvailableForDate = (task, date) => {
  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);

  // Check if task is active
  if (!task.isActive) return false;

  // Check deadline
  if (task.deadline && new Date(task.deadline) < targetDate) {
    return false;
  }

  // Check frequency
  if (task.frequency === 'daily') {
    if (task.daysOfWeek && task.daysOfWeek.length > 0) {
      const dayOfWeek = targetDate.getDay();
      return task.daysOfWeek.includes(dayOfWeek);
    }
    return true;
  }

  if (task.frequency === 'weekly') {
    // Weekly tasks available on specified days
    if (task.daysOfWeek && task.daysOfWeek.length > 0) {
      const dayOfWeek = targetDate.getDay();
      return task.daysOfWeek.includes(dayOfWeek);
    }
    return true;
  }

  if (task.frequency === 'monthly') {
    // Monthly tasks available every day (complete once per month)
    return true;
  }

  if (task.frequency === 'one-time') {
    return true;
  }

  return false;
};

// @route   GET /api/rooms/:roomId/tasks
// @desc    Get today's tasks for room
// @access  Private (must be member)
router.get('/:roomId/tasks', protect, isRoomMember, async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get available tasks
    const availableTasks = req.room.tasks.filter(task => 
      isTaskAvailableForDate(task, today)
    );

    // Get completions for today (for current user)
    const userCompletions = await TaskCompletion.find({
      userId: req.user.id,
      roomId: req.params.roomId,
      completionDate: {
        $gte: today,
        $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
      }
    });

    // Get ALL completions for today (to show who completed what)
    // Include avatar in population for profile pictures
    const allCompletions = await TaskCompletion.find({
      roomId: req.params.roomId,
      completionDate: {
        $gte: today,
        $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
      }
    }).populate('userId', 'username email _id avatar profilePicture');

    const completedTaskIds = userCompletions.map(c => c.taskId.toString());

    // Mark tasks as completed and add completion info
    const tasksWithStatus = availableTasks.map(task => {
      const taskCompletions = allCompletions.filter(c => c.taskId.toString() === task._id.toString());
      
      return {
        ...task.toObject(),
        isCompleted: completedTaskIds.includes(task._id.toString()),
        completionId: userCompletions.find(c => c.taskId.toString() === task._id.toString())?._id,
        completedBy: taskCompletions.map(c => ({
          userId: c.userId._id,
          username: c.userId.username || c.userId.email,
          avatar: c.userId.avatar || c.userId.profilePicture || null,
          completedAt: c.createdAt
        }))
      };
    });

    res.json({
      success: true,
      date: today,
      count: tasksWithStatus.length,
      tasks: tasksWithStatus
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/rooms/:roomId/tasks/:date
// @desc    Get tasks for specific date
// @access  Private (must be member)
router.get('/:roomId/tasks/:date', protect, isRoomMember, async (req, res, next) => {
  try {
    const targetDate = new Date(req.params.date);
    targetDate.setHours(0, 0, 0, 0);

    if (isNaN(targetDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format'
      });
    }

    // Get available tasks
    const availableTasks = req.room.tasks.filter(task => 
      isTaskAvailableForDate(task, targetDate)
    );

    // Get completions for date
    const completions = await TaskCompletion.find({
      userId: req.user.id,
      roomId: req.params.roomId,
      completionDate: {
        $gte: targetDate,
        $lt: new Date(targetDate.getTime() + 24 * 60 * 60 * 1000)
      }
    });

    const completedTaskIds = completions.map(c => c.taskId.toString());

    const tasksWithStatus = availableTasks.map(task => ({
      ...task.toObject(),
      isCompleted: completedTaskIds.includes(task._id.toString()),
      completionId: completions.find(c => c.taskId.toString() === task._id.toString())?._id
    }));

    res.json({
      success: true,
      date: targetDate,
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
    const { title, description, points, category, frequency, daysOfWeek, deadline } = req.body;

    // Check permissions
    const isOwner = req.room.owner.toString() === req.user.id;
    const canCreate = isOwner || req.room.settings.allowMemberTaskCreation;

    if (!canCreate) {
      return res.status(403).json({
        success: false,
        message: 'Only room owner can create tasks'
      });
    }

    const newTask = {
      title,
      description,
      points,
      category: category || 'other',
      frequency,
      daysOfWeek: daysOfWeek || [],
      deadline,
      createdBy: req.user.id,
      isActive: true
    };

    req.room.tasks.push(newTask);
    await req.room.save();

    const createdTask = req.room.tasks[req.room.tasks.length - 1];

    // Get room members (exclude creator)
    const roomMembers = req.room.members
      .map(m => m.userId.toString())
      .filter(userId => userId !== req.user.id);

    // Create in-app notifications for all members (don't fail if notification fails)
    for (const memberId of roomMembers) {
      try {
        await NotificationService.createNotification({
          userId: memberId,
          type: 'new_task',
          title: `New Task in ${req.room.name}`,
          message: `${req.user.username} created: ${title}`,
          relatedRoom: req.params.roomId,
          relatedTask: createdTask._id
        });
      } catch (err) {
        logger.error('Error creating notification:', err);
      }
    }

    // Send push notifications
    if (roomMembers.length > 0) {
      PushNotificationService.notifyNewTask(
        roomMembers,
        { ...createdTask.toObject(), roomId: req.params.roomId },
        req.room.name,
        req.user.username
      ).catch(err => logger.error('Push notification error:', err));
    }

    // Emit socket event
    const io = req.app.get('io');
    io.to(req.params.roomId).emit('task:created', {
      roomId: req.params.roomId,
      task: createdTask
    });

    // Emit notification event to members
    roomMembers.forEach(memberId => {
      io.to(`user:${memberId}`).emit('notification', {
        type: 'new_task',
        title: `New Task in ${req.room.name}`,
        message: `${req.user.username} created: ${title}`,
        roomId: req.params.roomId
      });
    });

    logger.info(`Task created in room ${req.room.name}: ${title}`);
    res.status(201).json({
      success: true,
      task: createdTask
    });
  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/rooms/:roomId/tasks/:taskId
// @desc    Update a task
// @access  Private (owner or task creator)
router.put('/:roomId/tasks/:taskId', protect, isRoomMember, validate(updateTaskSchema), async (req, res, next) => {
  try {
    const task = req.room.tasks.id(req.params.taskId);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    // Check permissions
    const isOwner = req.room.owner.toString() === req.user.id;
    const isCreator = task.createdBy.toString() === req.user.id;

    if (!isOwner && !isCreator) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this task'
      });
    }

    // Update fields
    const { title, description, points, category, frequency, daysOfWeek, deadline, isActive } = req.body;

    if (title) task.title = title;
    if (description !== undefined) task.description = description;
    if (points) task.points = points;
    if (category) task.category = category;
    if (frequency) task.frequency = frequency;
    if (daysOfWeek !== undefined) task.daysOfWeek = daysOfWeek;
    if (deadline !== undefined) task.deadline = deadline;
    if (isActive !== undefined) task.isActive = isActive;

    await req.room.save();

    // Emit socket event
    const io = req.app.get('io');
    io.to(req.params.roomId).emit('task:updated', {
      roomId: req.params.roomId,
      task
    });

    logger.info(`Task updated in room ${req.room.name}: ${task.title}`);
    res.json({
      success: true,
      task
    });
  } catch (error) {
    next(error);
  }
});

// @route   DELETE /api/rooms/:roomId/tasks/:taskId
// @desc    Delete a task
// @access  Private (owner or task creator)
router.delete('/:roomId/tasks/:taskId', protect, isRoomMember, async (req, res, next) => {
  try {
    const task = req.room.tasks.id(req.params.taskId);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    // Check permissions
    const isOwner = req.room.owner.toString() === req.user.id;
    const isCreator = task.createdBy.toString() === req.user.id;

    if (!isOwner && !isCreator) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this task'
      });
    }

    task.deleteOne();
    await req.room.save();

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
    const task = req.room.tasks.id(req.params.taskId);

    if (!task) {
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

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check if already completed today
    const existingCompletion = await TaskCompletion.findOne({
      userId: req.user.id,
      roomId: req.params.roomId,
      taskId: req.params.taskId,
      completionDate: {
        $gte: today,
        $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
      }
    });

    if (existingCompletion) {
      return res.status(400).json({
        success: false,
        message: 'Task already completed today'
      });
    }

    // Create completion record
    const completion = await TaskCompletion.create({
      userId: req.user.id,
      roomId: req.params.roomId,
      taskId: req.params.taskId,
      taskTitle: task.title,
      pointsAwarded: task.points,
      completionDate: today
    });

    // Check if this is a valid task completion for streak tracking
    const timezone = req.room.settings.timezone || 'UTC';
    const isValidForStreak = TaskValidationService.isValidTaskCompletion(
      task.createdAt,
      new Date(),
      timezone
    );

    // Update user streak if this is their first valid task today
    if (isValidForStreak) {
      const user = await User.findById(req.user.id);
      const allUserCompletions = await TaskCompletion.find({
        userId: req.user.id,
        roomId: req.params.roomId
      });
      
      // Add current completion to the list for validation
      allUserCompletions.push(completion);
      
      const hasValidTasksToday = TaskValidationService.hasValidTasksToday(
        allUserCompletions,
        timezone
      );
      
      // If this is the first valid task today, update streak
      if (hasValidTasksToday) {
        const hadValidTasksYesterday = TaskValidationService.hasValidTasksYesterday(
          allUserCompletions,
          timezone
        );
        
        // Increment or maintain streak based on yesterday's activity
        if (user.currentStreak === 0 || hadValidTasksYesterday) {
          user.incrementStreak();
          await user.save();
          
          // Create system message for streak milestone
          if (user.currentStreak % 7 === 0 && user.currentStreak > 0) {
            await ChatMessage.create({
              roomId: req.params.roomId,
              message: `🔥 ${req.user.username} reached a ${user.currentStreak}-day streak!`,
              isSystemMessage: true
            });
          }
        }
        
        // Update room streak
        req.room.incrementRoomStreak();
        await req.room.save();
      }
    }

    // Update room member points
    await req.room.updateMemberPoints(req.user.id, task.points);

    // Update user total points
    await User.findByIdAndUpdate(req.user.id, {
      $inc: { totalPoints: task.points }
    });

    // Update user room progress
    let progress = await UserRoomProgress.findOne({
      userId: req.user.id,
      roomId: req.params.roomId
    });

    if (!progress) {
      progress = await UserRoomProgress.create({
        userId: req.user.id,
        roomId: req.params.roomId
      });
    }

    await progress.updateProgress(task.points, today);

    // Get updated leaderboard
    const leaderboard = await req.room.getLeaderboard();

    // Get room members (exclude completer)
    const roomMembers = req.room.members
      .map(m => m.userId.toString())
      .filter(userId => userId !== req.user.id);

    // Create in-app notifications for all members (don't fail if notification fails)
    for (const memberId of roomMembers) {
      try {
        await NotificationService.createNotification({
          userId: memberId,
          type: 'task_completed',
          title: `Task Completed in ${req.room.name}`,
          message: `${req.user.username} completed: ${task.title}`,
          relatedRoom: req.params.roomId,
          relatedTask: req.params.taskId
        });
      } catch (err) {
        logger.error('Error creating notification:', err);
      }
    }

    // Send push notifications
    if (roomMembers.length > 0) {
      PushNotificationService.notifyTaskCompletion(
        roomMembers,
        { ...task.toObject(), roomId: req.params.roomId },
        req.user.username,
        req.room.name
      ).catch(err => logger.error('Push notification error:', err));
    }

    // Get full user data for avatar
    const fullUser = await User.findById(req.user.id).select('username email avatar');
    
    // Emit socket events
    const io = req.app.get('io');
    io.to(req.params.roomId).emit('task:completed', {
      roomId: req.params.roomId,
      taskId: req.params.taskId,
      userId: req.user.id,
      username: fullUser?.username || req.user.username || req.user.email,
      avatar: fullUser?.avatar || null,
      points: task.points,
      leaderboard
    });

    // Emit notification event to members
    roomMembers.forEach(memberId => {
      io.to(`user:${memberId}`).emit('notification', {
        type: 'task_completed',
        title: `Task Completed in ${req.room.name}`,
        message: `${req.user.username} completed: ${task.title}`,
        roomId: req.params.roomId
      });
    });

    logger.info(`Task completed by ${req.user.email}: ${task.title}`);
    res.status(201).json({
      success: true,
      completion,
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
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const completion = await TaskCompletion.findOne({
      userId: req.user.id,
      roomId: req.params.roomId,
      taskId: req.params.taskId,
      completionDate: {
        $gte: today,
        $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
      }
    });

    if (!completion) {
      return res.status(404).json({
        success: false,
        message: 'Completion not found for today'
      });
    }

    // Remove points
    await req.room.updateMemberPoints(req.user.id, -completion.pointsAwarded);
    await User.findByIdAndUpdate(req.user.id, {
      $inc: { totalPoints: -completion.pointsAwarded }
    });

    // Delete completion
    await completion.deleteOne();

    // Get updated leaderboard
    const leaderboard = await req.room.getLeaderboard();

    // Emit socket event
    const io = req.app.get('io');
    io.to(req.params.roomId).emit('task:uncompleted', {
      roomId: req.params.roomId,
      taskId: req.params.taskId,
      userId: req.user.id,
      leaderboard
    });

    logger.info(`Task completion removed by ${req.user.email}: ${completion.taskTitle}`);
    res.json({
      success: true,
      message: 'Task completion removed'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
