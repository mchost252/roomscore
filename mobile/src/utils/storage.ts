/**
 * Krios Storage — Unified storage abstraction.
 *
 * Platform behavior:
 *   • Web (Expo web, Metro bundler): Uses localStorage synchronously.
 *   • Native (iOS/Android): Uses react-native-mmkv v4, lazily required.
 *
 * Why lazy require? Metro's static analyzer walks the dependency graph
 * before runtime. A top-level `import { createMMKV } from 'react-native-mmkv'`
 * triggers the module's internal `import.meta` and crashes the web build.
 * By using `require()` inside a runtime branch, Metro skips it during graph walking.
 */

import { AppState, Platform } from 'react-native';

// ─── Platform detection ────────────────────────────────────────────────────────
// Platform.OS is the standard, reliable indicator. Available at module-parse time.
// On web: 'web'. On native: 'ios' | 'android'.
const IS_WEB = Platform.OS === 'web';

// ─── localStorage fallback (web) ───────────────────────────────────────────────
// Synchronous, same API shape as MMKV for Zustand compatibility.

const webStorage = {
  getItem(key: string): string | null {
    return localStorage.getItem(key);
  },
  setItem(key: string, value: string): void {
    localStorage.setItem(key, value);
  },
  removeItem(key: string): void {
    localStorage.removeItem(key);
  },
  clear(): void {
    localStorage.clear();
  },
  get length(): number {
    return localStorage.length;
  },
  key(i: number): string | null {
    return localStorage.key(i);
  },
};

// ─── Native MMKV (lazy singleton) ─────────────────────────────────────────────
// `require()` is not hoisted like `import`, so Metro never sees the
// 'react-native-mmkv' dependency during graph walking on web.
// The instance is cached after first creation (MMKV is a singleton by design).

// eslint-disable-next-line @typescript-eslint/no-require-imports
let nativeMMKV: any = null;

/**
 * Shim for a react-native-mmkv version mismatch.
 *
 * createMMKV() in react-native-mmkv 4.3.2 unconditionally registers an AppState
 * listener that calls `mmkv.checkContentChanged()` whenever the app returns to
 * 'active' (see lib/addContentChangedListener/addContentChangedListener.js). That
 * method only exists on newer native Nitro builds than the one installed here, so
 * every foreground transition threw "mmkv.checkContentChanged is not a function".
 *
 * It surfaced most visibly after picking an image: the picker backgrounds the app,
 * and coming back fires the listener. The write itself already succeeded — the
 * throw happens in the listener afterwards — which is why the avatar changed
 * anyway and the error looked spurious.
 *
 * Installing a no-op keeps the listener harmless. The method's real job is to
 * detect writes made by *other* processes (app extensions, widgets, App Clips);
 * Krios has none, so there is nothing to detect and nothing lost.
 */
function ensureContentChangedShim(instance: any): any {
  if (!instance || typeof instance.checkContentChanged === 'function') return instance;

  const noop = () => {};

  // Try the instance first.
  try {
    instance.checkContentChanged = noop;
    if (typeof instance.checkContentChanged === 'function') return instance;
  } catch {
    // fall through
  }

  // Nitro HybridObjects are native-backed and may reject plain assignment, so
  // fall back to defining it on the instance, then on its prototype.
  try {
    Object.defineProperty(instance, 'checkContentChanged', {
      value: noop, writable: true, configurable: true, enumerable: false,
    });
    if (typeof instance.checkContentChanged === 'function') return instance;
  } catch {
    // fall through
  }

  try {
    const proto = Object.getPrototypeOf(instance);
    if (proto && typeof proto.checkContentChanged !== 'function') {
      Object.defineProperty(proto, 'checkContentChanged', {
        value: noop, writable: true, configurable: true, enumerable: false,
      });
    }
  } catch {
    // Give up: the AppState listener will still throw on foreground, but it
    // happens after every write completes, so storage stays correct.
  }

  return instance;
}

