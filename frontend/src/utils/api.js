import axios from 'axios';
import cacheManager from './cache';

const api = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 second timeout for slow connections
});

// Cache configuration for different endpoints - use exact match or regex
const CACHE_CONFIG = {
  '/auth/profile': { ttl: 10 * 60 * 1000, cacheable: true, exact: true },
  '/rooms': { ttl: 2 * 60 * 1000, cacheable: true, exact: true },
  '/notifications': { ttl: 30 * 1000, cacheable: true, exact: true },
  '/direct-messages/conversations': { ttl: 30 * 1000, cacheable: true, exact: true },
  '/friends': { ttl: 60 * 1000, cacheable: true, exact: true },
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
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Check cache for GET requests
    const cacheConfig = shouldCache(config.url, config.method);
    if (cacheConfig) {
      const cacheKey = cacheManager.generateKey(config.url, config.params);
      const cachedData = cacheManager.get(cacheKey);
      
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
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) {
          throw new Error('No refresh token');
        }

        const response = await axios.post(
          `${import.meta.env.VITE_API_URL}/api/auth/refresh`,
          { refreshToken }
        );

        const { token } = response.data;
        localStorage.setItem('token', token);

        // Retry original request with new token
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh failed, logout user
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
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
