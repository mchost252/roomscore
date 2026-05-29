import { createMMKV } from 'react-native-mmkv';
import { Platform } from 'react-native';

// ==================== MMKV SETUP ====================
export const roomStorage = createMMKV({
  id: 'krios-room-storage',
  ...(Platform.OS !== 'web' ? { encryptionKey: 'tactical-room-key' } : {})
});

export const setRoomLastSync = (roomId: string, timestamp: string) => {
  roomStorage.set(`lastSync_${roomId}`, timestamp);
};

export const getRoomLastSync = (roomId: string): string => {
  return roomStorage.getString(`lastSync_${roomId}`) || '1970-01-01T00:00:00.000Z';
};

// ==================== SQLITE SETUP ====================
const dbName = 'krios_rooms.db';

// Safely require expo-sqlite to avoid Web crashes
let openDatabaseAsync: any;
if (Platform.OS !== 'web') {
  try {
    const SQLite = require('expo-sqlite');
    openDatabaseAsync = SQLite.openDatabaseAsync;
  } catch (e) {
    console.error('Failed to load expo-sqlite', e);
  }
}

// In-Memory Mock DB for Web Development
const webMemoryStore: Record<string, any[]> = {
  rooms: [],
  room_tasks: [],
  room_task_nodes: [],
};

const mockWebDb = {
  execAsync: async () => {},
  getAllAsync: async (query: string, params?: any[]) => {
    if (query.includes('FROM room_tasks')) {
      const roomId = params?.[0];
      return roomId ? webMemoryStore.room_tasks.filter(t => t.roomId === roomId) : webMemoryStore.room_tasks;
    }
    if (query.includes('FROM rooms')) {
      return webMemoryStore.rooms;
    }
    return [];
  },
  getFirstAsync: async (query: string, params?: any[]) => {
    if (query.includes('FROM rooms')) {
      const id = params?.[0];
      return webMemoryStore.rooms.find(r => r.id === id) || null;
    }
    return null;
  },
  runAsync: async (query: string, params: any[] = []) => {
    if (query.includes('INSERT INTO rooms')) {
      const [id, name, description, joinCode, isPrivate, maxMembers, chatRetentionDays, isPremium, streak, ownerId, isActive, createdAt, updatedAt] = params;
      webMemoryStore.rooms.push({ id, name, description, joinCode, isPrivate: !!isPrivate, maxMembers, chatRetentionDays, isPremium: !!isPremium, streak, ownerId, isActive: !!isActive, createdAt, updatedAt });
    }
    if (query.includes('INSERT INTO room_tasks')) {
      const [id, roomId, title, description, taskType, points, isActive, createdAt] = params;
      webMemoryStore.room_tasks.push({ id, roomId, title, description, taskType, points, isActive: !!isActive, createdAt });
    }
    if (query.includes('DELETE FROM rooms')) {
      webMemoryStore.rooms = webMemoryStore.rooms.filter(r => r.id !== params[0]);
    }
    if (query.includes('DELETE FROM room_tasks')) {
      webMemoryStore.room_tasks = webMemoryStore.room_tasks.filter(r => r.id !== params[0]);
    }
    return { changes: 1, lastInsertRowId: 1 };
  },
};

export const getRoomDb = async (): Promise<any> => {
  if (Platform.OS === 'web') {
    return mockWebDb;
  }
  return await openDatabaseAsync(dbName);
};

export const initRoomDb = async () => {
  if (Platform.OS === 'web') return; 
  try {
    const db = await getRoomDb();
    
    // Enable WAL mode for better concurrency and enforce foreign keys
    await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS rooms (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        joinCode TEXT NOT NULL,
        isPrivate INTEGER DEFAULT 0,
        maxMembers INTEGER DEFAULT 10,
        chatRetentionDays INTEGER DEFAULT 5,
        isPremium INTEGER DEFAULT 0,
        streak INTEGER DEFAULT 0,
        ownerId TEXT NOT NULL,
        isActive INTEGER DEFAULT 1,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS room_tasks (
        id TEXT PRIMARY KEY,
        roomId TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        taskType TEXT DEFAULT 'daily',
        daysOfWeek TEXT,
        points INTEGER DEFAULT 10,
        isActive INTEGER DEFAULT 1,
        createdAt TEXT NOT NULL,
        FOREIGN KEY (roomId) REFERENCES rooms (id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_room_tasks_roomId ON room_tasks(roomId);

      CREATE TABLE IF NOT EXISTS room_members (
        id TEXT PRIMARY KEY,
        roomId TEXT NOT NULL,
        userId TEXT NOT NULL,
        username TEXT NOT NULL,
        avatar TEXT,
        isOnline INTEGER DEFAULT 0,
        role TEXT DEFAULT 'member',
        FOREIGN KEY (roomId) REFERENCES rooms (id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_room_members_roomId ON room_members(roomId);

      CREATE TABLE IF NOT EXISTS room_task_nodes (
        id TEXT PRIMARY KEY,
        roomId TEXT NOT NULL,
        taskId TEXT,
        userId TEXT,
        type TEXT DEFAULT 'MESSAGE',
        content TEXT,
        caption TEXT,
        status TEXT DEFAULT 'PENDING',
        vouchCount INTEGER DEFAULT 0,
        isPinned INTEGER DEFAULT 0,
        mediaUrl TEXT,
        blurHash TEXT,
        heatLevel INTEGER DEFAULT 0,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        userJson TEXT,
        clientReferenceId TEXT,
        FOREIGN KEY (roomId) REFERENCES rooms (id) ON DELETE CASCADE,
        FOREIGN KEY (taskId) REFERENCES room_tasks (id) ON DELETE SET NULL
      );
      CREATE INDEX IF NOT EXISTS idx_task_nodes_taskId ON room_task_nodes(taskId);
      CREATE INDEX IF NOT EXISTS idx_task_nodes_createdAt ON room_task_nodes(createdAt);
      CREATE INDEX IF NOT EXISTS idx_task_nodes_clientRef ON room_task_nodes(clientReferenceId);
    `);

    // Simple migration logic for existing users
    try {
      await db.execAsync('ALTER TABLE room_task_nodes ADD COLUMN caption TEXT;');
    } catch {}
    try {
      await db.execAsync('ALTER TABLE room_task_nodes ADD COLUMN isPinned INTEGER DEFAULT 0;');
    } catch {}

    console.log('Room DB Initialized with WAL and Indexes');

  } catch (error) {
    console.error('Error initializing Room DB:', error);
  }
};

// ==================== JANITOR ====================
export const runDataJanitor = async () => {
  if (Platform.OS === 'web') return;
  try {
    const db = await getRoomDb();
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    
    const result = await db.runAsync(
      `DELETE FROM room_task_nodes WHERE createdAt < ?;`, 
      [fiveDaysAgo]
    );
    console.log(`Janitor: Deleted ${result.changes} old nodes.`);
  } catch (error) {
    console.error('Janitor Error:', error);
  }
};
