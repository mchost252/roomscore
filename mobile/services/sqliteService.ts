import { ThreadMessage } from './threadService';

const isWeb = typeof document !== 'undefined';
let SQLiteModule: any = null;
if (!isWeb) {
  SQLiteModule = require('expo-sqlite');
}

// ═══════════════════════════════════════════════════════════
// Types for DM tables
// ═══════════════════════════════════════════════════════════
export interface LocalDirectMessage {
  id: string;
  local_id: string;
  from_user_id: string;
  to_user_id: string;
  content: string;
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  reply_to_id: string | null;
  reply_to_text: string | null;
  created_at: number;
  synced: number;
}

export interface LocalConversation {
  friend_id: string;
  username: string;
  avatar: string | null;
  last_message: string;
  last_message_at: number;
  unread_count: number;
  is_online: number;
  updated_at: number;
  /** 'none' = already friends, 'pending_sent' = I sent request, 'pending_received' = they sent, 'accepted' */
  request_status: string;
  request_id: string | null;
}

export interface LocalFriend {
  id: string;
  user_id: string;
  username: string;
  avatar: string | null;
  status: string;
  created_at: number;
}

class SQLiteService {
  private db: any = null;
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    if (isWeb) {
      console.log('ℹ️ SQLite skipped on web — using backend API');
      this.initialized = true;
      return;
    }
    try {
      this.db = await SQLiteModule.openDatabaseAsync('krios.db');
      await this.createTables();
      this.initialized = true;
      console.log('✅ SQLite initialized');
    } catch (error) {
      console.error('❌ SQLite initialization failed:', error);
      this.initialized = true;
    }
  }

  private async createTables(): Promise<void> {
    if (!this.db) return;

    // Existing tables
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS thread_messages (
        id TEXT PRIMARY KEY,
        task_id INTEGER NOT NULL,
        text TEXT NOT NULL,
        sender TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        metadata TEXT,
        synced INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
      );
      CREATE INDEX IF NOT EXISTS idx_thread_messages_task_id ON thread_messages(task_id);
      CREATE INDEX IF NOT EXISTS idx_thread_messages_timestamp ON thread_messages(timestamp);
    `);

    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY,
        title TEXT NOT NULL,
        due_date INTEGER,
        priority TEXT,
        bucket TEXT,
        is_completed INTEGER DEFAULT 0,
        created_at INTEGER,
        updated_at INTEGER,
        synced INTEGER DEFAULT 0,
        local_changes TEXT,
        UNIQUE(id)
      );
      CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
      CREATE INDEX IF NOT EXISTS idx_tasks_is_completed ON tasks(is_completed);
    `);

    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS sync_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        action TEXT NOT NULL,
        data TEXT NOT NULL,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
      );
      CREATE INDEX IF NOT EXISTS idx_sync_queue_entity ON sync_queue(entity_type, entity_id);
    `);

    // ═══════════════════════════════════════════════════════════
    // NEW: Direct Messages tables
    // ═══════════════════════════════════════════════════════════

    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS direct_messages (
        id TEXT PRIMARY KEY,
        local_id TEXT,
        from_user_id TEXT NOT NULL,
        to_user_id TEXT NOT NULL,
        content TEXT NOT NULL,
        status TEXT DEFAULT 'sending',
        reply_to_id TEXT,
        reply_to_text TEXT,
        created_at INTEGER NOT NULL,
        synced INTEGER DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_dm_from ON direct_messages(from_user_id);
      CREATE INDEX IF NOT EXISTS idx_dm_to ON direct_messages(to_user_id);
      CREATE INDEX IF NOT EXISTS idx_dm_created ON direct_messages(created_at);
      CREATE INDEX IF NOT EXISTS idx_dm_synced ON direct_messages(synced);
      CREATE INDEX IF NOT EXISTS idx_dm_local_id ON direct_messages(local_id);
    `);

    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS conversations (
        friend_id TEXT PRIMARY KEY,
        username TEXT,
        avatar TEXT,
        last_message TEXT,
        last_message_at INTEGER,
        unread_count INTEGER DEFAULT 0,
        is_online INTEGER DEFAULT 0,
        updated_at INTEGER,
        request_status TEXT DEFAULT 'none',
        request_id TEXT
      );
    `);

    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS friends (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        username TEXT,
        avatar TEXT,
        status TEXT,
        created_at INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_friends_user_id ON friends(user_id);
    `);
  }

  // ═══════════════════════════════════════════════════════════
  // THREAD MESSAGES (existing)
  // ═══════════════════════════════════════════════════════════
  async getThreadMessages(taskId: number): Promise<ThreadMessage[]> {
    if (!this.db) return [];
    const result = await this.db.getAllAsync(
      'SELECT * FROM thread_messages WHERE task_id = ? ORDER BY timestamp ASC',
      [taskId]
    ) as any[];
    return result.map((row: any) => ({
      id: row.id,
      taskId: row.task_id,
      text: row.text,
      sender: row.sender as 'user' | 'ai' | 'system',
      timestamp: new Date(row.timestamp),
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    }));
  }

  async addThreadMessage(message: ThreadMessage): Promise<void> {
    if (!this.db) return;
    await this.db.runAsync(
      `INSERT INTO thread_messages (id, task_id, text, sender, timestamp, metadata)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [message.id, message.taskId, message.text, message.sender,
       message.timestamp.getTime(), message.metadata ? JSON.stringify(message.metadata) : null]
    );
  }

  async deleteThreadMessages(taskId: number): Promise<void> {
    if (!this.db) return;
    await this.db.runAsync('DELETE FROM thread_messages WHERE task_id = ?', [taskId]);
  }

  // ═══════════════════════════════════════════════════════════
  // DIRECT MESSAGES
  // ═══════════════════════════════════════════════════════════
  async saveDirectMessage(msg: LocalDirectMessage): Promise<void> {
    if (!this.db) return;
    await this.db.runAsync(
      `INSERT OR REPLACE INTO direct_messages
       (id, local_id, from_user_id, to_user_id, content, status, reply_to_id, reply_to_text, created_at, synced)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [msg.id, msg.local_id, msg.from_user_id, msg.to_user_id, msg.content,
       msg.status, msg.reply_to_id, msg.reply_to_text, msg.created_at, msg.synced]
    );
  }

  async getDirectMessages(userId: string, friendId: string, limit = 50, before?: number): Promise<LocalDirectMessage[]> {
    if (!this.db) return [];
    const query = before
      ? `SELECT * FROM direct_messages
         WHERE ((from_user_id = ? AND to_user_id = ?) OR (from_user_id = ? AND to_user_id = ?))
         AND created_at < ?
         ORDER BY created_at DESC LIMIT ?`
      : `SELECT * FROM direct_messages
         WHERE ((from_user_id = ? AND to_user_id = ?) OR (from_user_id = ? AND to_user_id = ?))
         ORDER BY created_at DESC LIMIT ?`;
    const params = before
      ? [userId, friendId, friendId, userId, before, limit]
      : [userId, friendId, friendId, userId, limit];
    const rows = await this.db.getAllAsync(query, params) as any[];
    return rows.reverse();
  }

  async getUnsyncedMessages(): Promise<LocalDirectMessage[]> {
    if (!this.db) return [];
    return this.db.getAllAsync(
      `SELECT * FROM direct_messages WHERE synced = 0 AND status = 'sending' ORDER BY created_at ASC`
    ) as Promise<LocalDirectMessage[]>;
  }

  async updateMessageStatus(id: string, status: string, synced?: number): Promise<void> {
    if (!this.db) return;
    if (synced !== undefined) {
      await this.db.runAsync(
        'UPDATE direct_messages SET status = ?, synced = ? WHERE id = ? OR local_id = ?',
        [status, synced, id, id]
      );
    } else {
      await this.db.runAsync(
        'UPDATE direct_messages SET status = ? WHERE id = ? OR local_id = ?',
        [status, id, id]
      );
    }
  }

  async updateMessageId(localId: string, serverId: string): Promise<void> {
    if (!this.db) return;
    await this.db.runAsync(
      'UPDATE direct_messages SET id = ?, synced = 1, status = ? WHERE local_id = ?',
      [serverId, 'sent', localId]
    );
  }

  async markMessagesReadFrom(friendId: string, userId: string): Promise<void> {
    if (!this.db) return;
    await this.db.runAsync(
      `UPDATE direct_messages SET status = 'read' WHERE from_user_id = ? AND to_user_id = ? AND status != 'read'`,
      [userId, friendId]
    );
  }

  async deleteConversationMessages(userId: string, friendId: string): Promise<void> {
    if (!this.db) return;
    await this.db.runAsync(
      `DELETE FROM direct_messages
       WHERE (from_user_id = ? AND to_user_id = ?) OR (from_user_id = ? AND to_user_id = ?)`,
      [userId, friendId, friendId, userId]
    );
  }

  // ═══════════════════════════════════════════════════════════
  // CONVERSATIONS
  // ═══════════════════════════════════════════════════════════
  async saveConversation(conv: LocalConversation): Promise<void> {
    if (!this.db) return;
    await this.db.runAsync(
      `INSERT OR REPLACE INTO conversations
       (friend_id, username, avatar, last_message, last_message_at, unread_count, is_online, updated_at, request_status, request_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [conv.friend_id, conv.username, conv.avatar, conv.last_message,
       conv.last_message_at, conv.unread_count, conv.is_online, conv.updated_at,
       conv.request_status || 'none', conv.request_id || null]
    );
  }

  async getConversations(): Promise<LocalConversation[]> {
    if (!this.db) return [];
    return this.db.getAllAsync(
      'SELECT * FROM conversations ORDER BY last_message_at DESC'
    ) as Promise<LocalConversation[]>;
  }

  async updateConversationOnline(friendId: string, isOnline: boolean): Promise<void> {
    if (!this.db) return;
    await this.db.runAsync(
      'UPDATE conversations SET is_online = ? WHERE friend_id = ?',
      [isOnline ? 1 : 0, friendId]
    );
  }

  async clearConversationUnread(friendId: string): Promise<void> {
    if (!this.db) return;
    await this.db.runAsync(
      'UPDATE conversations SET unread_count = 0 WHERE friend_id = ?',
      [friendId]
    );
  }

  async deleteConversation(friendId: string): Promise<void> {
    if (!this.db) return;
    await this.db.runAsync('DELETE FROM conversations WHERE friend_id = ?', [friendId]);
  }

  async updateConversationRequestStatus(friendId: string, status: string, requestId?: string | null): Promise<void> {
    if (!this.db) return;
    await this.db.runAsync(
      'UPDATE conversations SET request_status = ?, request_id = ? WHERE friend_id = ?',
      [status, requestId || null, friendId]
    );
  }

  async getTotalUnreadCount(): Promise<number> {
    if (!this.db) return 0;
    const r = await this.db.getFirstAsync(
      'SELECT COALESCE(SUM(unread_count), 0) as total FROM conversations'
    ) as { total: number } | null;
    return r?.total || 0;
  }

  // ═══════════════════════════════════════════════════════════
  // FRIENDS
  // ═══════════════════════════════════════════════════════════
  async saveFriend(f: LocalFriend): Promise<void> {
    if (!this.db) return;
    await this.db.runAsync(
      `INSERT OR REPLACE INTO friends (id, user_id, username, avatar, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [f.id, f.user_id, f.username, f.avatar, f.status, f.created_at]
    );
  }

  async getFriends(): Promise<LocalFriend[]> {
    if (!this.db) return [];
    return this.db.getAllAsync(
      `SELECT * FROM friends WHERE status = 'accepted' ORDER BY username ASC`
    ) as Promise<LocalFriend[]>;
  }

  // ═══════════════════════════════════════════════════════════
  // MIGRATION & UTILITY
  // ═══════════════════════════════════════════════════════════
  async migrateFromAsyncStorage(threads: { taskId: number; messages: ThreadMessage[] }[]): Promise<void> {
    if (!this.db) return;
    console.log(`🔄 Migrating ${threads.length} threads to SQLite...`);
    for (const { messages } of threads) {
      for (const message of messages) {
        await this.addThreadMessage(message);
      }
    }
    console.log('✅ Migration complete');
  }

  async clearAllData(): Promise<void> {
    if (!this.db) return;
    await this.db.execAsync(`
      DELETE FROM thread_messages;
      DELETE FROM tasks;
      DELETE FROM sync_queue;
      DELETE FROM direct_messages;
      DELETE FROM conversations;
      DELETE FROM friends;
    `);
    console.log('🗑️ All data cleared');
  }

  async getStats(): Promise<any> {
    if (!this.db) return { messages: 0, tasks: 0, syncQueue: 0, dms: 0, conversations: 0 };
    const [messages, tasks, queue, dms, convs] = await Promise.all([
      this.db.getFirstAsync('SELECT COUNT(*) as count FROM thread_messages') as Promise<{count: number} | null>,
      this.db.getFirstAsync('SELECT COUNT(*) as count FROM tasks') as Promise<{count: number} | null>,
      this.db.getFirstAsync('SELECT COUNT(*) as count FROM sync_queue') as Promise<{count: number} | null>,
      this.db.getFirstAsync('SELECT COUNT(*) as count FROM direct_messages') as Promise<{count: number} | null>,
      this.db.getFirstAsync('SELECT COUNT(*) as count FROM conversations') as Promise<{count: number} | null>,
    ]);
    return {
      messages: messages?.count || 0,
      tasks: tasks?.count || 0,
      syncQueue: queue?.count || 0,
      dms: dms?.count || 0,
      conversations: convs?.count || 0,
    };
  }
}

export default new SQLiteService();
