import AsyncStorage from '@react-native-async-storage/async-storage';
import sqliteService from './sqliteService';

/**
 * PHASE 1 & 2: Task Thread Persistence Service
 * 
 * Hybrid storage:
 * - Memory cache (instant access)
 * - SQLite (production storage) - PHASE 2
 * - Falls back to AsyncStorage if SQLite unavailable
 */

let useSQLite = false;

export interface ThreadMessage {
  id: string;
  taskId: string | number;
  text: string;
  sender: 'user' | 'ai' | 'system';
  timestamp: Date;
  metadata?: {
    aiGenerated?: boolean;
    suggestions?: string[];
    action?: 'created' | 'updated' | 'completed';
  };
}

// Normalize taskId to a consistent cache key string
function toKey(taskId: string | number): string {
  return String(taskId);
}

class ThreadService {
  private readonly THREAD_PREFIX = 'task_thread_';
  private cache: Map<string, ThreadMessage[]> = new Map();

  /**
   * Get all messages for a task thread
   * Returns cached version instantly, then fetches fresh data
   */
  async getThread(taskId: string | number): Promise<ThreadMessage[]> {
    const key = toKey(taskId);
    try {
      // Check memory cache first (instant)
      if (this.cache.has(key)) {
        return this.cache.get(key)!;
      }

      // PHASE 2: Use SQLite if available (faster for large datasets)
      if (useSQLite) {
        const messages = await sqliteService.getThreadMessages(taskId as number);
        this.cache.set(key, messages);
        return messages;
      }

      // Fallback: Load from AsyncStorage
      const storageKey = `${this.THREAD_PREFIX}${key}`;
      const stored = await AsyncStorage.getItem(storageKey);
      
      if (stored) {
        const messages: ThreadMessage[] = JSON.parse(stored).map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
        }));
        this.cache.set(key, messages);
        return messages;
      }

      return [];
    } catch (error) {
      console.error('Failed to load thread:', error);
      return [];
    }
  }

  /**
   * Add a message to the thread
   * Saves optimistically (instant UI update, saves in background)
   * PHASE 2: Saves to SQLite
   */
  async addMessage(taskId: string | number, message: Omit<ThreadMessage, 'id' | 'timestamp'>): Promise<ThreadMessage> {
    const newMessage: ThreadMessage = {
      ...message,
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
    };

    try {
      // Update memory cache (instant)
      const cacheKey = toKey(taskId);
      const currentMessages = this.cache.get(cacheKey) || await this.getThread(taskId);
      const updatedMessages = [...currentMessages, newMessage];
      this.cache.set(cacheKey, updatedMessages);

      // PHASE 2: Persist to SQLite or AsyncStorage in background
      if (useSQLite) {
        await sqliteService.addThreadMessage(newMessage);
      } else {
        await this.persistThread(taskId, updatedMessages);
      }

      return newMessage;
    } catch (error) {
      console.error('Failed to add message:', error);
      return newMessage;
    }
  }

  /**
   * Persist thread to storage (background operation)
   * PHASE 2: Uses SQLite or AsyncStorage fallback
   */
  private async persistThread(taskId: string | number, messages: ThreadMessage[]): Promise<void> {
    try {
      if (useSQLite) return;
      const key = `${this.THREAD_PREFIX}${toKey(taskId)}`;
      await AsyncStorage.setItem(key, JSON.stringify(messages));
    } catch (error) {
      console.error('Failed to persist thread:', error);
    }
  }

  /**
   * Clear a thread (when task is deleted)
   */
  async clearThread(taskId: string | number): Promise<void> {
    try {
      const k = toKey(taskId);
      this.cache.delete(k);
      await AsyncStorage.removeItem(`${this.THREAD_PREFIX}${k}`);
    } catch (error) {
      console.error('Failed to clear thread:', error);
    }
  }

  /**
   * Get all threads (for Phase 2: migration to SQLite)
   */
  async getAllThreads(): Promise<{ taskId: string; messages: ThreadMessage[] }[]> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const threadKeys = allKeys.filter(k => k.startsWith(this.THREAD_PREFIX));
      const threads = await Promise.all(
        threadKeys.map(async (k) => {
          const taskId = k.replace(this.THREAD_PREFIX, '');
          const messages = await this.getThread(taskId);
          return { taskId, messages };
        })
      );
      return threads;
    } catch (error) {
      console.error('Failed to get all threads:', error);
      return [];
    }
  }

  /**
   * Clear memory cache (useful for memory management)
   */
  clearCache(): void {
    this.cache.clear();
  }
}

const threadServiceInstance = new ThreadService();

// Initialize SQLite after class is declared
(async () => {
  try {
    await sqliteService.initialize();
    useSQLite = true;
    console.log('✅ ThreadService using SQLite');

    // Migrate existing AsyncStorage data to SQLite
    const asyncThreads = await threadServiceInstance.getAllThreads();
    if (asyncThreads.length > 0) {
      await sqliteService.migrateFromAsyncStorage(
        asyncThreads.map(t => ({ taskId: Number(t.taskId) || 0, messages: t.messages }))
      );
      console.log('✅ Migrated AsyncStorage threads to SQLite');
    }
  } catch (error) {
    console.warn('⚠️ SQLite unavailable, using AsyncStorage fallback:', error);
  }
})();

export default threadServiceInstance;
