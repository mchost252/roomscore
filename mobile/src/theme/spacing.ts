/**
 * Krios Theme — Spacing Tokens
 *
 * Consistent spacing scale for padding, margin, and gaps.
 */

export const spacing = {
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

export const borderRadius = {
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

export type Spacing = typeof spacing;
export type BorderRadius = typeof borderRadius;
