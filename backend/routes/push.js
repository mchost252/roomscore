const express = require('express');
const router = express.Router();
const User = require('../models/User');
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

    const user = await User.findById(req.user.id);

    // Check if subscription already exists
    const existingIndex = user.pushSubscriptions.findIndex(
      sub => sub.endpoint === subscription.endpoint
    );

    if (existingIndex !== -1) {
      // Update existing subscription
      user.pushSubscriptions[existingIndex] = {
        endpoint: subscription.endpoint,
        keys: subscription.keys,
        userAgent: req.headers['user-agent'] || 'Unknown',
        subscribedAt: new Date()
      };
    } else {
      // Add new subscription
      user.pushSubscriptions.push({
        endpoint: subscription.endpoint,
        keys: subscription.keys,
        userAgent: req.headers['user-agent'] || 'Unknown',
        subscribedAt: new Date()
      });
    }

    // Enable push notifications
    user.notificationSettings.pushEnabled = true;
    await user.save();

    logger.info(`User ${user.email} subscribed to push notifications`);
    
    res.json({
      success: true,
      message: 'Successfully subscribed to push notifications'
    });
  } catch (error) {
    logger.error('Error subscribing to push notifications:', error);
    next(error);
  }
});

// @route   POST /api/push/subscribe-native
// @desc    Subscribe to push notifications (native apps - FCM/APNS)
// @access  Private
router.post('/subscribe-native', protect, async (req, res, next) => {
  try {
    const { token, platform } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Push token is required'
      });
    }

    const user = await User.findById(req.user.id);

    // Check if token already exists
    const existingIndex = user.pushSubscriptions.findIndex(
      sub => sub.nativeToken === token
    );

    if (existingIndex !== -1) {
      // Update existing subscription
      user.pushSubscriptions[existingIndex] = {
        nativeToken: token,
        platform: platform || 'unknown',
        userAgent: req.headers['user-agent'] || 'Native App',
        subscribedAt: new Date()
      };
    } else {
      // Add new subscription
      user.pushSubscriptions.push({
        nativeToken: token,
        platform: platform || 'unknown',
        userAgent: req.headers['user-agent'] || 'Native App',
        subscribedAt: new Date()
      });
    }

    // Enable push notifications
    user.notificationSettings.pushEnabled = true;
    await user.save();

    logger.info(`User ${user.email} subscribed to native push notifications (${platform})`);
    
    res.json({
      success: true,
      message: 'Successfully subscribed to push notifications'
    });
  } catch (error) {
    logger.error('Error subscribing to native push notifications:', error);
    next(error);
  }
});

// @route   POST /api/push/unsubscribe
// @desc    Unsubscribe from push notifications
// @access  Private
router.post('/unsubscribe', protect, async (req, res, next) => {
  try {
    const { endpoint } = req.body;

    if (!endpoint) {
      return res.status(400).json({
        success: false,
        message: 'Endpoint is required'
      });
    }

    const user = await User.findById(req.user.id);

    // Remove the subscription
    user.pushSubscriptions = user.pushSubscriptions.filter(
      sub => sub.endpoint !== endpoint
    );

    // Disable push if no subscriptions left
    if (user.pushSubscriptions.length === 0) {
      user.notificationSettings.pushEnabled = false;
    }

    await user.save();

    logger.info(`User ${user.email} unsubscribed from push notifications`);
    
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
    const user = await User.findById(req.user.id).select('notificationSettings pushSubscriptions');

    res.json({
      success: true,
      pushEnabled: user.notificationSettings.pushEnabled,
      subscriptionCount: user.pushSubscriptions.length
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
