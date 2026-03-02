import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';

// ─── Types ────────────────────────────────────────────────────────────────────

type Intensity = 'subtle' | 'medium' | 'strong';

interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  intensity?: Intensity;
  gradient?: boolean;
  noPadding?: boolean;
}

// ─── Intensity Maps ───────────────────────────────────────────────────────────

const DARK_BG: Record<Intensity, string> = {
  subtle: 'rgba(255,255,255,0.04)',
  medium: 'rgba(255,255,255,0.07)',
  strong: 'rgba(255,255,255,0.12)',
};

const LIGHT_BG: Record<Intensity, string> = {
  subtle: 'rgba(0,0,0,0.03)',
  medium: 'rgba(0,0,0,0.05)',
  strong: 'rgba(0,0,0,0.09)',
};

const DARK_GRADIENT: Record<Intensity, [string, string]> = {
  subtle: ['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.02)'],
  medium: ['rgba(255,255,255,0.09)', 'rgba(255,255,255,0.04)'],
  strong: ['rgba(255,255,255,0.14)', 'rgba(255,255,255,0.07)'],
};

const LIGHT_GRADIENT: Record<Intensity, [string, string]> = {
  subtle: ['rgba(255,255,255,0.70)', 'rgba(255,255,255,0.40)'],
  medium: ['rgba(255,255,255,0.85)', 'rgba(255,255,255,0.55)'],
  strong: ['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.75)'],
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function GlassCard({
  children,
  style,
  intensity = 'medium',
  gradient = false,
  noPadding = false,
}: GlassCardProps) {
  const { isDark, shadows } = useTheme();

  const bgColor = isDark ? DARK_BG[intensity] : LIGHT_BG[intensity];
  const borderColor = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)';
  const shadow = shadows.md;

  const baseStyle: ViewStyle = {
    borderColor,
    ...shadow,
  };

  if (gradient) {
    const gradientColors = isDark
      ? DARK_GRADIENT[intensity]
      : LIGHT_GRADIENT[intensity];

    return (
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.base,
          baseStyle,
          !noPadding && styles.padding,
          style,
        ]}
      >
        {children}
      </LinearGradient>
    );
  }

  return (
    <View
      style={[
        styles.base,
        baseStyle,
        { backgroundColor: bgColor },
        !noPadding && styles.padding,
        style,
      ]}
    >
      {children}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  base: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  padding: {
    padding: 16,
  },
});
