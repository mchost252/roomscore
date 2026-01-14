/**
 * Cross-platform Storage Utility
 * Uses Capacitor Preferences for native apps, localStorage for web
 * This ensures tokens persist correctly on mobile devices
 */

import { Capacitor } from '@capacitor/core';

// Dynamic import for Preferences to avoid build issues if not installed
let Preferences = null;

const loadPreferences = async () => {
  if (Preferences) return Preferences;
  
  try {
    const module = await import('@capacitor/preferences');
    Preferences = module.Preferences;
    return Preferences;
  } catch (e) {
    console.warn('Capacitor Preferences not available, using localStorage');
    return null;
  }
};

/**
 * Check if we should use native storage
 */
const shouldUseNativeStorage = () => {
  return Capacitor.isNativePlatform();
};

/**
 * Storage wrapper that works on both web and native platforms
 */
const storage = {
  /**
   * Get an item from storage
   * @param {string} key 
   * @returns {Promise<string|null>}
   */
  async getItem(key) {
    if (shouldUseNativeStorage()) {
      try {
        const prefs = await loadPreferences();
        if (prefs) {
          const { value } = await prefs.get({ key });
          return value;
        }
      } catch (error) {
        console.error('Native storage get error:', error);
      }
    }
    // Fallback to localStorage
    return localStorage.getItem(key);
  },

  /**
   * Set an item in storage
   * @param {string} key 
   * @param {string} value 
   * @returns {Promise<void>}
   */
  async setItem(key, value) {
    if (shouldUseNativeStorage()) {
      try {
        const prefs = await loadPreferences();
        if (prefs) {
          await prefs.set({ key, value });
          // Also set in localStorage as backup for sync access
          try {
            localStorage.setItem(key, value);
          } catch (e) {
            // localStorage might not be available
          }
          return;
        }
      } catch (error) {
        console.error('Native storage set error:', error);
      }
    }
    // Fallback to localStorage
    localStorage.setItem(key, value);
  },

  /**
   * Remove an item from storage
   * @param {string} key 
   * @returns {Promise<void>}
   */
  async removeItem(key) {
    if (shouldUseNativeStorage()) {
      try {
        const prefs = await loadPreferences();
        if (prefs) {
          await prefs.remove({ key });
        }
      } catch (error) {
        console.error('Native storage remove error:', error);
      }
    }
    // Always try to remove from localStorage too
    try {
      localStorage.removeItem(key);
    } catch (e) {
      // localStorage might not be available
    }
  },

  /**
   * Clear all items from storage
   * @returns {Promise<void>}
   */
  async clear() {
    if (shouldUseNativeStorage()) {
      try {
        const prefs = await loadPreferences();
        if (prefs) {
          await prefs.clear();
        }
      } catch (error) {
        console.error('Native storage clear error:', error);
      }
    }
    try {
      localStorage.clear();
    } catch (e) {
      // localStorage might not be available
    }
  },

  /**
   * Synchronous get for cases where async isn't possible
   * Falls back to localStorage only - use getItem when possible
   * @param {string} key 
   * @returns {string|null}
   */
  getItemSync(key) {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  },

  /**
   * Initialize storage - call on app start to sync native storage to localStorage
   * This ensures synchronous reads work after app launch
   */
  async initialize() {
    if (!shouldUseNativeStorage()) return;

    try {
      const prefs = await loadPreferences();
      if (!prefs) return;

      // Sync important keys from native storage to localStorage
      const keysToSync = ['token', 'refreshToken'];
      
      for (const key of keysToSync) {
        const { value } = await prefs.get({ key });
        if (value) {
          try {
            localStorage.setItem(key, value);
          } catch (e) {
            // localStorage might not be available
          }
        }
      }
      
      console.log('✅ Storage initialized and synced');
    } catch (error) {
      console.error('Storage initialization error:', error);
    }
  }
};

export default storage;
