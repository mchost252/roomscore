/**
 * Live Update Service for Capawesome Cloud
 * Handles OTA updates for the mobile app
 * 
 * Features:
 * - Automatic background updates for minor changes
 * - User prompts for major updates
 * - Update progress tracking
 */

import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';

// Dynamic import to avoid build issues on web
let LiveUpdate = null;

const loadLiveUpdate = async () => {
  if (LiveUpdate) return LiveUpdate;
  
  if (!Capacitor.isNativePlatform()) {
    console.log('📱 Live Update: Skipped (not a native platform)');
    return null;
  }
  
  try {
    const module = await import('@capawesome/capacitor-live-update');
    LiveUpdate = module.LiveUpdate;
    return LiveUpdate;
  } catch (e) {
    console.warn('Live Update plugin not available:', e);
    return null;
  }
};

/**
 * Parse semantic version string
 */
const parseVersion = (version) => {
  const parts = version.split('.').map(Number);
  return {
    major: parts[0] || 0,
    minor: parts[1] || 0,
    patch: parts[2] || 0
  };
};

/**
 * Check if update is a major version change
 */
const isMajorUpdate = (currentVersion, newVersion) => {
  const current = parseVersion(currentVersion);
  const next = parseVersion(newVersion);
  return next.major > current.major;
};

/**
 * Live Update Manager
 */
const liveUpdateManager = {
  isReady: false,
  currentVersion: '1.0.0',
  
  /**
   * Initialize the live update system
   * Call this on app startup
   */
  async initialize() {
    const liveUpdate = await loadLiveUpdate();
    if (!liveUpdate) {
      this.isReady = false;
      return;
    }
    
    try {
      // Get current bundle info
      const result = await liveUpdate.getBundle();
      if (result.bundleId) {
        console.log('📦 Current bundle:', result.bundleId);
      }
      
      // Get app version
      try {
        const appInfo = await App.getInfo();
        this.currentVersion = appInfo.version || '1.0.0';
        console.log('📱 App version:', this.currentVersion);
      } catch (e) {
        console.log('Could not get app info:', e);
      }
      
      this.isReady = true;
      console.log('✅ Live Update initialized');
    } catch (error) {
      console.error('Failed to initialize Live Update:', error);
      this.isReady = false;
    }
  },
  
  /**
   * Check for updates and apply them
   * @param {Object} options
   * @param {Function} options.onUpdateAvailable - Called when update is found
   * @param {Function} options.onMajorUpdate - Called for major updates (should return true to proceed)
   * @param {Function} options.onProgress - Called with download progress (0-100)
   * @param {Function} options.onComplete - Called when update is ready
   * @param {Function} options.onError - Called on error
   */
  async checkForUpdate(options = {}) {
    const liveUpdate = await loadLiveUpdate();
    if (!liveUpdate || !this.isReady) {
      console.log('📱 Live Update not available');
      return { available: false };
    }
    
    try {
      console.log('🔍 Checking for updates...');
      
      // Sync with Capawesome Cloud to check for updates
      const result = await liveUpdate.sync();
      
      if (result.nextBundleId) {
        console.log('📦 Update available:', result.nextBundleId);
        
        // Notify that update is available
        if (options.onUpdateAvailable) {
          options.onUpdateAvailable(result.nextBundleId);
        }
        
        // Check if it's a major update (bundle ID might contain version info)
        // For Capawesome, you can include version in bundle name like "v2.0.0-build123"
        const versionMatch = result.nextBundleId.match(/v?(\d+\.\d+\.\d+)/);
        if (versionMatch && isMajorUpdate(this.currentVersion, versionMatch[1])) {
          console.log('🚀 Major update detected!');
          
          // Ask user for permission for major updates
          if (options.onMajorUpdate) {
            const shouldProceed = await options.onMajorUpdate(versionMatch[1]);
            if (!shouldProceed) {
              console.log('❌ User declined major update');
              return { available: true, declined: true };
            }
          }
        }
        
        // Notify completion
        if (options.onComplete) {
          options.onComplete();
        }
        
        return { 
          available: true, 
          bundleId: result.nextBundleId,
          ready: true 
        };
      } else {
        console.log('✅ App is up to date');
        return { available: false };
      }
    } catch (error) {
      console.error('Update check failed:', error);
      if (options.onError) {
        options.onError(error);
      }
      return { available: false, error };
    }
  },
  
  /**
   * Apply a pending update and reload the app
   */
  async applyUpdate() {
    const liveUpdate = await loadLiveUpdate();
    if (!liveUpdate) return false;
    
    try {
      console.log('🔄 Applying update and reloading...');
      await liveUpdate.reload();
      return true;
    } catch (error) {
      console.error('Failed to apply update:', error);
      return false;
    }
  },
  
  /**
   * Reset to the original app bundle (useful if update causes issues)
   */
  async resetToDefault() {
    const liveUpdate = await loadLiveUpdate();
    if (!liveUpdate) return false;
    
    try {
      console.log('🔄 Resetting to default bundle...');
      await liveUpdate.reset();
      await liveUpdate.reload();
      return true;
    } catch (error) {
      console.error('Failed to reset:', error);
      return false;
    }
  },
  
  /**
   * Get current bundle information
   */
  async getCurrentBundle() {
    const liveUpdate = await loadLiveUpdate();
    if (!liveUpdate) return null;
    
    try {
      return await liveUpdate.getBundle();
    } catch (error) {
      console.error('Failed to get bundle info:', error);
      return null;
    }
  },
  
  /**
   * Get list of downloaded bundles
   */
  async getBundles() {
    const liveUpdate = await loadLiveUpdate();
    if (!liveUpdate) return [];
    
    try {
      const result = await liveUpdate.getBundles();
      return result.bundleIds || [];
    } catch (error) {
      console.error('Failed to get bundles:', error);
      return [];
    }
  }
};

export default liveUpdateManager;
