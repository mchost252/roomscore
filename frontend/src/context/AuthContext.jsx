import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';
import api, { clearAllCache, API_BASE_URL } from '../utils/api';
import pushNotificationManager from '../utils/pushNotifications';

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
  const [token, setToken] = useState(localStorage.getItem('token'));

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
      const response = await axios.post(`${API_BASE_URL}/api/auth/register`, {
        email,
        password,
        username
      });
      
      const { token: newToken, refreshToken, user: newUser } = response.data;
      
      localStorage.setItem('token', newToken);
      localStorage.setItem('refreshToken', refreshToken);
      setToken(newToken);
      setUser(newUser);
      
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Registration failed'
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
      
      console.log('💾 Saving token to localStorage...');
      localStorage.setItem('token', newToken);
      localStorage.setItem('refreshToken', refreshToken);
      setToken(newToken);
      setUser(newUser);
      
      console.log('✅ Login successful! Token saved:', !!newToken);
      return { success: true };
    } catch (error) {
      console.error('❌ Login failed:', error.response?.data || error.message);
      
      // Handle rate limit error specifically
      if (error.response?.status === 429) {
        return {
          success: false,
          message: 'Too many login attempts. Please try again later.'
        };
      }
      
      return {
        success: false,
        message: error.response?.data?.message || 'Login failed'
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
      
      localStorage.setItem('token', newToken);
      localStorage.setItem('refreshToken', refreshToken);
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
      
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
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
