import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as Crypto from 'expo-crypto';

// Dynamically import SecureStore only on native platforms
let SecureStore: any = null;
if (Platform.OS !== 'web') {
  try {
    SecureStore = require('expo-secure-store');
  } catch (e) {
    console.warn('SecureStore not available, using AsyncStorage fallback');
  }
}

// Simple encryption for web fallback (NOT for production - use httpOnly cookies instead)
const encrypt = async (text: string): Promise<string> => {
  if (Platform.OS !== 'web') return text;
  try {
    // Generate a device-specific key using expo-crypto
    const key = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      Platform.OS + (navigator?.userAgent || '') + 'krios-salt-v1'
    );
    // XOR encryption with key rotation
    const encrypted = text.split('').map((char, i) => {
      const keyChar = key[i % key.length];
      return String.fromCharCode(char.charCodeAt(0) ^ keyChar.charCodeAt(0));
    }).join('');
    return btoa(encrypted); // Base64 encode
  } catch (e) {
    console.warn('Encryption failed, storing plaintext');
    return text;
  }
};

const decrypt = async (text: string): Promise<string> => {
  if (Platform.OS !== 'web') return text;
  try {
    const decoded = atob(text);
    const key = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      Platform.OS + (navigator?.userAgent || '') + 'krios-salt-v1'
    );
    return decoded.split('').map((char, i) => {
      const keyChar = key[i % key.length];
      return String.fromCharCode(char.charCodeAt(0) ^ keyChar.charCodeAt(0));
    }).join('');
  } catch (e) {
    return text;
  }
};

/**
 * Secure storage for sensitive data (tokens, credentials)
 * Falls back to AsyncStorage on web or if SecureStore fails
 * Web fallback includes basic obfuscation - consider using httpOnly cookies for production
 */
export const secureStorage = {
  async setItem(key: string, value: string): Promise<void> {
    try {
      const encryptedValue = await encrypt(value);
      
      if (Platform.OS === 'web' || !SecureStore) {
        await AsyncStorage.setItem(`secure_${key}`, encryptedValue);
      } else {
        await SecureStore.setItemAsync(key, value);
      }
    } catch (error) {
      console.error(`Error saving ${key} to secure store:`, error);
      // Fallback to AsyncStorage with encryption
      try {
        const encryptedValue = await encrypt(value);
        await AsyncStorage.setItem(`secure_${key}`, encryptedValue);
      } catch (fallbackError) {
        console.error(`Fallback storage also failed:`, fallbackError);
        throw error;
      }
    }
  },

  async getItem(key: string): Promise<string | null> {
    try {
      let value: string | null = null;
      
      if (Platform.OS === 'web' || !SecureStore) {
        value = await AsyncStorage.getItem(`secure_${key}`);
        if (value) {
          value = await decrypt(value);
        }
      } else {
        value = await SecureStore.getItemAsync(key);
      }
      
      return value;
    } catch (error) {
      console.error(`Error reading ${key} from secure store:`, error);
      // Try fallback
      try {
        const value = await AsyncStorage.getItem(`secure_${key}`);
        return value ? await decrypt(value) : null;
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
    console.warn('SecureStore does not support clearing all items');
    // Clear only known keys
    const knownKeys = ['token', 'refreshToken', 'userId', 'onboardingComplete'];
    await Promise.all(knownKeys.map(key => this.removeItem(key)));
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
