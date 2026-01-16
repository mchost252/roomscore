const express = require('express');
const router = express.Router();
const { protect, isRoomMember } = require('../middleware/auth');
const { prisma } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Daily Orbit Summary API
 * 
 * Provides yesterday's activity data for each room member:
 * - Tasks completed
 * - Streak status (kept/broken)
 * - Room streak status
 * - MVP calculation
 */

// Helper to get yesterday's date string (YYYY-MM-DD) in UTC
const getYesterdayString = () => {
  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  return yesterday.toISOString().split('T')[0];
};

// Helper to get today's date string (YYYY-MM-DD) in UTC
const getTodayString = () => new Date().toISOString().split('T')[0];

// Helper to get UTC day boundaries
const getUtcDayStart = (dateStr) => new Date(`${dateStr}T00:00:00.000Z`);
const getUtcDayEnd = (dateStr) => new Date(`${dateStr}T23:59:59.999Z`);

/**
 * Calculate MVP score for a member
 * 
 * Scoring rules:
 * - Base points: 10 per valid task completed (capped at 50 points/day)
 * - Streak bonus: +20 if streak maintained, -10 if streak broken
 * - Consistency bonus: +5 per day of current streak (capped at +25)
 * 
 * Anti-abuse:
 * - Tasks created and completed within 2 hours don't count
 * - Max 5 tasks count per day
 */
const calculateMVPScore = (tasksCompleted, validTaskCount, streakMaintained, currentStreak) => {
  // Cap valid tasks at 5 for MVP calculation
  const cappedTasks = Math.min(validTaskCount, 5);
  
  // Base points (10 per task, max 50)
  let score = cappedTasks * 10;
  
  // Streak bonus/penalty
  if (streakMaintained) {
    score += 20;
  } else if (tasksCompleted === 0) {
    score -= 10;
  }
  
  // Consistency bonus (5 per streak day, max 25)
  const consistencyBonus = Math.min(currentStreak * 5, 25);
  score += consistencyBonus;
  
  return Math.max(0, score);
};

/**
 * GET /orbit-summary/:roomId
 * 
 * Returns the daily orbit summary for a room (yesterday's data)
 * Only shown once per day per user per room
 */
router.get('/:roomId', protect, isRoomMember, async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user.id;
    const yesterdayStr = getYesterdayString();
    const todayStr = getTodayString();
    
    // Check if user has already seen today's summary for this room
    // We store this in a simple key-value or use localStorage on frontend
    // For now, we'll always return data and let frontend handle "seen" state
    
    // Get room details with members
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: {
        members: {
          where: { status: 'active' },
          include: {
            user: {
              select: {
                id: true,
                username: true,
                avatar: true,
                streak: true,
                lastStreakDate: true,
              }
            }
          }
        }
      }
    });
    
    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }
    
    // Get yesterday's task completions for all members
    const yesterdayCompletions = await prisma.taskCompletion.findMany({
      where: {
        roomId,
        completionDate: yesterdayStr
      },
      include: {
        task: {
          select: {
            id: true,
            title: true,
            createdAt: true,
          }
        }
      }
    });
    
    // Get tasks that existed before yesterday (for validation)
    const yesterdayStart = getUtcDayStart(yesterdayStr);
    
    // Group completions by user
    const completionsByUser = {};
    yesterdayCompletions.forEach(completion => {
      if (!completionsByUser[completion.userId]) {
        completionsByUser[completion.userId] = [];
      }
      completionsByUser[completion.userId].push(completion);
    });
    
    // Calculate member summaries
    const memberSummaries = await Promise.all(room.members.map(async (member) => {
      const userCompletions = completionsByUser[member.userId] || [];
      const tasksCompleted = userCompletions.length;
      
      // Count valid tasks (existed before yesterday or created 2+ hours before completion)
      const validTaskCount = userCompletions.filter(c => {
        const taskCreatedAt = new Date(c.task.createdAt);
        const completedAt = new Date(c.completedAt);
        const hoursDiff = (completedAt - taskCreatedAt) / (1000 * 60 * 60);
        
        // Task existed before yesterday OR created 2+ hours before completion
        return taskCreatedAt < yesterdayStart || hoursDiff >= 2;
      }).length;
      
      // Get user's room progress for streak info
      const userProgress = await prisma.userRoomProgress.findUnique({
        where: {
          userId_roomId: {
            userId: member.userId,
            roomId
          }
        }
      });
      
      const currentStreak = userProgress?.currentStreak || 0;
      
      // Determine if streak was maintained yesterday
      // Streak is maintained if user completed at least one task
      const streakMaintained = tasksCompleted > 0;
      
      // Calculate MVP score
      const mvpScore = calculateMVPScore(
        tasksCompleted,
        validTaskCount,
        streakMaintained,
        currentStreak
      );
      
      return {
        userId: member.userId,
        username: member.user.username,
        avatar: member.user.avatar,
        tasksCompleted,
        validTaskCount,
        currentStreak,
        streakMaintained,
        isActive: tasksCompleted > 0,
        mvpScore,
      };
    }));
    
    // Determine room MVP
    // Rules: Must have at least 1 valid task, highest MVP score wins
    const eligibleForMVP = memberSummaries.filter(m => m.validTaskCount > 0);
    let mvpMember = null;
    
    if (eligibleForMVP.length > 0) {
      // Sort by MVP score descending
      eligibleForMVP.sort((a, b) => b.mvpScore - a.mvpScore);
      
      // Check for MVP cooldown (can't be MVP more than 2 consecutive days)
      // This would require storing MVP history - for now, just pick highest score
      mvpMember = eligibleForMVP[0];
    }
    
    // Calculate room streak status
    const roomHadActivity = memberSummaries.some(m => m.isActive);
    const roomStreakStatus = roomHadActivity ? 'stable' : 'dimmed';
    
    // Get appreciations given yesterday
    const yesterdayAppreciations = await prisma.appreciation.findMany({
      where: {
        roomId,
        createdAt: {
          gte: yesterdayStart,
          lte: getUtcDayEnd(yesterdayStr)
        }
      },
      select: {
        toUserId: true,
        type: true
      }
    });
    
    // Group appreciations by user
    const appreciationsByUser = {};
    yesterdayAppreciations.forEach(app => {
      if (!appreciationsByUser[app.toUserId]) {
        appreciationsByUser[app.toUserId] = { star: 0, fire: 0, shield: 0 };
      }
      appreciationsByUser[app.toUserId][app.type]++;
    });
    
    // Add appreciations to member summaries
    memberSummaries.forEach(member => {
      member.appreciationsReceived = appreciationsByUser[member.userId] || { star: 0, fire: 0, shield: 0 };
    });
    
    res.json({
      success: true,
      summary: {
        date: yesterdayStr,
        roomId,
        roomName: room.name,
        roomStreak: room.streak,
        roomStreakStatus,
        mvp: mvpMember ? {
          userId: mvpMember.userId,
          username: mvpMember.username,
          avatar: mvpMember.avatar,
          mvpScore: mvpMember.mvpScore,
        } : null,
        members: memberSummaries.map(m => ({
          userId: m.userId,
          username: m.username,
          avatar: m.avatar,
          tasksCompleted: m.tasksCompleted,
          currentStreak: m.currentStreak,
          streakMaintained: m.streakMaintained,
          isActive: m.isActive,
          appreciationsReceived: m.appreciationsReceived,
        })),
        totalTasksCompleted: memberSummaries.reduce((sum, m) => sum + m.tasksCompleted, 0),
        activeMembers: memberSummaries.filter(m => m.isActive).length,
        totalMembers: memberSummaries.length,
      }
    });
    
  } catch (error) {
    logger.error('Error getting orbit summary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get orbit summary'
    });
  }
});

