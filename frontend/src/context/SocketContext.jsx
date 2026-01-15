import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { API_BASE_URL } from '../utils/api';

const SocketContext = createContext();

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export const SocketProvider = ({ children }) => {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const socketRef = useRef(null);
  const reconnectAttempts = useRef(0);

  useEffect(() => {
    if (user && !socketRef.current) {
      const token = localStorage.getItem('token');
      
      const newSocket = io(API_BASE_URL, {
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 15,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 10000,
        timeout: 30000
      });

      newSocket.on('connect', () => {
        console.log('Socket connected');
        setConnected(true);
        reconnectAttempts.current = 0;
        
        // Immediately request online users list on connection
        newSocket.emit('users:getOnline');
      });

      newSocket.on('disconnect', (reason) => {
        console.log('Socket disconnected:', reason);
        setConnected(false);
        
        // If server disconnected us, try to reconnect
        if (reason === 'io server disconnect') {
          newSocket.connect();
        }
      });

      newSocket.on('reconnect', (attemptNumber) => {
        console.log('Socket reconnected after', attemptNumber, 'attempts');
        setConnected(true);
        // Request online users after reconnection
        newSocket.emit('users:getOnline');
      });

      newSocket.on('reconnect_attempt', (attemptNumber) => {
        console.log('Socket reconnection attempt:', attemptNumber);
        reconnectAttempts.current = attemptNumber;
        
        // Refresh auth token on reconnection attempts to ensure we have the latest
        const freshToken = localStorage.getItem('token');
        if (freshToken && freshToken !== newSocket.auth.token) {
          console.log('🔄 Updating socket auth token for reconnection');
          newSocket.auth.token = freshToken;
        }
      });

      newSocket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
        setConnected(false);
        
        // Handle specific error cases
        if (error.message === 'User not found or inactive') {
          console.warn('⚠️ Socket auth failed - user may not be synced yet. Will retry automatically.');
          // Don't disconnect permanently - let the reconnection logic handle it
          // The user might just need time for the database to sync
        } else if (error.message === 'Authentication error') {
          console.warn('⚠️ Socket auth token may be invalid. Will retry with fresh token on reconnect.');
        }
      });

      // Handle online users list
      newSocket.on('users:online', (userIds) => {
        setOnlineUsers(new Set(userIds));
      });

      // Handle individual user status changes
      newSocket.on('user:status', ({ userId, isOnline }) => {
        setOnlineUsers(prev => {
          const newSet = new Set(prev);
          if (isOnline) {
            newSet.add(userId);
          } else {
            newSet.delete(userId);
          }
          return newSet;
        });
      });

      socketRef.current = newSocket;
      setSocket(newSocket);

      return () => {
        if (socketRef.current) {
          socketRef.current.disconnect();
          socketRef.current = null;
          setSocket(null);
          setConnected(false);
        }
      };
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
        setConnected(false);
      }
    };
  }, [user]);

  // Join room
  const joinRoom = (roomId) => {
    if (socket && connected) {
      socket.emit('room:join', roomId);
    }
  };

  // Leave room
  const leaveRoom = (roomId) => {
    if (socket && connected) {
      socket.emit('room:leave', roomId);
    }
  };

  // Typing indicator
  const sendTyping = (roomId, isTyping) => {
    if (socket && connected) {
      socket.emit('chat:typing', { roomId, isTyping });
    }
  };

  // Subscribe to event
  const on = (event, callback) => {
    if (socket) {
      socket.on(event, callback);
    }
  };

  // Unsubscribe from event
  const off = (event, callback) => {
    if (socket) {
      socket.off(event, callback);
    }
  };

  // Check if a specific user is online
  const isUserOnline = useCallback((userId) => {
    return onlineUsers.has(userId);
  }, [onlineUsers]);

  // Request fresh online users list
  const refreshOnlineUsers = useCallback(() => {
    if (socket && connected) {
      socket.emit('users:getOnline');
    }
  }, [socket, connected]);

  // Check status of a specific user
  const checkUserStatus = useCallback((userId) => {
    if (socket && connected) {
      socket.emit('user:checkStatus', userId);
    }
  }, [socket, connected]);

  const value = {
    socket,
    connected,
    onlineUsers,
    joinRoom,
    leaveRoom,
    sendTyping,
    on,
    off,
    isUserOnline,
    refreshOnlineUsers,
    checkUserStatus
  };

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};
