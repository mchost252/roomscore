import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Dynamically import SecureStore only on native platforms
let SecureStore: any = null;
if (Platform.OS !== 'web') {
  try {
    SecureStore = require('expo-secure-store');
  } catch (e) {
    console.warn('SecureStore not available, using AsyncStorage fallback');
  }
}

/**
 * Secure storage for sensitive data (tokens, credentials)
 * Falls back to AsyncStorage on web or if SecureStore fails
 */
export const secureStorage = {
  async setItem(key: string, value: string): Promise<void> {
    try {
      if (Platform.OS === 'web' || !SecureStore) {
        // SecureStore not available on web, use AsyncStorage
        await AsyncStorage.setItem(`secure_${key}`, value);
      } else {
        await SecureStore.setItemAsync(key, value);
      }
    } catch (error) {
      console.error(`Error saving ${key} to secure store:`, error);
      // Fallback to AsyncStorage
      try {
        await AsyncStorage.setItem(`secure_${key}`, value);
      } catch (fallbackError) {
        console.error(`Fallback storage also failed:`, fallbackError);
        throw error;
      }
    }
  },

  async getItem(key: string): Promise<string | null> {
    try {
      if (Platform.OS === 'web' || !SecureStore) {
        return await AsyncStorage.getItem(`secure_${key}`);
      } else {
        return await SecureStore.getItemAsync(key);
      }
    } catch (error) {
      console.error(`Error reading ${key} from secure store:`, error);
      // Try fallback
      try {
        return await AsyncStorage.getItem(`secure_${key}`);
      } catch (fallbackError) {
        return null;
      }
    }
  },

  async removeItem(key: string): Promise<void> {
    try {
      if (Platform.OS === 'web' || !SecureStore) {
        await AsyncStorage.removeItem(`secure_${key}`);
      } else {
        await SecureStore.deleteItemAsync(key);
      }
    } catch (error) {
      console.error(`Error deleting ${key} from secure store:`, error);
      // Try fallback
      try {
        await AsyncStorage.removeItem(`secure_${key}`);
      } catch (fallbackError) {
        throw error;
      }
    }
  },

  async clear(): Promise<void> {
    // Note: SecureStore doesn't have a clear all method
    console.warn('SecureStore does not support clearing all items');
  },
};

/**
 * Regular storage for non-sensitive data (preferences, cache)
 */
export const storage = {
  async setItem(key: string, value: string): Promise<void> {
    try {
      await AsyncStorage.setItem(key, value);
    } catch (error) {
      console.error(`Error saving ${key} to storage:`, error);
      throw error;
    }
  },

  async getItem(key: string): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(key);
    } catch (error) {
      console.error(`Error reading ${key} from storage:`, error);
      return null;
    }
  },

  async removeItem(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error(`Error deleting ${key} from storage:`, error);
      throw error;
    }
  },

  async clear(): Promise<void> {
    try {
      await AsyncStorage.clear();
    } catch (error) {
      console.error('Error clearing storage:', error);
      throw error;
    }
  },

  // Helper methods for JSON data
  async setJSON(key: string, value: any): Promise<void> {
    try {
      const jsonValue = JSON.stringify(value);
      await AsyncStorage.setItem(key, jsonValue);
    } catch (error) {
      console.error(`Error saving JSON ${key}:`, error);
      throw error;
    }
  },

  async getJSON<T = any>(key: string): Promise<T | null> {
    try {
      const jsonValue = await AsyncStorage.getItem(key);
      return jsonValue ? JSON.parse(jsonValue) : null;
    } catch (error) {
      console.error(`Error reading JSON ${key}:`, error);
      return null;
    }
  },
};
