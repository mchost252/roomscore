const jwt = require('jsonwebtoken');

// Generate JWT token
exports.generateToken = (userId) => {
  return jwt.sign(
    { id: userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
  );
};

// Generate refresh token
exports.generateRefreshToken = (userId) => {
  return jwt.sign(
    { id: userId },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );
};

// Verify refresh token
exports.verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
  } catch (error) {
    return null;
  }
};

// Helper to convert user to public profile (for Prisma)
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

// Send token response
exports.sendTokenResponse = (user, statusCode, res) => {
  const token = exports.generateToken(user.id);
  const refreshToken = exports.generateRefreshToken(user.id);

  res.status(statusCode).json({
    success: true,
    token,
    refreshToken,
    user: toPublicProfile(user)
  });
};
