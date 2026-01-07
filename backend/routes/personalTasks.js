const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const PersonalTask = require('../models/PersonalTask');
const User = require('../models/User');

// @route   GET /api/personal-tasks
// @desc    Get user's personal tasks
// @access  Private
router.get('/', protect, async (req, res, next) => {
  try {
    const tasks = await PersonalTask.find({
      userId: req.user.id,
      isActive: true
    }).sort({ createdAt: -1 });

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
    const { title, description, frequency, points, dueDate } = req.body;

    if (!title || title.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Title is required' });
    }

    const task = await PersonalTask.create({
      userId: req.user.id,
      title: title.trim(),
      description: description?.trim(),
      frequency: frequency || 'daily',
      points: points || 10,
      dueDate
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
    const task = await PersonalTask.findById(req.params.taskId);

    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    if (task.userId.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const { title, description, frequency, points, dueDate, isActive } = req.body;

    if (title !== undefined) task.title = title.trim();
    if (description !== undefined) task.description = description.trim();
    if (frequency !== undefined) task.frequency = frequency;
    if (points !== undefined) task.points = points;
    if (dueDate !== undefined) task.dueDate = dueDate;
    if (isActive !== undefined) task.isActive = isActive;

    await task.save();

    res.json({ success: true, task });
  } catch (error) {
    next(error);
  }
});

// @route   DELETE /api/personal-tasks/:taskId
// @desc    Delete personal task
// @access  Private
router.delete('/:taskId', protect, async (req, res, next) => {
  try {
    const task = await PersonalTask.findById(req.params.taskId);

    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    if (task.userId.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    await task.deleteOne();

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
    const task = await PersonalTask.findById(req.params.taskId);

    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    if (task.userId.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    if (task.isCompleted) {
      return res.status(400).json({ success: false, message: 'Task already completed today' });
    }

    task.isCompleted = true;
    task.completedAt = new Date();
    await task.save();

    // Award points
    const user = await User.findById(req.user.id);
    user.totalPoints += task.points;
    await user.save();

    res.json({ success: true, task, pointsAwarded: task.points });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
