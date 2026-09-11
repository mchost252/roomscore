import { io, Socket } from 'socket.io-client';
import { secureStorage } from './storage';
import { TOKEN_KEY, SOCKET_URL } from '../constants/config';

// ─── WebSocket manager for room-task-thread ────────────────────────────────────
// Used only by room-task-thread.tsx for room-specific real-time events.
// NOTE: syncEngine is the primary socket for the rest of the app.
// TODO: Consolidate into syncEngine during Phase 6 (settings + polish).

class WebSocketManager {
  private socket: Socket | null = null;
  private isConnected = false;
  private currentRoomId: string | null = null;

  // Track all listeners to re-attach them on reconnection/room switch
  private listeners: Map<string, Set<(data: any) => void>> = new Map();
  private onConnectCallbacks: Array<() => void> = [];

  async connect(roomId: string, userToken?: string) {
    // Prevent duplicate connections to same room
    if (this.socket && this.isConnected && this.currentRoomId === roomId) {
      return;
    }
    
    // Disconnect existing connection if different room
    if (this.socket) {
      console.log('[WebSocketManager] Switching rooms, disconnecting from:', this.currentRoomId);
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }

    this.currentRoomId = roomId;

    // Resolve token
    let token = userToken || '';
    if (!token) {
      try {
        token = await secureStorage.getItem(TOKEN_KEY) || '';
      } catch {
        console.warn('[WebSocketManager] Failed to read token');
      }
    }

    try {
      this.socket = io(SOCKET_URL, {
        transports: ['websocket'],
        auth: { token, roomId },
      });

      this.socket.on('connect', () => {
        console.log('[WebSocketManager] Connected to room:', roomId);
        this.isConnected = true;
        this.socket?.emit('room:join', roomId);
        
        // Re-attach all registered listeners
        this.listeners.forEach((callbacks, event) => {
          callbacks.forEach(cb => {
            this.socket?.on(event, cb);
          });
        });

        // Fire onConnect callbacks
        this.onConnectCallbacks.forEach(cb => cb());
        this.onConnectCallbacks = [];
      });

      this.socket.on('disconnect', () => {
        console.log('[WebSocketManager] Disconnected');
        this.isConnected = false;
      });

      this.socket.on('connect_error', (error) => {
        console.error('[WebSocketManager] Connection error:', error);
        this.isConnected = false;
      });

    } catch (error) {
      console.error('[WebSocketManager] Failed to connect:', error);
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.currentRoomId = null;
    }
  }

  on(event: string, callback: (data: any) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    // If already connected, attach immediately
    if (this.socket && this.isConnected) {
      this.socket.on(event, callback);
    }
  }

  off(event: string, callback: (data: any) => void) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.delete(callback);
      if (callbacks.size === 0) {
        this.listeners.delete(event);
      }
    }
    
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }

  onceConnected(callback: () => void) {
    if (this.isConnected) {
      callback();
    } else {
      this.onConnectCallbacks.push(callback);
    }
  }

  emit(event: string, data: any) {
    if (this.socket && this.isConnected) {
      this.socket.emit(event, data);
    }
  }

  isConnectedToServer(): boolean {
    return this.isConnected;
  }
}

export const webSocketManager = new WebSocketManager();