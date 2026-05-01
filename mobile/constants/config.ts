import Constants from 'expo-constants';
import { Platform } from 'react-native';

// ==================== CONFIGURATION ====================
// Set to true for local development, false for production
const USE_LOCAL_DEV = true; // <-- CHANGE THIS to false when ready for production

// Local server URL (emulator/simulator)
const LOCAL_API_URL = 'http://10.126.141.150:5000';  // Physical device
const LOCAL_SOCKET_URL = 'http://10.126.141.150:5000';

const LOCAL_WEB_URL = 'http://localhost:5000';  // Browser testing
const LOCAL_WEB_SOCKET_URL = 'http://localhost:5000';

// Production URLs
const PROD_API_URL = 'https://roomscore-production.up.railway.app';
const PROD_SOCKET_URL = 'https://roomscore-production.up.railway.app';

// Detect if running on web - check multiple ways
const isWebPlatform = (): boolean => {
  // Check Platform.OS first
  if (Platform.OS === 'web') return true;
  
  // Fallback: check for browser-specific globals
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    return true;
  }
  
  return false;
};

// Debug: log the detected platform
console.log('🔍 Platform detection:', { 
  PlatformOS: Platform.OS, 
  isWeb: isWebPlatform(),
  hasWindow: typeof window !== 'undefined',
  hasDocument: typeof document !== 'undefined'
});

// Get API URL - check web first, then env, then default
const getApiUrl = (): string => {
  // Detect if running on web - prioritize web detection over env
  if (isWebPlatform()) {
    return USE_LOCAL_DEV ? LOCAL_WEB_URL : PROD_API_URL;
  }
  
  // Check for explicit environment override (for native mobile)
  const envUrl = Constants.expoConfig?.extra?.apiUrl || process.env.EXPO_PUBLIC_API_URL;
  if (envUrl) return envUrl;
  
  // Use local or production based on configuration
  return USE_LOCAL_DEV ? LOCAL_API_URL : PROD_API_URL;
};

// AI Agent URLs
const LOCAL_AI_URL = 'http://10.126.141.150:3000/api/chat';
const LOCAL_WEB_AI_URL = 'http://localhost:3000/api/chat';
const LOCAL_AI_TASK_URL = 'http://10.126.141.150:3000/api/task-assist';
const LOCAL_WEB_AI_TASK_URL = 'http://localhost:3000/api/task-assist';

// ... existing code ...

const getSocketUrl = (): string => {
  // Detect if running on web - prioritize web detection over env
  if (isWebPlatform()) {
    return USE_LOCAL_DEV ? LOCAL_WEB_SOCKET_URL : PROD_SOCKET_URL;
  }
  
  // Check for explicit environment override (for native mobile)
  const envUrl = Constants.expoConfig?.extra?.socketUrl || process.env.EXPO_PUBLIC_SOCKET_URL;
  if (envUrl) return envUrl;
  
  // Use local or production based on configuration
  return USE_LOCAL_DEV ? LOCAL_SOCKET_URL : PROD_SOCKET_URL;
};

const getAiUrl = (): string => {
  if (isWebPlatform()) return USE_LOCAL_DEV ? LOCAL_WEB_AI_URL : '/api/chat';
  return process.env.EXPO_PUBLIC_AI_AGENT_URL || LOCAL_AI_URL;
};

const getAiTaskUrl = (): string => {
  if (isWebPlatform()) return USE_LOCAL_DEV ? LOCAL_WEB_AI_TASK_URL : '/api/task-assist';
  return process.env.EXPO_PUBLIC_AI_TASK_ASSIST_URL || LOCAL_AI_TASK_URL;
};

export const API_BASE_URL = getApiUrl();
export const SOCKET_URL = getSocketUrl();
export const AI_AGENT_URL = getAiUrl();
export const AI_TASK_ASSIST_URL = getAiTaskUrl();
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
