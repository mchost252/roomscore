const express = require('express');
const router = express.Router();
const passport = require('passport');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const TaskCompletion = require('../models/TaskCompletion');
const UserRoomProgress = require('../models/UserRoomProgress');
const Room = require('../models/Room');
const ChatMessage = require('../models/ChatMessage');
const Notification = require('../models/Notification');
const { validate, registerSchema, loginSchema, updateProfileSchema } = require('../middleware/validation');
const { sendTokenResponse, verifyRefreshToken, generateToken } = require('../utils/jwt');
const logger = require('../utils/logger');

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post('/register', validate(registerSchema), async (req, res, next) => {
  try {
    const { email, password, username } = req.body;

    // Check if user exists
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email'
      });
    }

    // Create user
    user = await User.create({
      email,
      password,
      username,
      isVerified: false
    });

    logger.info(`New user registered: ${email}`);
    sendTokenResponse(user, 201, res);
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Check for user
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if password matches
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated'
      });
    }

    logger.info(`User logged in: ${email}`);
    sendTokenResponse(user, 200, res);
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/auth/google
// @desc    Google OAuth login
// @access  Public
router.get('/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

// @route   GET /api/auth/google/callback
// @desc    Google OAuth callback
// @access  Public
router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: '/login' }),
  (req, res) => {
    // Successful authentication
    sendTokenResponse(req.user, 200, res);
  }
);

// @route   POST /api/auth/refresh
// @desc    Refresh access token
// @access  Public
router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token required'
      });
    }

    const decoded = verifyRefreshToken(refreshToken);
    if (!decoded) {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token'
      });
    }

    const user = await User.findById(decoded.id);
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'User not found or inactive'
      });
    }

    const newToken = generateToken(user._id);
    res.json({
      success: true,
      token: newToken
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/auth/profile
// @desc    Get current user profile
// @access  Private
router.get('/profile', protect, async (req, res, next) => {
  try {
    res.json({
      success: true,
      user: req.user.toPublicProfile()
    });
  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/auth/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', protect, validate(updateProfileSchema), async (req, res, next) => {
  try {
    const { username, avatar, bio, notificationSettings } = req.body;

    const updateFields = {};
    if (username) updateFields.username = username;
    if (avatar !== undefined) updateFields.avatar = avatar;
    if (bio !== undefined) updateFields.bio = bio;
    if (notificationSettings) updateFields.notificationSettings = notificationSettings;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      updateFields,
      { new: true, runValidators: true }
    );

    logger.info(`User profile updated: ${user.email}`);
    res.json({
      success: true,
      user: user.toPublicProfile()
    });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/auth/logout
// @desc    Logout user
// @access  Private
router.post('/logout', protect, (req, res) => {
  logger.info(`User logged out: ${req.user.email}`);
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

// @route   DELETE /api/auth/account
// @desc    Permanently delete current user's account and related data
// @access  Private
router.delete('/account', protect, async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Remove user from all rooms
    await Room.updateMany(
      { 'members.userId': userId },
      { $pull: { members: { userId } } }
    );

    // If user is owner of any rooms, mark them inactive (simple safe behavior)
    await Room.updateMany(
      { owner: userId },
      { $set: { isActive: false, deletedAt: new Date() } }
    );

    // Delete related records
    await Promise.all([
      TaskCompletion.deleteMany({ userId }),
      UserRoomProgress.deleteMany({ userId }),
      ChatMessage.deleteMany({ userId }),
      Notification.deleteMany({ userId })
    ]);

    // Finally delete the user
    await User.findByIdAndDelete(userId);

    logger.info(`User account deleted: ${userId}`);
    res.json({ success: true, message: 'Account deleted' });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/auth/avatar/:userId
// @desc    Get user's avatar by ID (lightweight endpoint for on-demand avatar loading)
// @access  Private
router.get('/avatar/:userId', protect, async (req, res, next) => {
  try {
    const user = await User.findById(req.params.userId).select('avatar').lean();
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, avatar: user.avatar || null });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
