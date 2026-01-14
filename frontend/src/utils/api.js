import axios from 'axios';
import cacheManager from './cache';
import storage from './storage';

// Production API URL - hardcoded fallback for native app builds (Appflow)
// This ensures the app works even if environment variables aren't injected
const PRODUCTION_API_URL = 'https://roomscore-production.up.railway.app';

// Use environment variable if available, otherwise use production URL for native builds
// localhost is only used for local development
const getApiUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl) return envUrl;
  
  // Check if we're in a browser dev environment
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return 'http://localhost:5000';
  }
  
  // Default to production for native apps and production builds
  return PRODUCTION_API_URL;
};

export const API_BASE_URL = getApiUrl();

const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 second timeout for slow connections
});

// Cache configuration for different endpoints - use exact match or regex
// Mobile-optimized with longer TTLs for persistent cache
const CACHE_CONFIG = {
  '/auth/profile': { ttl: 10 * 60 * 1000, cacheable: true, exact: true, persistent: true },
  '/rooms': { ttl: 2 * 60 * 1000, cacheable: true, exact: true, persistent: true },
  '/notifications': { ttl: 30 * 1000, cacheable: true, exact: true },
  '/direct-messages/conversations': { ttl: 30 * 1000, cacheable: true, exact: true },
  '/friends': { ttl: 60 * 1000, cacheable: true, exact: true, persistent: true },
};

// Check if endpoint should be cached
const shouldCache = (url, method) => {
  if (method !== 'get' && method !== 'GET') return false;
  
  for (const [pattern, config] of Object.entries(CACHE_CONFIG)) {
    if (config.exact) {
      // Exact match - URL must end with pattern or be exactly the pattern
      if (url === pattern || url.endsWith(pattern)) {
        return config;
      }
    } else if (url.includes(pattern) && config.cacheable) {
      return config;
    }
  }
  return null;
};

// Request interceptor to add token and check cache
api.interceptors.request.use(
  (config) => {
    // Use sync method for request interceptor (async not supported here)
    const token = storage.getItemSync('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Allow bypassing cache per-request
    const bypassCache = config.headers && (config.headers['x-bypass-cache'] || config.headers['X-Bypass-Cache']);

    // Check cache for GET requests if not bypassed
    const cacheConfig = !bypassCache ? shouldCache(config.url, config.method) : null;
    if (cacheConfig) {
      const cacheKey = cacheManager.generateKey(config.url, config.params);
      const cachedData = cacheManager.get(cacheKey, true);
      
      if (cachedData) {
        // Silently use cache (no console spam)
        // Return cached response instead of making request
        config.adapter = () => {
          return Promise.resolve({
            data: cachedData,
            status: 200,
            statusText: 'OK (Cached)',
            headers: {},
            config,
            request: {},
            cached: true
          });
        };
      } else {
        // Cache miss - will fetch and cache
        // Store cache config for response interceptor
        config.cacheConfig = cacheConfig;
        config.cacheKey = cacheKey;
      }
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle caching and token refresh
api.interceptors.response.use(
  (response) => {
    // Cache successful GET responses
    if (response.config.cacheConfig && !response.cached) {
      const { cacheKey, cacheConfig } = response.config;
      cacheManager.set(cacheKey, response.data, cacheConfig.ttl);
      // Silently cache response
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // If error is 401 and we haven't tried to refresh yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = storage.getItemSync('refreshToken');
        if (!refreshToken) {
          throw new Error('No refresh token');
        }

        const response = await axios.post(
          `${API_BASE_URL}/api/auth/refresh`,
          { refreshToken }
        );

        const { token } = response.data;
        // Use async storage for native app support
        await storage.setItem('token', token);

        // Retry original request with new token
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh failed, logout user
        await storage.removeItem('token');
        await storage.removeItem('refreshToken');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// Helper to invalidate cache
export const invalidateCache = (pattern) => {
  cacheManager.clearPattern(pattern);
  console.log(`🗑️ Cache cleared: ${pattern}`);
};

// Helper to clear all cache
export const clearAllCache = () => {
  cacheManager.clear();
  console.log('🗑️ All cache cleared');
};

// Helper to get cache stats
export const getCacheStats = () => {
  return cacheManager.getStats();
};

export default api;
