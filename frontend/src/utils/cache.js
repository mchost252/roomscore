/**
 * Hybrid Cache Manager with TTL (Time To Live)
 * Uses in-memory cache for speed + localStorage for persistence across app restarts
 * Optimized for mobile apps (Capacitor) with aggressive caching strategy
 */

const STORAGE_PREFIX = 'krios_cache_';
const PERSISTENT_KEYS = ['/rooms', '/auth/profile', '/friends']; // Keys to persist to storage

class CacheManager {
  constructor() {
    this.cache = new Map();
    this.defaultTTL = 5 * 60 * 1000; // 5 minutes default
    this.persistentTTL = 24 * 60 * 60 * 1000; // 24 hours for persistent cache
    this.initialized = false;
    
    // Load persistent cache on startup
    this.loadPersistentCache();
  }

  /**
   * Load cached data from localStorage on app start
   * This enables instant app loading with stale-while-revalidate pattern
   */
  loadPersistentCache() {
    try {
      const keys = Object.keys(localStorage).filter(k => k.startsWith(STORAGE_PREFIX));
      
      for (const storageKey of keys) {
        try {
          const item = JSON.parse(localStorage.getItem(storageKey));
          if (item && item.data) {
            const cacheKey = storageKey.replace(STORAGE_PREFIX, '');
            // Use persistent TTL for restored items (they're stale but usable)
            // Mark as stale so we know to revalidate
            this.cache.set(cacheKey, {
              data: item.data,
              expiresAt: item.expiresAt || Date.now() + this.persistentTTL,
              isStale: Date.now() > (item.expiresAt || 0),
              persistedAt: item.persistedAt || Date.now()
            });
          }
        } catch (e) {
          // Remove corrupted cache entry
          localStorage.removeItem(storageKey);
        }
      }
      
      this.initialized = true;
      console.log(`📦 Cache loaded: ${this.cache.size} items from storage`);
    } catch (error) {
      console.error('Error loading persistent cache:', error);
      this.initialized = true;
    }
  }

  /**
   * Check if key should be persisted to localStorage
   */
  shouldPersist(key) {
    return PERSISTENT_KEYS.some(pattern => key.includes(pattern));
  }

  /**
   * Generate cache key from URL and params
   */
  generateKey(url, params = {}) {
    const paramString = Object.keys(params).length 
      ? JSON.stringify(params) 
      : '';
    return `${url}${paramString}`;
  }

  /**
   * Set cache item with TTL
   * Persists important data to localStorage for mobile app fast loading
   */
  set(key, data, ttl = this.defaultTTL) {
    const expiresAt = Date.now() + ttl;
    const cacheItem = {
      data,
      expiresAt,
      isStale: false,
      persistedAt: Date.now()
    };
    
    this.cache.set(key, cacheItem);
    
    // Persist to localStorage for important endpoints
    if (this.shouldPersist(key)) {
      try {
        const storageKey = STORAGE_PREFIX + key;
        localStorage.setItem(storageKey, JSON.stringify({
          data,
          expiresAt,
          persistedAt: Date.now()
        }));
      } catch (e) {
        // localStorage full or unavailable - clean up old entries
        this.cleanupStorage();
      }
    }
  }

  /**
   * Get cache item if not expired
   * For stale items, returns data but marks for revalidation
   */
  get(key, allowStale = false) {
    const item = this.cache.get(key);
    
    if (!item) {
      return null;
    }

    const isExpired = Date.now() > item.expiresAt;
    
    // For mobile: return stale data immediately (will be revalidated in background)
    if (isExpired) {
      if (allowStale && item.data) {
        // Return stale data for instant UI, but mark it
        return { data: item.data, isStale: true };
      }
      this.cache.delete(key);
      return null;
    }

    return item.data;
  }

  /**
   * Get stale-while-revalidate: returns cached data (even if stale) for instant UI
   * Used for mobile app fast loading
   */
  getWithStale(key) {
    const item = this.cache.get(key);
    
    if (!item) {
      return { data: null, isStale: true };
    }

    const isExpired = Date.now() > item.expiresAt;
    return { 
      data: item.data, 
      isStale: isExpired || item.isStale 
    };
  }

