// Prisma Database Client for PostgreSQL (Neon)
const { PrismaClient } = require('@prisma/client');

// Create Prisma client instance with logging and connection pool settings
// Optimized for Neon serverless PostgreSQL
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' 
    ? ['query', 'info', 'warn', 'error'] 
    : ['error'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
});

// Ensure single instance in development (avoid connection pool exhaustion)
const globalForPrisma = global;
if (process.env.NODE_ENV !== 'production') {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = prisma;
  }
}

// Connection test function
async function connectDatabase() {
  try {
    await prisma.$connect();
    console.log('✅ Connected to PostgreSQL database (Neon)');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    throw error;
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
  disconnectDatabase
};
