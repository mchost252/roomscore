import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import { useColorScheme, Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Types ────────────────────────────────────────────────────────────────────

type Theme = 'light' | 'dark' | 'system';
type AccentColor = 'indigo' | 'purple' | 'cyan' | 'rose';

// ─── Inline design tokens (kept here to avoid circular imports) ───────────────
// theme.ts re-exports useTheme from here, so we cannot import from theme.ts.

const DarkColors = {
  // New flat API
  bg: '#080810',
  surface: 'rgba(255,255,255,0.06)',
  surfaceElevated: 'rgba(255,255,255,0.09)',
  primary: '#6366f1',
  primaryLight: '#818cf8',
  primaryDark: '#4f46e5',
  text: '#ffffff',
  textSecondary: 'rgba(255,255,255,0.65)',
  textTertiary: 'rgba(255,255,255,0.35)',
  borderColor: 'rgba(255,255,255,0.08)',
  borderStrong: 'rgba(255,255,255,0.14)',
  success: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444',
  accent: '#a78bfa',
  card: 'rgba(255,255,255,0.06)',
  separator: 'rgba(255,255,255,0.06)',
  overlay: 'rgba(0,0,0,0.6)',
  inputBg: 'rgba(255,255,255,0.05)',
  placeholder: 'rgba(255,255,255,0.3)',
  icon: 'rgba(255,255,255,0.6)',
  tabBarBg: 'rgba(8,8,16,0.95)',
  statusBar: 'dark-content' as const,

  // Legacy nested API (for backward compat with existing screens)
  background: {
    primary: '#080810',
    secondary: '#0d0d1a',
    tertiary: '#14142a',
    elevated: 'rgba(255,255,255,0.06)',
  },
  constellation: {
    light: '#818cf8',
    DEFAULT: '#6366f1',
    dark: '#4f46e5',
    glow: 'rgba(99,102,241,0.15)',
  },
  cosmic: {
    light: '#c4b5fd',
    DEFAULT: '#a78bfa',
    dark: '#8b5cf6',
    glow: 'rgba(167,139,250,0.12)',
  },
  border: {
    primary: 'rgba(255,255,255,0.08)',
    secondary: 'rgba(255,255,255,0.04)',
    focus: 'rgba(99,102,241,0.4)',
  },
  status: {
    success: '#22c55e',
    error: '#ef4444',
    warning: '#f59e0b',
    info: '#6366f1',
  },
} as const;

const LightColors = {
  // New flat API
  bg: '#f8f9ff',
  surface: 'rgba(0,0,0,0.04)',
  surfaceElevated: 'rgba(0,0,0,0.07)',
  primary: '#6366f1',
  primaryLight: '#818cf8',
  primaryDark: '#4f46e5',
  text: '#0f172a',
  textSecondary: 'rgba(15,23,42,0.65)',
  textTertiary: 'rgba(15,23,42,0.4)',
  borderColor: 'rgba(0,0,0,0.08)',
  borderStrong: 'rgba(0,0,0,0.14)',
  success: '#16a34a',
  warning: '#d97706',
  error: '#dc2626',
  accent: '#7c3aed',
  card: 'rgba(0,0,0,0.04)',
  separator: 'rgba(0,0,0,0.06)',
  overlay: 'rgba(0,0,0,0.4)',
  inputBg: 'rgba(0,0,0,0.04)',
  placeholder: 'rgba(15,23,42,0.35)',
  icon: 'rgba(15,23,42,0.5)',
  tabBarBg: 'rgba(248,249,255,0.95)',
  statusBar: 'dark-content' as const,

  // Legacy nested API
  background: {
    primary: '#f8f9ff',
    secondary: '#f1f3ff',
    tertiary: '#eaedff',
    elevated: 'rgba(255,255,255,0.9)',
  },
  constellation: {
    light: '#818cf8',
    DEFAULT: '#6366f1',
    dark: '#4f46e5',
    glow: 'rgba(99,102,241,0.2)',
  },
  cosmic: {
    light: '#c084fc',
    DEFAULT: '#a855f7',
    dark: '#9333ea',
    glow: 'rgba(168,85,247,0.15)',
  },
  border: {
    primary: 'rgba(0,0,0,0.1)',
    secondary: 'rgba(0,0,0,0.05)',
    focus: 'rgba(99,102,241,0.5)',
  },
  status: {
    success: '#16a34a',
    error: '#dc2626',
    warning: '#d97706',
    info: '#6366f1',
  },
} as const;

export type Colors = typeof DarkColors;

const DarkGradients = {
  background: { colors: ['#080810', '#0d0d1a', '#080810'], locations: [0, 0.5, 1] },
  constellation: { colors: ['#1e1b4b', '#312e81', '#4f46e5'], locations: [0, 0.6, 1] },
  cosmic: { colors: ['#2e1a47', '#7c3aed', '#a78bfa'], locations: [0, 0.5, 1] },
  primary: { colors: ['#6366f1', '#8b5cf6', '#a78bfa'], locations: [0, 0.5, 1] },
  primaryReverse: { colors: ['#a78bfa', '#8b5cf6', '#6366f1'], locations: [0, 0.5, 1] },
  // Flat arrays for new API
  primaryArr: ['#6366f1', '#8b5cf6'] as string[],
  cosmicArr: ['#1e1b4b', '#312e81', '#080810'] as string[],
  surface: ['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.04)'] as string[],
  nebula: ['#1e1b4b', '#4c1d95', '#2d1b69'] as string[],
  aurora: ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd'] as string[],
  danger: ['#ef4444', '#dc2626'] as string[],
  gold: ['#f59e0b', '#d97706'] as string[],
} as const;

const LightGradients = {
  background: { colors: ['#f8f9ff', '#eef0ff', '#f8f9ff'], locations: [0, 0.5, 1] },
  constellation: { colors: ['#4f46e5', '#6366f1', '#818cf8'], locations: [0, 0.5, 1] },
  cosmic: { colors: ['#7c3aed', '#a855f7', '#c084fc'], locations: [0, 0.5, 1] },
  primary: { colors: ['#6366f1', '#8b5cf6', '#a78bfa'], locations: [0, 0.5, 1] },
  primaryReverse: { colors: ['#a78bfa', '#8b5cf6', '#6366f1'], locations: [0, 0.5, 1] },
  // Flat arrays for new API
  primaryArr: ['#6366f1', '#8b5cf6'] as string[],
  cosmicArr: ['#1e1b4b', '#312e81', '#080810'] as string[],
  surface: ['rgba(0,0,0,0.06)', 'rgba(0,0,0,0.02)'] as string[],
  nebula: ['#1e1b4b', '#4c1d95', '#2d1b69'] as string[],
  aurora: ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd'] as string[],
  danger: ['#ef4444', '#dc2626'] as string[],
  gold: ['#f59e0b', '#d97706'] as string[],
} as const;

const Spacing = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48,
  section: 24,
  // Legacy nested shapes used by existing screens
  card: { padding: 20, margin: 16, gap: 12 },
  button: { paddingVertical: 14, paddingHorizontal: 24, gap: 8 },
  input: { paddingVertical: 14, paddingHorizontal: 16 },
  screen: { paddingHorizontal: 20, paddingVertical: 16 },
} as const;

