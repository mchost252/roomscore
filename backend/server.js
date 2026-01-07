require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const http = require('http');
const { Server } = require('socket.io');
const logger = require('./utils/logger');
const passport = require('passport');
const session = require('express-session');

// Import routes
const authRoutes = require('./routes/auth');
const roomRoutes = require('./routes/rooms');
const taskRoutes = require('./routes/tasks');
const notificationRoutes = require('./routes/notifications');
const pushRoutes = require('./routes/push');
const friendRoutes = require('./routes/friends');
const directMessageRoutes = require('./routes/directMessages');

// Import socket handler and cron jobs
const socketHandler = require('./socket/socketHandler');
const { setIO } = require('./socket/io');
require('./services/cronJobs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Trust proxy for Railway/production deployment
app.set('trust proxy', 1);

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Session configuration for Google OAuth
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Passport initialization
app.use(passport.initialize());
app.use(passport.session());
require('./config/passport')(passport);

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Database connection
console.log('🔌 Attempting MongoDB connection...');
console.log('📋 MongoDB URI:', process.env.MONGODB_URI ? 'Set (hidden for security)' : 'NOT SET!');

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/roomscore', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 10000, // Timeout after 10 seconds instead of hanging forever
  maxPoolSize: 10, // Maintain up to 10 socket connections
  minPoolSize: 2, // Keep at least 2 connections ready
  socketTimeoutMS: 20000, // Close sockets after 20 seconds of inactivity
  family: 4 // Use IPv4, skip trying IPv6
})
.then(() => {
  console.log('✅ MongoDB connected successfully');
  logger.info('MongoDB connected successfully');
})
.catch((err) => {
  console.error('❌ MongoDB connection error:', err.message);
  logger.error('MongoDB connection error:', err);
  // Don't exit - let app run for health checks
});

// Make io accessible to routes and services
app.set('io', io);
setIO(io);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/rooms', taskRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/push', pushRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/direct-messages', directMessageRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Socket.io connection handling
socketHandler(io);

// Start server
const PORT = process.env.PORT || 5000;
console.log(`🚀 Starting server on port ${PORT}...`);
server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
  logger.info(`Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
});

module.exports = { app, server, io };
