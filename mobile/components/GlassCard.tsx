import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import {
  Canvas,
  RoundedRect,
  BackdropBlur,
  LinearGradient,
  Paint,
  vec,
} from '@shopify/react-native-skia';
import { useTheme } from '../context/ThemeContext';

// ─── Types ────────────────────────────────────────────────────────────────────

interface GlassCardProps {
  width: number;
  height: number;
  borderRadius?: number;
  children?: React.ReactNode;
  style?: ViewStyle;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function GlassCard({
  width,
  height,
  borderRadius = 24,
  children,
  style,
}: GlassCardProps) {
  const { isDark } = useTheme();

  // BackdropBlur tint: lighter overlay in dark mode, slightly darker in light mode
  const gradientTopColor = isDark
    ? 'rgba(255,255,255,0.08)'
    : 'rgba(255,255,255,0.22)';
  const gradientBottomColor = 'rgba(255,255,255,0.00)';

  const borderColor = isDark
    ? 'rgba(255,255,255,0.15)'
    : 'rgba(255,255,255,0.50)';

  return (
    <View style={[{ width, height }, style]}>
      {/* Skia canvas — frosted glass layers */}
      <Canvas style={StyleSheet.absoluteFill}>
        {/* Layer 1: frosted glass via BackdropBlur */}
        <BackdropBlur blur={8} clip={{ rx: borderRadius, ry: borderRadius, x: 0, y: 0, width, height }}>
          <RoundedRect
            x={0}
            y={0}
            width={width}
            height={height}
            r={borderRadius}
            color={isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.35)'}
          />
        </BackdropBlur>

        {/* Layer 2: subtle gradient overlay (top highlight → transparent) */}
        <RoundedRect
          x={0}
          y={0}
          width={width}
          height={height}
          r={borderRadius}
        >
          <LinearGradient
            start={vec(0, 0)}
            end={vec(0, height)}
            colors={[gradientTopColor, gradientBottomColor]}
          />
        </RoundedRect>

        {/* Layer 3: hairline border stroke */}
        <RoundedRect
          x={0.5}
          y={0.5}
          width={width - 1}
          height={height - 1}
          r={borderRadius - 0.5}
          color="transparent"
        >
          <Paint
            color={borderColor}
            style="stroke"
            strokeWidth={1}
          />
        </RoundedRect>
      </Canvas>

      {/* Children rendered on top of the canvas */}
      <View style={StyleSheet.absoluteFill}>
        {children}
      </View>
    </View>
  );
}