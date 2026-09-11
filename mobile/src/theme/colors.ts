/**
 * Krios Theme — Color Tokens
 *
 * Re-exports the existing DarkColors and LightColors from ThemeContext.
 * This file does NOT define new colors — it preserves the exact same
 * color palette the app already uses.
 *
 * Usage:
 *   import { darkColors, lightColors } from '@/theme/colors';
 *   import { useTheme } from '@/theme';
 *   const { colors } = useTheme(); // returns darkColors or lightColors
 */

export {
  DarkColors as darkColors,
  LightColors as lightColors,
} from '../../context/ThemeContext';

// Re-export the color type
export type { Colors } from '../../context/ThemeContext';