const BorderRadius = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 24, full: 9999,
  card: 16, button: 14, input: 12, badge: 6, avatar: 9999,
  // Legacy alias
  xxl: 24,
} as const;

const FontSizes = {
  xs: 10, sm: 12, md: 14, lg: 16, xl: 18, xxl: 22, xxxl: 28, display: 36,
  body: 14, caption: 12, label: 13,
  h1: 36, h2: 28, h3: 22, h4: 18, h5: 16, h6: 14,
} as const;

const FontWeights = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  extrabold: '800' as const,
} as const;

const DarkShadows = {
  sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.35, shadowRadius: 4, elevation: 3 },
  md: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.45, shadowRadius: 10, elevation: 6 },
  lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.55, shadowRadius: 20, elevation: 10 },
  glow: { shadowColor: '#6366f1', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 20, elevation: 8 },
  glowAccent: { shadowColor: '#a78bfa', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 6 },
} as const;

const LightShadows = {
  sm: { shadowColor: '#0f172a', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  md: { shadowColor: '#0f172a', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 10, elevation: 4 },
  lg: { shadowColor: '#0f172a', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.16, shadowRadius: 20, elevation: 8 },
  glow: { shadowColor: '#6366f1', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.25, shadowRadius: 16, elevation: 6 },
  glowAccent: { shadowColor: '#7c3aed', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 4 },
} as const;

// ─── Context Type ─────────────────────────────────────────────────────────────

interface ThemeContextType {
  // Theme control
  theme: Theme;
  isDark: boolean;
  setTheme: (theme: Theme) => void;
  accentColor: AccentColor;
  setAccentColor: (color: AccentColor) => void;

  // Design tokens (returned directly for convenience)
  colors: typeof DarkColors;
  gradients: typeof DarkGradients;
  spacing: typeof Spacing;
  borderRadius: typeof BorderRadius;
  fontSizes: typeof FontSizes;
  fontWeight: typeof FontWeights;
  shadows: typeof DarkShadows;

  // Aliases used by new components
  radius: typeof BorderRadius;
  fontSize: typeof FontSizes;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// ─── Provider ─────────────────────────────────────────────────────────────────

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const systemColorScheme = useColorScheme();
  const [theme, setThemeState] = useState<Theme>('system');
  const [accentColor, setAccentColorState] = useState<AccentColor>('indigo');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadPreferences();
  }, []);

  useEffect(() => {
    const subscription = Appearance.addChangeListener(() => {
      // Re-render triggered automatically via useColorScheme
    });
    return () => subscription.remove();
  }, []);

  const loadPreferences = async () => {
    try {
      const [storedTheme, storedAccent] = await Promise.all([
        AsyncStorage.getItem('themePreference'),
        AsyncStorage.getItem('accentColor'),
      ]);

      if (storedTheme === 'light' || storedTheme === 'dark' || storedTheme === 'system') {
        setThemeState(storedTheme);
      } else {
        setThemeState('system');
      }

      if (
        storedAccent === 'indigo' ||
        storedAccent === 'purple' ||
        storedAccent === 'cyan' ||
        storedAccent === 'rose'
      ) {
        setAccentColorState(storedAccent as AccentColor);
      }
    } catch (error) {
      console.error('[ThemeContext] Error loading preferences:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const setTheme = async (newTheme: Theme) => {
    try {
      await AsyncStorage.setItem('themePreference', newTheme);
      setThemeState(newTheme);
    } catch (error) {
      console.error('[ThemeContext] Error saving theme preference:', error);
    }
  };

  const setAccentColor = async (color: AccentColor) => {
    try {
      await AsyncStorage.setItem('accentColor', color);
      setAccentColorState(color);
    } catch (error) {
      console.error('[ThemeContext] Error saving accent color:', error);
    }
  };

  const isDark =
    theme === 'system' ? systemColorScheme === 'dark' : theme === 'dark';

  if (isLoading) return null;

  const colors = isDark ? DarkColors : (LightColors as unknown as typeof DarkColors);
  const gradients = isDark ? DarkGradients : (LightGradients as unknown as typeof DarkGradients);
  const shadows = isDark ? DarkShadows : (LightShadows as unknown as typeof DarkShadows);

  const value: ThemeContextType = {
    theme,
    isDark,
    setTheme,
    accentColor,
    setAccentColor,
    colors,
    gradients,
    spacing: Spacing,
    borderRadius: BorderRadius,
    fontSizes: FontSizes,
    fontWeight: FontWeights,
    shadows,
    // Aliases
    radius: BorderRadius,
    fontSize: FontSizes,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

// ─── Hooks ────────────────────────────────────────────────────────────────────

export const useThemeContext = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useThemeContext must be used within a ThemeProvider');
  }
  return context;
};

// Primary export — used everywhere
export const useTheme = useThemeContext;

export default ThemeContext;
