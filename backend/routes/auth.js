const express = require('express');
const router = express.Router();
const passport = require('passport');
const bcrypt = require('bcryptjs');
const { prisma } = require('../config/database');
const { protect } = require('../middleware/auth');
const { validate, registerSchema, loginSchema, updateProfileSchema } = require('../middleware/validation');
const { sendTokenResponse, verifyRefreshToken, generateToken } = require('../utils/jwt');
const logger = require('../utils/logger');

// Helper to convert user to public profile
const toPublicProfile = (user) => ({
  id: user.id,
  email: user.email,
  username: user.username,
  avatar: user.avatar,
  bio: user.bio,
  timezone: user.timezone,
  onboardingCompleted: user.onboardingCompleted,
  streak: user.streak,
  longestStreak: user.longestStreak,
  totalTasksCompleted: user.totalTasksCompleted,
  createdAt: user.createdAt
});

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post('/register', validate(registerSchema), async (req, res, next) => {
  try {
    const { email, password, username, timezone } = req.body;

    // Check if user exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: email.toLowerCase() },
          { username: username }
        ]
      }
    });

    if (existingUser) {
      const field = existingUser.email === email.toLowerCase() ? 'email' : 'username';
      return res.status(400).json({
        success: false,
        message: `User already exists with this ${field}`
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user with timezone from browser
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        password: hashedPassword,
        username,
        timezone: timezone || 'UTC'
      }
    });

    logger.info(`New user registered: ${email} (timezone: ${timezone || 'UTC'})`);
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
    const { email, password, timezone } = req.body;

    // Check for user
    let user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if password matches
    if (!user.password) {
      return res.status(401).json({
        success: false,
        message: 'Please use Google login for this account'
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Update user's timezone on each login (in case they moved or use different device)
    if (timezone && timezone !== user.timezone) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { timezone }
      });
      logger.info(`User timezone updated: ${email} -> ${timezone}`);
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

    const user = await prisma.user.findUnique({
      where: { id: decoded.id }
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found or inactive'
      });
    }

    const newToken = generateToken(user.id);
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
      user: toPublicProfile(req.user)
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
    const { username, avatar, bio, timezone, onboardingCompleted } = req.body;

    const updateData = {};
    if (username) updateData.username = username;
    if (avatar !== undefined) updateData.avatar = avatar;
    if (bio !== undefined) updateData.bio = bio;
    if (timezone !== undefined) updateData.timezone = timezone;
    if (onboardingCompleted !== undefined) updateData.onboardingCompleted = onboardingCompleted;

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: updateData
    });

    logger.info(`User profile updated: ${user.email}`);
    res.json({
      success: true,
      user: toPublicProfile(user)
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

    // Delete user (cascades will handle related data due to onDelete: Cascade in schema)
    await prisma.user.delete({
      where: { id: userId }
    });

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
    const user = await prisma.user.findUnique({
      where: { id: req.params.userId },
      select: { avatar: true }
    });
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, avatar: user.avatar || null });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
