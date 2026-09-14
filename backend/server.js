const fs = require('fs');
// Load .env for production (Railway), .env.local for local development
const isLocalDev = fs.existsSync('.env.local');
if (isLocalDev) {
  require('dotenv').config({ path: '.env.local' });
  console.log('📝 Using .env.local for local development');
} else {
  require('dotenv').config();
  console.log('📝 Using .env for production');
}
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const http = require('http');
const { Server } = require('socket.io');
const logger = require('./utils/logger');
const passport = require('passport');
const session = require('express-session');
const { prisma, connectDatabase } = require('./config/database');
const { startChatRetentionCleanup } = require('./services/chatRetentionService');

// Import routes
const authRoutes = require('./routes/auth');
const roomRoutes = require('./routes/rooms');
const taskRoutes = require('./routes/tasks');
const notificationRoutes = require('./routes/notifications');
const pushRoutes = require('./routes/push');
const friendRoutes = require('./routes/friends');
const directMessageRoutes = require('./routes/directMessages');
const nudgeRoutes = require('./routes/nudges');
const appreciationRoutes = require('./routes/appreciations');
const orbitSummaryRoutes = require('./routes/orbitSummary');
const personalTaskRoutes = require('./routes/personalTasks');
const aiRoutes = require('./routes/ai');
const internalRoutes = require('./routes/internal');
const activityRoutes = require('./routes/activity');
const trophyRoutes = require('./routes/trophies');
const blockRoutes = require('./routes/blocks');
const focusRoutes = require('./routes/focus');


// Import socket handler
const socketHandler = require('./socket/socketHandler');
const { setIO } = require('./socket/io');

// Cron jobs removed - chat retention handled by chatRetentionService
// Other cron functionality can be re-implemented with Prisma if needed

