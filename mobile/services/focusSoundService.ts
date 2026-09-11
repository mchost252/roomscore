/**
 * Focus Sound Service — Audio playback for focus sessions
 *
 * Modern engine: expo-audio (AudioPlayer) with download-first remote tracks,
 * so each preset is saved to device on first play and replays offline.
 */
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Lazy-load so a missing native module can never crash startup.
let AudioModule: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  AudioModule = require('expo-audio');
} catch {}

export interface SoundOption {
  id: string;
  name: string;
  description: string;
  icon: string;
  source: any;         // { uri } for remote/local files
  isCustom?: boolean;
}

export interface SoundStatus {
  loading: boolean;
  playing: boolean;
  soundId: string | null;
  error: string | null;
}

// Bundled presets — Mixkit direct links (verified live, royalty-free).
// Each file is downloaded to the device on first play, then replays offline.
const BUNDLED_SOUNDS: SoundOption[] = [
  { id: 'silence', name: 'Silence', description: 'No sound', icon: '🔇', source: null },
  { id: 'forest', name: 'Forest', description: 'European forest ambience', icon: '🌿', source: { uri: 'https://assets.mixkit.co/active_storage/sfx/1213/1213-preview.mp3' } },
  { id: 'rain', name: 'Rain', description: 'Long rain ambience', icon: '🌧️', source: { uri: 'https://assets.mixkit.co/active_storage/sfx/1247/1247-preview.mp3' } },
  { id: 'lofi', name: 'Lo-fi', description: 'Sleepy Cat chill', icon: '🎵', source: { uri: 'https://assets.mixkit.co/music/135/135.mp3' } },
  { id: 'whitenoise', name: 'Cosmic', description: 'Deep Focus drone', icon: '🌌', source: { uri: 'https://assets.mixkit.co/active_storage/sfx/2744/2744-preview.mp3' } },
];

const PREFS_KEY = '@krios:focusSound';
const CUSTOM_SOUNDS_KEY = '@krios:customSounds';

class FocusSoundService {
  private player: any = null;
  private statusSub: any = null;
  private webEl: any = null;
  private currentId: string = 'silence';
  private volume: number = 0.6;
  private customSounds: SoundOption[] = [];
  private status: SoundStatus = { loading: false, playing: false, soundId: null, error: null };
  private listeners = new Set<(s: SoundStatus) => void>();

  /** Subscribe to playback status (loading / playing / error). No immediate emit. */
  onStatus(cb: (s: SoundStatus) => void): () => void {
    this.listeners.add(cb);
    return () => { this.listeners.delete(cb); };
  }

  private setStatus(patch: Partial<SoundStatus>): void {
    this.status = { ...this.status, ...patch };
    this.listeners.forEach((cb) => {
      try { cb(this.status); } catch {}
    });
  }

  async initialize(): Promise<void> {
    if (AudioModule?.setAudioModeAsync) {
      try {
        await AudioModule.setAudioModeAsync({
          playsInSilentMode: true,
          shouldPlayInBackground: true,
          interruptionMode: 'duckOthers',
        });
      } catch {}
    }

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
    if (this.player) {
      try { this.player.volume = this.volume; } catch {}
    }
    if (this.webEl) {
      try { this.webEl.volume = this.volume; } catch {}
    }
    await this.savePrefs();
  }

  private disposePlayer(): void {
    try { this.statusSub?.remove?.(); } catch {}
    this.statusSub = null;
    try { this.player?.remove?.(); } catch {}
    this.player = null;
    try { this.webEl?.pause?.(); } catch {}
    try {
      if (this.webEl) {
        this.webEl.src = '';
        this.webEl.load?.();
      }
    } catch {}
    this.webEl = null;
  }

  // Web backend: expo-audio's web player emits no error events and swallows
  // autoplay rejections, so silence was untraceable. Raw HTMLAudio gives us
  // real events (playing / waiting / error) on every browser.
  private async playWeb(source: any, soundId: string): Promise<void> {
    this.disposePlayer();
    this.setStatus({ loading: true, playing: false, soundId, error: null });
    try {
      const url = typeof source === 'string' ? source : source?.uri;
      if (!url) throw new Error('No audio source');
      const Ctor = (globalThis as any).Audio;
      const el = new Ctor(url);
      el.loop = true;
      el.volume = this.volume;
      el.preload = 'auto';
      el.onplaying = () => this.setStatus({ loading: false, playing: true, error: null });
      el.onwaiting = () => this.setStatus({ loading: true });
      el.onpause = () => {
        if (this.webEl === el) this.setStatus({ playing: false });
      };
      el.onerror = () => {
        if (this.webEl === el) this.setStatus({ loading: false, playing: false, error: 'Could not load sound' });
      };
      this.webEl = el;
      this.currentId = soundId;
      await el.play();
      await this.savePrefs();
    } catch (err: any) {
      const blocked = err?.name === 'NotAllowedError';
      this.setStatus({
        loading: false,
        playing: false,
        error: blocked ? 'Tap play again to start audio' : (err?.message || 'Could not load sound'),
      });
    }
  }

