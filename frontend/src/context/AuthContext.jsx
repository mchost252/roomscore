import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';
import api, { clearAllCache, API_BASE_URL } from '../utils/api';
import pushNotificationManager from '../utils/pushNotifications';
import storage from '../utils/storage';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(storage.getItemSync('token'));
  const [storageReady, setStorageReady] = useState(false);

  // Initialize storage on mount (syncs native storage to localStorage)
  useEffect(() => {
    const initStorage = async () => {
      await storage.initialize();
      // Re-check token after storage is initialized
      const storedToken = await storage.getItem('token');
      if (storedToken && storedToken !== token) {
        setToken(storedToken);
      }
      setStorageReady(true);
    };
    initStorage();
  }, []);

  // Load user on mount
  useEffect(() => {
    if (token) {
      loadUser();
    } else {
      setLoading(false);
    }
  }, [token]);

  // Initialize push notifications when user logs in (non-blocking)
  useEffect(() => {
    if (user && token) {
      // Initialize in background without blocking UI
      pushNotificationManager.initialize().catch(err => {
        console.error('Failed to initialize push notifications:', err);
      });
    }
  }, [user, token]);

  // Load user profile
  const loadUser = async () => {
    try {
      console.log('🔄 Loading user profile...');
      const response = await api.get('/auth/profile');
      console.log('✅ User profile loaded:', response.data.user);
      setUser(response.data.user);
      setLoading(false); // Set loading false immediately after user is set
    } catch (error) {
      console.error('❌ Failed to load user:', error.response?.data || error.message);
      setLoading(false);
      logout();
    }
  };

  // Register
  const register = async (email, password, username) => {
    try {
      console.log('📝 Attempting registration to:', `${API_BASE_URL}/api/auth/register`);
      const response = await axios.post(`${API_BASE_URL}/api/auth/register`, {
        email,
        password,
        username
      });
      
      const { token: newToken, refreshToken, user: newUser } = response.data;
      
      // Use async storage for native app support
      await storage.setItem('token', newToken);
      await storage.setItem('refreshToken', refreshToken);
      setToken(newToken);
      setUser(newUser);
      
      return { success: true };
    } catch (error) {
      console.error('❌ Registration failed:', error);
      // Provide detailed error message for debugging
      let errorMessage = 'Registration failed';
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.code === 'ERR_NETWORK') {
        errorMessage = 'Network error - cannot reach server';
      } else if (error.message) {
        errorMessage = error.message;
      }
      return {
        success: false,
        message: errorMessage
      };
    }
  };

  // Login
  const login = async (email, password) => {
    try {
      console.log('🔐 Attempting login to:', `${API_BASE_URL}/api/auth/login`);
      const response = await axios.post(`${API_BASE_URL}/api/auth/login`, {
        email,
        password
      });
      
      console.log('✅ Login response:', response.data);
      const { token: newToken, refreshToken, user: newUser } = response.data;
      
      console.log('💾 Saving token to storage...');
      // Use async storage for native app support
      await storage.setItem('token', newToken);
      await storage.setItem('refreshToken', refreshToken);
      setToken(newToken);
      setUser(newUser);
      
      console.log('✅ Login successful! Token saved:', !!newToken);
      return { success: true };
    } catch (error) {
      console.error('❌ Login failed:', error);
      
      // Handle rate limit error specifically
      if (error.response?.status === 429) {
        return {
          success: false,
          message: 'Too many login attempts. Please try again later.'
        };
      }
      
      // Provide detailed error message for debugging
      let errorMessage = 'Login failed';
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.code === 'ERR_NETWORK') {
        errorMessage = 'Network error - cannot reach server';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      return {
        success: false,
        message: errorMessage
      };
    }
  };

  // Google login
  const googleLogin = async (googleToken) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/api/auth/google`, {
        token: googleToken
      });
      
      const { token: newToken, refreshToken, user: newUser } = response.data;
      
      // Use async storage for native app support
      await storage.setItem('token', newToken);
      await storage.setItem('refreshToken', refreshToken);
      setToken(newToken);
      setUser(newUser);
      
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Google login failed'
      };
    }
  };

  // Logout
  const logout = async () => {
    try {
      await api.post('/auth/logout');
      
      // Unsubscribe from push notifications
      await pushNotificationManager.unsubscribe().catch(err => {
        console.error('Error unsubscribing from push notifications:', err);
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear all cache on logout
      clearAllCache();
      
      // Use async storage for native app support
      await storage.removeItem('token');
      await storage.removeItem('refreshToken');
      setToken(null);
      setUser(null);
    }
  };

  // Update profile
  const updateProfile = async (updates) => {
    try {
      const response = await api.put('/auth/profile', updates);
      setUser(response.data.user);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Profile update failed'
      };
    }
  };

  // Enable push notifications
  const enablePushNotifications = async () => {
    try {
      await pushNotificationManager.enable();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Failed to enable push notifications'
      };
    }
  };

  // Disable push notifications
  const disablePushNotifications = async () => {
    try {
      await pushNotificationManager.unsubscribe();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Failed to disable push notifications'
      };
    }
  };

  const value = {
    user,
    loading,
    register,
    login,
    googleLogin,
    logout,
    updateProfile,
    loadUser,
    enablePushNotifications,
    disablePushNotifications
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
