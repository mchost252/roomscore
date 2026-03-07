/**
 * Krios Design System - Theme Tokens
 * 
 * Centralized design tokens for consistent UI across the app.
 * Import these instead of hardcoding values.
 */

import { Dimensions } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ==================== COLORS ====================
export const colors = {
  // Primary brand
  primary: '#6366f1',
  primaryDark: '#4f46e5',
  primaryLight: '#818cf8',
  secondary: '#8b5cf6',
  secondaryDark: '#7c3aed',
  
  // Backgrounds
  background: '#0a0a0f',
  backgroundSecondary: '#12121a',
  backgroundTertiary: '#1a1a24',
  surface: 'rgba(255,255,255,0.05)',
  surfaceElevated: 'rgba(255,255,255,0.08)',
  
  // Text
  textPrimary: '#ffffff',
  textSecondary: 'rgba(255,255,255,0.6)',
  textMuted: 'rgba(255,255,255,0.4)',
  textHint: 'rgba(255,255,255,0.25)',
  
  // States
  success: '#10b981',
  successLight: '#34d399',
  error: '#ef4444',
  errorLight: '#f87171',
  warning: '#f59e0b',
  warningLight: '#fbbf24',
  
  // Accent colors for variety
  accent: {
    purple: '#8b5cf6',
    blue: '#3b82f6',
    cyan: '#06b6d4',
    green: '#22c55e',
    orange: '#f97316',
    pink: '#ec4899',
  },
  
  // Borders
  border: 'rgba(255,255,255,0.1)',
  borderLight: 'rgba(255,255,255,0.08)',
  borderFocus: '#6366f1',
  
  // Overlays
  overlay: 'rgba(0,0,0,0.5)',
  overlayLight: 'rgba(0,0,0,0.3)',
};

// ==================== SPACING ====================
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

// ==================== RADIUS ====================
export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 9999,
};

// ==================== TYPOGRAPHY ====================
export const typography = {
  h1: {
    fontSize: 28,
    fontWeight: '700' as const,
    lineHeight: 36,
    letterSpacing: -0.5,
  },
  h2: {
    fontSize: 20,
    fontWeight: '600' as const,
    lineHeight: 28,
    letterSpacing: -0.3,
  },
  h3: {
    fontSize: 18,
    fontWeight: '600' as const,
    lineHeight: 24,
  },
  body: {
    fontSize: 16,
    fontWeight: '400' as const,
    lineHeight: 24,
  },
  bodySmall: {
    fontSize: 14,
    fontWeight: '400' as const,
    lineHeight: 20,
  },
  caption: {
    fontSize: 12,
    fontWeight: '400' as const,
    lineHeight: 16,
  },
  button: {
    fontSize: 16,
    fontWeight: '600' as const,
    lineHeight: 24,
  },
  overline: {
    fontSize: 11,
    fontWeight: '600' as const,
    lineHeight: 16,
    letterSpacing: 1.5,
    textTransform: 'uppercase' as const,
  },
};

// ==================== SHADOWS ====================
export const shadows = {
  small: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  large: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  glow: (color: string = colors.primary) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 8,
  }),
};

// ==================== ANIMATIONS ====================
export const animations = {
  // Timing
  duration: {
    fast: 150,
    normal: 300,
    slow: 500,
    entrance: 600,
  },
  
  // Spring configs
  spring: {
    gentle: { tension: 40, friction: 8 },
    default: { tension: 50, friction: 7 },
    bouncy: { tension: 100, friction: 6 },
    entrance: { tension: 45, friction: 8 },
  },
  
  // Easing
  easing: {
    easeIn: 'ease-in',
    easeOut: 'ease-out',
    easeInOut: 'ease-in-out',
    sharp: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },
};

// ==================== DIMENSIONS ====================
export const dimensions = {
  screenWidth: SCREEN_WIDTH,
  screenHeight: SCREEN_HEIGHT,
  inputHeight: 52,
  buttonHeight: 52,
  iconSmall: 18,
  iconMedium: 24,
  iconLarge: 32,
  logoSmall: 36,
  logoMedium: 60,
  logoLarge: 80,
};

// ==================== GRADIENTS ====================
type GradientColors = readonly [string, string, ...string[]];

export const gradients: {
  primary: GradientColors;
  primaryReversed: GradientColors;
  success: GradientColors;
  error: GradientColors;
  surface: GradientColors;
  background: GradientColors;
} = {
  primary: [colors.primary, colors.secondary] as GradientColors,
  primaryReversed: [colors.secondary, colors.primary] as GradientColors,
  success: [colors.success, '#059669'] as GradientColors,
  error: [colors.error, '#dc2626'] as GradientColors,
  surface: ['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.02)'] as GradientColors,
  background: [colors.background, colors.backgroundSecondary, colors.background] as GradientColors,
};

// ==================== EXPORT DEFAULT ====================
export const theme = {
  colors,
  spacing,
  radius,
  typography,
  shadows,
  animations,
  dimensions,
  gradients,
};

export default theme;
