/**
 * Krios Theme — Typography Tokens
 *
 * Font sizes, weights, and line heights for consistent text rendering.
 */

export const typography = {
  // Font sizes
  xs: 10,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 18,
  xxl: 22,
  xxxl: 28,
  display: 36,

  // Semantic aliases
  body: 14,
  caption: 12,
  label: 13,

  // Headings
  h1: 36,
  h2: 28,
  h3: 22,
  h4: 18,
  h5: 16,
  h6: 14,
} as const;

export const fontWeights = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  extrabold: '800' as const,
} as const;

export type Typography = typeof typography;
export type FontWeight = typeof fontWeights;
