const cron = require('node-cron');
const NotificationService = require('./notificationService');
const PushNotificationService = require('./pushNotificationService');
const { prisma } = require('../config/database');
const logger = require('../utils/logger');

// Send scheduled notifications every 5 minutes
cron.schedule('*/5 * * * *', async () => {
  try {
    logger.info('Running scheduled notifications job...');
    const count = await NotificationService.sendScheduledNotifications();
    logger.info(`Sent ${count} scheduled notifications`);
  } catch (error) {
    logger.error('Error in scheduled notifications job:', error);
  }
});

// Clean up old notifications daily at 2 AM
cron.schedule('0 2 * * *', async () => {
  try {
    logger.info('Running notification cleanup job...');
    const count = await NotificationService.cleanupOldNotifications(30);
    logger.info(`Cleaned up ${count} old notifications`);
  } catch (error) {
    logger.error('Error in notification cleanup job:', error);
  }
});

// Clean up old chat messages based on room retention settings
cron.schedule('0 3 * * *', async () => {
  try {
    logger.info('Running chat message cleanup job...');
    const rooms = await Room.find({ isActive: true });
    
    let totalDeleted = 0;
    for (const room of rooms) {
      const retentionDays = room.settings.messageRetentionDays || 30;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const result = await ChatMessage.deleteMany({
        roomId: room._id,
        createdAt: { $lt: cutoffDate }
      });

      totalDeleted += result.deletedCount;
    }
    
    logger.info(`Cleaned up ${totalDeleted} old chat messages`);
  } catch (error) {
    logger.error('Error in chat message cleanup job:', error);
  }
});

// Send daily task reminders at 8 AM
cron.schedule('0 8 * * *', async () => {
  try {
    logger.info('Running daily task reminder job...');
    const rooms = await Room.find({ isActive: true }).populate('members.userId');
    
    let reminderCount = 0;
    for (const room of rooms) {
      const today = new Date();
      const dayOfWeek = today.getDay();
      
      // Get today's tasks
      const todayTasks = room.tasks.filter(task => {
        if (!task.isActive) return false;
        if (task.frequency === 'daily') return true;
        if (task.frequency === 'weekly' && task.daysOfWeek.includes(dayOfWeek)) return true;
        if (task.frequency === 'monthly') return true;
        return false;
      });

      // Send reminders to all members
      for (const member of room.members) {
        if (member.userId && member.userId.notificationSettings?.taskReminders) {
          for (const task of todayTasks) {
            // Create in-app notification
            await NotificationService.notifyTaskReminder(
              member.userId._id,
              task,
              room
            );
            
            // Send push notification
            try {
              await PushNotificationService.notifyTaskReminder(
                member.userId._id,
                task.title,
                room.name,
                room._id.toString()
              );
            } catch (pushErr) {
              logger.error('Push notification error for task reminder:', pushErr);
            }
            
            reminderCount++;
          }
        }
      }
    }
    
    logger.info(`Sent ${reminderCount} task reminders`);
  } catch (error) {
    logger.error('Error in task reminder job:', error);
  }
});

// Delete expired rooms daily at 1 AM (cleanup database space)
cron.schedule('0 1 * * *', async () => {
  try {
    logger.info('Running expired rooms cleanup job...');
    const now = new Date();
    
    // Find all rooms that have expired using Prisma
    const expiredRooms = await prisma.room.findMany({
      where: {
        expiresAt: { lte: now }
      },
      include: {
        members: {
          select: { userId: true }
        }
      }
    });
    
    let deletedCount = 0;
    for (const room of expiredRooms) {
      // Get all member IDs for notifications
      const memberIds = room.members
        .map(m => m.userId)
        .filter(Boolean);
      
      // Notify all members that the room has expired BEFORE deleting
      for (const memberId of memberIds) {
        try {
          await NotificationService.createNotification({
            recipientId: memberId,
            type: 'system',
            title: `Room Expired`,
            message: `${room.name} has reached its end date and has been closed`,
            roomId: room.id
          });
        } catch (err) {
          logger.error('Error creating room expired notification:', err);
        }
      }
      
      // DELETE all related data in a transaction to save database space
      try {
        await prisma.$transaction(async (tx) => {
          // Delete task completions for this room
          await tx.taskCompletion.deleteMany({
            where: { roomId: room.id }
          });

          // Delete user room progress
          await tx.userRoomProgress.deleteMany({
            where: { roomId: room.id }
          });

          // Delete room tasks
          await tx.roomTask.deleteMany({
            where: { roomId: room.id }
          });

          // Delete chat messages
          await tx.chatMessage.deleteMany({
            where: { roomId: room.id }
          });

          // Delete room members
          await tx.roomMember.deleteMany({
            where: { roomId: room.id }
          });

          // Delete appreciations related to this room
          await tx.appreciation.deleteMany({
            where: { roomId: room.id }
          });

          // Delete nudges related to this room
          await tx.nudge.deleteMany({
            where: { roomId: room.id }
          });

          // Finally, delete the room itself
          await tx.room.delete({
            where: { id: room.id }
          });
        });
        
        deletedCount++;
        logger.info(`Deleted expired room and all related data: ${room.name}`);
      } catch (txErr) {
        logger.error(`Error deleting expired room ${room.name}:`, txErr);
      }
    }
    
    logger.info(`Deleted ${deletedCount} expired rooms and their data`);
  } catch (error) {
    logger.error('Error in expired rooms cleanup job:', error);
  }
});

