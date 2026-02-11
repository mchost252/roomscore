// KRIOS Engine - Native C++ Module Interface
// This module will handle:
// - Audio (miniaudio) - Premium sound effects
// - AI Logic (future) - Set Word detection
// - Person Detection (future) - Advanced features

import { NativeModules, Platform } from 'react-native';

const LINKING_ERROR =
  `The package 'krios-engine' doesn't seem to be linked. Make sure: \n\n` +
  Platform.select({ ios: "- Run 'pod install'\n", default: '' }) +
  '- Rebuild the app after installing the native module';

const KriosEngine = NativeModules.KriosEngine
  ? NativeModules.KriosEngine
  : new Proxy(
      {},
      {
        get() {
          throw new Error(LINKING_ERROR);
        },
      }
    );

// Audio Engine API
export const Audio = {
  // Initialize audio engine
  init: async (): Promise<boolean> => {
    try {
      return await KriosEngine.initAudio();
    } catch (error) {
      console.warn('Audio init failed, using fallback');
      return false;
    }
  },

  // Play click sound (buttons, interactions)
  playClick: async (): Promise<void> => {
    try {
      await KriosEngine.playSound('click');
    } catch (error) {
      console.warn('Audio playback failed');
    }
  },

  // Play whoosh sound (swipes, transitions)
  playWhoosh: async (): Promise<void> => {
    try {
      await KriosEngine.playSound('whoosh');
    } catch (error) {
      console.warn('Audio playback failed');
    }
  },

  // Play success sound (task completion)
  playSuccess: async (): Promise<void> => {
    try {
      await KriosEngine.playSound('success');
    } catch (error) {
      console.warn('Audio playback failed');
    }
  },
};

// AI Engine API (Future - placeholders for now)
export const AI = {
  // Detect "Set Word" in text
  detectSetWord: async (text: string): Promise<{ detected: boolean; word?: string }> => {
    try {
      return await KriosEngine.detectSetWord(text);
    } catch (error) {
      // Fallback: Simple JavaScript detection
      const setWords = ['help', 'sos', 'emergency'];
      const detected = setWords.some(word => text.toLowerCase().includes(word));
      return { detected, word: detected ? setWords.find(w => text.toLowerCase().includes(w)) : undefined };
    }
  },

  // Analyze emotion from text
  analyzeEmotion: async (text: string): Promise<{ emotion: string; confidence: number }> => {
    try {
      return await KriosEngine.analyzeEmotion(text);
    } catch (error) {
      // Fallback: Return neutral
      return { emotion: 'neutral', confidence: 0.5 };
    }
  },
};

// Person Detection API (Future)
export const Person = {
  // Detect person presence (camera/sensors)
  detect: async (): Promise<{ detected: boolean; confidence: number }> => {
    try {
      return await KriosEngine.detectPerson();
    } catch (error) {
      return { detected: false, confidence: 0 };
    }
  },
};

export default {
  Audio,
  AI,
  Person,
};
