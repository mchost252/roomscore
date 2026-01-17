// Prisma Database Client for PostgreSQL (Neon)
const { PrismaClient } = require('@prisma/client');

// Build optimized DATABASE_URL with connection pool settings for Neon serverless
function getOptimizedDatabaseUrl() {
  let url = process.env.DATABASE_URL;
  if (!url) return url;
  
  // Add connection pool and timeout settings if not already present
  const params = new URLSearchParams();
  
  // Connection pool settings optimized for serverless
  if (!url.includes('connection_limit')) params.append('connection_limit', '10');
  if (!url.includes('pool_timeout')) params.append('pool_timeout', '20');
  if (!url.includes('connect_timeout')) params.append('connect_timeout', '10');
  if (!url.includes('statement_cache_size')) params.append('statement_cache_size', '0');
  
  const paramString = params.toString();
  if (paramString) {
    url += (url.includes('?') ? '&' : '?') + paramString;
  }
  
  return url;
}

// Create Prisma client instance with logging and connection pool settings
// Optimized for Neon serverless PostgreSQL
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' 
    ? ['query', 'info', 'warn', 'error'] 
    : ['warn', 'error'],
  datasources: {
    db: {
      url: getOptimizedDatabaseUrl()
    }
  }
});

// Add middleware to log slow queries and retry on connection errors
prisma.$use(async (params, next) => {
  const before = Date.now();
  let lastError;
  
  // Retry up to 2 times for connection errors (Neon cold start)
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const result = await next(params);
      const duration = Date.now() - before;
      
      if (duration > 2000) {
        console.warn(`⚠️ Slow query: ${params.model}.${params.action} took ${duration}ms`);
      }
      
      return result;
    } catch (error) {
      lastError = error;
      
      // Check if it's a connection error worth retrying
      const isConnectionError = 
        error.code === 'P1001' || // Can't reach database
        error.code === 'P1002' || // Database timeout
        error.code === 'P1008' || // Operations timed out
        error.code === 'P1017' || // Server closed connection
        error.message?.includes('Connection') ||
        error.message?.includes('timeout') ||
        error.message?.includes('ECONNREFUSED');
      
      if (isConnectionError && attempt < 3) {
        console.warn(`⚠️ Database connection error (attempt ${attempt}/3): ${error.message}. Retrying...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
        continue;
      }
      
      throw error;
    }
  }
  
  throw lastError;
});

// Ensure single instance (avoid connection pool exhaustion)
const globalForPrisma = global;
if (!globalForPrisma.prisma) {
  globalForPrisma.prisma = prisma;
}

// Connection test function with retry logic for Neon cold starts
async function connectDatabase(retries = 3, delay = 2000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`🔌 Database connection attempt ${attempt}/${retries}...`);
      await prisma.$connect();
      
      // Warmup query to wake up Neon serverless database
      console.log('🔥 Running warmup query...');
      const warmupStart = Date.now();
      await prisma.$queryRaw`SELECT 1 as connected`;
      console.log(`✅ Database warmup completed in ${Date.now() - warmupStart}ms`);
      
      // Run a simple query to ensure tables are accessible
      const userCount = await prisma.user.count();
      console.log(`✅ Connected to PostgreSQL database (Neon) - ${userCount} users found`);
      
      return true;
    } catch (error) {
      console.error(`❌ Database connection attempt ${attempt} failed:`, error.message);
      
      if (attempt < retries) {
        console.log(`⏳ Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 1.5; // Exponential backoff
      } else {
        console.error('❌ All database connection attempts failed');
        throw error;
      }
    }
  }
}

// Keep connection alive with periodic pings (helps prevent Neon cold starts)
let keepAliveInterval = null;
function startKeepAlive() {
  if (keepAliveInterval) return;
  
  // Ping every 2 minutes to keep Neon database warm (more aggressive to prevent cold starts)
  keepAliveInterval = setInterval(async () => {
    try {
      const start = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      const duration = Date.now() - start;
      if (duration > 1000) {
        console.log(`💓 Database keep-alive ping: ${duration}ms (slow - possible cold start)`);
      }
    } catch (error) {
      console.error('❌ Database keep-alive ping failed:', error.message);
      // Try to reconnect
      try {
        await prisma.$connect();
        console.log('✅ Database reconnected after failed ping');
      } catch (reconnectError) {
        console.error('❌ Database reconnect failed:', reconnectError.message);
      }
    }
  }, 2 * 60 * 1000); // 2 minutes (more aggressive)
  
  console.log('💓 Database keep-alive started (every 2 minutes)');
}

function stopKeepAlive() {
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
    keepAliveInterval = null;
    console.log('💔 Database keep-alive stopped');
  }
}

// Graceful shutdown
async function disconnectDatabase() {
  await prisma.$disconnect();
  console.log('📴 Disconnected from database');
}

// Handle process termination
process.on('beforeExit', async () => {
  await disconnectDatabase();
});

module.exports = {
  prisma,
  connectDatabase,
  disconnectDatabase,
  startKeepAlive,
  stopKeepAlive
};
