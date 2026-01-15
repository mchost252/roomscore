// Prisma Database Client for PostgreSQL (Neon)
const { PrismaClient } = require('@prisma/client');

// Create Prisma client instance with logging and connection pool settings
// Optimized for Neon serverless PostgreSQL
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' 
    ? ['query', 'info', 'warn', 'error'] 
    : ['warn', 'error'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
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
  
  // Ping every 4 minutes to keep Neon database warm (it suspends after 5 mins)
  keepAliveInterval = setInterval(async () => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      console.log('💓 Database keep-alive ping successful');
    } catch (error) {
      console.error('❌ Database keep-alive ping failed:', error.message);
    }
  }, 4 * 60 * 1000); // 4 minutes
  
  console.log('💓 Database keep-alive started (every 4 minutes)');
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