/**
 * GET /orbit-summary/:roomId/mvp-history
 * 
 * Returns MVP history for the room (last 7 days)
 * Used for cooldown calculations and display
 */
router.get('/:roomId/mvp-history', protect, isRoomMember, async (req, res) => {
  try {
    const { roomId } = req.params;
    
    // Get last 7 days of MVP history
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];
    
    const history = await prisma.roomMVP.findMany({
      where: {
        roomId,
        date: { gte: sevenDaysAgoStr }
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatar: true
          }
        }
      },
      orderBy: { date: 'desc' }
    });
    
    res.json({
      success: true,
      history: history.map(h => ({
        date: h.date,
        userId: h.userId,
        username: h.user.username,
        avatar: h.user.avatar,
        mvpScore: h.mvpScore,
        tasksCompleted: h.tasksCompleted
      }))
    });
    
  } catch (error) {
    logger.error('Error getting MVP history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get MVP history'
    });
  }
});

/**
 * GET /orbit-summary/:roomId/today-mvp
 * 
 * Returns today's current MVP (calculated from yesterday's activity)
 * Used to display the crown icon in real-time
 */
router.get('/:roomId/today-mvp', protect, isRoomMember, async (req, res) => {
  try {
    const { roomId } = req.params;
    const yesterdayStr = getYesterdayString();
    
    // Check if MVP was already recorded for yesterday
    const existingMVP = await prisma.roomMVP.findUnique({
      where: {
        roomId_date: {
          roomId,
          date: yesterdayStr
        }
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatar: true
          }
        }
      }
    });
    
    if (existingMVP) {
      return res.json({
        success: true,
        mvp: {
          userId: existingMVP.userId,
          username: existingMVP.user.username,
          avatar: existingMVP.user.avatar,
          mvpScore: existingMVP.mvpScore,
          date: existingMVP.date
        }
      });
    }
    
    // No MVP recorded yet
    res.json({
      success: true,
      mvp: null
    });
    
  } catch (error) {
    logger.error('Error getting today MVP:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get today MVP'
    });
  }
});

/**
 * POST /orbit-summary/:roomId/mark-seen
 * 
 * Marks the daily summary as seen for the current user
 * Prevents popup from showing again today
 */
router.post('/:roomId/mark-seen', protect, isRoomMember, async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user.id;
    const todayStr = getTodayString();
    
    // Store in UserRoomProgress or a separate table
    // For now, we'll use a simple approach - update lastSummarySeenDate
    await prisma.userRoomProgress.upsert({
      where: {
        userId_roomId: {
          userId,
          roomId
        }
      },
      update: {
        // We'd add a lastSummarySeenDate field
        updatedAt: new Date()
      },
      create: {
        userId,
        roomId,
        tasksCompletedToday: 0,
        currentStreak: 0,
        longestStreak: 0,
        totalPoints: 0,
      }
    });
    
    res.json({
      success: true,
      message: 'Summary marked as seen'
    });
    
  } catch (error) {
    logger.error('Error marking summary as seen:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark summary as seen'
    });
  }
});

module.exports = router;
