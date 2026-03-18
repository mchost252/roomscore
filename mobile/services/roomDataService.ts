/**
 * Room Data Service - Local-First Architecture
 * Handles SQLite operations for Room UI enhancements
 * Includes 5-day retention "Janitor" and Delta-Sync strategy
 */

import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  EnhancedRoom,
  EnhancedRoomTask,
  UserAura,
  TaskProof,
  WeeklySprint,
  SprintBadge,
  RoomSystemMessage,
  PinnedImage,
  TaskChallenge,
  AuraLevel,
} from '../types';

// Constants
const DB_NAME = 'krios_rooms.db';
const RETENTION_DAYS = 5;
const GHOST_APPROVAL_HOURS = 4;
const CHALLENGE_HOURS = 12;
const BADGE_DEFENSE_DAYS = 7;

// Aura configuration - pre-cached for performance
export const AURA_CONFIG: Record<AuraLevel, { color: string; voteWeight: number; minScore: number }> = {
  bronze: { color: '#cd7f32', voteWeight: 1, minScore: 0 },
  silver: { color: '#c0c0c0', voteWeight: 2, minScore: 25 },
  gold: { color: '#ffd700', voteWeight: 3, minScore: 50 },
  platinum: { color: '#e5e4e2', voteWeight: 5, minScore: 80 },
};

class RoomDataService {
  private db: SQLite.SQLiteDatabase | null = null;
  private initialized = false;

  // In-memory cache for quick access
  private cache: {
    rooms: Map<string, EnhancedRoom>;
    tasks: Map<string, EnhancedRoomTask[]>;
    auras: Map<string, UserAura>;
    sprints: Map<string, WeeklySprint>;
  } = {
    rooms: new Map(),
    tasks: new Map(),
    auras: new Map(),
    sprints: new Map(),
  };

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Use in-memory for web
    if (Platform.OS === 'web') {
      console.log('[RoomDataService] Web mode - using memory only');
      this.initialized = true;
      return;
    }

