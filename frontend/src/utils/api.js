import axios from 'axios';
import cacheManager from './cache';

// Production API URL
const PRODUCTION_API_URL = 'https://roomscore-production.up.railway.app';

// Use environment variable if available, otherwise use production URL
const getApiUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl) return envUrl;
  
  // Check if we're in a browser dev environment
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return 'http://localhost:5000';
  }
  
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
  '/rooms/': { ttl: 60 * 1000, cacheable: true, exact: false, persistent: true }, // Individual room details
  '/notifications': { ttl: 30 * 1000, cacheable: true, exact: true },
  '/notifications/unread-count': { ttl: 30 * 1000, cacheable: true, exact: true },
  '/direct-messages/conversations': { ttl: 30 * 1000, cacheable: true, exact: true },
  '/friends': { ttl: 60 * 1000, cacheable: true, exact: true, persistent: true },
};

// Track rate limit state to prevent request storms
let rateLimitedUntil = 0;

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

    // Check if we're rate limited - if so, try to return cached data
    if (rateLimitedUntil > Date.now()) {
      const cacheKey = cacheManager.generateKey(config.url, config.params);
      const cachedData = cacheManager.get(cacheKey, true); // Allow stale during rate limit
      
      if (cachedData) {
        console.log('📦 Rate limited - returning cached data for:', config.url);
        config.adapter = () => {
          return Promise.resolve({
            data: cachedData,
            status: 200,
            statusText: 'OK (Cached - Rate Limited)',
            headers: {},
            config,
            request: {},
            cached: true
          });
        };
        return config;
      }
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

    // Handle 429 Rate Limit errors
    if (error.response?.status === 429) {
      // Set a cooldown period (default 30 seconds, or use Retry-After header)
      const retryAfter = error.response.headers['retry-after'];
      const cooldownMs = retryAfter ? parseInt(retryAfter) * 1000 : 30000;
      rateLimitedUntil = Date.now() + cooldownMs;
      
      console.warn(`⚠️ Rate limited. Cooling down for ${cooldownMs / 1000}s`);
      
      // Try to return cached data if available
      const cacheKey = cacheManager.generateKey(originalRequest.url, originalRequest.params);
      const cachedData = cacheManager.get(cacheKey, true); // Allow stale
      if (cachedData) {
        console.log('📦 Returning cached data during rate limit');
        return Promise.resolve({
          data: cachedData,
          status: 200,
          statusText: 'OK (Cached - Rate Limited)',
          headers: {},
          config: originalRequest,
          cached: true
        });
      }
      
      // If no cache, reject with a friendlier error
      error.message = 'Too many requests. Please wait a moment and try again.';
      return Promise.reject(error);
    }

    // If error is 401 and we haven't tried to refresh yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) {
          throw new Error('No refresh token');
        }

        const response = await axios.post(
          `${API_BASE_URL}/api/auth/refresh`,
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
