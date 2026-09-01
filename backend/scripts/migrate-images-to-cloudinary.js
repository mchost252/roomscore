require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const cloudinaryService = require('./services/cloudinaryService');
const logger = require('./utils/logger');

const prisma = new PrismaClient();
const BATCH_SIZE = 100;

async function migrateAvatars() {
  let skip = 0;
  let totalMigrated = 0;
  let totalSkipped = 0;
  let totalFailed = 0;

  while (true) {
    const users = await prisma.user.findMany({
      skip,
      take: BATCH_SIZE,
      where: {
        avatar: {
          not: null,
          startsWith: 'data:',
        },
      },
    });

    if (users.length === 0) break;

    for (const user of users) {
      try {
        logger.info(`Migrating avatar for user ${user.id}...`);
        const cloudinaryUrl = await cloudinaryService.migrateBase64ToCloudinary(
          user.avatar,
          `krios/avatars/${user.id}`
        );
        await prisma.user.update({
          where: { id: user.id },
          data: { avatar: cloudinaryUrl },
        });
        totalMigrated++;
      } catch (error) {
        logger.error(`Failed to migrate avatar for user ${user.id}:`, error.message);
        totalFailed++;
      }
    }

    skip += BATCH_SIZE;
    logger.info(`Processed ${skip} users for avatar migration...`);
  }

  return { totalMigrated, totalSkipped, totalFailed };
}

async function migrateMediaUrls() {
  let skip = 0;
  let totalMigrated = 0;
  let totalSkipped = 0;
  let totalFailed = 0;

  while (true) {
    const nodes = await prisma.roomTaskNode.findMany({
      skip,
      take: BATCH_SIZE,
      where: {
        mediaUrl: {
          not: null,
          startsWith: 'data:',
        },
      },
    });

    if (nodes.length === 0) break;

    for (const node of nodes) {
      try {
        logger.info(
          `Migrating mediaUrl for node ${node.id} in task ${node.taskId}...`
        );
        const cloudinaryUrl = await cloudinaryService.migrateBase64ToCloudinary(
          node.mediaUrl,
          `krios/proofs/${node.roomId}/${node.taskId}`
        );
        await prisma.roomTaskNode.update({
          where: { id: node.id },
          data: { mediaUrl: cloudinaryUrl },
        });
        totalMigrated++;
      } catch (error) {
        logger.error(
          `Failed to migrate mediaUrl for node ${node.id}:`,
          error.message
        );
        totalFailed++;
      }
    }

    skip += BATCH_SIZE;
    logger.info(`Processed ${skip} nodes for mediaUrl migration...`);
  }

  return { totalMigrated, totalSkipped, totalFailed };
}

async function main() {
  logger.info('Starting Cloudinary migration...');
  logger.info('Cloud:', process.env.CLOUDINARY_CLOUD_NAME);

  const avatarResult = await migrateAvatars();
  const mediaResult = await migrateMediaUrls();

  logger.info('Avatar migration complete:', avatarResult);
  logger.info('Media URL migration complete:', mediaResult);

  const totalMigrated = avatarResult.totalMigrated + mediaResult.totalMigrated;
  const totalFailed = avatarResult.totalFailed + mediaResult.totalFailed;
  logger.info(`Total migrated: ${totalMigrated}, Total failed: ${totalFailed}`);
}

main()
  .catch((err) => {
    logger.error('Migration failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