    try {
      this.db = await SQLite.openDatabaseAsync(DB_NAME);
      await this.createTables();
      this.initialized = true;
      console.log('[RoomDataService] SQLite initialized');
      
      // Run Janitor on startup
      await this.runJanitor();
    } catch (error) {
      console.error('[RoomDataService] Init failed:', error);
      // Fall back to memory-only
      this.initialized = true;
    }
  }

  private async createTables(): Promise<void> {
    if (!this.db) return;

    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS rooms (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        code TEXT NOT NULL,
        ownerId TEXT NOT NULL,
        createdAt INTEGER NOT NULL,
        expiresAt INTEGER,
        isPremium INTEGER DEFAULT 0,
        memberCount INTEGER DEFAULT 0,
        taskCount INTEGER DEFAULT 0,
        isFlipped INTEGER DEFAULT 0,
        updatedAt INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        roomId TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'spectator',
        deadline INTEGER,
        points INTEGER DEFAULT 0,
        participants TEXT DEFAULT '[]',
        viewerIds TEXT DEFAULT '[]',
        heatLevel INTEGER DEFAULT 0,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL,
        FOREIGN KEY (roomId) REFERENCES rooms(id)
      );

      CREATE TABLE IF NOT EXISTS proofs (
        id TEXT PRIMARY KEY,
        taskId TEXT NOT NULL,
        userId TEXT NOT NULL,
        imageUrl TEXT NOT NULL,
        submittedAt INTEGER NOT NULL,
        status TEXT DEFAULT 'pending',
        challengeExpiresAt INTEGER,
        reviewedBy TEXT,
        reviewedAt INTEGER,
        FOREIGN KEY (taskId) REFERENCES tasks(id)
      );

      CREATE TABLE IF NOT EXISTS auras (
        userId TEXT PRIMARY KEY,
        aura TEXT NOT NULL,
        auraScore INTEGER DEFAULT 0,
        voteWeight INTEGER DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS sprints (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        startDate INTEGER NOT NULL,
        endDate INTEGER NOT NULL,
        points INTEGER DEFAULT 0,
        rank INTEGER,
        badges TEXT DEFAULT '[]'
      );

      CREATE TABLE IF NOT EXISTS system_messages (
        id TEXT PRIMARY KEY,
        roomId TEXT NOT NULL,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        createdAt INTEGER NOT NULL,
        metadata TEXT,
        FOREIGN KEY (roomId) REFERENCES rooms(id)
      );

      CREATE TABLE IF NOT EXISTS pinned_images (
        id TEXT PRIMARY KEY,
        taskId TEXT NOT NULL,
        imageUrl TEXT NOT NULL,
        thumbnailUrl TEXT NOT NULL,
        uploadedBy TEXT NOT NULL,
        uploadedAt INTEGER NOT NULL,
        FOREIGN KEY (taskId) REFERENCES tasks(id)
      );

      CREATE TABLE IF NOT EXISTS challenges (
        id TEXT PRIMARY KEY,
        proofId TEXT NOT NULL,
        challengedBy TEXT NOT NULL,
        challengedAt INTEGER NOT NULL,
        reason TEXT NOT NULL,
        status TEXT DEFAULT 'active',
        resolvedBy TEXT,
        resolvedAt INTEGER,
        resolution TEXT,
        FOREIGN KEY (proofId) REFERENCES proofs(id)
      );

      CREATE INDEX IF NOT EXISTS idx_tasks_roomId ON tasks(roomId);
      CREATE INDEX IF NOT EXISTS idx_proofs_taskId ON proofs(taskId);
      CREATE INDEX IF NOT EXISTS idx_system_messages_roomId ON system_messages(roomId);
      CREATE INDEX IF NOT EXISTS idx_pinned_images_taskId ON pinned_images(taskId);
    `);
  }

  // ═══════════════════════════════════════════════════════════
  // JANITOR - 5 Day Retention Policy
  // ═══════════════════════════════════════════════════════════

  async runJanitor(): Promise<number> {
    const cutoffTime = Date.now() - (RETENTION_DAYS * 24 * 60 * 60 * 1000);
    let deletedCount = 0;

    if (!this.db) return deletedCount;

    try {
      // Delete old system messages
      const msgResult = await this.db.runAsync(
        'DELETE FROM system_messages WHERE createdAt < ?',
        [cutoffTime]
      );
      deletedCount += msgResult.changes;

      // Delete old pinned images
      const imgResult = await this.db.runAsync(
        'DELETE FROM pinned_images WHERE uploadedAt < ?',
        [cutoffTime]
      );
      deletedCount += imgResult.changes;

      // Delete old challenges
      const challengeResult = await this.db.runAsync(
        'DELETE FROM challenges WHERE challengedAt < ?',
        [cutoffTime]
      );
      deletedCount += challengeResult.changes;

      console.log(`[Janitor] Deleted ${deletedCount} old records (older than ${RETENTION_DAYS} days)`);
    } catch (error) {
      console.error('[Janitor] Error:', error);
    }

    return deletedCount;
  }

  // ═══════════════════════════════════════════════════════════
  // GHOST APPROVAL SYSTEM
  // ═══════════════════════════════════════════════════════════

  async processGhostApprovals(): Promise<string[]> {
    if (!this.db) return [];
    
    const now = Date.now();
    const ghostCutoff = now - (GHOST_APPROVAL_HOURS * 60 * 60 * 1000);
    const autoApprovedIds: string[] = [];

    try {
      // Find pending proofs older than GHOST_APPROVAL_HOURS
      const pendingProofs = await this.db.getAllAsync<{ id: string; taskId: string }>(
        'SELECT id, taskId FROM proofs WHERE status = ? AND submittedAt < ?',
        ['pending', ghostCutoff]
      );

      for (const proof of pendingProofs) {
        // Auto-approve
        await this.db.runAsync(
          'UPDATE proofs SET status = ?, challengeExpiresAt = ? WHERE id = ?',
          ['auto_approved', now + (CHALLENGE_HOURS * 60 * 60 * 1000), proof.id]
        );
        autoApprovedIds.push(proof.id);

        // Update task heat level based on completion
        await this.db.runAsync(
          'UPDATE tasks SET heatLevel = MIN(100, heatLevel + 10) WHERE id = ?',
          [proof.taskId]
        );
      }

      console.log(`[GhostApproval] Auto-approved ${autoApprovedIds.length} proofs`);
    } catch (error) {
      console.error('[GhostApproval] Error:', error);
    }

    return autoApprovedIds;
  }

  // ═══════════════════════════════════════════════════════════
  // CHALLENGE SYSTEM
  // ═══════════════════════════════════════════════════════════

  async createChallenge(proofId: string, userId: string, reason: string): Promise<TaskChallenge> {
    const challenge: TaskChallenge = {
      id: `challenge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      proofId,
      challengedBy: userId,
      challengedAt: Date.now(),
      reason,
      status: 'active',
    };

    if (this.db) {
      await this.db.runAsync(
        'INSERT INTO challenges (id, proofId, challengedBy, challengedAt, reason, status) VALUES (?, ?, ?, ?, ?, ?)',
        [challenge.id, challenge.proofId, challenge.challengedBy, challenge.challengedAt, challenge.reason, challenge.status]
      );

      // Update proof status
      await this.db.runAsync(
        'UPDATE proofs SET status = ? WHERE id = ?',
        ['challenged', proofId]
      );
    }

    return challenge;
  }

  async resolveChallenge(challengeId: string, resolvedBy: string, resolution: string, overturn: boolean): Promise<void> {
    if (!this.db) return;

    const newStatus = overturn ? 'overturned' : 'resolved';
    const now = Date.now();

    await this.db.runAsync(
      'UPDATE challenges SET status = ?, resolvedBy = ?, resolvedAt = ?, resolution = ? WHERE id = ?',
      [newStatus, resolvedBy, now, resolution, challengeId]
    );

    // Get challenge to update proof
    const challenge = await this.db.getFirstAsync<{ proofId: string }>(
      'SELECT proofId FROM challenges WHERE id = ?',
      [challengeId]
    );

    if (challenge) {
      await this.db.runAsync(
        'UPDATE proofs SET status = ?, reviewedBy = ?, reviewedAt = ? WHERE id = ?',
        [overturn ? 'pending' : 'approved', resolvedBy, now, challenge.proofId]
      );
    }
  }

  // ═══════════════════════════════════════════════════════════
  // AURA SYSTEM
  // ═══════════════════════════════════════════════════════════

  calculateAura(score: number): AuraLevel {
    if (score >= 80) return 'platinum';
    if (score >= 50) return 'gold';
    if (score >= 25) return 'silver';
    return 'bronze';
  }

  getAuraConfig(aura: AuraLevel) {
    return AURA_CONFIG[aura];
  }

  async updateAura(userId: string, scoreDelta: number): Promise<UserAura> {
    let currentAura: UserAura | null = null;

    if (this.db) {
      currentAura = await this.db.getFirstAsync<UserAura>(
        'SELECT * FROM auras WHERE userId = ?',
        [userId]
      );
    }

    const newScore = (currentAura?.auraScore || 0) + scoreDelta;
    const newAura = this.calculateAura(newScore);
    const voteWeight = AURA_CONFIG[newAura].voteWeight;

    const aura: UserAura = {
      userId,
      aura: newAura,
      auraScore: Math.min(100, Math.max(0, newScore)),
      voteWeight,
    };

    if (this.db) {
      await this.db.runAsync(
        'INSERT OR REPLACE INTO auras (userId, aura, auraScore, voteWeight) VALUES (?, ?, ?, ?)',
        [aura.userId, aura.aura, aura.auraScore, aura.voteWeight]
      );
    }

    // Update cache
    this.cache.auras.set(userId, aura);

    return aura;
  }

  async getAura(userId: string): Promise<UserAura | null> {
    // Check cache first
    if (this.cache.auras.has(userId)) {
      return this.cache.auras.get(userId)!;
    }

    if (!this.db) return null;

    const aura = await this.db.getFirstAsync<UserAura>(
      'SELECT * FROM auras WHERE userId = ?',
      [userId]
    );

    if (aura) {
      this.cache.auras.set(userId, aura);
    }

    return aura;
  }

  // ═══════════════════════════════════════════════════════════
  // WEEKLY SPRINT & BADGES
  // ═══════════════════════════════════════════════════════════

  getCurrentSprintDates(): { start: number; end: number } {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const daysUntilSunday = dayOfWeek === 0 ? 7 : 7 - dayOfWeek;
    
    const start = new Date(now);
    start.setDate(start.getDate() - dayOfWeek);
    start.setHours(0, 0, 0, 0);
    
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);

    return { start: start.getTime(), end: end.getTime() };
  }

  async getOrCreateSprint(userId: string): Promise<WeeklySprint> {
    const { start, end } = this.getCurrentSprintDates();
    const sprintId = `sprint_${userId}_${start}`;

    // Check cache
    if (this.cache.sprints.has(sprintId)) {
      return this.cache.sprints.get(sprintId)!;
    }

    let sprint: WeeklySprint | null = null;

    if (this.db) {
      sprint = await this.db.getFirstAsync<any>(
        'SELECT * FROM sprints WHERE id = ?',
        [sprintId]
      );

      if (sprint) {
        // Handle badges - could be JSON string or already parsed array
        const badgesData = sprint.badges;
        if (typeof badgesData === 'string') {
          sprint.badges = JSON.parse(badgesData || '[]');
        } else if (Array.isArray(badgesData)) {
          sprint.badges = badgesData;
        } else {
          sprint.badges = [];
        }
      }
    }

    if (!sprint) {
      sprint = {
        id: sprintId,
        startDate: start,
        endDate: end,
        points: 0,
        badges: [],
      };

      if (this.db) {
        await this.db.runAsync(
          'INSERT INTO sprints (id, userId, startDate, endDate, points, badges) VALUES (?, ?, ?, ?, ?, ?)',
          [sprint.id, userId, sprint.startDate, sprint.endDate, sprint.points, '[]']
        );
      }
    }

    // Check for badge decay
    const now = Date.now();
    sprint.badges = sprint.badges.map(badge => ({
      ...badge,
      isDecayed: now > badge.defenseExpiry && badge.defenseExpiry > 0,
    }));

    this.cache.sprints.set(sprintId, sprint);
    return sprint;
  }

  async addSprintPoints(userId: string, points: number): Promise<WeeklySprint> {
    const sprint = await this.getOrCreateSprint(userId);
    sprint.points += points;

    if (this.db) {
      await this.db.runAsync(
        'UPDATE sprints SET points = ? WHERE id = ?',
        [sprint.points, sprint.id]
      );
    }

    return sprint;
  }

  // ═══════════════════════════════════════════════════════════
  // ROOM OPERATIONS
  // ═══════════════════════════════════════════════════════════

  async saveRoom(room: EnhancedRoom): Promise<void> {
    if (this.db) {
      await this.db.runAsync(
        `INSERT OR REPLACE INTO rooms (id, name, code, ownerId, createdAt, expiresAt, isPremium, memberCount, taskCount, isFlipped, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [room.id, room.name, room.code, room.ownerId, room.createdAt, room.expiresAt, room.isPremium ? 1 : 0, room.memberCount, room.taskCount, room.isFlipped ? 1 : 0, Date.now()]
      );
    }
    this.cache.rooms.set(room.id, room);
  }

  async getRooms(): Promise<EnhancedRoom[]> {
    if (this.db) {
      const rooms = await this.db.getAllAsync<any>('SELECT * FROM rooms ORDER BY updatedAt DESC');
      return rooms.map(r => ({
        ...r,
        isPremium: r.isPremium === 1,
        isFlipped: r.isFlipped === 1,
      }));
    }
    return Array.from(this.cache.rooms.values());
  }

  // ═══════════════════════════════════════════════════════════
  // TASK OPERATIONS
  // ═══════════════════════════════════════════════════════════

  async saveTask(task: EnhancedRoomTask): Promise<void> {
    if (this.db) {
      await this.db.runAsync(
        `INSERT OR REPLACE INTO tasks (id, roomId, title, description, status, deadline, points, participants, viewerIds, heatLevel, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [task.id, task.roomId, task.title, task.description, task.status, task.deadline, task.points, 
         JSON.stringify(task.participants), JSON.stringify(task.viewerIds), task.heatLevel, task.createdAt, task.updatedAt]
      );
    }

    const roomTasks = this.cache.tasks.get(task.roomId) || [];
    const existingIndex = roomTasks.findIndex(t => t.id === task.id);
    if (existingIndex >= 0) {
      roomTasks[existingIndex] = task;
    } else {
      roomTasks.push(task);
    }
    this.cache.tasks.set(task.roomId, roomTasks);
  }

  async getTasks(roomId: string): Promise<EnhancedRoomTask[]> {
    if (this.cache.tasks.has(roomId)) {
      return this.cache.tasks.get(roomId)!;
    }

    if (!this.db) return [];

    const tasks = await this.db.getAllAsync<any>(
      'SELECT * FROM tasks WHERE roomId = ? ORDER BY createdAt DESC',
      [roomId]
    );

    const parsedTasks = tasks.map(t => ({
      ...t,
      participants: JSON.parse(t.participants || '[]'),
      viewerIds: JSON.parse(t.viewerIds || '[]'),
    }));

    this.cache.tasks.set(roomId, parsedTasks);
    return parsedTasks;
  }

  async joinTask(taskId: string, userId: string): Promise<void> {
    const tasks = Array.from(this.cache.tasks.values()).flat();
    const task = tasks.find(t => t.id === taskId);
    
    if (task && !task.participants.includes(userId)) {
      task.participants.push(userId);
      task.viewerIds = task.viewerIds.filter((id: string) => id !== userId);
      task.status = 'accepted';
      await this.saveTask(task);
    }
  }

  async leaveTask(taskId: string, userId: string): Promise<void> {
    const tasks = Array.from(this.cache.tasks.values()).flat();
    const task = tasks.find(t => t.id === taskId);
    
    if (task) {
      task.participants = task.participants.filter((id: string) => id !== userId);
      if (!task.viewerIds.includes(userId)) {
        task.viewerIds.push(userId);
      }
      task.status = task.participants.length > 0 ? 'accepted' : 'spectator';
      await this.saveTask(task);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // DELTA SYNC
  // ═══════════════════════════════════════════════════════════

  async getLastSyncTime(): Promise<number> {
    try {
      const time = await AsyncStorage.getItem('krios_room_last_sync');
      return time ? parseInt(time, 10) : 0;
    } catch {
      return 0;
    }
  }

  async setLastSyncTime(time: number): Promise<void> {
    await AsyncStorage.setItem('krios_room_last_sync', time.toString());
  }

  async getDeltaTasks(roomId: string, since: number): Promise<EnhancedRoomTask[]> {
    // This would be called with data from server delta sync
    // Returns tasks modified since the given timestamp
    return this.getTasks(roomId).then(tasks => 
      tasks.filter(t => t.updatedAt > since)
    );
  }
}

// Export singleton
export default new RoomDataService();