function getNativeMMKV(): any {
  if (nativeMMKV) return nativeMMKV;
  const { createMMKV } = require('react-native-mmkv');
  // The installed JS package registers a foreground listener during creation,
  // but this native build does not expose checkContentChanged(). Skip that
  // optional listener; Krios has no second process that needs change detection.
  const addContentChangedListener = AppState.addEventListener;
  AppState.addEventListener = (() => ({ remove: () => {} })) as typeof AppState.addEventListener;
  try {
    nativeMMKV = createMMKV({ id: 'krios-storage' });
  } finally {
    AppState.addEventListener = addContentChangedListener;
  }
  return nativeMMKV;
}

// ─── Unified storage adapter ───────────────────────────────────────────────────
// All methods are synchronous. On web they use localStorage; on native they use MMKV.

export const storage = {
  getString(key: string): string | undefined {
    if (IS_WEB) {
      const v = webStorage.getItem(key);
      return v ?? undefined;
    }
    return getNativeMMKV().getString(key);
  },

  getNumber(key: string): number | undefined {
    if (IS_WEB) {
      const v = webStorage.getItem(key);
      if (v === null || v === undefined) return undefined;
      const n = Number(v);
      return isNaN(n) ? undefined : n;
    }
    return getNativeMMKV().getNumber(key);
  },

  getBoolean(key: string): boolean | undefined {
    if (IS_WEB) {
      const v = webStorage.getItem(key);
      if (v === null || v === undefined) return undefined;
      return v === 'true';
    }
    return getNativeMMKV().getBoolean(key);
  },

  set(key: string, value: string | number | boolean): void {
    if (IS_WEB) {
      webStorage.setItem(key, String(value));
      return;
    }
    getNativeMMKV().set(key, value);
  },

  remove(key: string): void {
    if (IS_WEB) {
      webStorage.removeItem(key);
      return;
    }
    getNativeMMKV().remove(key);
  },

  contains(key: string): boolean {
    if (IS_WEB) {
      return webStorage.getItem(key) !== null;
    }
    return getNativeMMKV().contains(key);
  },

  getAllKeys(): string[] {
    if (IS_WEB) {
      const keys: string[] = [];
      for (let i = 0; i < webStorage.length; i++) {
        const k = webStorage.key(i);
        if (k) keys.push(k);
      }
      return keys;
    }
    return getNativeMMKV().getAllKeys();
  },

  clearAll(): void {
    if (IS_WEB) {
      webStorage.clear();
      return;
    }
    getNativeMMKV().clearAll();
  },

  // ─── JSON helpers ──────────────────────────────────────────────────────────

  getJSON<T>(key: string): T | undefined {
    const raw = storage.getString(key);
    if (!raw) return undefined;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return undefined;
    }
  },

  setJSON<T>(key: string, value: T): void {
    storage.set(key, JSON.stringify(value));
  },
};

// ─── Storage Keys (Centralized) ───────────────────────────────────────────────

export const STORAGE_KEYS = {
  // Auth
  AUTH_TOKEN: 'auth_token',
  REFRESH_TOKEN: 'refresh_token',
  USER_ID: 'user_id',

  // Theme
  THEME_PREFERENCE: 'theme_preference',
  ACCENT_COLOR: 'accent_color',

  // Chat
  BUBBLE_STYLE: 'bubble-style',
  CHAT_FONT_SIZE: 'chat_font_size',

  // Settings
  SETTINGS_PREFERENCE: 'settings_preference',
  HAPTICS_ENABLED: 'haptics_enabled',
  SOUND_EFFECTS: 'sound_effects',
  NAVIGATION_STYLE: 'navigation_style',
  NOTIFICATIONS_ENABLED: 'notifications_enabled',

  // Onboarding
  ONBOARDING_COMPLETE: 'onboarding_complete',
  ONBOARDED_ROOM: 'onboarded_',

  // Cache
  LAST_SYNC: 'last_sync',
  OFFLINE_QUEUE: 'offline_queue',
} as const;

export default storage;
