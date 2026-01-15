const express = require('express');
const router = express.Router();
const { prisma } = require('../config/database');
const { protect } = require('../middleware/auth');
const logger = require('../utils/logger');

// @route   GET /api/notifications/unread-count
// @desc    Get unread notifications count
// @access  Private
router.get('/unread-count', protect, async (req, res, next) => {
  try {
    const unreadCount = await prisma.notification.count({
      where: { userId: req.user.id, read: false }
    });
    res.json({ success: true, unreadCount });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/notifications
// @desc    Get user notifications
// @access  Private
router.get('/', protect, async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const rawLimit = parseInt(req.query.limit) || 20;
    const limit = Math.min(Math.max(rawLimit, 1), 100);
    const status = req.query.status || 'all';

    const whereClause = { userId: req.user.id };
    if (status === 'unread') whereClause.read = false;
    if (status === 'read') whereClause.read = true;

    const [items, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.notification.count({ where: whereClause }),
      prisma.notification.count({ where: { userId: req.user.id, read: false } })
    ]);

    const hasMore = page * limit < total;

    // Format for frontend compatibility
    const notifications = items.map(n => ({
      ...n,
      _id: n.id,
      isRead: n.read
    }));

    res.json({
      success: true,
      page,
      limit,
      total,
      hasMore,
      count: notifications.length,
      unreadCount,
      notifications
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
    const notification = await prisma.notification.findFirst({
      where: {
        id: req.params.id,
        userId: req.user.id
      }
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    const updated = await prisma.notification.update({
      where: { id: req.params.id },
      data: { read: true }
    });

    // Emit socket events
    const io = req.app.get('io');
    const unreadCount = await prisma.notification.count({
      where: { userId: req.user.id, read: false }
    });
    io.to(`user:${req.user.id}`).emit('notification:read', { id: notification.id });
    io.to(`user:${req.user.id}`).emit('notification:unreadCount', { unreadCount });

    res.json({
      success: true,
      notification: { ...updated, _id: updated.id, isRead: updated.read },
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
    await prisma.notification.updateMany({
      where: { userId: req.user.id, read: false },
      data: { read: true }
    });

    const io = req.app.get('io');
    io.to(`user:${req.user.id}`).emit('notification:readAll');
    io.to(`user:${req.user.id}`).emit('notification:unreadCount', { unreadCount: 0 });

    res.json({
      success: true,
      message: 'All notifications marked as read',
      unreadCount: 0
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
    const notification = await prisma.notification.findFirst({
      where: {
        id: req.params.id,
        userId: req.user.id
      }
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    await prisma.notification.delete({
      where: { id: req.params.id }
    });

    const io = req.app.get('io');
    const unreadCount = await prisma.notification.count({
      where: { userId: req.user.id, read: false }
    });
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
    await prisma.notification.deleteMany({
      where: {
        userId: req.user.id,
        read: true
      }
    });

    const io = req.app.get('io');
    const unreadCount = await prisma.notification.count({
      where: { userId: req.user.id, read: false }
    });
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
