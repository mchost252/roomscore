import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { storage, STORAGE_KEYS } from '../utils/storage';

export type NavigationStyle = 'bottom' | 'sidebar';

/**
 * Seed from the standalone `navigation_style` key that Settings used to write
 * directly. Only consulted when this store has nothing persisted yet, so an
 * existing preference survives the move into the store.
 */
function legacyNavigationStyle(): NavigationStyle {
  return storage.getString(STORAGE_KEYS.NAVIGATION_STYLE) === 'sidebar' ? 'sidebar' : 'bottom';
}

interface SettingsState {
  hapticsEnabled: boolean;
  soundEffects: boolean;
  notificationsEnabled: boolean;
  navigationStyle: NavigationStyle;

  setHaptics: (enabled: boolean) => void;
  setSoundEffects: (enabled: boolean) => void;
  setNotifications: (enabled: boolean) => void;
  setNavigationStyle: (style: NavigationStyle) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      hapticsEnabled: true,
      soundEffects: true,
      notificationsEnabled: true,
      navigationStyle: legacyNavigationStyle(),

      setHaptics: (enabled) => set({ hapticsEnabled: enabled }),
      setSoundEffects: (enabled) => set({ soundEffects: enabled }),
      setNotifications: (enabled) => set({ notificationsEnabled: enabled }),
      setNavigationStyle: (style) => set({ navigationStyle: style }),
    }),
    {
      name: STORAGE_KEYS.SETTINGS_PREFERENCE,
      version: 1,
      // v0 typed this field 'tabs' | 'sidebar', where 'tabs' meant the bottom bar.
      migrate: (persisted: any, version) => {
        if (version === 0 && persisted?.navigationStyle === 'tabs') {
          return { ...persisted, navigationStyle: 'bottom' };
        }
        return persisted;
      },
      storage: createJSONStorage(() => ({
        getItem: (name: string) => storage.getString(name) ?? null,
        setItem: (name: string, value: string) => storage.set(name, value),
        removeItem: (name: string) => storage.remove(name),
      })),
    }
  )
);
