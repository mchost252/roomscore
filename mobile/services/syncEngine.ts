import { io, Socket } from 'socket.io-client';
import NetInfo from '@react-native-community/netinfo';
import sqliteService from './sqliteService';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * PHASE 3: Real-Time Sync Engine
 * 
 * WhatsApp-style real-time synchronization:
 * - WebSocket for instant updates (rooms, tasks, messages)
 * - Offline queue for changes made without internet
 * - Optimistic UI (show changes instantly, sync in background)
 * - Conflict resolution (last-write-wins with timestamps)
 * - Automatic reconnection with exponential backoff
 */

export interface SyncQueueItem {
  id: string;
  entityType: 'task' | 'room' | 'thread_message' | 'appreciation';
  entityId: string;
  action: 'create' | 'update' | 'delete';
  data: any;
  timestamp: number;
  retries: number;
}

type SyncEventHandler = (data: any) => void;

class SyncEngine {
  private socket: Socket | null = null;
  private isOnline = true;
  private syncQueue: SyncQueueItem[] = [];
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private eventHandlers: Map<string, SyncEventHandler[]> = new Map();
  private userId: string | null = null;
  private token: string | null = null;

  /**
   * Initialize sync engine
   */
  async initialize(userId: string, token: string): Promise<void> {
    this.userId = userId;
    this.token = token;

    // Load offline queue from storage
    await this.loadSyncQueue();

    // Setup network monitoring
    this.setupNetworkMonitoring();

    // Connect to WebSocket
    this.connect();

    console.log('✅ Sync Engine initialized');
  }

  /**
   * Connect to WebSocket server
   */
  private connect(): void {
    if (this.socket?.connected) return;

    // Use configured socket URL (falls back to Railway in production)
    const { SOCKET_URL } = require('../constants/config');
    const API_URL = SOCKET_URL || process.env.EXPO_PUBLIC_SOCKET_URL || process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
    
    this.socket = io(API_URL, {
      auth: { token: this.token },
      transports: ['websocket', 'polling'],
      upgrade: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: this.maxReconnectAttempts,
      timeout: 30000, // 30 seconds for Railway/Neon cold starts
    });

    // Connection events
    this.socket.on('connect', () => {
      console.log('🔌 WebSocket connected');
      this.reconnectAttempts = 0;
      // Request fresh online list (helps after reconnects)
      try { this.socket?.emit('users:getOnline'); } catch {}
      this.processSyncQueue(); // Sync any offline changes
    });

    this.socket.on('disconnect', (reason) => {
      console.log('🔌 WebSocket disconnected:', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ WebSocket connection error:', error.message);
      this.reconnectAttempts++;
    });

    // Real-time event listeners
    this.setupEventListeners();
  }

  /**
   * Setup real-time event listeners (like WhatsApp)
   */
  private setupEventListeners(): void {
    if (!this.socket) return;

    // Room events
    this.socket.on('room:updated', (data) => this.handleEvent('room:updated', data));
    this.socket.on('room:task:created', (data) => this.handleEvent('room:task:created', data));
    this.socket.on('room:task:updated', (data) => this.handleEvent('room:task:updated', data));
    this.socket.on('room:task:deleted', (data) => this.handleEvent('room:task:deleted', data));
    
    // Task events
    this.socket.on('task:updated', (data) => this.handleEvent('task:updated', data));
    this.socket.on('task:completed', (data) => this.handleEvent('task:completed', data));
    
    // Thread events
    this.socket.on('thread:message', (data) => this.handleEvent('thread:message', data));
    
    // Appreciation events
    this.socket.on('appreciation:received', (data) => this.handleEvent('appreciation:received', data));

    // Direct Message events
    this.socket.on('new_direct_message', (data) => this.handleEvent('new_direct_message', data));
    this.socket.on('dm:typing', (data) => this.handleEvent('dm:typing', data));
    this.socket.on('dm:read', (data) => this.handleEvent('dm:read', data));
    this.socket.on('dm:delivered', (data) => this.handleEvent('dm:delivered', data));
    this.socket.on('user:status', (data) => this.handleEvent('user:status', data));
    this.socket.on('users:online', (data) => this.handleEvent('users:online', data));

    // Friend events
    this.socket.on('friend:request', (data) => this.handleEvent('friend:request', data));
    this.socket.on('friend:accepted', (data) => this.handleEvent('friend:accepted', data));
    this.socket.on('friend:removed', (data) => this.handleEvent('friend:removed', data));
  }

  /**
   * Handle incoming real-time events
   */
  private handleEvent(eventType: string, data: any): void {
    console.log('📨 Real-time event:', eventType, data);
    
    // Call all registered handlers for this event
    const handlers = this.eventHandlers.get(eventType) || [];
    handlers.forEach(handler => handler(data));
  }

  /**
   * Subscribe to real-time events
   * Usage: syncEngine.on('room:task:created', (task) => { ... })
   */
  on(eventType: string, handler: SyncEventHandler): () => void {
    const handlers = this.eventHandlers.get(eventType) || [];
    handlers.push(handler);
    this.eventHandlers.set(eventType, handlers);

    // Return unsubscribe function
    return () => {
      const currentHandlers = this.eventHandlers.get(eventType) || [];
      const filtered = currentHandlers.filter(h => h !== handler);
      this.eventHandlers.set(eventType, filtered);
    };
  }

  /**
   * Queue a change for syncing (optimistic update)
   */
  async queueChange(item: Omit<SyncQueueItem, 'id' | 'timestamp' | 'retries'>): Promise<void> {
    const queueItem: SyncQueueItem = {
      ...item,
      id: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      retries: 0,
    };

    this.syncQueue.push(queueItem);
    await this.saveSyncQueue();

    // Try to sync immediately if online
    if (this.isOnline && this.socket?.connected) {
      await this.processSyncQueue();
    }
  }

  /**
   * Process sync queue (send offline changes to server)
   */
  private async processSyncQueue(): Promise<void> {
    if (this.syncQueue.length === 0) return;
    if (!this.socket?.connected) return;

    console.log(`🔄 Processing ${this.syncQueue.length} queued changes...`);

    const itemsToSync = [...this.syncQueue];
    const successIds: string[] = [];

    for (const item of itemsToSync) {
      try {
        // Emit to server via WebSocket
        await this.syncItem(item);
        successIds.push(item.id);
      } catch (error) {
        console.error('Failed to sync item:', item.id, error);
        item.retries++;
        
        // Remove after 5 failed attempts
        if (item.retries >= 5) {
          console.warn('⚠️ Removing item after 5 failed attempts:', item.id);
          successIds.push(item.id);
        }
      }
    }

    // Remove successfully synced items
    this.syncQueue = this.syncQueue.filter(item => !successIds.includes(item.id));
    await this.saveSyncQueue();

    console.log(`✅ Synced ${successIds.length} items, ${this.syncQueue.length} remaining`);
  }

  /**
   * Sync a single item to server
   */
  private async syncItem(item: SyncQueueItem): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Socket not connected'));
        return;
      }

