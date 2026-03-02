import React, { useEffect, useRef } from 'react';
import {
  Animated,
  View,
  StyleSheet,
  ViewStyle,
  Easing,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SkeletonProps {
  width: number | `${number}%`;
  height: number;
  borderRadius?: number;
  style?: ViewStyle;
}

interface SkeletonGroupProps {
  children: React.ReactNode;
  style?: ViewStyle;
  gap?: number;
}

// ─── Shimmer Colors ───────────────────────────────────────────────────────────

const DARK_SHIMMER: [string, string, string] = [
  '#1a1a2e',
  '#2a2a4e',
  '#1a1a2e',
];

const LIGHT_SHIMMER: [string, string, string] = [
  '#e2e8f0',
  '#f1f5f9',
  '#e2e8f0',
];

// ─── Skeleton ─────────────────────────────────────────────────────────────────

export default function Skeleton({
  width,
  height,
  borderRadius = 8,
  style,
}: SkeletonProps) {
  const { isDark } = useTheme();
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  const shimmerColors = isDark ? DARK_SHIMMER : LIGHT_SHIMMER;
  const baseColor = shimmerColors[0];

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 1400,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: false,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [shimmerAnim]);

  // Translate the shimmer gradient across the width of the skeleton
  // We use a fixed pixel width for the gradient container; the gradient itself
  // moves from -width to +width so the shimmer sweeps fully across.
  const GRADIENT_WIDTH = typeof width === 'number' ? width * 2 : 300;

  const translateX = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-GRADIENT_WIDTH, GRADIENT_WIDTH],
  });

  return (
    <View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: baseColor,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { transform: [{ translateX }] },
        ]}
      >
        <LinearGradient
          colors={shimmerColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{
            width: GRADIENT_WIDTH,
            height: '100%',
          }}
        />
      </Animated.View>
    </View>
  );
}

// ─── SkeletonGroup ────────────────────────────────────────────────────────────

export function SkeletonGroup({
  children,
  style,
  gap = 10,
}: SkeletonGroupProps) {
  return (
    <View style={[{ gap }, style]}>
      {children}
    </View>
  );
}
