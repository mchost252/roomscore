import React, { useRef, useCallback } from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
  Animated,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { PREMIUM_COLORS } from '../../constants/theme';

// ─── Types ────────────────────────────────────────────────────────────────────

type ButtonSize = 'sm' | 'md' | 'lg';
type ButtonVariant = 'primary' | 'ghost' | 'danger' | 'premium';

interface GradientButtonProps {
  onPress: () => void;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  size?: ButtonSize;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  locked?: boolean;
  style?: ViewStyle;
  labelStyle?: TextStyle;
}

// ─── Size Configs ─────────────────────────────────────────────────────────────

const SIZE_CONFIG: Record<
  ButtonSize,
  { height: number; paddingHorizontal: number; fontSize: number; iconSize: number; gap: number }
> = {
  sm: { height: 36, paddingHorizontal: 14, fontSize: 13, iconSize: 14, gap: 6 },
  md: { height: 48, paddingHorizontal: 20, fontSize: 15, iconSize: 18, gap: 8 },
  lg: { height: 56, paddingHorizontal: 28, fontSize: 17, iconSize: 20, gap: 10 },
};

// ─── Gradient Color Map ───────────────────────────────────────────────────────

const GRADIENT_COLORS: Record<'primary' | 'danger' | 'premium', [string, string]> = {
  primary: ['#6366f1', '#8b5cf6'],
  danger: ['#ef4444', '#dc2626'],
  premium: [PREMIUM_COLORS.gold, PREMIUM_COLORS.goldDark],
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function GradientButton({
  onPress,
  label,
  icon,
  size = 'md',
  variant = 'primary',
  disabled = false,
  loading = false,
  locked = false,
  style,
  labelStyle,
}: GradientButtonProps) {
  const { isDark, colors } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;

  const sizeConfig = SIZE_CONFIG[size];
  const isInteractive = !disabled && !loading && !locked;

  const handlePressIn = useCallback(() => {
    Animated.spring(scale, {
      toValue: 0.96,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  }, [scale]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 40,
      bounciness: 6,
    }).start();
  }, [scale]);

  const handlePress = useCallback(() => {
    if (isInteractive) onPress();
  }, [isInteractive, onPress]);

  // ── Ghost variant ──────────────────────────────────────────────────────────

  if (variant === 'ghost') {
    const borderColor = isDark
      ? 'rgba(255,255,255,0.18)'
      : 'rgba(99,102,241,0.4)';
    const textColor = isDark ? colors.text : colors.primary;

    return (
      <Animated.View style={[{ transform: [{ scale }] }, style]}>
        <TouchableOpacity
          onPress={handlePress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          activeOpacity={1}
          disabled={!isInteractive}
          style={[
            styles.base,
            {
              height: sizeConfig.height,
              paddingHorizontal: sizeConfig.paddingHorizontal,
              borderColor,
              borderWidth: 1.5,
              backgroundColor: isDark
                ? 'rgba(255,255,255,0.05)'
                : 'rgba(99,102,241,0.06)',
              opacity: disabled || loading ? 0.5 : 1,
              gap: sizeConfig.gap,
            },
          ]}
        >
          {loading ? (
            <ActivityIndicator size="small" color={textColor} />
          ) : (
            <>
              {icon && (
                <Ionicons name={icon} size={sizeConfig.iconSize} color={textColor} />
              )}
              <Text
                style={[
                  styles.label,
                  { fontSize: sizeConfig.fontSize, color: textColor },
                  labelStyle,
                ]}
              >
                {label}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </Animated.View>
    );
  }

  // ── Gradient variants: primary, danger, premium ────────────────────────────

  const gradientColors =
    GRADIENT_COLORS[variant as keyof typeof GRADIENT_COLORS] ?? GRADIENT_COLORS.primary;
  const labelColor = '#ffffff';
  const resolvedIcon: keyof typeof Ionicons.glyphMap | undefined =
    locked ? 'lock-closed' : icon;

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <TouchableOpacity
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
        disabled={!isInteractive}
        style={[
          styles.base,
          {
            height: sizeConfig.height,
            paddingHorizontal: sizeConfig.paddingHorizontal,
            opacity: disabled || loading ? 0.5 : 1,
            overflow: 'hidden',
          },
        ]}
      >
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFillObject}
        />
        {/* Top-edge shine for depth */}
        <View style={styles.shine} pointerEvents="none" />
        {loading ? (
          <ActivityIndicator size="small" color={labelColor} />
        ) : (
          <View style={[styles.row, { gap: sizeConfig.gap }]}>
            {resolvedIcon && (
              <Ionicons name={resolvedIcon} size={sizeConfig.iconSize} color={labelColor} />
            )}
            <Text
              style={[
                styles.label,
                { fontSize: sizeConfig.fontSize, color: labelColor },
                labelStyle,
              ]}
            >
              {label}
            </Text>
            {locked && !icon && (
              <Ionicons
                name="lock-closed"
                size={sizeConfig.iconSize - 2}
                color="rgba(255,255,255,0.7)"
              />
            )}
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  base: {
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  shine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 24,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
  },
});
