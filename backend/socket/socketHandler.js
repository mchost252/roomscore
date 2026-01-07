const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../utils/logger');

module.exports = (io) => {
  // Authentication middleware for socket connections
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Authentication error'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id);

      if (!user || !user.isActive) {
        return next(new Error('User not found or inactive'));
      }

      socket.userId = user._id.toString();
      socket.username = user.username;
      next();
    } catch (error) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    logger.info(`User connected: ${socket.username} (${socket.userId})`);

    // Join user's personal room
    socket.join(`user:${socket.userId}`);

    // Join room
    socket.on('room:join', (roomId) => {
      socket.join(roomId);
      logger.info(`User ${socket.username} joined room: ${roomId}`);
      
      // Notify others in the room
      socket.to(roomId).emit('user:online', {
        userId: socket.userId,
        username: socket.username
      });
    });

    // Leave room
    socket.on('room:leave', (roomId) => {
      socket.leave(roomId);
      logger.info(`User ${socket.username} left room: ${roomId}`);
      
      // Notify others in the room
      socket.to(roomId).emit('user:offline', {
        userId: socket.userId,
        username: socket.username
      });
    });

    // Typing indicator
    socket.on('chat:typing', ({ roomId, isTyping }) => {
      socket.to(roomId).emit('chat:typing', {
        userId: socket.userId,
        username: socket.username,
        isTyping
      });
    });

    // Direct message typing indicator
    socket.on('dm:typing', ({ recipientId, isTyping }) => {
      socket.to(`user:${recipientId}`).emit('dm:typing', {
        userId: socket.userId,
        username: socket.username,
        isTyping
      });
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      logger.info(`User disconnected: ${socket.username} (${socket.userId})`);
    });

    // Error handling
    socket.on('error', (error) => {
      logger.error(`Socket error for user ${socket.username}:`, error);
    });
  });

  return io;
};
