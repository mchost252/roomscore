const jwt = require('jsonwebtoken');
const { prisma } = require('../config/database');

// Verify JWT token
exports.protect = async (req, res, next) => {
  try {
    let token;

    // Get token from header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route'
      });
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Get user from token (exclude password)
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: {
          id: true,
          email: true,
          username: true,
          avatar: true,
          timezone: true,
          onboardingCompleted: true,
          streak: true,
          longestStreak: true,
          totalTasksCompleted: true,
          lastActive: true,
          createdAt: true,
          updatedAt: true
        }
      });
      
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not found'
        });
      }

      req.user = user;
      next();
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route'
      });
    }
  } catch (error) {
    next(error);
  }
};

// Check if user is admin (for future use)
exports.isAdmin = (req, res, next) => {
  // For now, no admin field in Prisma schema - can be added later
  res.status(403).json({
    success: false,
    message: 'Access denied. Admin privileges required.'
  });
};

// Check if user is room owner
exports.isRoomOwner = async (req, res, next) => {
  try {
    const roomId = req.params.id || req.params.roomId;
    
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: {
        members: true,
        tasks: true
      }
    });
    
    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    if (room.ownerId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Only room owner can perform this action'
      });
    }

    req.room = room;
    next();
  } catch (error) {
    next(error);
  }
};

// Check if user is room member
exports.isRoomMember = async (req, res, next) => {
  try {
    const roomId = req.params.id || req.params.roomId;
    
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: {
        members: {
          select: {
            id: true,
            userId: true,
            role: true,
            points: true,
            status: true,
            joinedAt: true,
            user: {
              select: {
                id: true,
                username: true,
                avatar: true,
                streak: true
              }
            }
          }
        },
        // Only active tasks and only fields needed by UI
        tasks: {
          where: { isActive: true },
          select: {
            id: true,
            roomId: true,
            title: true,
            description: true,
            taskType: true,
            points: true,
            isActive: true,
            createdAt: true
          }
        },
        owner: {
          select: {
            id: true,
            username: true,
            avatar: true
          }
        }
      }
    });
    
    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    const isMember = room.members.some(member => member.userId === req.user.id);

    if (!isMember && room.ownerId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You must be a member of this room'
      });
    }

    req.room = room;
    next();
  } catch (error) {
    next(error);
  }
};
