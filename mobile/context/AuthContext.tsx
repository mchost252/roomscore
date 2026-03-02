import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import axios from 'axios';
import api from '../services/api';
import { secureStorage } from '../services/storage';
import { TOKEN_KEY, REFRESH_TOKEN_KEY, API_BASE_URL } from '../constants/config';
import { User, AuthResponse } from '../types';
import syncEngine from '../services/syncEngine';
import messageService from '../services/messageService';
import sqliteService from '../services/sqliteService';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  signup: (name: string, email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  register: (email: string, password: string, username: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<{ success: boolean; user?: User; message?: string }>;
  loadUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Load user on mount
  useEffect(() => {
    console.log('🚀 AuthProvider mounted');
    checkAuthStatus().catch((err) => {
      console.error('❌ Fatal error in checkAuthStatus:', err);
      setLoading(false);
    });
  }, []);

  // Check if user is authenticated
  const checkAuthStatus = async () => {
    try {
      console.log('🔍 Checking auth status...');
      const token = await secureStorage.getItem(TOKEN_KEY);
      if (token) {
        console.log('✅ Token found');
        
        // PHASE 1 OPTIMISTIC: Load cached user immediately for instant UI
        const cachedUser = await secureStorage.getItem('cached_user');
        if (cachedUser) {
          console.log('⚡ Using cached user for instant load');
          const parsed = JSON.parse(cachedUser);
          setUser(parsed);
          setLoading(false);

          // Initialize messaging services in background
          await sqliteService.initialize();
          await syncEngine.initialize(parsed.id.toString(), token);
          await messageService.initialize(parsed.id);
        }
        
        // Then fetch fresh data in background
        await loadUser();
      } else {
        console.log('ℹ️ No token found, user not authenticated');
        setLoading(false);
      }
    } catch (error) {
      console.error('❌ Error checking auth status:', error);
      setLoading(false);
    }
  };

  // Get user's timezone
  const getUserTimezone = (): string => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch (e) {
      return 'UTC';
    }
  };

  // Load user profile
  const loadUser = async (retryCount = 0) => {
    try {
      console.log('🔄 Loading user profile...');
      const response = await api.get('/auth/profile', { timeout: 5000 });
      console.log('✅ User profile loaded');
      
      // PHASE 1: Cache user data for next instant load
      await secureStorage.setItem('cached_user', JSON.stringify(response.data.user));
      
      setUser(response.data.user);
      setLoading(false);
    } catch (error: any) {
      console.error('❌ Failed to load user:', error.response?.data || error.message);
      
      // Only logout on explicit auth errors (401)
      if (error.response?.status === 401) {
        console.log('🔒 Authentication failed - logging out');
        await secureStorage.removeItem('cached_user');
        setLoading(false);
        await logout();
      } else {
        // Don't retry - just set loading false to avoid delays
        console.warn('⚠️ Could not load user profile');
        setLoading(false);
      }
    }
  };

  // Register
  const register = async (email: string, password: string, username: string) => {
    try {
      console.log('📝 Attempting registration...');
      const timezone = getUserTimezone();
      
      const response = await axios.post<AuthResponse>(`${API_BASE_URL}/api/auth/register`, {
        email,
        password,
        username,
        timezone,
      });
      
      const { token, refreshToken, user: newUser } = response.data;
      
      await secureStorage.setItem(TOKEN_KEY, token);
      await secureStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
      
      setUser(newUser);
      console.log('✅ Registration successful');
      
      return { success: true };
    } catch (error: any) {
      console.error('❌ Registration failed:', error.response?.data || error.message);
      
      let errorMessage = 'Registration failed';
      
      if (error.response?.data?.errors && error.response.data.errors.length > 0) {
        errorMessage = error.response.data.errors.map((e: any) => e.message).join('. ');
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.code === 'ERR_NETWORK') {
        errorMessage = 'Network error - cannot reach server';
      } else if (error.response?.status === 400) {
        errorMessage = 'Invalid input. Please check your email, username, and password.';
      } else if (error.response?.status === 500) {
        errorMessage = 'Server error. Please try again later.';
      }
      
      return { success: false, message: errorMessage };
    }
  };

  // Login
  const login = async (email: string, password: string) => {
    try {
      console.log('🔐 Attempting login...');
      const timezone = getUserTimezone();
      
      const response = await axios.post<AuthResponse>(`${API_BASE_URL}/api/auth/login`, {
        email,
        password,
        timezone,
      }, {
        timeout: 20000,
      });
      
      const { token, refreshToken, user: newUser } = response.data;
      
      await secureStorage.setItem(TOKEN_KEY, token);
      await secureStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
      // PHASE 1: Cache user for instant load next time
      await secureStorage.setItem('cached_user', JSON.stringify(newUser));
      
      setUser(newUser);
      
      // PHASE 3: Initialize real-time sync engine
      await syncEngine.initialize(newUser.id.toString(), token);
      
      // PHASE 4: Initialize messaging (SQLite + socket listeners)
      await sqliteService.initialize();
      await messageService.initialize(newUser.id);
      
      console.log('✅ Login successful');
      
      return { success: true };
    } catch (error: any) {
      console.error('❌ Login failed:', error.response?.data || error.message);
      
      let errorMessage = 'Login failed';
      
      // Check for network errors with better detection
      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        errorMessage = 'Connection timed out. The server might be starting up. Please try again.';
      } else if (error.code === 'ERR_NETWORK' || error.message === 'Network Error' || !error.response) {
        errorMessage = 'Unable to connect. Please check your internet connection and try again.';
      } else if (error.response?.status === 429) {
        errorMessage = 'Too many login attempts. Please try again later.';
      } else if (error.response?.data?.errors && error.response.data.errors.length > 0) {
        errorMessage = error.response.data.errors.map((e: any) => e.message).join('. ');
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.status === 401) {
        errorMessage = 'Invalid credentials. Please check your email and password.';
      } else if (error.response?.status === 500) {
        errorMessage = 'Server error. Please try again later.';
      }
      
      return { success: false, message: errorMessage };
    }
  };

  // Logout
  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      await secureStorage.removeItem(TOKEN_KEY);
      await secureStorage.removeItem(REFRESH_TOKEN_KEY);
      await secureStorage.removeItem('cached_user');
      
      // PHASE 3: Disconnect sync engine
      syncEngine.disconnect();
      
      // PHASE 4: Disconnect messaging
      messageService.disconnect();
      
      setUser(null);
    }
  };

  // Update profile
  const updateProfile = async (updates: Partial<User>) => {
    try {
      const response = await api.put('/auth/profile', updates);
      setUser(response.data.user);
      return { success: true, user: response.data.user };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Profile update failed',
      };
    }
  };

  // Signup (alias for register with different parameter order)
  const signup = async (name: string, email: string, password: string) => {
    return register(email, password, name);
  };

  const value: AuthContextType = {
    user,
    loading,
    login,
    signup,
    register,
    logout,
    updateProfile,
    loadUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
