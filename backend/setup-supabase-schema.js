/**
 * Setup Supabase Schema
 * 
 * This script runs Prisma migrations on Supabase to create the schema
 * Run this BEFORE the data migration
 * 
 * Usage LOCALLY:
 * cd backend && node setup-supabase-schema.js
 */

const { execSync } = require('child_process');

// Supabase connection - Using eu-west-1 pooler (session mode on port 5432)
// Username format: postgres.projectref for pooler connections
const SUPABASE_URL = 'postgresql://postgres.pewtaqiljwqzzvzcoscf:Bo37zap3BkeWhfom@aws-1-eu-west-1.pooler.supabase.com:5432/postgres';

console.log('🔧 Setting up Supabase database schema...\n');

try {
  // Set Supabase as the target database
  process.env.DATABASE_URL = SUPABASE_URL;
  process.env.DIRECT_DATABASE_URL = SUPABASE_URL;

  console.log('📋 Database URL: Set ✅');
  console.log('📋 Target: Supabase (db.pewtaqiljwqzzvzcoscf.supabase.co)\n');

  console.log('🚀 Running Prisma db push to create schema...\n');
  
  // Use db push instead of migrate to avoid migration history conflicts
  execSync('npx prisma db push --accept-data-loss --skip-generate', {
    stdio: 'inherit',
    env: {
      ...process.env,
      DATABASE_URL: SUPABASE_URL,
      DIRECT_DATABASE_URL: SUPABASE_URL
    }
  });

  console.log('\n✅ Supabase schema created successfully!');
  console.log('📋 Next step: Run the data migration script\n');

} catch (error) {
  console.error('❌ Schema setup failed:', error.message);
  process.exit(1);
}
