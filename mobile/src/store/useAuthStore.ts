import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { storage, STORAGE_KEYS } from '../utils/storage';

export interface User {
  id: string;
  username: string;
  email: string;
  avatar?: string;
  token?: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: true,

setUser: (user) => {
        set({
          user,
          isAuthenticated: !!user,
          isLoading: false,
        });
        // Also persist token to secure storage for API interceptors
        if (user?.token) {
          storage.set(STORAGE_KEYS.AUTH_TOKEN, user.token);
        }
      },

      setLoading: (isLoading) => set({ isLoading }),

logout: () => {
        set({
          user: null,
          isAuthenticated: false,
          isLoading: false,
        });
        storage.remove(STORAGE_KEYS.AUTH_TOKEN);
        storage.remove(STORAGE_KEYS.REFRESH_TOKEN);
        storage.remove(STORAGE_KEYS.USER_ID);
      },
    }),
{
      name: 'auth-store',
      storage: createJSONStorage(() => ({
        getItem: (name: string) => storage.getString(name) ?? null,
        setItem: (name: string, value: string) => storage.set(name, value),
        removeItem: (name: string) => storage.remove(name),
      })),
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);


