import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { storage, STORAGE_KEYS } from '../utils/storage';

export const BUBBLE_STYLES = [
  'minimal', 'glass', 'neon', 'gradient', 'liquid',
  'cyber', 'outline', 'shadow', 'pixel', 'hologram',
  'flame', 'cosmic',
] as const;

export type BubbleStyle = typeof BUBBLE_STYLES[number];

interface BubbleState {
  selectedStyle: BubbleStyle;
  setStyle: (style: BubbleStyle) => void;
}

export const useBubbleStore = create<BubbleState>()(
  persist(
    (set) => ({
      selectedStyle: 'minimal' as BubbleStyle,

      setStyle: (style) => set({ selectedStyle: style }),
    }),
{
      name: STORAGE_KEYS.BUBBLE_STYLE,
      storage: createJSONStorage(() => ({
        getItem: (name: string) => storage.getString(name) ?? null,
        setItem: (name: string, value: string) => storage.set(name, value),
        removeItem: (name: string) => storage.remove(name),
      })),
    }
  )
);