  private sourceNeedsDownload(source: any): boolean {
    const uri = typeof source === 'string' ? source : source?.uri;
    return !!uri && uri.startsWith('http');
  }

  async play(soundId: string): Promise<void> {
    if (!AudioModule?.createAudioPlayer || soundId === 'silence') {
      this.disposePlayer();
      this.currentId = soundId;
      this.setStatus({ loading: false, playing: false, soundId, error: null });
      await this.savePrefs();
      return;
    }

    const allSounds = this.getAllSounds();
    const option = allSounds.find(s => s.id === soundId);
    if (!option || !option.source) {
      this.disposePlayer();
      this.currentId = soundId;
      this.setStatus({ loading: false, playing: false, soundId, error: null });
      await this.savePrefs();
      return;
    }

    // Web goes through the raw-audio backend (see playWeb).
    if (Platform.OS === 'web') {
      await this.playWeb(option.source, soundId);
      return;
    }

    this.disposePlayer();
    this.setStatus({ loading: true, playing: false, soundId, error: null });

    try {
      // downloadFirst saves remote tracks to device storage on first play —
      // replays are instant and fully offline. Local files play directly.
      const player = AudioModule.createAudioPlayer(option.source, {
        downloadFirst: this.sourceNeedsDownload(option.source),
      });
      player.loop = true;
      player.volume = this.volume;
      this.statusSub = player.addListener?.('playbackStatusUpdate', (st: any) => {
        if (!st) return;
        if (st.isLoaded) {
          this.setStatus({ loading: !!st.isBuffering, playing: !!st.playing, error: null });
        } else if (st.error) {
          this.setStatus({ loading: false, playing: false, error: String(st.error) });
        }
      });
      this.player = player;
      this.currentId = soundId;
      player.play();
      await this.savePrefs();
    } catch (err: any) {
      console.warn('[FocusSound] Playback failed:', err);
      this.setStatus({ loading: false, playing: false, error: err?.message || 'Could not load sound' });
    }
  }

  private setTargetVolume(v: number): void {
    if (this.player) {
      try { this.player.volume = v; } catch {}
    }
    if (this.webEl) {
      try { this.webEl.volume = v; } catch {}
    }
  }

  private hasTarget(): boolean {
    return !!this.player || !!this.webEl;
  }

  async stop(): Promise<void> {
    if (this.player) {
      try { this.player.pause(); } catch {}
      try { await this.player.seekTo?.(0); } catch {}
    }
    if (this.webEl) {
      try { this.webEl.pause(); } catch {}
      try { this.webEl.currentTime = 0; } catch {}
    }
    this.setStatus({ loading: false, playing: false, soundId: null, error: null });
  }

  async pause(): Promise<void> {
    if (this.hasTarget()) {
      if (this.player) {
        try { this.player.pause(); } catch {}
      }
      if (this.webEl) {
        try { this.webEl.pause(); } catch {}
      }
      this.setStatus({ playing: false });
    }
  }

  async resume(): Promise<void> {
    if (this.player) {
      try { this.player.play(); } catch {}
      this.setStatus({ playing: true });
    } else if (this.webEl) {
      try {
        await this.webEl.play();
        this.setStatus({ playing: true });
      } catch (err: any) {
        this.setStatus({ playing: false, error: err?.name === 'NotAllowedError' ? 'Tap play again to start audio' : (err?.message || 'Could not play sound') });
      }
    }
  }

  async fadeOut(durationMs: number = 2000): Promise<void> {
    if (!this.hasTarget()) return;
    const steps = 20;
    const stepMs = durationMs / steps;
    const stepVol = this.volume / steps;
    for (let i = steps; i >= 0; i--) {
      this.setTargetVolume(Math.max(0, stepVol * i));
      await new Promise(r => setTimeout(r, stepMs));
    }
    this.setTargetVolume(this.volume);
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
      this.disposePlayer();
      this.setStatus({ loading: false, playing: false, soundId: null, error: null });
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