  /**
   * Check if cache has valid (non-stale) item
   */
  has(key) {
    return this.get(key) !== null;
  }

  /**
   * Check if cache has any data (including stale)
   */
  hasAny(key) {
    return this.cache.has(key);
  }

  /**
   * Clear specific cache key
   */
  delete(key) {
    this.cache.delete(key);
    
    // Also remove from localStorage
    try {
      localStorage.removeItem(STORAGE_PREFIX + key);
    } catch (e) {
      // Ignore storage errors
    }
  }

  /**
   * Clear all cache matching pattern
   */
  clearPattern(pattern) {
    const regex = new RegExp(pattern);
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        try {
          localStorage.removeItem(STORAGE_PREFIX + key);
        } catch (e) {
          // Ignore storage errors
        }
      }
    }
  }

  /**
   * Clear all cache
   */
  clear() {
    this.cache.clear();
    
    // Clear localStorage cache entries
    try {
      const keys = Object.keys(localStorage).filter(k => k.startsWith(STORAGE_PREFIX));
      keys.forEach(k => localStorage.removeItem(k));
    } catch (e) {
      // Ignore storage errors
    }
  }

  /**
   * Clean up old localStorage entries when storage is full
   */
  cleanupStorage() {
    try {
      const keys = Object.keys(localStorage).filter(k => k.startsWith(STORAGE_PREFIX));
      
      // Sort by age and remove oldest half
      const items = keys.map(k => {
        try {
          const item = JSON.parse(localStorage.getItem(k));
          return { key: k, persistedAt: item?.persistedAt || 0 };
        } catch {
          return { key: k, persistedAt: 0 };
        }
      }).sort((a, b) => a.persistedAt - b.persistedAt);
      
      // Remove oldest half
      const toRemove = items.slice(0, Math.ceil(items.length / 2));
      toRemove.forEach(item => localStorage.removeItem(item.key));
      
      console.log(`🧹 Cleaned up ${toRemove.length} old cache entries`);
    } catch (e) {
      // If cleanup fails, clear all cache
      this.clear();
    }
  }

  /**
   * Get cache stats
   */
  getStats() {
    let validCount = 0;
    let staleCount = 0;
    let expiredCount = 0;

    for (const [key, item] of this.cache.entries()) {
      if (Date.now() > item.expiresAt) {
        expiredCount++;
      } else if (item.isStale) {
        staleCount++;
      } else {
        validCount++;
      }
    }

    return {
      total: this.cache.size,
      valid: validCount,
      stale: staleCount,
      expired: expiredCount,
      initialized: this.initialized
    };
  }

  /**
   * Clean up expired items from memory (keeps stale items for mobile fast loading)
   */
  cleanup() {
    const now = Date.now();
    const maxStaleAge = 24 * 60 * 60 * 1000; // Remove items stale for over 24 hours
    
    for (const [key, item] of this.cache.entries()) {
      // Remove very old stale items
      if (item.persistedAt && (now - item.persistedAt) > maxStaleAge) {
        this.cache.delete(key);
        try {
          localStorage.removeItem(STORAGE_PREFIX + key);
        } catch (e) {
          // Ignore
        }
      }
    }
  }

  /**
   * Preload critical data for fast app startup
   * Call this on app foreground event
   */
  async preloadCritical(fetchFn) {
    const criticalEndpoints = ['/rooms', '/auth/profile'];
    
    for (const endpoint of criticalEndpoints) {
      const cached = this.getWithStale(endpoint);
      if (cached.isStale) {
        // Revalidate in background
        try {
          const freshData = await fetchFn(endpoint);
          if (freshData) {
            this.set(endpoint, freshData, this.defaultTTL);
          }
        } catch (e) {
          // Keep stale data if fetch fails
          console.log(`Failed to revalidate ${endpoint}, using stale data`);
        }
      }
    }
  }
}

// Export singleton instance
const cacheManager = new CacheManager();

// Auto cleanup every 10 minutes
setInterval(() => {
  cacheManager.cleanup();
}, 10 * 60 * 1000);

export default cacheManager;
