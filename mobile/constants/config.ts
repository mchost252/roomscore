import Constants from 'expo-constants';

// Get API URL from environment variables
// Use EXPO_PUBLIC_ prefix for Expo SDK 54+
const getApiUrl = (): string => {
  const envUrl = Constants.expoConfig?.extra?.apiUrl || process.env.EXPO_PUBLIC_API_URL;
  
  if (envUrl) {
    return envUrl;
  }
  
  // Fallback to production Railway URL
  return 'https://roomscore-production.up.railway.app';
};

const getSocketUrl = (): string => {
  const envUrl = Constants.expoConfig?.extra?.socketUrl || process.env.EXPO_PUBLIC_SOCKET_URL;
  
  if (envUrl) {
    return envUrl;
  }
  
  // Fallback to production Railway URL
  return 'https://roomscore-production.up.railway.app';
};

export const API_BASE_URL = getApiUrl();
export const SOCKET_URL = getSocketUrl();
export const API_TIMEOUT = 30000; // 30 seconds - increased for Railway/Neon cold starts

// Token storage keys
export const TOKEN_KEY = 'auth_token';
export const REFRESH_TOKEN_KEY = 'refresh_token';

// API endpoints
export const API_ENDPOINTS = {
  // Auth
  LOGIN: '/api/auth/login',
  REGISTER: '/api/auth/register',
  LOGOUT: '/api/auth/logout',
  PROFILE: '/api/auth/profile',
  REFRESH: '/api/auth/refresh',
  
  // Rooms
  ROOMS: '/api/rooms',
  
  // Tasks
  TASKS: '/api/rooms',
  
  // Notifications
  NOTIFICATIONS: '/api/notifications',
  
  // Friends
  FRIENDS: '/api/friends',
  
  // Direct Messages
  DIRECT_MESSAGES: '/api/direct-messages',
} as const;

console.log('🌐 API Configuration:');
console.log('  - API URL:', API_BASE_URL);
console.log('  - Socket URL:', SOCKET_URL);
