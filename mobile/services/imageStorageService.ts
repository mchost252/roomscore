/**
 * ImageStorageService - Manages profile image storage with deduplication
 * 
 * Key features:
 * - Stores only ONE avatar per user (overwrites old, never duplicates)
 * - Uses AsyncStorage for lightweight metadata
 * - Integrates with expo-image for efficient caching
 * - Auto-cleanup on profile update
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const AVATAR_STORAGE_KEY = 'user_avatar_';
const AVATAR_CACHE_PREFIX = 'avatar_cache_';

export interface AvatarInfo {
  userId: string;
  localUri: string | null;
  serverUrl: string | null;
  updatedAt: number;
}

class ImageStorageService {
  /**
   * Save avatar for a user - DELETES old avatar first to prevent duplicates
   * Only ONE avatar file exists per user at any time
   */
  async saveAvatar(userId: string, imageUri: string): Promise<string> {
    try {
      const key = AVATAR_STORAGE_KEY + userId;
      
      // First, delete any existing avatar for this user
      await this.deleteAvatar(userId);
      
      // Store the new avatar URI
      // For local files, we keep the path
      // For server URLs, we cache the reference
      const avatarInfo: AvatarInfo = {
        userId,
        localUri: imageUri,
        serverUrl: imageUri.startsWith('http') ? imageUri : null,
        updatedAt: Date.now(),
      };
      
      await AsyncStorage.setItem(key, JSON.stringify(avatarInfo));
      
      console.log('[ImageStorage] Saved avatar for user:', userId);
      return imageUri;
    } catch (error) {
      console.error('[ImageStorage] Error saving avatar:', error);
      throw error;
    }
  }

  /**
   * Delete avatar for a user - removes from storage completely
   * This is called BEFORE saving a new avatar
   */
  async deleteAvatar(userId: string): Promise<void> {
    try {
      const key = AVATAR_STORAGE_KEY + userId;
      
      // Get existing avatar info
      const existing = await AsyncStorage.getItem(key);
      if (existing) {
        const avatarInfo: AvatarInfo = JSON.parse(existing);
        
        // Clear expo-image cache for this avatar
        if (avatarInfo.serverUrl) {
          await this.clearImageCache(avatarInfo.serverUrl);
        }
        
        console.log('[ImageStorage] Deleted old avatar for user:', userId);
      }
      
      // Remove the storage key entirely
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error('[ImageStorage] Error deleting avatar:', error);
      // Don't throw - deletion should be best effort
    }
  }

  /**
   * Get avatar for a user - returns the best available URI
   */
  async getAvatar(userId: string): Promise<string | null> {
    try {
      const key = AVATAR_STORAGE_KEY + userId;
      const data = await AsyncStorage.getItem(key);
      
      if (!data) {
        return null;
      }
      
      const avatarInfo: AvatarInfo = JSON.parse(data);
      
      // Return local URI if available, otherwise server URL
      return avatarInfo.localUri || avatarInfo.serverUrl;
    } catch (error) {
      console.error('[ImageStorage] Error getting avatar:', error);
      return null;
    }
  }

  /**
   * Check if avatar exists for user
   */
  async hasAvatar(userId: string): Promise<boolean> {
    const avatar = await this.getAvatar(userId);
    return avatar !== null;
  }

  /**
   * Clear expo-image cache for a specific URL
   * Note: expo-image handles caching automatically based on URL
   * This method is a no-op but kept for API compatibility
   */
  private async clearImageCache(url: string): Promise<void> {
    try {
      // expo-image caches automatically - the cache is invalidated when URL changes
      // For profile updates, we save with a new URI so cache miss occurs naturally
      console.log('[ImageStorage] Image cache note:', url, '- auto-handled by expo-image');
    } catch (error) {
      console.warn('[ImageStorage] Cache clear warning:', error);
    }
  }

  /**
   * Clear ALL avatars - useful for logout or cleanup
   */
  async clearAllAvatars(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const avatarKeys = keys.filter(k => k.startsWith(AVATAR_STORAGE_KEY));
      
      await AsyncStorage.multiRemove(avatarKeys);
      // expo-image handles cache automatically
      
      console.log('[ImageStorage] Cleared all avatars');
    } catch (error) {
      console.error('[ImageStorage] Error clearing avatars:', error);
    }
  }

  /**
   * Get all stored avatar user IDs (for batch operations)
   */
  async getAllAvatarUserIds(): Promise<string[]> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const avatarKeys = keys.filter(k => k.startsWith(AVATAR_STORAGE_KEY));
      return avatarKeys.map(k => k.replace(AVATAR_STORAGE_KEY, ''));
    } catch (error) {
      console.error('[ImageStorage] Error getting all user IDs:', error);
      return [];
    }
  }

  /**
   * Update avatar after server sync - keeps local if newer
   */
  async syncAvatar(userId: string, serverUrl: string): Promise<string | null> {
    try {
      const key = AVATAR_STORAGE_KEY + userId;
      const existing = await AsyncStorage.getItem(key);
      
      if (existing) {
        const avatarInfo: AvatarInfo = JSON.parse(existing);
        
        // Only update if local is older or doesn't exist
        if (!avatarInfo.localUri || avatarInfo.updatedAt < Date.now() - 1000) {
          avatarInfo.serverUrl = serverUrl;
          avatarInfo.updatedAt = Date.now();
          await AsyncStorage.setItem(key, JSON.stringify(avatarInfo));
        }
        
        return avatarInfo.localUri || avatarInfo.serverUrl;
      }
      
      // No existing avatar - store server URL
      await this.saveAvatar(userId, serverUrl);
      return serverUrl;
    } catch (error) {
      console.error('[ImageStorage] Error syncing avatar:', error);
      return null;
    }
  }

  /**
   * Get cache statistics
   */
  async getStorageStats(): Promise<{ userCount: number; keys: string[] }> {
    const userIds = await this.getAllAvatarUserIds();
    return {
      userCount: userIds.length,
      keys: userIds,
    };
  }
}

// Export singleton instance
export const imageStorageService = new ImageStorageService();
export default imageStorageService;
