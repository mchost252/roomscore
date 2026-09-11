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

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route'
      });
    }

    // Keep database failures distinct from invalid credentials. Returning 401
    // for a schema or connection error makes every protected route look like
    // an expired session and hides the real backend failure.
    try {
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
          xp: true,
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
    } catch (error) {
      next(error);
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

    // Fetch only the fields needed for the ownership check first.
    // Route handlers that need full room data (members, tasks) will re-query
    // via req.room, but most owner-only routes (update, delete, settings, premium)
    // already do their own targeted Prisma call, so the heavy include is wasted here.
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
            user: { select: { id: true, username: true, avatar: true } }
          }
        },
        tasks: {
          where: { isActive: true },
          select: {
            id: true,
            roomId: true,
            title: true,
            description: true,
            taskType: true,
            daysOfWeek: true,
            points: true,
            isActive: true,
            createdAt: true
          }
        },
        owner: { select: { id: true, username: true } }
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

// Check if user is room owner OR a promoted room admin.
// Sets req.roomRole to 'owner' or 'admin' so handlers can apply the extra
// restrictions that apply to admins (e.g. an admin cannot kick another admin).
exports.isRoomAdmin = async (req, res, next) => {
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
            user: { select: { id: true, username: true, avatar: true } }
          }
        },
        owner: { select: { id: true, username: true } }
      }
    });

    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    const isOwner = room.ownerId === req.user.id;
    const membership = room.members.find(
      m => m.userId === req.user.id && m.status === 'active'
    );

    if (!isOwner && membership?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only the room owner or an admin can perform this action'
      });
    }

    req.room = room;
    req.roomRole = isOwner ? 'owner' : 'admin';
    next();
  } catch (error) {
    next(error);
  }
};

// Check if user is room member
exports.isRoomMember = async (req, res, next) => {
  try {
    const roomId = req.params.id || req.params.roomId;
    
    // First, do a quick membership check without loading all data
    const membership = await prisma.roomMember.findUnique({
      where: {
        roomId_userId: {
          roomId: roomId,
          userId: req.user.id
        }
      },
      select: { id: true, status: true }
    });
    
    // Also check if user is owner (separate quick query)
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      select: {
        id: true,
        name: true,
        description: true,
        joinCode: true,
        isPrivate: true,
        maxMembers: true,
        chatRetentionDays: true,
        streak: true,
        longestStreak: true,
        lastActivityDate: true,
        ownerId: true,
        startDate: true,
        endDate: true,
        isActive: true,
        createdAt: true,
        updatedAt: true
      }
    });
    
    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    const isOwner = room.ownerId === req.user.id;
    
    if (!membership && !isOwner) {
      return res.status(403).json({
        success: false,
        message: 'You must be a member of this room'
      });
    }

    // Check if membership is pending (not yet approved)
    if (membership && membership.status === 'pending' && !isOwner) {
      return res.status(403).json({
        success: false,
        message: 'Your join request is pending approval from the room owner'
      });
    }

    // Now load full room data only for authorized users
    const fullRoom = await prisma.room.findUnique({
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
        tasks: {
          where: { isActive: true },
          select: {
            id: true,
            roomId: true,
            title: true,
            description: true,
            taskType: true,
            daysOfWeek: true,
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

    req.room = fullRoom;
    next();
  } catch (error) {
    next(error);
  }
};
