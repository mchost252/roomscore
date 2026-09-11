/**
 * Krios Theme System
 *
 * Central export for all theme tokens and the useTheme hook.
 * The useTheme hook comes from ThemeContext — this file just re-exports it.
 *
 * Usage:
 *   import { useTheme, colors, spacing, typography } from '@/theme';
 */

// ─── Re-export the existing useTheme hook (from ThemeContext) ──────────────────
export { useTheme, useThemeContext, ThemeProvider } from '../../context/ThemeContext';

// ─── Color tokens ─────────────────────────────────────────────────────────────
export { darkColors, lightColors } from './colors';
export type { Colors } from './colors';

// ─── Spacing + Border Radius ──────────────────────────────────────────────────
export { spacing, borderRadius } from './spacing';
export type { Spacing, BorderRadius } from './spacing';

// ─── Typography ───────────────────────────────────────────────────────────────
export { typography, fontWeights } from './typography';
export type { Typography, FontWeight } from './typography';

// ─── Re-export standalone constants from constants/theme.ts ───────────────────
// These are framework-independent and safe to import anywhere.
export {
  Spacing as SpacingTokens,
  BorderRadius as BorderRadiusTokens,
  FontSizes,
  FontWeights,
  DarkShadows,
  LightShadows,
  Gradients,
  MOOD_CONFIG,
  PREMIUM_COLORS,
  ACCENT_COLORS,
  getThemeTokens,
  DarkGradients,
  LightGradients,
} from '../../constants/theme';