// Warn rooms expiring soon (3 days before) - daily at 9 AM
cron.schedule('0 9 * * *', async () => {
  try {
    logger.info('Running room expiry warning job...');
    const now = new Date();
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const twoDaysFromNow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
    
    // Find rooms expiring in ~3 days (between 2-3 days from now to avoid duplicate warnings)
    const expiringRooms = await Room.find({
      isActive: true,
      expiresAt: { 
        $gte: twoDaysFromNow,
        $lte: threeDaysFromNow 
      }
    }).populate('members.userId', '_id');
    
    let warnedCount = 0;
    for (const room of expiringRooms) {
      // Get owner ID for notification
      const ownerId = room.owner.toString();
      
      try {
        await NotificationService.createNotification({
          userId: ownerId,
          type: 'room_expiring_soon',
          title: `Room Expiring Soon`,
          message: `${room.name} will expire in 3 days`,
          relatedRoom: room._id
        });
        warnedCount++;
      } catch (err) {
        logger.error('Error creating room expiry warning notification:', err);
      }
    }
    
    logger.info(`Sent ${warnedCount} room expiry warnings`);
  } catch (error) {
    logger.error('Error in room expiry warning job:', error);
  }
});

// Update user and room streaks daily at midnight UTC
// This resets streaks for users/rooms that had no activity yesterday
cron.schedule('0 0 * * *', async () => {
  try {
    logger.info('Running daily streak update job...');
    
    const yesterdayStr = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const twoDaysAgoStr = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    // Get all active rooms with their members
    const rooms = await prisma.room.findMany({
      where: { isActive: true },
      include: {
        members: {
          where: { status: 'active' },
          include: { user: true }
        }
      }
    });
    
    let usersUpdated = 0;
    let roomsUpdated = 0;
    
    for (const room of rooms) {
      let roomHadActivityYesterday = false;
      
      // Process each member's streak
      for (const member of room.members) {
        try {
          // Check if user completed any tasks yesterday in this room
          const completionsYesterday = await prisma.taskCompletion.count({
            where: {
              userId: member.userId,
              roomId: room.id,
              completionDate: yesterdayStr
            }
          });
          
          if (completionsYesterday > 0) {
            roomHadActivityYesterday = true;
          } else {
            // Check if user had a streak and needs reset
            const userProgress = await prisma.userRoomProgress.findUnique({
              where: {
                userId_roomId: { userId: member.userId, roomId: room.id }
              }
            });
            
            if (userProgress && userProgress.currentStreak > 0) {
              // Check if last completion was before yesterday (missed yesterday)
              const lastCompletionDate = userProgress.lastCompletionDate;
              if (lastCompletionDate) {
                const lastDateStr = lastCompletionDate.toISOString().split('T')[0];
                if (lastDateStr < yesterdayStr) {
                  // Reset streak
                  await prisma.userRoomProgress.update({
                    where: { id: userProgress.id },
                    data: { currentStreak: 0 }
                  });
                  usersUpdated++;
                  logger.info(`❌ User ${member.user.username} room streak reset in ${room.name}`);
                }
              }
            }
            
            // Also check and reset global user streak if needed
            if (member.user.streak > 0) {
              const lastStreakDate = member.user.lastStreakDate;
              if (lastStreakDate) {
                const lastDateStr = lastStreakDate.toISOString().split('T')[0];
                if (lastDateStr < yesterdayStr) {
                  await prisma.user.update({
                    where: { id: member.userId },
                    data: { streak: 0 }
                  });
                  logger.info(`❌ User ${member.user.username} global streak reset`);
                }
              }
            }
          }
        } catch (userError) {
          logger.error(`Error processing streak for user ${member.userId}:`, userError);
        }
      }
      
      // Update room streak if no activity yesterday
      if (!roomHadActivityYesterday && room.streak > 0) {
        const lastActivityDate = room.lastActivityDate;
        if (lastActivityDate) {
          const lastDateStr = lastActivityDate.toISOString().split('T')[0];
          if (lastDateStr < yesterdayStr) {
            await prisma.room.update({
              where: { id: room.id },
              data: { streak: 0 }
            });
            roomsUpdated++;
            logger.info(`❌ Room ${room.name} streak reset (no activity yesterday)`);
            
            // Create system message
            await prisma.chatMessage.create({
              data: {
                roomId: room.id,
                content: '🌑 Orbit dimmed — no activity yesterday',
                type: 'system'
              }
            });
          }
        }
      }
    }
    
    logger.info(`Streak update complete: ${usersUpdated} users, ${roomsUpdated} rooms updated`);
  } catch (error) {
    logger.error('Error in daily streak update job:', error);
  }
});

logger.info('Cron jobs initialized');

module.exports = {};