const app = express();
const server = http.createServer(app);
console.log('[boot] http server created');
const io = new Server(server, {
  cors: {
    origin: function(origin, callback) {
      // Allow requests with no origin (mobile apps)
      if (!origin) return callback(null, true);
      callback(null, true); // Allow all origins for mobile app support
    },
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Trust proxy for Railway/production deployment
app.set('trust proxy', 1);

// Middleware
app.use(helmet());

// CORS configuration - allow web and mobile apps
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'https://krios-hub.vercel.app',
  'http://localhost',
  'https://localhost',
  'capacitor://localhost',
  'ionic://localhost',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:8081',
  'http://localhost:19006'
].filter(Boolean);

const isProduction = process.env.NODE_ENV === 'production';

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    // Allow if in dev mode or origin is explicitly allowed
    const isAllowed = !isProduction || allowedOrigins.indexOf(origin) !== -1 || origin.endsWith('.vercel.app');
    if (isAllowed) {
      return callback(null, true);
    }
    
    // Reject with a clear error instead of silently allowing
    const error = new Error(`Origin ${origin} not allowed by CORS`);
    error.code = 'CORS_ERROR';
    callback(error);
  },
  credentials: true
}));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Session configuration for Google OAuth
const sessionSecret = process.env.SESSION_SECRET || (process.env.NODE_ENV === 'production' ? null : 'dev-session-secret');
if (!sessionSecret) {
  console.error('❌ SESSION_SECRET is required in production');
  process.exit(1);
}
app.use(session({
  secret: sessionSecret,
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

// Rate limiting - enabled to prevent abuse and reduce unnecessary API calls
// Skip rate limiting for auth routes (register/login) to prevent blocking legitimate users
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 min
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 1000, // Increased for Railway
  message: { 
    success: false, 
    message: 'Too many requests. Please wait a moment and try again.',
    retryAfter: Math.ceil((parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000) / 1000)
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    if (req.path === '/health') return true;
    if (req.path.includes('/socket.io')) return true;
    // Skip rate limiting for auth routes (register/login)
    if (req.path.includes('/auth/register') || req.path.includes('/auth/login')) return true;
    return false;
  }
});
app.use('/api/', limiter);

// Database connection (PostgreSQL via Prisma)
console.log('🔌 Attempting PostgreSQL connection...');
console.log('📋 DATABASE_URL:', process.env.DATABASE_URL ? 'Set (hidden for security)' : 'NOT SET!');

const isSQLite = process.env.DATABASE_URL?.includes('sqlite') || process.env.DATABASE_URL?.includes('.db');

connectDatabase()
  .then(async () => {
    const dbType = isSQLite ? 'SQLite' : 'PostgreSQL';
    logger.info(`${dbType} connected successfully`);

    // Ensure required columns exist (idempotent) without Prisma Migrate.
    // This avoids Prisma migrate baseline issues (P3005) on existing production DB.
    if (!isSQLite) {
      try {
        await prisma.$executeRawUnsafe(
          'ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "coverImage" TEXT;'
        );
        logger.info('✅ Ensured User.coverImage exists');

        await prisma.$executeRawUnsafe(
          'ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "notificationPreferences" TEXT;'
        );
        logger.info('✅ Ensured User.notificationPreferences exists');

        await prisma.$executeRawUnsafe(
          'ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "xp" INTEGER NOT NULL DEFAULT 0;'
        );
        logger.info('✅ Ensured User.xp exists');

        await prisma.$executeRawUnsafe(
          'ALTER TABLE "DirectMessage" ADD COLUMN IF NOT EXISTS "deletedFor" TEXT;'
        );
        await prisma.$executeRawUnsafe(
          'ALTER TABLE "DirectMessage" ADD COLUMN IF NOT EXISTS "replyToId" TEXT;'
        );
        await prisma.$executeRawUnsafe(
          'ALTER TABLE "DirectMessage" ADD COLUMN IF NOT EXISTS "replyToText" TEXT;'
        );
        await prisma.$executeRawUnsafe(
          'ALTER TABLE "DirectMessage" ADD COLUMN IF NOT EXISTS "reactions" JSONB;'
        );
        logger.info('✅ Ensured DirectMessage compatibility columns exist');

        await prisma.$executeRawUnsafe(
          'ALTER TABLE "ChatMessage" ADD COLUMN IF NOT EXISTS "replyToId" TEXT;'
        );
        await prisma.$executeRawUnsafe(
          'ALTER TABLE "ChatMessage" ADD COLUMN IF NOT EXISTS "replyToText" TEXT;'
        );
        await prisma.$executeRawUnsafe(
          'ALTER TABLE "ChatMessage" ADD COLUMN IF NOT EXISTS "reactions" JSONB;'
        );
        logger.info('✅ Ensured ChatMessage compatibility columns exist');

        await prisma.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS "ConversationPreference" (
            "id" TEXT PRIMARY KEY,
            "userId" TEXT NOT NULL,
            "friendId" TEXT NOT NULL,
            "pinned" BOOLEAN NOT NULL DEFAULT false,
            "muted" BOOLEAN NOT NULL DEFAULT false,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "ConversationPreference_userId_fkey"
              FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
            CONSTRAINT "ConversationPreference_userId_friendId_key"
              UNIQUE ("userId", "friendId")
          );
        `);
        await prisma.$executeRawUnsafe(
          'CREATE INDEX IF NOT EXISTS "ConversationPreference_userId_pinned_idx" ON "ConversationPreference"("userId", "pinned");'
        );
        logger.info('✅ Ensured ConversationPreference exists');

        await prisma.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS "UserBlock" (
            "id" TEXT PRIMARY KEY,
            "blockerId" TEXT NOT NULL,
            "blockedId" TEXT NOT NULL,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "UserBlock_blockerId_blockedId_key"
              UNIQUE ("blockerId", "blockedId"),
            CONSTRAINT "UserBlock_blockerId_fkey"
              FOREIGN KEY ("blockerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
            CONSTRAINT "UserBlock_blockedId_fkey"
              FOREIGN KEY ("blockedId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
          );
        `);
        await prisma.$executeRawUnsafe(
          'CREATE INDEX IF NOT EXISTS "UserBlock_blockerId_idx" ON "UserBlock"("blockerId");'
        );
        await prisma.$executeRawUnsafe(
          'CREATE INDEX IF NOT EXISTS "UserBlock_blockedId_idx" ON "UserBlock"("blockedId");'
        );
        logger.info('✅ Ensured UserBlock exists');

        await prisma.$executeRawUnsafe(
          'ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "readAt" TIMESTAMP(3);'
        );
        await prisma.$executeRawUnsafe(
          'ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "seenAt" TIMESTAMP(3);'
        );
        await prisma.$executeRawUnsafe(
          'ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "dedupeKey" TEXT;'
        );
        await prisma.$executeRawUnsafe(
          `ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "category" TEXT NOT NULL DEFAULT 'system';`
        );
        await prisma.$executeRawUnsafe(
          `ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "priority" TEXT NOT NULL DEFAULT 'normal';`
        );
        await prisma.$executeRawUnsafe(
          'ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);'
        );
        await prisma.$executeRawUnsafe(
          'ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;'
        );
        logger.info('✅ Ensured Notification compatibility columns exist');

        await prisma.$executeRawUnsafe(
          'ALTER TABLE "Room" ADD COLUMN IF NOT EXISTS "requireApproval" BOOLEAN NOT NULL DEFAULT false;'
        );
        await prisma.$executeRawUnsafe(
          'ALTER TABLE "Room" ADD COLUMN IF NOT EXISTS "chatRetentionDays" INTEGER NOT NULL DEFAULT 5;'
        );
        await prisma.$executeRawUnsafe(
          'ALTER TABLE "Room" ADD COLUMN IF NOT EXISTS "isPremium" BOOLEAN NOT NULL DEFAULT false;'
        );
        await prisma.$executeRawUnsafe(
          'ALTER TABLE "Room" ADD COLUMN IF NOT EXISTS "premiumActivatedAt" TIMESTAMP(3);'
        );
        await prisma.$executeRawUnsafe(
          'ALTER TABLE "Room" ADD COLUMN IF NOT EXISTS "coverImage" TEXT;'
        );
        await prisma.$executeRawUnsafe(
          'ALTER TABLE "Room" ADD COLUMN IF NOT EXISTS "roomDp" TEXT;'
        );
        await prisma.$executeRawUnsafe(
          'ALTER TABLE "Room" ADD COLUMN IF NOT EXISTS "showJoinCode" BOOLEAN NOT NULL DEFAULT false;'
        );
        await prisma.$executeRawUnsafe(
          'ALTER TABLE "RoomTask" ADD COLUMN IF NOT EXISTS "daysOfWeek" TEXT;'
        );
        await prisma.$executeRawUnsafe(
          'ALTER TABLE "RoomTask" ADD COLUMN IF NOT EXISTS "dueDate" TIMESTAMP(3);'
        );
        logger.info('✅ Ensured Room and RoomTask compatibility columns exist');

        await prisma.$executeRawUnsafe(
          'ALTER TABLE "RoomTask" ADD COLUMN IF NOT EXISTS "hasThread" BOOLEAN NOT NULL DEFAULT false;'
        );
        await prisma.$executeRawUnsafe(
          `ALTER TABLE "RoomTask" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'upcoming';`
        );
      } catch (e) {
        logger.warn('⚠️ Could not ensure chatRetentionDays column:', e.message);
      }
    }

    // Start keep-alive pings to prevent Neon database from sleeping
    // DISABLED to reduce egress on Supabase
    // startKeepAlive();
    // Start chat retention cleanup
    startChatRetentionCleanup();
  })
  .catch((err) => {
    console.error('❌ PostgreSQL connection error:', err.message);
    logger.error('PostgreSQL connection error:', err);
    // Don't exit - let app run for health checks
  });

// Make prisma accessible to routes
app.set('prisma', prisma);

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
app.use('/api/nudges', nudgeRoutes);
app.use('/api/appreciations', appreciationRoutes);
app.use('/api/orbit-summary', orbitSummaryRoutes);
app.use('/api/personal-tasks', personalTaskRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/internal', internalRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/trophies', trophyRoutes);
app.use('/api/blocks', blockRoutes);
app.use('/api/me', focusRoutes);

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
