/**
 * Simple in-memory cache with TTL (Time To Live)
 * Stores API responses temporarily to reduce server requests
 */

class CacheManager {
  constructor() {
    this.cache = new Map();
    this.defaultTTL = 5 * 60 * 1000; // 5 minutes default
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
   */
  set(key, data, ttl = this.defaultTTL) {
    const expiresAt = Date.now() + ttl;
    this.cache.set(key, {
      data,
      expiresAt
    });
  }

  /**
   * Get cache item if not expired
   */
  get(key) {
    const item = this.cache.get(key);
    
    if (!item) {
      return null;
    }

    // Check if expired
    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return item.data;
  }

  /**
   * Check if cache has valid item
   */
  has(key) {
    return this.get(key) !== null;
  }

  /**
   * Clear specific cache key
   */
  delete(key) {
    this.cache.delete(key);
  }

  /**
   * Clear all cache matching pattern
   */
  clearPattern(pattern) {
    const regex = new RegExp(pattern);
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all cache
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Get cache stats
   */
  getStats() {
    let validCount = 0;
    let expiredCount = 0;

    for (const [key, item] of this.cache.entries()) {
      if (Date.now() > item.expiresAt) {
        expiredCount++;
      } else {
        validCount++;
      }
    }

    return {
      total: this.cache.size,
      valid: validCount,
      expired: expiredCount
    };
  }

  /**
   * Clean up expired items
   */
  cleanup() {
    for (const [key, item] of this.cache.entries()) {
      if (Date.now() > item.expiresAt) {
        this.cache.delete(key);
      }
    }
  }
}

// Export singleton instance
const cacheManager = new CacheManager();

// Auto cleanup every 5 minutes
setInterval(() => {
  cacheManager.cleanup();
}, 5 * 60 * 1000);

export default cacheManager;
