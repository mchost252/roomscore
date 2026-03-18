/**
 * DoomClock - Circular Gauge Component
 * Shows room expiry/ban date transitioning from Green to Red
 * GPU-accelerated with Reanimated
 */

import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolateColor,
  Easing,
} from 'react-native-reanimated';
import { useTheme } from '../../context/ThemeContext';

interface DoomClockProps {
  expiresAt: number; // Unix timestamp
  size?: number;
  strokeWidth?: number;
}

export default function DoomClock({
  expiresAt,
  size = 120,
  strokeWidth = 8,
}: DoomClockProps) {
  const { colors, isDark } = useTheme();
  
  // Calculate progress (0 = fresh, 1 = expired)
  const getProgress = () => {
    const now = Date.now();
    const totalDuration = 7 * 24 * 60 * 60 * 1000; // 7 days
    const remaining = expiresAt - now;
    const elapsed = totalDuration - remaining;
    return Math.max(0, Math.min(1, elapsed / totalDuration));
  };

  const progress = useSharedValue(getProgress());

  useEffect(() => {
    // Animate progress changes
    progress.value = withTiming(getProgress(), {
      duration: 1000,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
    });
  }, [expiresAt]);

  // Animated color interpolation
  const animatedGaugeStyle = useAnimatedStyle(() => {
    const color = interpolateColor(
      progress.value,
      [0, 0.5, 1],
      ['#22c55e', '#eab308', '#ef4444'] // Green -> Yellow -> Red
    );
    
    return {
      backgroundColor: color,
    };
  });

  const animatedTextStyle = useAnimatedStyle(() => {
    const color = interpolateColor(
      progress.value,
      [0, 0.5, 1],
      ['#22c55e', '#eab308', '#ef4444']
    );
    
    return {
      color,
    };
  });

  // Format time remaining
  const getTimeRemaining = () => {
    const now = Date.now();
    const diff = expiresAt - now;
    
    if (diff <= 0) return 'EXPIRED';
    
    const days = Math.floor(diff / (24 * 60 * 60 * 1000));
    const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h`;
    return '<1h';
  };

  const progressValue = getProgress();

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {/* Background ring */}
      <View
        style={[
          styles.ring,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: strokeWidth,
            borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
          },
        ]}
      />
      
      {/* Progress ring overlay */}
      <View
        style={[
          styles.progressRing,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: strokeWidth,
            borderColor: 'transparent',
            borderTopColor: interpolateColor(
              progressValue,
              [0, 0.5, 1],
              ['#22c55e', '#eab308', '#ef4444']
            ) as string,
            borderRightColor: progressValue > 0.25 ? interpolateColor(
              Math.min(1, progressValue * 4),
              [0, 0.5, 1],
              ['#22c55e', '#eab308', '#ef4444']
            ) as string : 'transparent',
            borderBottomColor: progressValue > 0.5 ? interpolateColor(
              Math.min(1, (progressValue - 0.5) * 4),
              [0, 0.5, 1],
              ['#22c55e', '#eab308', '#ef4444']
            ) as string : 'transparent',
            borderLeftColor: progressValue > 0.75 ? interpolateColor(
              Math.min(1, (progressValue - 0.75) * 4),
              [0, 0.5, 1],
              ['#22c55e', '#eab308', '#ef4444']
            ) as string : 'transparent',
            transform: [{ rotate: '-90deg' }],
          },
        ]}
      />
      
      {/* Inner content */}
      <View style={styles.innerContent}>
        <Animated.Text style={[styles.timeText, animatedTextStyle]}>
          {getTimeRemaining()}
        </Animated.Text>
        <Text style={[styles.label, { color: colors.textSecondary }]}>
          remaining
        </Text>
      </View>
      
      {/* Glow effect based on progress */}
      {progressValue > 0.7 && (
        <View
          style={[
            styles.glow,
            {
              width: size + 20,
              height: size + 20,
              borderRadius: (size + 20) / 2,
              backgroundColor: progressValue > 0.9 ? 'rgba(239,68,68,0.3)' : 'rgba(234,179,8,0.2)',
            },
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
  },
  progressRing: {
    position: 'absolute',
  },
  innerContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeText: {
    fontSize: 22,
    fontWeight: '800',
  },
  label: {
    fontSize: 11,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  glow: {
    position: 'absolute',
    zIndex: -1,
  },
});
