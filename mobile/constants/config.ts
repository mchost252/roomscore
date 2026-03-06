import Constants from 'expo-constants';

// ==================== CONFIGURATION ====================
// Set to true for local development, false for production
const USE_LOCAL_DEV = true; // <-- CHANGE THIS to false when ready for production

// Local server URL (emulator/simulator)
const LOCAL_API_URL = 'http://10.0.2.2:5000';  // Android emulator
const LOCAL_SOCKET_URL = 'http://10.0.2.2:5000';

// Production URLs
const PROD_API_URL = 'https://roomscore-production.up.railway.app';
const PROD_SOCKET_URL = 'https://roomscore-production.up.railway.app';

// Get API URL from environment variables, or use configured value
const getApiUrl = (): string => {
  // Check for explicit environment override
  const envUrl = Constants.expoConfig?.extra?.apiUrl || process.env.EXPO_PUBLIC_API_URL;
  if (envUrl) return envUrl;
  
  // Use local or production based on configuration
  return USE_LOCAL_DEV ? LOCAL_API_URL : PROD_API_URL;
};

const getSocketUrl = (): string => {
  // Check for explicit environment override
  const envUrl = Constants.expoConfig?.extra?.socketUrl || process.env.EXPO_PUBLIC_SOCKET_URL;
  if (envUrl) return envUrl;
  
  // Use local or production based on configuration
  return USE_LOCAL_DEV ? LOCAL_SOCKET_URL : PROD_SOCKET_URL;
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
console.log('  - Environment:', USE_LOCAL_DEV ? 'LOCAL DEVELOPMENT' : 'PRODUCTION');
console.log('  - API URL:', API_BASE_URL);
console.log('  - Socket URL:', SOCKET_URL);
console.log('  - Timeout:', API_TIMEOUT / 1000, 'seconds');
