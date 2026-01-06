const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const { protect } = require('../middleware/auth');
const logger = require('../utils/logger');

// @route   GET /api/notifications
// @desc    Get user notifications
// @access  Private
// @route   GET /api/notifications/unread-count
// @desc    Get unread notifications count
// @access  Private
router.get('/unread-count', protect, async (req, res, next) => {
  try {
    const unreadCount = await Notification.countDocuments({ userId: req.user.id, isRead: false });
    res.json({ success: true, unreadCount });
  } catch (error) {
    next(error);
  }
});

router.get('/', protect, async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const rawLimit = parseInt(req.query.limit) || 20;
    const limit = Math.min(Math.max(rawLimit, 1), 100); // 1..100
    const status = req.query.status || 'all'; // all | read | unread

    const query = { userId: req.user.id };
    if (status === 'unread') query.isRead = false;
    if (status === 'read') query.isRead = true;

    const [items, total, unreadCount] = await Promise.all([
      Notification.find(query)
        .populate('relatedRoom', 'name')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Notification.countDocuments(query),
      Notification.countDocuments({ userId: req.user.id, isRead: false })
    ]);

    const hasMore = page * limit < total;

    res.json({
      success: true,
      page,
      limit,
      total,
      hasMore,
      count: items.length,
      unreadCount,
      notifications: items
    });
  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/notifications/:id/read
// @desc    Mark notification as read
// @access  Private
router.put('/:id/read', protect, async (req, res, next) => {
  try {
    const notification = await Notification.findOne({
      _id: req.params.id,
      userId: req.user.id
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    notification.isRead = true;
    await notification.save();

    // Emit socket events and updated unread count
    const io = req.app.get('io');
    const unreadCount = await Notification.countDocuments({ userId: req.user.id, isRead: false });
    io.to(`user:${req.user.id}`).emit('notification:read', { id: notification._id });
    io.to(`user:${req.user.id}`).emit('notification:unreadCount', { unreadCount });

    res.json({
      success: true,
      notification,
      unreadCount
    });
  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/notifications/read-all
// @desc    Mark all notifications as read
// @access  Private
router.put('/read-all', protect, async (req, res, next) => {
  try {
    await Notification.updateMany(
      { userId: req.user.id, isRead: false },
      { isRead: true }
    );

    const io = req.app.get('io');
    const unreadCount = 0;
    io.to(`user:${req.user.id}`).emit('notification:readAll');
    io.to(`user:${req.user.id}`).emit('notification:unreadCount', { unreadCount });

    res.json({
      success: true,
      message: 'All notifications marked as read',
      unreadCount
    });
  } catch (error) {
    next(error);
  }
});

// @route   DELETE /api/notifications/:id
// @desc    Delete notification
// @access  Private
router.delete('/:id', protect, async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    // Emit deletion and possibly updated unread count
    const io = req.app.get('io');
    const unreadCount = await Notification.countDocuments({ userId: req.user.id, isRead: false });
    io.to(`user:${req.user.id}`).emit('notification:deleted', { id: req.params.id });
    io.to(`user:${req.user.id}`).emit('notification:unreadCount', { unreadCount });

    res.json({
      success: true,
      message: 'Notification deleted',
      unreadCount
    });
  } catch (error) {
    next(error);
  }
});

// @route   DELETE /api/notifications
// @desc    Delete all read notifications
// @access  Private
router.delete('/', protect, async (req, res, next) => {
  try {
    await Notification.deleteMany({
      userId: req.user.id,
      isRead: true
    });

    const io = req.app.get('io');
    const unreadCount = await Notification.countDocuments({ userId: req.user.id, isRead: false });
    io.to(`user:${req.user.id}`).emit('notification:clearedRead');
    io.to(`user:${req.user.id}`).emit('notification:unreadCount', { unreadCount });

    res.json({
      success: true,
      message: 'All read notifications deleted',
      unreadCount
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
