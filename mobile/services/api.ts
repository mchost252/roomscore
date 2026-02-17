import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
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

// Helper to check if request should be retried
const shouldRetry = (error: AxiosError): boolean => {
  // Retry on timeout
  if (error.code === 'ECONNABORTED') return true;
  // Retry on network errors (no response)
  if (!error.response) return true;
  // Retry on 5xx server errors
  if (error.response?.status >= 500) return true;
  // Retry on 429 (rate limit)
  if (error.response?.status === 429) return true;
  // Don't retry on client errors (4xx) except 429
  return false;
};

// Sleep helper
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Request interceptor - add auth token
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    try {
      const token = await secureStorage.getItem(TOKEN_KEY);
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error('Error reading token from secure store:', error);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - handle token refresh and retries
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean; _retryCount?: number };
    
    if (!originalRequest) {
      return Promise.reject(error);
    }

    // Handle 401 - Token expired, try to refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = await secureStorage.getItem(REFRESH_TOKEN_KEY);
        if (!refreshToken) {
          throw new Error('No refresh token');
        }

        const response = await axios.post(`${API_BASE_URL}/api/auth/refresh`, {
          refreshToken,
        });

        const { token } = response.data;
        await secureStorage.setItem(TOKEN_KEY, token);

        // Retry original request with new token
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${token}`;
        }
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh failed, clear tokens and reject
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

    return Promise.reject(error);
  }
);

export default api;
