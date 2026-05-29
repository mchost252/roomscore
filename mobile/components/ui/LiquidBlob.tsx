/**
 * LiquidBlob — Gemini-like liquid morphing animation
 * 
 * A minimalistic, slowly morphing blob that represents AI presence.
 * Uses animated scale transforms on overlapping circles to simulate
 * organic liquid movement. Lightweight — no Skia/Canvas needed.
 */
import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface LiquidBlobProps {
  size?: number;
  color?: string;
  style?: ViewStyle;
  intensity?: 'calm' | 'active' | 'idle';
}

export default function LiquidBlob({
  size = 40,
  color = '#6366f1',
  style,
  intensity = 'calm',
}: LiquidBlobProps) {
  const speeds = { idle: 6000, calm: 4000, active: 2000 };
  const speed = speeds[intensity];

  // 3 overlapping blobs with phase-shifted animations
  const blob1Scale = useRef(new Animated.Value(1)).current;
  const blob1X = useRef(new Animated.Value(0)).current;
  const blob1Y = useRef(new Animated.Value(0)).current;

  const blob2Scale = useRef(new Animated.Value(0.9)).current;
  const blob2X = useRef(new Animated.Value(0)).current;
  const blob2Y = useRef(new Animated.Value(0)).current;

  const blob3Scale = useRef(new Animated.Value(0.85)).current;
  const blob3X = useRef(new Animated.Value(0)).current;
  const blob3Y = useRef(new Animated.Value(0)).current;

  const drift = size * 0.12; // how far blobs drift

  useEffect(() => {
    const animate = (
      scale: Animated.Value,
      x: Animated.Value,
      y: Animated.Value,
      sRange: [number, number],
      delay: number,
    ) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.parallel([
            Animated.timing(scale, { toValue: sRange[1], duration: speed, useNativeDriver: true }),
            Animated.timing(x, { toValue: drift, duration: speed * 0.8, useNativeDriver: true }),
            Animated.timing(y, { toValue: -drift * 0.6, duration: speed * 0.9, useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(scale, { toValue: sRange[0], duration: speed, useNativeDriver: true }),
            Animated.timing(x, { toValue: -drift * 0.5, duration: speed * 1.1, useNativeDriver: true }),
            Animated.timing(y, { toValue: drift * 0.4, duration: speed, useNativeDriver: true }),
          ]),
        ])
      ).start();
    };

    animate(blob1Scale, blob1X, blob1Y, [0.95, 1.08], 0);
    animate(blob2Scale, blob2X, blob2Y, [0.88, 1.05], speed * 0.33);
    animate(blob3Scale, blob3X, blob3Y, [0.82, 1.02], speed * 0.66);
  }, [speed]);

  const blobStyle = (
    scale: Animated.Value,
    x: Animated.Value,
    y: Animated.Value,
    opacity: number,
    blobSize: number,
  ) => ({
    position: 'absolute' as const,
    width: blobSize,
    height: blobSize,
    borderRadius: blobSize / 2,
    opacity,
    transform: [{ scale }, { translateX: x }, { translateY: y }],
  });

  return (
    <View style={[styles.container, { width: size, height: size }, style]}>
      <Animated.View style={blobStyle(blob3Scale, blob3X, blob3Y, 0.3, size * 0.9)}>
        <LinearGradient
          colors={[color, `${color}66`]}
          style={{ flex: 1, borderRadius: size }}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
      </Animated.View>
      <Animated.View style={blobStyle(blob2Scale, blob2X, blob2Y, 0.5, size * 0.75)}>
        <LinearGradient
          colors={[`${color}cc`, `${color}44`]}
          style={{ flex: 1, borderRadius: size }}
          start={{ x: 0.3, y: 0 }}
          end={{ x: 0.7, y: 1 }}
        />
      </Animated.View>
      <Animated.View style={blobStyle(blob1Scale, blob1X, blob1Y, 0.7, size * 0.6)}>
        <LinearGradient
          colors={[`${color}ee`, `${color}88`]}
          style={{ flex: 1, borderRadius: size }}
          start={{ x: 0, y: 0.3 }}
          end={{ x: 1, y: 0.7 }}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
