import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

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
  const socketRef = useRef(null);

  useEffect(() => {
    if (user && !socketRef.current) {
      // Connect socket immediately - don't block render with artificial delay
      const token = localStorage.getItem('token');
      
      const newSocket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000', {
        auth: { token },
        transports: ['websocket', 'polling']
      });

      newSocket.on('connect', () => {
        console.log('Socket connected');
        setConnected(true);
      });

      newSocket.on('disconnect', () => {
        console.log('Socket disconnected');
        setConnected(false);
      });

      newSocket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
        setConnected(false);
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

  const value = {
    socket,
    connected,
    joinRoom,
    leaveRoom,
    sendTyping,
    on,
    off
  };

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};
