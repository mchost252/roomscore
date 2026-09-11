const express = require('express');
const router = express.Router();
const { prisma } = require('../config/database');
const { protect } = require('../middleware/auth');
const logger = require('../utils/logger');

// @route   GET /api/push/vapid-public-key
// @desc    Get VAPID public key for push notifications
// @access  Public
router.get('/vapid-public-key', (req, res) => {
  res.json({
    success: true,
    publicKey: process.env.VAPID_PUBLIC_KEY
  });
});

// @route   POST /api/push/subscribe
// @desc    Subscribe to push notifications
// @access  Private
router.post('/subscribe', protect, async (req, res, next) => {
  try {
    const { subscription } = req.body;

    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({
        success: false,
        message: 'Invalid subscription object'
      });
    }

    const isSQLite = process.env.DATABASE_URL?.includes('sqlite') || process.env.DATABASE_URL?.includes('.db');
    const subscriptionValue = isSQLite ? JSON.stringify(subscription) : subscription;

    await prisma.pushDevice.upsert({
      where: { token: subscription.endpoint },
      create: {
        userId: req.user.id,
        platform: 'web',
        token: subscription.endpoint,
        subscription: isSQLite ? subscriptionValue : subscription,
        appVersion: req.headers['user-agent'] || null,
        enabled: true,
      },
      update: {
        userId: req.user.id,
        subscription: subscriptionValue,
        appVersion: req.headers['user-agent'] || null,
        enabled: true,
        lastSeenAt: new Date(),
      },
    });

    // Keep the legacy field until all clients migrate to PushDevice.
    await prisma.user.update({
      where: { id: req.user.id },
      data: {
        pushSubscription: {
          endpoint: subscription.endpoint,
          keys: subscription.keys,
          userAgent: req.headers['user-agent'] || 'Unknown',
          subscribedAt: new Date().toISOString()
        }
      }
    });

    logger.info(`User ${req.user.email} subscribed to push notifications`);
    
    res.json({
      success: true,
      message: 'Successfully subscribed to push notifications'
    });
  } catch (error) {
    logger.error('Error subscribing to push notifications:', error);
    next(error);
  }
});

// @route   POST /api/push/device
// @desc    Register a native Expo push token
// @access  Private
router.post('/device', protect, async (req, res, next) => {
  try {
    const { token, platform, appVersion } = req.body || {};
    if (!token || !['ios', 'android'].includes(platform)) {
      return res.status(400).json({ success: false, message: 'A valid native push token and platform are required' });
    }
    await prisma.pushDevice.upsert({
      where: { token },
      create: { userId: req.user.id, platform, token, appVersion: appVersion || null, enabled: true },
      update: { userId: req.user.id, platform, appVersion: appVersion || null, enabled: true, lastSeenAt: new Date() },
    });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// @route   DELETE /api/push/device
// @desc    Unregister a native Expo push token
// @access  Private
router.delete('/device', protect, async (req, res, next) => {
  try {
    const { token } = req.body || {};
    if (token) {
      await prisma.pushDevice.updateMany({
        where: { userId: req.user.id, token },
        data: { enabled: false, lastSeenAt: new Date() },
      });
    }
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/push/unsubscribe
// @desc    Unsubscribe from push notifications
// @access  Private
router.post('/unsubscribe', protect, async (req, res, next) => {
  try {
    const { endpoint } = req.body || {};
    if (endpoint) {
      await prisma.pushDevice.updateMany({
        where: { userId: req.user.id, token: endpoint },
        data: { enabled: false, lastSeenAt: new Date() },
      });
    } else {
      await prisma.pushDevice.updateMany({
        where: { userId: req.user.id },
        data: { enabled: false, lastSeenAt: new Date() },
      });
    }
    await prisma.user.update({
      where: { id: req.user.id },
      data: { pushSubscription: null }
    });

    logger.info(`User ${req.user.email} unsubscribed from push notifications`);
    
    res.json({
      success: true,
      message: 'Successfully unsubscribed from push notifications'
    });
  } catch (error) {
    logger.error('Error unsubscribing from push notifications:', error);
    next(error);
  }
});

// @route   GET /api/push/status
// @desc    Get push notification status
// @access  Private
router.get('/status', protect, async (req, res, next) => {
  try {
    const [user, devices] = await Promise.all([
      prisma.user.findUnique({
        where: { id: req.user.id },
        select: { pushSubscription: true }
      }),
      prisma.pushDevice.count({ where: { userId: req.user.id, enabled: true } }),
    ]);

    res.json({
      success: true,
      pushEnabled: devices > 0 || !!user.pushSubscription,
      subscriptionCount: devices + (devices === 0 && user.pushSubscription ? 1 : 0)
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
