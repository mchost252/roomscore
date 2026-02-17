import { useColorScheme } from 'react-native';
import { KRIOS_COLORS } from './colors';

/**
 * Krios Design System - Dark & Light Theme Support
 * Inspired by constellation/cosmic aesthetics with sophisticated gradients
 */

export const useTheme = () => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return {
    isDark,
    colors: isDark ? DarkColors : LightColors,
    gradients: isDark ? DarkGradients : LightGradients,
    spacing: Spacing,
    borderRadius: BorderRadius,
    fontSizes: FontSizes,
    shadows: isDark ? DarkShadows : LightShadows,
  };
};

// ============================================
// DARK THEME - Instagram/Discord Inspired (Premium & Modern)
// ============================================
export const DarkColors = {
  // True dark backgrounds (almost black like Instagram/Discord)
  background: {
    primary: '#000000',      // Pure black (Instagram style)
    secondary: '#0a0a0a',    // Very dark gray
    tertiary: '#1a1a1a',     // Card backgrounds (Discord style)
    elevated: 'rgba(26, 26, 26, 0.95)', // Subtle elevation
  },
  
  // Constellation blue (muted, sophisticated)
  constellation: {
    light: '#5B8DEF',        // Muted blue
    DEFAULT: '#4A7CD6',      // Deeper blue
    dark: '#3B6BC2',         // Dark blue
    glow: 'rgba(74, 124, 214, 0.15)', // Very subtle glow
  },
  
  // Cosmic accent (purple-pink like Instagram)
  cosmic: {
    light: '#C084FC',        // Soft purple
    DEFAULT: '#A855F7',      // Purple 500
    dark: '#9333EA',         // Deep purple
    glow: 'rgba(168, 85, 247, 0.12)', // Very subtle
  },
  
  // Text colors (high contrast)
  text: {
    primary: '#FFFFFF',
    secondary: 'rgba(255, 255, 255, 0.6)',  // More muted
    tertiary: 'rgba(255, 255, 255, 0.4)',
    inverse: '#000000',
  },
  
  // Border colors (very subtle)
  border: {
    primary: 'rgba(255, 255, 255, 0.08)',   // Almost invisible
    secondary: 'rgba(255, 255, 255, 0.04)', // Super subtle
    focus: 'rgba(74, 124, 214, 0.4)',
  },
  
  // Status colors
  status: {
    success: '#10B981',
    error: '#EF4444',
    warning: '#F59E0B',
    info: '#4A7CD6',
  },
};

// ============================================
// LIGHT THEME - Secondary (Clean & Professional)
// ============================================
export const LightColors = {
  // Clean backgrounds
  background: {
    primary: '#ffffff',
    secondary: '#f8f9fa',
    tertiary: '#f1f5f9',
    elevated: 'rgba(241, 245, 249, 0.9)',
  },
  
  // Constellation blue (darker for light theme)
  constellation: {
    light: '#3B82F6',
    DEFAULT: '#2563EB',
    dark: '#1E40AF',
    glow: 'rgba(37, 99, 235, 0.2)',
  },
  
  // Cosmic amber (darker for light theme)
  cosmic: {
    light: '#F59E0B',
    DEFAULT: '#D97706',
    dark: '#B45309',
    glow: 'rgba(217, 119, 6, 0.2)',
  },
  
  // Text colors
  text: {
    primary: '#0f172a',
    secondary: 'rgba(15, 23, 42, 0.7)',
    tertiary: 'rgba(15, 23, 42, 0.5)',
    inverse: '#ffffff',
  },
  
  // Border colors
  border: {
    primary: 'rgba(0, 0, 0, 0.1)',
    secondary: 'rgba(0, 0, 0, 0.05)',
    focus: 'rgba(37, 99, 235, 0.5)',
  },
  
  // Status colors
  status: {
    success: '#059669',
    error: '#DC2626',
    warning: '#D97706',
    info: '#2563EB',
  },
};

// ============================================
// GRADIENT DEFINITIONS (Dark, Subtle, Premium)
// ============================================
export const DarkGradients = {
  // Background gradient (very dark, almost black)
  background: {
    colors: ['#000000', '#0a0a0a', '#050505'],  // Pure black to dark gray
    locations: [0, 0.5, 1],
  },
  
  // Constellation gradient (subtle blue)
  constellation: {
    colors: ['#1a1a2e', '#2a3f5f', '#3B6BC2'],  // Dark navy → Blue gray → Blue
    locations: [0, 0.6, 1],
  },
  
  // Cosmic gradient (purple-pink Instagram style)
  cosmic: {
    colors: ['#2e1a47', '#7c3aed', '#c084fc'],  // Dark purple → Purple → Light purple
    locations: [0, 0.5, 1],
  },
  
  // Primary app gradient (blue to purple - modern)
  primary: {
    colors: ['#4A7CD6', '#7c3aed', '#A855F7'],  // Blue → Purple → Light purple
    locations: [0, 0.5, 1],
  },
  
  // Reverse gradient
  primaryReverse: {
    colors: ['#A855F7', '#7c3aed', '#4A7CD6'],  // Purple → Deep purple → Blue
    locations: [0, 0.5, 1],
  },
};

export const LightGradients = {
  // Background gradient (clean white to light gray)
  background: {
    colors: ['#ffffff', '#f8fafc', '#f1f5f9'],
    locations: [0, 0.5, 1],
  },
  
  // Constellation gradient
  constellation: {
    colors: ['#1E40AF', '#2563EB', '#3B82F6'],
    locations: [0, 0.5, 1],
  },
  
  // Cosmic gradient (purple for light theme too)
  cosmic: {
    colors: ['#7c3aed', '#a855f7', '#c084fc'],
    locations: [0, 0.5, 1],
  },
  
  // Primary app gradient (blue to purple)
  primary: {
    colors: ['#2563EB', '#7c3aed', '#a855f7'],
    locations: [0, 0.5, 1],
  },
  
  // Reverse gradient
  primaryReverse: {
    colors: ['#a855f7', '#7c3aed', '#2563EB'],
    locations: [0, 0.5, 1],
  },
};

// ============================================
// SPACING (Love for padding!)
// ============================================
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
  massive: 48,
  
  // Semantic spacing
  card: {
    padding: 20,
    margin: 16,
    gap: 12,
  },
  
  button: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    gap: 8,
  },
  
  input: {
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  
  screen: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
};

// ============================================
// BORDER RADIUS (Smooth, not sharp)
// ============================================
export const BorderRadius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 9999,
  
  // Semantic radius
  card: 16,
  button: 12,
  input: 12,
  avatar: 9999,
  badge: 8,
};

// ============================================
// FONT SIZES (Mobile-optimized)
// ============================================
export const FontSizes = {
  xs: 10,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 18,
  xxl: 20,
  xxxl: 24,
  
  // Headings
  h1: 32,
  h2: 28,
  h3: 24,
  h4: 20,
  h5: 18,
  h6: 16,
  
  // Body
  body: 15,
  caption: 12,
  label: 13,
};

// ============================================
// SHADOWS (Smooth depth)
// ============================================
export const DarkShadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8,
  },
  glow: {
    shadowColor: '#60A5FA',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 10,
  },
};

export const LightShadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  glow: {
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
};

// Export individual items for backward compatibility
export const Colors = DarkColors;  // Default to dark for existing code
