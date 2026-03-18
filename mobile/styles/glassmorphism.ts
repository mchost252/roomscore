/**
 * Glassmorphism Design System
 * "Shiny and Massive" futuristic dark-mode aesthetic
 */

import { Platform, ViewStyle, TextStyle } from 'react-native';

export const COLORS = {
  // Neon accents
  primary: '#6366f1',
  primaryLight: '#8b5cf6',
  secondary: '#22c55e',
  accent: '#f59e0b',
  danger: '#ef4444',
  warning: '#f97316',
  
  // Aura colors (pre-cached for performance)
  aura: {
    bronze: '#cd7f32',
    silver: '#c0c0c0',
    gold: '#ffd700',
    platinum: '#e5e4e2',
  },
  
  // Doom clock
  doomGreen: '#22c55e',
  doomYellow: '#eab308',
  doomRed: '#ef4444',
};

export const GLASS = {
  // Background
  background: 'rgba(255,255,255,0.05)',
  backgroundDark: 'rgba(26,26,46,0.95)',
  surface: 'rgba(255,255,255,0.08)',
  surfaceLight: 'rgba(255,255,255,0.12)',
  
  // Borders
  border: 'rgba(255,255,255,0.1)',
  borderLight: 'rgba(255,255,255,0.15)',
  
  // Shadows
  shadowColor: '#000',
};

export const ANIMATION = {
  // Spring configs
  spring: {
    damping: 15,
    stiffness: 100,
    mass: 1,
  },
  springFast: {
    damping: 12,
    stiffness: 180,
    mass: 0.8,
  },
  
  // Timing
  timing: {
    fast: 150,
    normal: 300,
    slow: 500,
  },
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
};

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
};

export const TYPOGRAPHY = {
  title: {
    fontSize: 28,
    fontWeight: '800' as const,
    letterSpacing: -0.5,
  },
  heading: {
    fontSize: 20,
    fontWeight: '700' as const,
    letterSpacing: -0.3,
  },
  subheading: {
    fontSize: 16,
    fontWeight: '600' as const,
    letterSpacing: -0.2,
  },
  body: {
    fontSize: 14,
    fontWeight: '500' as const,
  },
  caption: {
    fontSize: 12,
    fontWeight: '500' as const,
  },
  label: {
    fontSize: 11,
    fontWeight: '700' as const,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
  },
};

// Pre-cached neon glow styles
export const GLOWS = {
  primary: Platform.select({
    ios: {
      shadowColor: COLORS.primary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.5,
      shadowRadius: 12,
    },
    android: {
      elevation: 8,
    },
  }) as ViewStyle,
  
  cyan: Platform.select({
    ios: {
      shadowColor: '#06b6d4',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.6,
      shadowRadius: 16,
    },
    android: {
      elevation: 10,
    },
  }) as ViewStyle,
  
  green: Platform.select({
    ios: {
      shadowColor: COLORS.secondary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.5,
      shadowRadius: 8,
    },
    android: {
      elevation: 6,
    },
  }) as ViewStyle,
  
  danger: Platform.select({
    ios: {
      shadowColor: COLORS.danger,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.5,
      shadowRadius: 10,
    },
    android: {
      elevation: 8,
    },
  }) as ViewStyle,
};

// Glass card base style
export const GLASS_CARD: ViewStyle = {
  backgroundColor: GLASS.background,
  borderWidth: 1,
  borderColor: GLASS.border,
  borderRadius: RADIUS.lg,
};

// Heat level colors (static, no animation for FPS)
export const HEAT_COLORS = {
  normal: null,
  warm: '#eab308',    // 40-60%
  hot: '#f97316',     // 60-80%
  critical: '#ef4444', // 80%+
};

// Badge decay opacity
export const BADGE_DECAY_OPACITY = 0.4;

export default {
  COLORS,
  GLASS,
  ANIMATION,
  SPACING,
  RADIUS,
  TYPOGRAPHY,
  GLOWS,
  GLASS_CARD,
  HEAT_COLORS,
  BADGE_DECAY_OPACITY,
};
