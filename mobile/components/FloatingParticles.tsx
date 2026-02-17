import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

interface Star {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  duration: number;
}

interface FloatingParticlesProps {
  count?: number;
}

export const FloatingParticles: React.FC<FloatingParticlesProps> = ({ count = 30 }) => {
  const stars = useRef<Star[]>([]);

  // Generate stars once
  if (stars.current.length === 0) {
    const colors = [
      '#ffffff',      // White
      '#93c5fd',      // Blue
      '#fbbf24',      // Gold
    ];

    stars.current = Array.from({ length: count }, (_, i) => ({
      id: i,
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() > 0.7 ? 4 : 3, // Mostly 3px, some 4px
      color: colors[Math.floor(Math.random() * colors.length)],
      duration: 2000 + Math.random() * 2000, // 2-4 seconds
    }));
  }

  return (
    <View style={styles.container} pointerEvents="none">
      {stars.current.map((star) => (
        <TwinklingStar key={star.id} {...star} />
      ))}
    </View>
  );
};

const TwinklingStar: React.FC<Star> = ({ x, y, size, color, duration }) => {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: duration / 2,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: duration / 2,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View
      style={[
        styles.star,
        {
          left: x,
          top: y,
          width: size,
          height: size,
          backgroundColor: color,
          opacity,
          shadowColor: color,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 1,
          shadowRadius: size > 3 ? 10 : 6,
        },
      ]}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
  },
  star: {
    position: 'absolute',
    borderRadius: 999,
  },
});
