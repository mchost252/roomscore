const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { prisma } = require('../config/database');

// @route   GET /api/personal-tasks
// @desc    Get user's personal tasks
// @access  Private
router.get('/', protect, async (req, res, next) => {
  try {
    const tasks = await prisma.personalTask.findMany({
      where: {
        userId: req.user.id
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json({ success: true, tasks });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/personal-tasks
// @desc    Create personal task
// @access  Private
router.post('/', protect, async (req, res, next) => {
  try {
    const { title, description, taskType, dueDate } = req.body;

    if (!title || title.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Title is required' });
    }

    const task = await prisma.personalTask.create({
      data: {
        userId: req.user.id,
        title: title.trim(),
        description: description?.trim(),
        taskType: taskType || 'daily',
        dueDate: dueDate ? new Date(dueDate) : null
      }
    });

    res.json({ success: true, task });
  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/personal-tasks/:taskId
// @desc    Update personal task
// @access  Private
router.put('/:taskId', protect, async (req, res, next) => {
  try {
    const task = await prisma.personalTask.findUnique({
      where: { id: req.params.taskId }
    });

    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    if (task.userId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const { title, description, taskType, dueDate } = req.body;

    const updatedTask = await prisma.personalTask.update({
      where: { id: req.params.taskId },
      data: {
        ...(title !== undefined && { title: title.trim() }),
        ...(description !== undefined && { description: description.trim() }),
        ...(taskType !== undefined && { taskType }),
        ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null })
      }
    });

    res.json({ success: true, task: updatedTask });
  } catch (error) {
    next(error);
  }
});

// @route   DELETE /api/personal-tasks/:taskId
// @desc    Delete personal task
// @access  Private
router.delete('/:taskId', protect, async (req, res, next) => {
  try {
    const task = await prisma.personalTask.findUnique({
      where: { id: req.params.taskId }
    });

    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    if (task.userId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    await prisma.personalTask.delete({
      where: { id: req.params.taskId }
    });

    res.json({ success: true, message: 'Task deleted' });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/personal-tasks/:taskId/complete
// @desc    Complete personal task
// @access  Private
router.post('/:taskId/complete', protect, async (req, res, next) => {
  try {
    const task = await prisma.personalTask.findUnique({
      where: { id: req.params.taskId }
    });

    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    if (task.userId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    if (task.isCompleted) {
      return res.status(400).json({ success: false, message: 'Task already completed today' });
    }

    const updatedTask = await prisma.personalTask.update({
      where: { id: req.params.taskId },
      data: {
        isCompleted: true,
        completedAt: new Date()
      }
    });

    // Increment user's total tasks completed
    await prisma.user.update({
      where: { id: req.user.id },
      data: {
        totalTasksCompleted: {
          increment: 1
        }
      }
    });

    res.json({ success: true, task: updatedTask });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
