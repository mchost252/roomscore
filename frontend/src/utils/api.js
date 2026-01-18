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
  timeout: 15000, // 15 second timeout (reduced for faster feedback on mobile)
});

// ==================== REQUEST DEDUPLICATION ====================
// Prevents duplicate in-flight requests (common on mobile with double-taps)
const pendingRequests = new Map();

const generateRequestKey = (config) => {
  const { method, url, params, data } = config;
  return `${method}:${url}:${JSON.stringify(params || {})}:${JSON.stringify(data || {})}`;
};

// Dedupe GET requests only (safe to dedupe)
const shouldDedupe = (config) => {
  return config.method?.toLowerCase() === 'get' && !config._skipDedupe;
};

// ==================== OPTIMISTIC UPDATE HELPERS ====================
// Store for rollback data
const optimisticRollbacks = new Map();

/**
 * Execute an optimistic update with automatic rollback on failure
 * @param {string} key - Unique key for this operation
 * @param {Function} optimisticFn - Function to apply optimistic update (receives current state)
 * @param {Function} apiFn - Async function that makes the API call
 * @param {Function} rollbackFn - Function to rollback on failure (receives saved state)
 * @param {Function} successFn - Optional function to call on success with API response
 */
export const optimisticUpdate = async (key, optimisticFn, apiFn, rollbackFn, successFn) => {
  // Save current state for potential rollback
  const savedState = optimisticFn();
  optimisticRollbacks.set(key, savedState);
  
  try {
    const result = await apiFn();
    optimisticRollbacks.delete(key);
    if (successFn) successFn(result);
    return { success: true, data: result };
  } catch (error) {
    // Rollback on failure
    const rollbackState = optimisticRollbacks.get(key);
    if (rollbackState !== undefined && rollbackFn) {
      rollbackFn(rollbackState);
    }
    optimisticRollbacks.delete(key);
    return { success: false, error };
  }
};

// ==================== PREFETCH HELPER ====================
const prefetchCache = new Map();
const PREFETCH_COOLDOWN = 30000; // 30 seconds between prefetches of same resource

/**
 * Prefetch data for faster subsequent navigation
 * @param {string} url - API endpoint to prefetch
 * @param {object} options - Optional config
 */
export const prefetch = (url, options = {}) => {
  const cacheKey = cacheManager.generateKey(url, options.params);
  const now = Date.now();
  
  // Check cooldown to prevent excessive prefetching
  const lastPrefetch = prefetchCache.get(cacheKey);
  if (lastPrefetch && (now - lastPrefetch) < PREFETCH_COOLDOWN) {
    return; // Skip - recently prefetched
  }
  
  // Check if already cached and fresh
  const cached = cacheManager.getWithStale(cacheKey);
  if (cached.data && !cached.isStale) {
    return; // Already have fresh data
  }
  
  // Prefetch in background (low priority)
  prefetchCache.set(cacheKey, now);
  
  // Use requestIdleCallback if available, otherwise setTimeout
  const scheduleTask = window.requestIdleCallback || ((cb) => setTimeout(cb, 100));
  
  scheduleTask(() => {
    api.get(url, { 
      ...options, 
      _skipDedupe: true,
      headers: { ...options.headers, 'x-prefetch': '1' }
    }).catch(() => {
      // Silently fail prefetch - it's not critical
    });
  });
};

// Retry configuration for failed requests (handles Neon cold starts and network issues)
const MAX_RETRIES = 2;
const RETRY_DELAY = 1000; // 1 second base delay (reduced for faster mobile feedback)

// Helper to check if request should be retried
const shouldRetry = (error) => {
  // Retry on timeout (Neon cold start)
  if (error.code === 'ECONNABORTED') return true;
  // Retry on network errors
  if (!error.response) return true;
  // Retry on 5xx server errors
  if (error.response?.status >= 500) return true;
  // Retry on 429 rate limit (after delay)
  if (error.response?.status === 429) return true;
  // Don't retry on client errors (4xx except 429)
  return false;
};

