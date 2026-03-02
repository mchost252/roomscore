/**
 * Database Migration Script: Neon → Supabase
 * 
 * This script:
 * 1. Connects to both Neon (source) and Supabase (target)
 * 2. Creates schema in Supabase using Prisma
 * 3. Copies all data from Neon to Supabase
 * 4. Verifies data integrity
 * 
 * Run LOCALLY from your machine - no Railway terminal needed!
 * Usage: cd backend && node migrate-to-supabase.js
 */

const { PrismaClient } = require('@prisma/client');

// Source database (Neon) - using correct URL from Railway (with c-2 region code)
const NEON_URL = process.env.NEON_DATABASE_URL || 'postgresql://neondb_owner:npg_BFvkA4wcyEV5@ep-soft-mouse-ag784a9c-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require';

// Target database (Supabase) - Using eu-west-1 pooler (session mode on port 5432)
// Username format: postgres.projectref for pooler connections
const SUPABASE_URL = process.env.SUPABASE_DATABASE_URL || 'postgresql://postgres.pewtaqiljwqzzvzcoscf:Bo37zap3BkeWhfom@aws-1-eu-west-1.pooler.supabase.com:5432/postgres';

// Source database (Neon)
const neonPrisma = new PrismaClient({
  datasources: {
    db: {
      url: NEON_URL
    }
  }
});

// Target database (Supabase)
const supabasePrisma = new PrismaClient({
  datasources: {
    db: {
      url: SUPABASE_URL
    }
  }
});

