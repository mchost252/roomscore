/**
 * Krios Design System — theme.ts
 *
 * All design tokens live in ThemeContext to avoid circular imports.
 * This file re-exports everything from ThemeContext plus adds
 * standalone constants (MOOD_CONFIG, PREMIUM_COLORS, ACCENT_COLORS,
 * Gradients, etc.) that don't depend on the context.
 *
 * Usage:
 *   import { useTheme } from '../constants/theme';          // hook
 *   import { MOOD_CONFIG, PREMIUM_COLORS } from '../constants/theme'; // constants
 *   import { getThemeTokens } from '../constants/theme';   // token helper
 */

// ─── Re-export hook + context types ──────────────────────────────────────────

export { useTheme, useThemeContext, ThemeProvider } from '../context/ThemeContext';
export { default as ThemeContext } from '../context/ThemeContext';

// ─── Standalone Design Token Constants ───────────────────────────────────────
// These are framework-independent and safe to import anywhere.

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
  section: 24,
  card: { padding: 20, margin: 16, gap: 12 },
  button: { paddingVertical: 14, paddingHorizontal: 24, gap: 8 },
  input: { paddingVertical: 14, paddingHorizontal: 16 },
  screen: { paddingHorizontal: 20, paddingVertical: 16 },
} as const;

export const BorderRadius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 24,
  full: 9999,
  card: 16,
  button: 14,
  input: 12,
  badge: 6,
  avatar: 9999,
} as const;

export const FontSizes = {
  xs: 10,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 18,
  xxl: 22,
  xxxl: 28,
  display: 36,
  body: 14,
  caption: 12,
  label: 13,
  h1: 36,
  h2: 28,
  h3: 22,
  h4: 18,
  h5: 16,
  h6: 14,
} as const;

export const FontWeights = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  extrabold: '800' as const,
} as const;

export const DarkShadows = {
  sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.35, shadowRadius: 4, elevation: 3 },
  md: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.45, shadowRadius: 10, elevation: 6 },
  lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.55, shadowRadius: 20, elevation: 10 },
  glow: { shadowColor: '#6366f1', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 20, elevation: 8 },
  glowAccent: { shadowColor: '#a78bfa', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 6 },
} as const;

