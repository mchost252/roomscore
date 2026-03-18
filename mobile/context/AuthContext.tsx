import React, { createContext, useState, useContext, useEffect, useRef, ReactNode } from 'react';
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
  // FIX: useRef so the cooldown persists across re-renders (was a plain `let` before)
  const lastLoadUserAttemptRef = useRef(0);
  const LOAD_USER_COOLDOWN = 30000; // 30 seconds

  // Helper: safely initialize all messaging services
  const initializeMessagingServices = async (userId: string, token: string) => {
    try {
      await sqliteService.initialize();
    } catch (err) {
      console.warn('[Auth] SQLite init failed (non-fatal):', err);
    }
    try {
      await syncEngine.initialize(userId.toString(), token);
    } catch (err) {
      console.warn('[Auth] SyncEngine init failed (non-fatal):', err);
    }
    try {
      await messageService.initialize(userId);
    } catch (err) {
      console.warn('[Auth] MessageService init failed (non-fatal):', err);
    }
  };

  // Load user on mount
  useEffect(() => {
    console.log('[Auth] AuthProvider mounted');
    checkAuthStatus().catch((err) => {
      console.error('[Auth] Fatal error in checkAuthStatus:', err);
      setLoading(false);
    });
  }, []);

  // Check if user is authenticated
  const checkAuthStatus = async () => {
    try {
      const token = await secureStorage.getItem(TOKEN_KEY);
      if (token) {
        // OPTIMISTIC: Load cached user immediately for instant UI
        const cachedUser = await secureStorage.getItem('cached_user');
        if (cachedUser) {
          const parsed = JSON.parse(cachedUser);
          setUser(parsed);
          setLoading(false);

          // Initialize messaging services in background (with error handling)
          await initializeMessagingServices(parsed.id, token);
        }
        
        // Then fetch fresh data in background
        await loadUser();
      } else {
        setLoading(false);
      }
    } catch (error) {
      console.error('[Auth] Error checking auth status:', error);
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

  // Load user profile (debounced to prevent rate limiting)
  const loadUser = async () => {
    const now = Date.now();
    if (now - lastLoadUserAttemptRef.current < LOAD_USER_COOLDOWN) {
      return;
    }
    lastLoadUserAttemptRef.current = now;

    try {
      const response = await api.get('/auth/profile', { timeout: 5000 });
      
      // Cache user data for next instant load
      await secureStorage.setItem('cached_user', JSON.stringify(response.data.user));
      
      setUser(response.data.user);
      setLoading(false);
    } catch (error: any) {
      console.error('[Auth] Failed to load user:', error.response?.data || error.message);
      
      // Only logout on explicit auth errors (401)
      if (error.response?.status === 401) {
        await secureStorage.removeItem('cached_user');
        setLoading(false);
        await logout();
      } else {
        setLoading(false);
      }
    }
  };

  // Register
  const register = async (email: string, password: string, username: string) => {
    try {
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
      // Cache user for instant load next time
      await secureStorage.setItem('cached_user', JSON.stringify(newUser));
      
      setUser(newUser);

      // FIX: Initialize messaging services after registration (was missing before)
      await initializeMessagingServices(newUser.id, token);
      
      console.log('[Auth] Registration successful');
      return { success: true };
    } catch (error: any) {
      console.error('[Auth] Registration failed:', error.response?.data || error.message);
      
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
      // Cache user for instant load next time
      await secureStorage.setItem('cached_user', JSON.stringify(newUser));
      
      setUser(newUser);
      
      // Initialize all messaging services
      await initializeMessagingServices(newUser.id, token);
      
      console.log('[Auth] Login successful');
      return { success: true };
    } catch (error: any) {
      console.error('[Auth] Login failed:', error.response?.data || error.message);
      
      let errorMessage = 'Login failed';
      
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
      console.error('[Auth] Logout API error:', error);
    } finally {
      await secureStorage.removeItem(TOKEN_KEY);
      await secureStorage.removeItem(REFRESH_TOKEN_KEY);
      await secureStorage.removeItem('cached_user');
      
      // Disconnect real-time services
      syncEngine.disconnect();
      messageService.disconnect();
      
      // FIX: Clear local data on logout to prevent cross-user data leakage
      try {
        await sqliteService.clearAllData();
      } catch (err) {
        console.warn('[Auth] Failed to clear SQLite on logout:', err);
      }
      
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
