/**
 * CircularProgress — Animated SVG ring for Focus Timer
 * 
 * A glowing circular progress indicator with gradient stroke.
 * Used as the hero element in Focus Mode.
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface CircularProgressProps {
  size?: number;
  strokeWidth?: number;
  progress: number;        // 0-1
  timeDisplay: string;     // e.g. "25:00"
  subtitle?: string;       // e.g. "Until 7:15 PM"
  label?: string;          // e.g. "FOCUSING"
}

export default function CircularProgress({
  size = 280,
  strokeWidth = 6,
  progress,
  timeDisplay,
  subtitle,
  label,
}: CircularProgressProps) {
  const { isDark, colors } = useTheme();
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - Math.min(Math.max(progress, 0), 1));

  // Glow pulse animation
  const glowAnim = useRef(new Animated.Value(0.15)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 0.35, duration: 2000, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0.15, duration: 2000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const trackColor = 'rgba(255,255,255,0.04)';

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {/* Subtle Outer glow */}
      <Animated.View
        style={[
          styles.glow,
          {
            width: size + 20,
            height: size + 20,
            borderRadius: (size + 20) / 2,
            opacity: glowAnim,
          },
        ]}
      />

      <Svg width={size} height={size} style={styles.svg}>
        <Defs>
          <SvgGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#a855f7" />
            <Stop offset="0.5" stopColor="#6366f1" />
            <Stop offset="1" stopColor="#3b82f6" />
          </SvgGradient>
        </Defs>

        {/* Track */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />

        {/* Progress */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="url(#ringGrad)"
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>

      {/* Center content */}
      <View style={styles.center}>
        {label && (
          <Text style={styles.label}>{label}</Text>
        )}
        <Text style={styles.time}>
          {timeDisplay}
        </Text>
        {subtitle && (
          <View style={styles.subtitleRow}>
            <Ionicons name="time" size={12} color="#a855f7" />
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  svg: {
    position: 'absolute',
  },
  glow: {
    position: 'absolute',
    backgroundColor: 'rgba(99,102,241,0.2)',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  time: {
    color: '#fff',
    fontSize: 64,
    fontWeight: '300',
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontWeight: '500',
  },
});
