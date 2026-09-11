import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { storage, STORAGE_KEYS } from '../utils/storage';

interface ThemeState {
  isDark: boolean;
  theme: 'light' | 'dark' | 'system';
  toggleTheme: () => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      isDark: true,
      theme: 'system' as const,

      toggleTheme: () => {
        const current = get().isDark;
        set({ isDark: !current, theme: !current ? 'dark' : 'light' });
      },

      setTheme: (theme) => {
        if (theme === 'system') {
          // Default to dark for system — actual system detection happens in ThemeProvider
          set({ theme, isDark: true });
        } else {
          set({ theme, isDark: theme === 'dark' });
        }
      },
    }),
{
      name: STORAGE_KEYS.THEME_PREFERENCE,
      storage: createJSONStorage(() => ({
        getItem: (name: string) => storage.getString(name) ?? null,
        setItem: (name: string, value: string) => storage.set(name, value),
        removeItem: (name: string) => storage.remove(name),
      })),
    }
  )
);


