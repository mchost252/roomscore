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

    // Store subscription as JSON
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

// @route   POST /api/push/unsubscribe
// @desc    Unsubscribe from push notifications
// @access  Private
router.post('/unsubscribe', protect, async (req, res, next) => {
  try {
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
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { pushSubscription: true }
    });

    res.json({
      success: true,
      pushEnabled: !!user.pushSubscription,
      subscriptionCount: user.pushSubscription ? 1 : 0
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
