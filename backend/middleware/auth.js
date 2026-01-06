const jwt = require('jsonwebtoken');
const User = require('../models/User');

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
      
      // Get user from token
      req.user = await User.findById(decoded.id).select('-password');
      
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'User not found'
        });
      }

      if (!req.user.isActive) {
        return res.status(401).json({
          success: false,
          message: 'Account is deactivated'
        });
      }

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

// Check if user is admin
exports.isAdmin = (req, res, next) => {
  if (req.user && req.user.isAdmin) {
    next();
  } else {
    res.status(403).json({
      success: false,
      message: 'Access denied. Admin privileges required.'
    });
  }
};

// Check if user is room owner
exports.isRoomOwner = async (req, res, next) => {
  try {
    const Room = require('../models/Room');
    const room = await Room.findById(req.params.id || req.params.roomId);
    
    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    if (room.owner.toString() !== req.user.id) {
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
    const Room = require('../models/Room');
    const room = await Room.findById(req.params.id || req.params.roomId);
    
    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    const isMember = room.members.some(member => 
      member.userId.toString() === req.user.id
    );

    if (!isMember && room.owner.toString() !== req.user.id) {
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