export const LightShadows = {
  sm: { shadowColor: '#0f172a', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  md: { shadowColor: '#0f172a', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 10, elevation: 4 },
  lg: { shadowColor: '#0f172a', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.16, shadowRadius: 20, elevation: 8 },
  glow: { shadowColor: '#6366f1', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.25, shadowRadius: 16, elevation: 6 },
  glowAccent: { shadowColor: '#7c3aed', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 4 },
} as const;

export const Gradients = {
  primary: ['#6366f1', '#8b5cf6'] as string[],
  primaryDeep: ['#4f46e5', '#6366f1', '#8b5cf6'] as string[],
  cosmic: ['#1e1b4b', '#312e81', '#080810'] as string[],
  cosmicReverse: ['#080810', '#312e81', '#1e1b4b'] as string[],
  surface: ['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.04)'] as string[],
  surfaceLight: ['rgba(0,0,0,0.06)', 'rgba(0,0,0,0.02)'] as string[],
  nebula: ['#1e1b4b', '#4c1d95', '#2d1b69'] as string[],
  aurora: ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd'] as string[],
  danger: ['#ef4444', '#dc2626'] as string[],
  success: ['#22c55e', '#16a34a'] as string[],
  gold: ['#f59e0b', '#d97706'] as string[],
} as const;

// ─── Mood Config ──────────────────────────────────────────────────────────────

export const MOOD_CONFIG = {
  calm: {
    label: 'Calm',
    color: '#10b981',
    bgColor: 'rgba(16,185,129,0.10)',
    icon: 'leaf-outline' as const,
    gradient: ['#10b981', '#059669'] as string[],
  },
  focused: {
    label: 'Focused',
    color: '#3b82f6',
    bgColor: 'rgba(59,130,246,0.10)',
    icon: 'eye-outline' as const,
    gradient: ['#3b82f6', '#2563eb'] as string[],
  },
  light: {
    label: 'Light',
    color: '#f59e0b',
    bgColor: 'rgba(245,158,11,0.10)',
    icon: 'sunny-outline' as const,
    gradient: ['#f59e0b', '#d97706'] as string[],
  },
  overwhelmed: {
    label: 'Overwhelmed',
    color: '#ef4444',
    bgColor: 'rgba(239,68,68,0.10)',
    icon: 'cloud-outline' as const,
    gradient: ['#ef4444', '#dc2626'] as string[],
  },
  motivated: {
    label: 'Motivated',
    color: '#8b5cf6',
    bgColor: 'rgba(139,92,246,0.10)',
    icon: 'flame-outline' as const,
    gradient: ['#8b5cf6', '#7c3aed'] as string[],
  },
} as const;

export type MoodKey = keyof typeof MOOD_CONFIG;

// ─── Premium Colors ───────────────────────────────────────────────────────────

export const PREMIUM_COLORS = {
  gold: '#f59e0b',
  goldLight: '#fcd34d',
  goldDark: '#d97706',
  goldGradient: ['#f59e0b', '#d97706'] as string[],
  goldGlow: 'rgba(245,158,11,0.25)',
  lockedOverlay: 'rgba(0,0,0,0.45)',
} as const;

// ─── Accent Color Map ─────────────────────────────────────────────────────────

export const ACCENT_COLORS = {
  indigo: {
    primary: '#6366f1',
    light: '#818cf8',
    dark: '#4f46e5',
    gradient: ['#6366f1', '#8b5cf6'] as string[],
  },
  purple: {
    primary: '#a855f7',
    light: '#c084fc',
    dark: '#9333ea',
    gradient: ['#a855f7', '#7c3aed'] as string[],
  },
  cyan: {
    primary: '#06b6d4',
    light: '#22d3ee',
    dark: '#0891b2',
    gradient: ['#06b6d4', '#0284c7'] as string[],
  },
  rose: {
    primary: '#f43f5e',
    light: '#fb7185',
    dark: '#e11d48',
    gradient: ['#f43f5e', '#e11d48'] as string[],
  },
} as const;

// ─── getThemeTokens helper ────────────────────────────────────────────────────
// For components that can't use hooks (e.g. StyleSheet.create outside render).

export interface ThemeTokens {
  spacing: typeof Spacing;
  radius: typeof BorderRadius;
  borderRadius: typeof BorderRadius;
  fontSize: typeof FontSizes;
  fontSizes: typeof FontSizes;
  fontWeight: typeof FontWeights;
  shadows: typeof DarkShadows | typeof LightShadows;
  gradients: typeof Gradients;
  isDark: boolean;
}

export function getThemeTokens(isDark: boolean): ThemeTokens {
  return {
    spacing: Spacing,
    radius: BorderRadius,
    borderRadius: BorderRadius,
    fontSize: FontSizes,
    fontSizes: FontSizes,
    fontWeight: FontWeights,
    shadows: isDark ? DarkShadows : LightShadows,
    gradients: Gradients,
    isDark,
  };
}

// ─── Backward Compatibility Aliases ──────────────────────────────────────────

export const DarkColors = {
  bg: '#080810',
  surface: 'rgba(255,255,255,0.06)',
  primary: '#6366f1',
  primaryLight: '#818cf8',
  text: '#ffffff',
  textSecondary: 'rgba(255,255,255,0.65)',
  textTertiary: 'rgba(255,255,255,0.35)',
  border: 'rgba(255,255,255,0.08)',
  success: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444',
  accent: '#a78bfa',
} as const;

export const LightColors = {
  bg: '#f8f9ff',
  surface: 'rgba(0,0,0,0.04)',
  primary: '#6366f1',
  primaryLight: '#818cf8',
  text: '#0f172a',
  textSecondary: 'rgba(15,23,42,0.65)',
  textTertiary: 'rgba(15,23,42,0.4)',
  border: 'rgba(0,0,0,0.08)',
  success: '#16a34a',
  warning: '#d97706',
  error: '#dc2626',
  accent: '#7c3aed',
} as const;

export const Colors = DarkColors;
export const DarkGradients = Gradients;
export const LightGradients = Gradients;
