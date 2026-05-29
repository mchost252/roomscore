/**
 * Focus Sound Service — Audio playback for focus sessions
 * 
 * Manages ambient sound loops using expo-av.
 * Supports bundled sounds + user-uploaded custom audio.
 */
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Lazy-load expo-av to avoid crashes on web
let Audio: any = null;
try {
  if (Platform.OS !== 'web') {
    Audio = require('expo-av').Audio;
  }
} catch {}

export interface SoundOption {
  id: string;
  name: string;
  description: string;
  icon: string;
  source: any;         // require() for bundled, { uri } for custom
  isCustom?: boolean;
}

// Bundled sounds — these will be silent placeholders until real .mp3 files are added
// The app won't crash if files are missing; it just won't play audio
const BUNDLED_SOUNDS: SoundOption[] = [
  { id: 'silence', name: 'Silence', description: 'No sound', icon: '🔇', source: null },
  { id: 'forest', name: 'Forest', description: 'Calm', icon: '🌿', source: { uri: 'https://cdn.pixabay.com/download/audio/2022/10/25/audio_5145b23d57.mp3' } },
  { id: 'rain', name: 'Rain', description: 'Soothing', icon: '🌧️', source: { uri: 'https://cdn.pixabay.com/download/audio/2021/08/09/audio_9eb45d9fa8.mp3' } },
  { id: 'lofi', name: 'Lo-fi', description: 'Chill', icon: '🎵', source: { uri: 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf589.mp3' } },
  { id: 'whitenoise', name: 'Cosmic', description: 'Deep Focus', icon: '🌌', source: { uri: 'https://cdn.pixabay.com/download/audio/2022/02/10/audio_fc87b80829.mp3' } },
];

const PREFS_KEY = '@krios:focusSound';
const CUSTOM_SOUNDS_KEY = '@krios:customSounds';

class FocusSoundService {
  private sound: any = null;
  private currentId: string = 'silence';
  private volume: number = 0.6;
  private customSounds: SoundOption[] = [];

  async initialize(): Promise<void> {
    if (!Audio) return;
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
      });
    } catch {}

    // Load preferences
    try {
      const prefs = await AsyncStorage.getItem(PREFS_KEY);
      if (prefs) {
        const p = JSON.parse(prefs);
        this.currentId = p.id || 'silence';
        this.volume = p.volume ?? 0.6;
      }
    } catch {}

    // Load custom sounds
    try {
      const raw = await AsyncStorage.getItem(CUSTOM_SOUNDS_KEY);
      if (raw) this.customSounds = JSON.parse(raw);
    } catch {}
  }

  getAllSounds(): SoundOption[] {
    return [...BUNDLED_SOUNDS, ...this.customSounds];
  }

  getCurrentSoundId(): string {
    return this.currentId;
  }

  getVolume(): number {
    return this.volume;
  }

  async setVolume(vol: number): Promise<void> {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.sound) {
      try { await this.sound.setVolumeAsync(this.volume); } catch {}
    }
    await this.savePrefs();
  }

  async play(soundId: string): Promise<void> {
    if (!Audio || soundId === 'silence') {
      await this.stop();
      this.currentId = soundId;
      await this.savePrefs();
      return;
    }

    const allSounds = this.getAllSounds();
    const option = allSounds.find(s => s.id === soundId);
    if (!option || !option.source) {
      this.currentId = soundId;
      await this.savePrefs();
      return;
    }

    await this.stop();

    try {
      const { sound } = await Audio.Sound.createAsync(
        option.source,
        { isLooping: true, volume: this.volume, shouldPlay: true }
      );
      this.sound = sound;
      this.currentId = soundId;
      await this.savePrefs();
    } catch (err) {
      console.warn('[FocusSound] Playback failed:', err);
    }
  }

  async stop(): Promise<void> {
    if (this.sound) {
      try {
        await this.sound.stopAsync();
        await this.sound.unloadAsync();
      } catch {}
      this.sound = null;
    }
  }

  async pause(): Promise<void> {
    if (this.sound) {
      try { await this.sound.pauseAsync(); } catch {}
    }
  }

  async resume(): Promise<void> {
    if (this.sound) {
      try { await this.sound.playAsync(); } catch {}
    }
  }

  async fadeOut(durationMs: number = 2000): Promise<void> {
    if (!this.sound) return;
    const steps = 20;
    const stepMs = durationMs / steps;
    const stepVol = this.volume / steps;
    for (let i = steps; i >= 0; i--) {
      try { await this.sound.setVolumeAsync(stepVol * i); } catch {}
      await new Promise(r => setTimeout(r, stepMs));
    }
    await this.stop();
  }

  async addCustomSound(uri: string, name: string): Promise<SoundOption> {
    const id = `custom_${Date.now()}`;
    const custom: SoundOption = {
      id,
      name,
      description: 'Custom',
      icon: '🎧',
      source: { uri },
      isCustom: true,
    };
    this.customSounds.push(custom);
    await AsyncStorage.setItem(CUSTOM_SOUNDS_KEY, JSON.stringify(this.customSounds));
    return custom;
  }

  async removeCustomSound(id: string): Promise<void> {
    this.customSounds = this.customSounds.filter(s => s.id !== id);
    await AsyncStorage.setItem(CUSTOM_SOUNDS_KEY, JSON.stringify(this.customSounds));
    if (this.currentId === id) {
      this.currentId = 'silence';
      await this.stop();
      await this.savePrefs();
    }
  }

  private async savePrefs(): Promise<void> {
    try {
      await AsyncStorage.setItem(PREFS_KEY, JSON.stringify({ id: this.currentId, volume: this.volume }));
    } catch {}
  }
}

export const focusSoundService = new FocusSoundService();
export default focusSoundService;