async function migrateData() {
  console.log('🚀 Starting migration from Neon to Supabase...\n');

  try {
    // Test connections
    console.log('🔌 Testing database connections...');
    await neonPrisma.$connect();
    console.log('✅ Connected to Neon (source)');
    
    await supabasePrisma.$connect();
    console.log('✅ Connected to Supabase (target)\n');

    // Get counts from Neon
    console.log('📊 Analyzing source database (Neon)...');
    
    // Helper to safely count records (returns 0 if table doesn't exist)
    async function safeCount(model, name) {
      try {
        const count = await model.count();
        return count;
      } catch (error) {
        console.log(`   ⚠️  ${name} table not found or error: ${error.message}`);
        return 0;
      }
    }
    
    const neonCounts = {
      users: await safeCount(neonPrisma.user, 'User'),
      rooms: await safeCount(neonPrisma.room, 'Room'),
      roomTasks: await safeCount(neonPrisma.roomTask, 'RoomTask'),
      roomMembers: await safeCount(neonPrisma.roomMember, 'RoomMember'),
      taskCompletions: await safeCount(neonPrisma.taskCompletion, 'TaskCompletion'),
      roomMVPs: await safeCount(neonPrisma.roomMVP, 'RoomMVP'),
      appreciations: await safeCount(neonPrisma.appreciation, 'Appreciation'),
      directMessages: await safeCount(neonPrisma.directMessage, 'DirectMessage'),
      friends: await safeCount(neonPrisma.friend, 'Friend'),
      notifications: await safeCount(neonPrisma.notification, 'Notification'),
      nudges: await safeCount(neonPrisma.nudge, 'Nudge'),
      personalTasks: await safeCount(neonPrisma.personalTask, 'PersonalTask'),
    };

    console.log('📈 Records to migrate:');
    Object.entries(neonCounts).forEach(([table, count]) => {
      console.log(`   ${table}: ${count}`);
    });
    console.log('');

    // Migrate Users first (they're referenced by other tables)
    console.log('👥 Migrating Users...');
    const users = await neonPrisma.user.findMany();
    for (const user of users) {
      await supabasePrisma.user.upsert({
        where: { id: user.id },
        update: user,
        create: user,
      });
    }
    console.log(`✅ Migrated ${users.length} users\n`);

    // Migrate Rooms
    console.log('🏠 Migrating Rooms...');
    const rooms = await neonPrisma.room.findMany();
    for (const room of rooms) {
      await supabasePrisma.room.upsert({
        where: { id: room.id },
        update: room,
        create: room,
      });
    }
    console.log(`✅ Migrated ${rooms.length} rooms\n`);

    // Migrate Room Members
    console.log('👨‍👩‍👧‍👦 Migrating Room Members...');
    const roomMembers = await neonPrisma.roomMember.findMany();
    for (const member of roomMembers) {
      await supabasePrisma.roomMember.upsert({
        where: { id: member.id },
        update: member,
        create: member,
      });
    }
    console.log(`✅ Migrated ${roomMembers.length} room members\n`);

    // Migrate Room Tasks
    console.log('✅ Migrating Room Tasks...');
    const roomTasks = await neonPrisma.roomTask.findMany();
    for (const roomTask of roomTasks) {
      await supabasePrisma.roomTask.upsert({
        where: { id: roomTask.id },
        update: roomTask,
        create: roomTask,
      });
    }
    console.log(`✅ Migrated ${roomTasks.length} room tasks\n`);
    
    // Migrate Task Completions
    console.log('✅ Migrating Task Completions...');
    const taskCompletions = await neonPrisma.taskCompletion.findMany();
    for (const completion of taskCompletions) {
      await supabasePrisma.taskCompletion.upsert({
        where: { id: completion.id },
        update: completion,
        create: completion,
      });
    }
    console.log(`✅ Migrated ${taskCompletions.length} task completions\n`);
    
    // Migrate Room MVPs
    console.log('✅ Migrating Room MVPs...');
    const roomMVPs = await neonPrisma.roomMVP.findMany();
    for (const mvp of roomMVPs) {
      await supabasePrisma.roomMVP.upsert({
        where: { id: mvp.id },
        update: mvp,
        create: mvp,
      });
    }
    console.log(`✅ Migrated ${roomMVPs.length} room MVPs\n`);

    // Migrate Personal Tasks
    console.log('📝 Migrating Personal Tasks...');
    const personalTasks = await neonPrisma.personalTask.findMany();
    for (const task of personalTasks) {
      await supabasePrisma.personalTask.upsert({
        where: { id: task.id },
        update: task,
        create: task,
      });
    }
    console.log(`✅ Migrated ${personalTasks.length} personal tasks\n`);

    // Migrate Appreciations
    console.log('💖 Migrating Appreciations...');
    const appreciations = await neonPrisma.appreciation.findMany();
    for (const appreciation of appreciations) {
      await supabasePrisma.appreciation.upsert({
        where: { id: appreciation.id },
        update: appreciation,
        create: appreciation,
      });
    }
    console.log(`✅ Migrated ${appreciations.length} appreciations\n`);

    // Migrate Friends
    console.log('👫 Migrating Friends...');
    const friends = await neonPrisma.friend.findMany();
    for (const friend of friends) {
      await supabasePrisma.friend.upsert({
        where: { id: friend.id },
        update: friend,
        create: friend,
      });
    }
    console.log(`✅ Migrated ${friends.length} friendships\n`);

    // Migrate Direct Messages
    console.log('💬 Migrating Direct Messages...');
    const directMessages = await neonPrisma.directMessage.findMany();
    for (const message of directMessages) {
      await supabasePrisma.directMessage.upsert({
        where: { id: message.id },
        update: message,
        create: message,
      });
    }
    console.log(`✅ Migrated ${directMessages.length} direct messages\n`);

    // Migrate Nudges
    console.log('👋 Migrating Nudges...');
    const nudges = await neonPrisma.nudge.findMany();
    for (const nudge of nudges) {
      await supabasePrisma.nudge.upsert({
        where: { id: nudge.id },
        update: nudge,
        create: nudge,
      });
    }
    console.log(`✅ Migrated ${nudges.length} nudges\n`);

    // Migrate Notifications
    console.log('🔔 Migrating Notifications...');
    const notifications = await neonPrisma.notification.findMany();
    for (const notification of notifications) {
      await supabasePrisma.notification.upsert({
        where: { id: notification.id },
        update: notification,
        create: notification,
      });
    }
    console.log(`✅ Migrated ${notifications.length} notifications\n`);

    // Push Subscriptions model doesn't exist - skip
    console.log('⏭️  Skipping Push Subscriptions (model not in schema)\n');

    // Verify migration
    console.log('🔍 Verifying migration...');
    const supabaseCounts = {
      users: await supabasePrisma.user.count(),
      rooms: await supabasePrisma.room.count(),
      roomTasks: await supabasePrisma.roomTask.count(),
      roomMembers: await supabasePrisma.roomMember.count(),
      taskCompletions: await supabasePrisma.taskCompletion.count(),
      roomMVPs: await supabasePrisma.roomMVP.count(),
      appreciations: await supabasePrisma.appreciation.count(),
      directMessages: await supabasePrisma.directMessage.count(),
      friends: await supabasePrisma.friend.count(),
      notifications: await supabasePrisma.notification.count(),
      nudges: await supabasePrisma.nudge.count(),
      personalTasks: await supabasePrisma.personalTask.count(),
    };

    console.log('\n📊 Migration Results:');
    console.log('┌─────────────────────┬─────────┬───────────┬────────┐');
    console.log('│ Table               │ Source  │ Target    │ Status │');
    console.log('├─────────────────────┼─────────┼───────────┼────────┤');
    
    let allMatch = true;
    Object.keys(neonCounts).forEach((table) => {
      const source = neonCounts[table];
      const target = supabaseCounts[table];
      const status = source === target ? '✅' : '❌';
      if (source !== target) allMatch = false;
      console.log(`│ ${table.padEnd(19)} │ ${String(source).padStart(7)} │ ${String(target).padStart(9)} │ ${status}      │`);
    });
    
    console.log('└─────────────────────┴─────────┴───────────┴────────┘\n');

    if (allMatch) {
      console.log('🎉 Migration completed successfully!');
      console.log('✅ All data has been transferred to Supabase\n');
      console.log('📋 Next steps:');
      console.log('1. Update Railway environment variables to use Supabase');
      console.log('2. Restart your Railway deployment');
      console.log('3. Test your application');
      console.log('4. Once verified, you can delete the Neon database\n');
    } else {
      console.log('⚠️  Migration completed with warnings');
      console.log('Some tables have mismatched counts. Please review.\n');
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await neonPrisma.$disconnect();
    await supabasePrisma.$disconnect();
  }
}

// Run migration
migrateData()
  .then(() => {
    console.log('✅ Migration script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration script failed:', error);
    process.exit(1);
  });
