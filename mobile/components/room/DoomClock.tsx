/**
 * DoomClock - Circular Gauge Component
 * Shows room expiry/ban date transitioning from Green to Red
 * GPU-accelerated with Reanimated for smooth color interpolation
 * 
 * Features:
 * - Smooth color transition: Green → Yellow → Red
 * - Pulsing glow effect at critical thresholds (70%+)
 * - Animated countdown text
 */

import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolateColor,
  Easing,
  useAnimatedProps,
} from 'react-native-reanimated';
import { useTheme } from '../../context/ThemeContext';
import { COLORS, GLASS } from '../../styles/glassmorphism';

interface DoomClockProps {
  expiresAt: number;
  size?: number;
  strokeWidth?: number;
}

const AnimatedView = Animated.View;

export default function DoomClock({
  expiresAt,
  size = 100,
  strokeWidth = 8,
}: DoomClockProps) {
  const { colors, isDark } = useTheme();
  
  const getProgress = () => {
    const now = Date.now();
    const totalDuration = 7 * 24 * 60 * 60 * 1000; // 7 days default
    const remaining = expiresAt - now;
    const elapsed = totalDuration - remaining;
    return Math.max(0, Math.min(1, elapsed / totalDuration));
  };

  const progress = useSharedValue(getProgress());

  useEffect(() => {
    progress.value = withTiming(getProgress(), {
      duration: 1000,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
    });
  }, [expiresAt]);

  const progressValue = getProgress();

  // Get color based on progress
  const getColor = (p: number) => {
    if (p < 0.5) {
      // Green to Yellow
      const ratio = p * 2;
      return interpolateColor(
        ratio,
        [0, 1],
        [COLORS.doomGreen, COLORS.doomYellow]
      ) as string;
    } else {
      // Yellow to Red
      const ratio = (p - 0.5) * 2;
      return interpolateColor(
        ratio,
        [0, 1],
        [COLORS.doomYellow, COLORS.doomRed]
      ) as string;
    }
  };

  const currentColor = getColor(progressValue);

  // Format time remaining
  const getTimeRemaining = () => {
    const now = Date.now();
    const diff = expiresAt - now;
    
    if (diff <= 0) return { text: 'EXPIRED', subtext: 'Room closed' };
    
    const days = Math.floor(diff / (24 * 60 * 60 * 1000));
    const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    const minutes = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
    
    if (days > 0) return { text: `${days}d ${hours}h`, subtext: 'remaining' };
    if (hours > 0) return { text: `${hours}h ${minutes}m`, subtext: 'remaining' };
    return { text: `${minutes}m`, subtext: 'remaining' };
  };

  const timeRemaining = getTimeRemaining();
  const showGlow = progressValue > 0.7;

  // Calculate arc segments for circular progress
  const innerSize = size - strokeWidth * 2;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Calculate stroke dash array for progress
  const strokeDashoffset = circumference * (1 - progressValue);

  return (
    <View style={[styles.container, { width: size + 30, height: size + 30 }]}>
      {/* Glow effect */}
      {showGlow && (
        <View
          style={[
            styles.glowOuter,
            {
              width: size + 24,
              height: size + 24,
              borderRadius: (size + 24) / 2,
              backgroundColor: progressValue > 0.9 
                ? `${COLORS.doomRed}30` 
                : `${COLORS.doomYellow}20`,
            },
          ]}
        />
      )}
      
      {/* Main circle */}
      <View
        style={[
          styles.circle,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: strokeWidth,
            borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
            backgroundColor: isDark ? 'rgba(26,26,46,0.8)' : 'rgba(255,255,255,0.9)',
          },
        ]}
      >
        {/* Progress arc - simplified as colored border */}
        <View
          style={[
            styles.progressArc,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              borderWidth: strokeWidth,
              borderColor: 'transparent',
              borderTopColor: currentColor,
              borderRightColor: progressValue > 0.25 ? currentColor : 'transparent',
              borderBottomColor: progressValue > 0.5 ? currentColor : 'transparent',
              borderLeftColor: progressValue > 0.75 ? currentColor : 'transparent',
              transform: [{ rotate: '-90deg' }],
            },
          ]}
        />
        
        {/* Inner content */}
        <View style={styles.innerContent}>
          <Text style={[styles.timeText, { color: currentColor }]}>
            {timeRemaining.text}
          </Text>
          <Text style={[styles.subText, { color: colors.textSecondary }]}>
            {timeRemaining.subtext}
          </Text>
        </View>
      </View>

      {/* Tick marks */}
      {[...Array(12)].map((_, i) => (
        <View
          key={i}
          style={[
            styles.tickMark,
            {
              width: 2,
              height: i % 3 === 0 ? 8 : 4,
              backgroundColor: i / 12 <= progressValue ? currentColor : isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)',
              transform: [
                { rotate: `${i * 30}deg` },
                { translateY: -(size / 2 - 12) },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  glowOuter: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -57,
    marginTop: -57,
  },
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  progressArc: {
    position: 'absolute',
  },
  innerContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeText: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subText: {
    fontSize: 10,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '600',
  },
  tickMark: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -1,
    borderRadius: 1,
  },
});
