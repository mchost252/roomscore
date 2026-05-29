/**
 * KriosChip — AI suggestion pill
 * 
 * A glassmorphic pill that surfaces contextual AI suggestions.
 * Appears inline near relevant content, fades in with delay.
 * Tap to execute the action immediately.
 */
import React, { useEffect, useRef } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  Animated,
  ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';

interface KriosChipProps {
  label: string;
  onPress: () => void;
  delay?: number;       // ms before fade-in (default 400)
  icon?: string;        // emoji or symbol (default ✦)
  variant?: 'default' | 'accent' | 'success';
  style?: ViewStyle;
}

export default function KriosChip({
  label,
  onPress,
  delay = 400,
  icon = '✦',
  variant = 'default',
  style,
}: KriosChipProps) {
  const { isDark, colors } = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Delayed entrance
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, tension: 300, friction: 15, useNativeDriver: true }),
      ]).start();
    }, delay);

    // Subtle icon pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.6, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ])
    ).start();

    return () => clearTimeout(timer);
  }, []);

  const glass = isDark ? (colors as any).glass : (colors as any).glass;
  const variantColors = {
    default: { border: glass?.border || 'rgba(255,255,255,0.10)', text: colors.textSecondary, icon: colors.primary },
    accent: { border: glass?.borderActive || 'rgba(99,102,241,0.35)', text: colors.primary, icon: colors.primary },
    success: { border: 'rgba(34,197,94,0.3)', text: colors.status.success, icon: colors.status.success },
  };
  const v = variantColors[variant];

  const gradColors: [string, string] = isDark
    ? ['rgba(255,255,255,0.04)', 'rgba(255,255,255,0.02)']
    : ['rgba(255,255,255,0.80)', 'rgba(255,255,255,0.60)'];

  return (
    <Animated.View style={[{ opacity: fadeAnim, transform: [{ scale: scaleAnim }] }, style]}>
      <TouchableOpacity activeOpacity={0.7} onPress={onPress}>
        <LinearGradient
          colors={gradColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.chip, { borderColor: v.border }]}
        >
          <Animated.Text style={[styles.icon, { color: v.icon, opacity: pulseAnim }]}>
            {icon}
          </Animated.Text>
          <Text style={[styles.label, { color: v.text }]} numberOfLines={1}>
            {label}
          </Text>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  icon: {
    fontSize: 12,
    fontWeight: '700',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
