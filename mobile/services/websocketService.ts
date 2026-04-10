import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { secureStorage } from './storage';
import { TOKEN_KEY, SOCKET_URL } from '../constants/config';

interface WebSocketService {
  socket: Socket | null;
  isConnected: boolean;
  connect: (roomId: string) => void;
  disconnect: () => void;
  onTaskUpdate: (callback: (data: any) => void) => void;
  onTaskComplete: (callback: (data: any) => void) => void;
  onTaskAssign: (callback: (data: any) => void) => void;
  offTaskUpdate: (callback: (data: any) => void) => void;
  offTaskComplete: (callback: (data: any) => void) => void;
  offTaskAssign: (callback: (data: any) => void) => void;
}

export const useWebSocket = (): WebSocketService => {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    secureStorage.getItem(TOKEN_KEY).then((t) => {
      if (!cancelled) setAuthToken(t);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const connect = (roomId: string) => {
    if (!user) return;

    try {
      const token = authToken || user.token || '';
      // Connect to WebSocket server
      const newSocket = io(process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001', {
        transports: ['websocket'],
        auth: {
          token,
          roomId: roomId,
        },
      });

      newSocket.on('connect', () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        socketRef.current = newSocket;
        setSocket(newSocket);
        
        // Join the room to receive room-specific events
        newSocket.emit('join_room', roomId);
      });

      newSocket.on('disconnect', () => {
        console.log('WebSocket disconnected');
        setIsConnected(false);
        socketRef.current = null;
        setSocket(null);
      });

      newSocket.on('connect_error', (error) => {
        console.error('WebSocket connection error:', error);
        setIsConnected(false);
      });

    } catch (error) {
      console.error('Failed to connect to WebSocket:', error);
    }
  };

  const disconnect = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setSocket(null);
      setIsConnected(false);
    }
  };

  const onTaskUpdate = (callback: (data: any) => void) => {
    if (socketRef.current) {
      socketRef.current.on('task_update', callback);
    }
  };

  const onTaskComplete = (callback: (data: any) => void) => {
    if (socketRef.current) {
      socketRef.current.on('task_complete', callback);
    }
  };

  const onTaskAssign = (callback: (data: any) => void) => {
    if (socketRef.current) {
      socketRef.current.on('task_assign', callback);
    }
  };

  const offTaskUpdate = (callback: (data: any) => void) => {
    if (socketRef.current) {
      socketRef.current.off('task_update', callback);
    }
  };

  const offTaskComplete = (callback: (data: any) => void) => {
    if (socketRef.current) {
      socketRef.current.off('task_complete', callback);
    }
  };

  const offTaskAssign = (callback: (data: any) => void) => {
    if (socketRef.current) {
      socketRef.current.off('task_assign', callback);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  return {
    socket,
    isConnected,
    connect,
    disconnect,
    onTaskUpdate,
    onTaskComplete,
    onTaskAssign,
    offTaskUpdate,
    offTaskComplete,
    offTaskAssign,
  };
};

// Simple WebSocket manager for direct use
class WebSocketManager {
  private socket: Socket | null = null;
  private isConnected = false;
  private currentRoomId: string | null = null;

  private pendingListeners: Array<{ event: string; callback: (data: any) => void }> = [];
  private onConnectCallbacks: Array<() => void> = [];

  async connect(roomId: string, userToken?: string) {
    // Prevent duplicate connections
    if (this.socket && this.isConnected && this.currentRoomId === roomId) {
      console.log('WebSocket already connected to room:', roomId);
      return;
    }
    
    // Disconnect existing connection if different room
    if (this.socket && this.currentRoomId !== roomId) {
      this.disconnect();
    }

    this.currentRoomId = roomId;

    // Resolve token: prefer passed token, then read from secure storage
    let token = userToken || '';
    if (!token) {
      try {
        token = await secureStorage.getItem(TOKEN_KEY) || '';
      } catch {
        console.warn('[WebSocketManager] Failed to read token from secureStorage');
      }
    }

    if (!token) {
      console.warn('[WebSocketManager] No auth token available — socket will likely fail auth');
    }

    try {
      this.socket = io(SOCKET_URL, {
        transports: ['websocket'],
        auth: {
          token,
          roomId: roomId,
        },
      });

      this.socket.on('connect', () => {
        console.log('WebSocket connected to room:', roomId);
        this.isConnected = true;
        // Join the room for real-time updates
        this.socket?.emit('join_room', roomId);
        // Flush any pending listeners that were registered before connection
        this.pendingListeners.forEach(({ event, callback }) => {
          this.socket?.on(event, callback);
        });
        this.pendingListeners = [];
        // Fire onConnect callbacks
        this.onConnectCallbacks.forEach(cb => cb());
        this.onConnectCallbacks = [];
      });

      this.socket.on('disconnect', () => {
        console.log('WebSocket disconnected');
        this.isConnected = false;
      });

      this.socket.on('connect_error', (error) => {
        console.error('WebSocket connection error:', error);
        this.isConnected = false;
      });

    } catch (error) {
      console.error('Failed to connect to WebSocket:', error);
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  on(event: string, callback: (data: any) => void) {
    if (this.socket && this.isConnected) {
      this.socket.on(event, callback);
    } else if (this.socket) {
      // Socket exists but not yet connected — queue the listener
      this.pendingListeners.push({ event, callback });
    } else {
      // No socket at all — queue for when connect() is called
      this.pendingListeners.push({ event, callback });
    }
  }

  onceConnected(callback: () => void) {
    if (this.isConnected) {
      callback();
    } else {
      this.onConnectCallbacks.push(callback);
    }
  }

  off(event: string, callback: (data: any) => void) {
    if (this.socket) {
      this.socket.off(event, callback);
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