// Sleep helper
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ==================== REQUEST DEDUPLICATION INTERCEPTOR ====================
api.interceptors.request.use(
  (config) => {
    if (shouldDedupe(config)) {
      const requestKey = generateRequestKey(config);
      
      // Check if this exact request is already in flight
      if (pendingRequests.has(requestKey)) {
        // Return the existing promise instead of making a new request
        const controller = new AbortController();
        config.signal = controller.signal;
        
        // Wait for the existing request and return its result
        return pendingRequests.get(requestKey).then((response) => {
          controller.abort(); // Cancel this duplicate request
          return Promise.reject({ __DEDUPE__: true, response });
        }).catch((error) => {
          if (error.__DEDUPE__) throw error;
          controller.abort();
          return Promise.reject(error);
        });
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Add retry interceptor (runs before other interceptors)
api.interceptors.response.use(
  (response) => {
    // Clean up pending request tracking
    const requestKey = generateRequestKey(response.config);
    pendingRequests.delete(requestKey);
    return response;
  },
  async (error) => {
    // Handle deduplication - return the cached response
    if (error.__DEDUPE__) {
      return error.response;
    }
    
    const config = error.config;
    
    // Clean up pending request on error
    if (config) {
      const requestKey = generateRequestKey(config);
      pendingRequests.delete(requestKey);
    }
    
    // Don't retry if we've already retried max times, shouldn't retry, or no config
    if (!config || config._retryCount >= MAX_RETRIES || !shouldRetry(error)) {
      return Promise.reject(error);
    }
    
    // Initialize retry count
    config._retryCount = config._retryCount || 0;
    config._retryCount++;
    
    // Calculate delay (exponential backoff)
    let delay = RETRY_DELAY * config._retryCount;
    
    // For rate limit, use longer delay
    if (error.response?.status === 429) {
      delay = Math.max(delay, 5000);
    }
    
    // Wait before retrying
    await sleep(delay);
    
    // Retry the request
    return api(config);
  }
);

// Cache configuration for different endpoints - use exact match or regex
// Mobile-optimized with longer TTLs for persistent cache
const CACHE_CONFIG = {
  '/auth/profile': { ttl: 15 * 60 * 1000, cacheable: true, exact: true, persistent: true }, // 15 min - rarely changes
  '/rooms': { ttl: 3 * 60 * 1000, cacheable: true, exact: true, persistent: true }, // 3 min - main list
  '/rooms/': { ttl: 2 * 60 * 1000, cacheable: true, exact: false, persistent: true }, // 2 min - room details
  '/notifications': { ttl: 60 * 1000, cacheable: true, exact: true }, // 1 min
  '/notifications/unread-count': { ttl: 60 * 1000, cacheable: true, exact: true }, // 1 min
  '/direct-messages/conversations': { ttl: 60 * 1000, cacheable: true, exact: true, persistent: true }, // 1 min
  '/direct-messages/unread-count': { ttl: 60 * 1000, cacheable: true, exact: true }, // 1 min
  '/friends': { ttl: 5 * 60 * 1000, cacheable: true, exact: true, persistent: true }, // 5 min - rarely changes
  '/orbit-summary': { ttl: 5 * 60 * 1000, cacheable: true, exact: false }, // 5 min - daily summary
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
      const cachedResult = cacheManager.getWithStale(cacheKey);
      
      if (cachedResult.data) {
        config.adapter = () => {
          return Promise.resolve({
            data: cachedResult.data,
            status: 200,
            statusText: 'OK (Cached - Rate Limited)',
            headers: {},
            config,
            request: {},
            cached: true,
            isStale: cachedResult.isStale
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
      // Use getWithStale to properly handle stale data format
      const cachedResult = cacheManager.getWithStale(cacheKey);
      
      // Only use cache if data exists AND is not stale (for initial load, stale data is loaded separately)
      if (cachedResult.data && !cachedResult.isStale) {
        // Return fresh cached response instead of making request
        config.adapter = () => {
          return Promise.resolve({
            data: cachedResult.data,
            status: 200,
            statusText: 'OK (Cached)',
            headers: {},
            config,
            request: {},
            cached: true
          });
        };
      } else {
        // Cache miss or stale - will fetch fresh and cache
        // Store cache config for response interceptor
        config.cacheConfig = cacheConfig;
        config.cacheKey = cacheKey;
        
        // Track this request for deduplication (only for GET requests)
        if (shouldDedupe(config) && !config._skipDedupe) {
          const requestKey = generateRequestKey(config);
          // Create a deferred promise that will be resolved when this request completes
          let resolvePromise, rejectPromise;
          const pendingPromise = new Promise((resolve, reject) => {
            resolvePromise = resolve;
            rejectPromise = reject;
          });
          pendingPromise._resolve = resolvePromise;
          pendingPromise._reject = rejectPromise;
          pendingRequests.set(requestKey, pendingPromise);
          config._requestKey = requestKey;
        }
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
    }
    
    // Resolve pending promise for deduplication
    if (response.config._requestKey) {
      const pending = pendingRequests.get(response.config._requestKey);
      if (pending && pending._resolve) {
        pending._resolve(response);
      }
      pendingRequests.delete(response.config._requestKey);
    }
    
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    
    // Reject pending promise for deduplication on error
    if (originalRequest?._requestKey) {
      const pending = pendingRequests.get(originalRequest._requestKey);
      if (pending && pending._reject) {
        pending._reject(error);
      }
      pendingRequests.delete(originalRequest._requestKey);
    }

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
