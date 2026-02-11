// COPIED FROM: frontend/src/context/AuthContext.jsx
// ADAPTED FOR: React Native (AsyncStorage instead of localStorage)

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth as authAPI } from '../services/api';

interface User {
  id: string;
  email: string;
  username: string;
  avatar?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load token and user on mount
  useEffect(() => {
    loadAuth();
  }, []);

  const loadAuth = async () => {
    try {
      const storedToken = await AsyncStorage.getItem('token');
      if (storedToken) {
        setToken(storedToken);
        await fetchUser(storedToken);
      }
    } catch (error) {
      console.error('Failed to load auth:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUser = async (authToken: string) => {
    try {
      const response = await authAPI.me(authToken);
      setUser(response.data.user);
    } catch (error) {
      console.error('Failed to fetch user:', error);
      await logout();
    }
  };

  const login = async (email: string, password: string) => {
    const response = await authAPI.login(email, password);
    const { token: newToken, user: newUser } = response.data;
    
    await AsyncStorage.setItem('token', newToken);
    setToken(newToken);
    setUser(newUser);
  };

  const register = async (email: string, username: string, password: string) => {
    const response = await authAPI.register(email, username, password);
    const { token: newToken, user: newUser } = response.data;
    
    await AsyncStorage.setItem('token', newToken);
    setToken(newToken);
    setUser(newUser);
  };

  const logout = async () => {
    await AsyncStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  const refreshUser = async () => {
    if (token) {
      await fetchUser(token);
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
