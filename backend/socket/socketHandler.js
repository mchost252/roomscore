const jwt = require('jsonwebtoken');
const { prisma } = require('../config/database');
const logger = require('../utils/logger');

// Track online users: Map<userId, Set<socketId>>
const onlineUsers = new Map();

module.exports = (io) => {
  // Helper to get online user IDs
  const getOnlineUserIds = () => Array.from(onlineUsers.keys());

  // Authentication middleware for socket connections
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        logger.warn('Socket connection attempted without token');
        return next(new Error('Authentication error'));
      }

      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
      } catch (jwtError) {
        logger.warn('Socket JWT verification failed:', jwtError.message);
        return next(new Error('Authentication error'));
      }

      // Retry user lookup with exponential backoff for database timing issues (Neon cold start)
      let user = null;
      let retries = 5;
      let delay = 500; // Start with 500ms for Neon
      
      while (retries > 0) {
        try {
          user = await prisma.user.findUnique({
            where: { id: decoded.id }
          });
          
          if (user) {
            break; // Found user, exit loop
          }
          
          if (retries > 1) {
            // User not found yet - might be database sync delay
            logger.info(`User ${decoded.id} not found, retrying... (${retries - 1} attempts left)`);
            await new Promise(resolve => setTimeout(resolve, delay));
            delay = Math.min(delay * 1.5, 2000); // Cap at 2 seconds
            retries--;
          } else {
            break; // Last retry, exit loop
          }
        } catch (dbError) {
          logger.error('Database error during socket auth:', dbError.message);
          if (retries > 1) {
            await new Promise(resolve => setTimeout(resolve, delay));
            delay = Math.min(delay * 1.5, 2000);
            retries--;
          } else {
            return next(new Error('Authentication error'));
          }
        }
      }

      if (!user) {
        logger.warn(`Socket auth failed: User ${decoded.id} not found after retries`);
        return next(new Error('User not found or inactive'));
      }
      
      // NOTE: Prisma User model does not include `isActive`.
      // Treat users as active unless an explicit `isActive === false` field exists.
      if (user.isActive === false) {
        logger.warn(`Socket auth failed: User ${decoded.id} is inactive`);
        return next(new Error('User not found or inactive'));
      }

      socket.userId = user.id;
      socket.username = user.username;
      next();
    } catch (error) {
      logger.error('Socket auth error:', error);
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    logger.info(`User connected: ${socket.username} (${socket.userId})`);

    // Track online status
    if (!onlineUsers.has(socket.userId)) {
      onlineUsers.set(socket.userId, new Set());
    }
    onlineUsers.get(socket.userId).add(socket.id);

    // Broadcast to all users that this user is online
    io.emit('user:status', { userId: socket.userId, isOnline: true });

    // Join user's personal room
    socket.join(`user:${socket.userId}`);

    // Send current online users to the newly connected user
    socket.emit('users:online', getOnlineUserIds());

    // Handle explicit request for online users (useful for reconnection)
    socket.on('users:getOnline', () => {
      socket.emit('users:online', getOnlineUserIds());
    });

    // Handle request for specific user's online status
    socket.on('user:checkStatus', (userId) => {
      const isOnline = onlineUsers.has(userId);
      socket.emit('user:status', { userId, isOnline });
    });

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

    // Mark messages as read - notify sender
    socket.on('dm:read', ({ senderId, messageIds }) => {
      socket.to(`user:${senderId}`).emit('dm:read', {
        readBy: socket.userId,
        messageIds,
        readAt: new Date().toISOString()
      });
    });

    // Confirm message delivery when recipient is online
    socket.on('dm:confirm_delivery', ({ senderId, messageIds }) => {
      socket.to(`user:${senderId}`).emit('dm:delivered', {
        messageIds,
        deliveredAt: new Date().toISOString()
      });
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      logger.info(`User disconnected: ${socket.username} (${socket.userId})`);
      
      // Remove socket from online tracking
      if (onlineUsers.has(socket.userId)) {
        onlineUsers.get(socket.userId).delete(socket.id);
        // If user has no more active sockets, they're offline
        if (onlineUsers.get(socket.userId).size === 0) {
          onlineUsers.delete(socket.userId);
          // Broadcast to all users that this user is offline
          io.emit('user:status', { userId: socket.userId, isOnline: false });
        }
      }
    });

    // Error handling
    socket.on('error', (error) => {
      logger.error(`Socket error for user ${socket.username}:`, error);
    });
  });

  return io;
};