      const event = `${item.entityType}:${item.action}`;
      
      this.socket.emit(event, item.data, (response: any) => {
        if (response?.success) {
          resolve();
        } else {
          reject(new Error(response?.error || 'Sync failed'));
        }
      });

      // Timeout after 10 seconds
      setTimeout(() => reject(new Error('Sync timeout')), 10000);
    });
  }

  /**
   * Network monitoring (detect online/offline)
   */
  private setupNetworkMonitoring(): void {
    NetInfo.addEventListener(state => {
      const wasOnline = this.isOnline;
      this.isOnline = state.isConnected ?? false;

      if (!wasOnline && this.isOnline) {
        console.log('📡 Back online - syncing...');
        this.connect();
        this.processSyncQueue();
      } else if (wasOnline && !this.isOnline) {
        console.log('📡 Offline - queueing changes');
      }
    });
  }

  /**
   * Save sync queue to persistent storage
   */
  private async saveSyncQueue(): Promise<void> {
    try {
      await AsyncStorage.setItem('sync_queue', JSON.stringify(this.syncQueue));
    } catch (error) {
      console.error('Failed to save sync queue:', error);
    }
  }

  /**
   * Load sync queue from persistent storage
   */
  private async loadSyncQueue(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem('sync_queue');
      if (stored) {
        this.syncQueue = JSON.parse(stored);
        console.log(`📥 Loaded ${this.syncQueue.length} queued changes`);
      }
    } catch (error) {
      console.error('Failed to load sync queue:', error);
    }
  }

  /**
   * Disconnect (cleanup)
   */
  disconnect(): void {
    this.socket?.disconnect();
    this.eventHandlers.clear();
    console.log('🔌 Sync Engine disconnected');
  }

  /**
   * Emit a socket event directly (used by messageService for typing, delivery confirmation, etc.)
   */
  emit(event: string, data: any): void {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    }
  }

  /**
   * Get the underlying socket for direct event binding (DM events)
   */
  getSocket(): Socket | null {
    return this.socket;
  }

  /**
   * Check if currently connected
   */
  get connected(): boolean {
    return this.socket?.connected ?? false;
  }

  /**
   * Get sync status (for debugging)
   */
  getStatus() {
    return {
      connected: this.socket?.connected || false,
      online: this.isOnline,
      queueLength: this.syncQueue.length,
      reconnectAttempts: this.reconnectAttempts,
    };
  }
}

export default new SyncEngine();
