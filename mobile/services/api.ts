import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { API_BASE_URL, API_TIMEOUT, TOKEN_KEY, REFRESH_TOKEN_KEY } from '../constants/config';
import { secureStorage } from './storage';

// Create axios instance
const api: AxiosInstance = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  timeout: API_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY = 1500;

// Offline queue for mutations
interface QueuedRequest {
  config: InternalAxiosRequestConfig;
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
  timestamp: number;
}

let offlineQueue: QueuedRequest[] = [];
let isOffline = false;

// Token refresh mutex - prevents concurrent 401 handlers from racing
let refreshPromise: Promise<string> | null = null;

// Subscribe to network state - only on native platforms
if (Platform.OS !== 'web') {
  NetInfo.addEventListener(state => {
    const wasOffline = isOffline;
    isOffline = !state.isConnected;
    
    // Process queue when coming back online
    if (wasOffline && !isOffline && offlineQueue.length > 0) {
      console.log(`Processing ${offlineQueue.length} queued requests`);
      const queue = [...offlineQueue];
      offlineQueue = [];
      queue.forEach(item => {
        api(item.config).then(item.resolve).catch(item.reject);
      });
    }
  });
}

// Helper to check if request should be retried
const shouldRetry = (error: AxiosError): boolean => {
  if (error.code === 'ECONNABORTED') return true;
  if (!error.response) return true;
  if (error.response?.status >= 500) return true;
  if (error.response?.status === 429) return true;
  return false;
};

// Sleep helper
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Request interceptor - add auth token and logging
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    // Log in development
    if (__DEV__) {
      console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url}`, config.data);
    }

    try {
      const token = await secureStorage.getItem(TOKEN_KEY);
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      } else if (!token) {
        console.warn(
          `[API] No auth token found for ${config.method?.toUpperCase()} ${config.url} — request will be sent without Authorization header. ` +
          'If this is not a public endpoint, expect a 401.'
        );
      }
    } catch (error) {
      console.error('[API] Failed to read token from secure store:', error);
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - handle token refresh, retries, and offline queue
api.interceptors.response.use(
  (response) => {
    if (__DEV__) {
      console.log(`[API Response] ${response.config.url}`, response.status, response.data);
    }
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { 
      _retry?: boolean; 
      _retryCount?: number;
      _isOfflineQueued?: boolean;
    };
    
    if (!originalRequest) {
      return Promise.reject(error);
    }

    // Handle offline state for mutations (POST, PUT, DELETE, PATCH)
    if (isOffline && originalRequest.method && 
        ['post', 'put', 'delete', 'patch'].includes(originalRequest.method.toLowerCase()) &&
        !originalRequest._isOfflineQueued) {
      
      return new Promise((resolve, reject) => {
        offlineQueue.push({
          config: { ...originalRequest, _isOfflineQueued: true },
          resolve,
          reject,
          timestamp: Date.now(),
        });
      });
    }

    // Handle 401 - Token expired (with mutex to prevent concurrent refresh races)
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        // If a refresh is already in flight, share the same promise
        if (!refreshPromise) {
          refreshPromise = (async () => {
            const refreshToken = await secureStorage.getItem(REFRESH_TOKEN_KEY);
            if (!refreshToken) {
              throw new Error('No refresh token');
            }
            const response = await axios.post(`${API_BASE_URL}/api/auth/refresh`, { 
              refreshToken 
            });
            const { token } = response.data;
            await secureStorage.setItem(TOKEN_KEY, token);
            return token;
          })();
        }

        const token = await refreshPromise;
        refreshPromise = null; // Clear mutex after success
        
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${token}`;
        }
        return api(originalRequest);
      } catch (refreshError) {
        refreshPromise = null; // Clear mutex on failure
        await secureStorage.removeItem(TOKEN_KEY);
        await secureStorage.removeItem(REFRESH_TOKEN_KEY);
        return Promise.reject(refreshError);
      }
    }

    // Handle retries for network/timeout errors
    if (shouldRetry(error) && (!originalRequest._retryCount || originalRequest._retryCount < MAX_RETRIES)) {
      originalRequest._retryCount = (originalRequest._retryCount || 0) + 1;
      const delay = RETRY_DELAY * originalRequest._retryCount;
      await sleep(delay);
      return api(originalRequest);
    }

    // Transform error for better handling
    const data = error.response?.data as { message?: string } | undefined;
    let errorMessage = data?.message || error.message || 'An error occurred';
    
    // Handle rate limiting with friendly message
    if (error.response?.status === 429) {
      const retryAfter = error.response.headers['retry-after'];
      const seconds = retryAfter ? parseInt(retryAfter) : 900; // default 15 min
      errorMessage = `Too many requests. Please wait ${Math.ceil(seconds / 60)} minute(s) and try again.`;
    }
    
    const customError = {
      ...error,
      isOffline: isOffline,
      retryCount: originalRequest._retryCount || 0,
      message: errorMessage,
      code: error.code || error.response?.status?.toString(),
    };

    return Promise.reject(customError);
  }
);

// Helper to clear offline queue (e.g., on logout)
export const clearOfflineQueue = () => {
  offlineQueue = [];
};

// Helper to get offline queue status
export const getOfflineQueueStatus = () => ({
  isOffline,
  queueLength: offlineQueue.length,
});

export default api;
