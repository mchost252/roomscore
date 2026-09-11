/**
 * CircularProgress — Animated SVG ring for Focus Timer
 * 
 * A glowing circular progress indicator with gradient stroke.
 * Used as the hero element in Focus Mode.
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface CircularProgressProps {
  size?: number;
  strokeWidth?: number;
  progress: number;        // 0-1 ELAPSED fraction (fills clockwise from the top over the grey track)
  timeDisplay: string;     // e.g. "00:17"
  elapsedMinutes?: number; // e.g. 17 → "Focused for 17 minutes"
  remainingPercent?: number; // e.g. 83 → "83% remaining"
  subtitle?: string;       // e.g. "Until 7:15 PM"
  label?: string;          // e.g. "FOCUSING"
}

export default function CircularProgress({
  size = 280,
  strokeWidth = 6,
  progress,
  timeDisplay,
  elapsedMinutes,
  remainingPercent,
  subtitle,
  label,
}: CircularProgressProps) {
  const { isDark, colors } = useTheme();
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(Math.max(progress, 0), 1);
  const strokeDashoffset = circumference * (1 - clamped);
  // Breathing room so the knob + halo never touch the SVG edge (that was the chop)
  const pad = strokeWidth * 2;
  const boxSize = size + pad * 2;
  const c = boxSize / 2;
  const glowSize = size + 18;

  // Glow pulse animation (tight halo hugging the ring, not a fog disc)
  const glowAnim = useRef(new Animated.Value(0.12)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 0.26, duration: 2000, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0.12, duration: 2000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const trackColor = 'rgba(255,255,255,0.06)';

  // Compute knob position (small circle on progress)
  const angle = clamped * 2 * Math.PI - Math.PI / 2; // radians, -90deg start
  const knobX = c + radius * Math.cos(angle);
  const knobY = c + radius * Math.sin(angle);

  return (
    <View style={[styles.container, { width: boxSize, height: boxSize }]}>
      <Animated.View
        style={[
          styles.glow,
          {
            width: glowSize,
            height: glowSize,
            borderRadius: glowSize / 2,
            left: (boxSize - glowSize) / 2,
            top: (boxSize - glowSize) / 2,
            opacity: glowAnim,
            backgroundColor: 'rgba(99,102,241,0.10)'
          },
        ]}
      />

      <Svg width={boxSize} height={boxSize} style={styles.svg}>
        <Defs>
          <SvgGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#f5d0fe" />
            <Stop offset="0.35" stopColor="#c084fc" />
            <Stop offset="0.7" stopColor="#8b5cf6" />
            <Stop offset="1" stopColor="#60a5fa" />
          </SvgGradient>
        </Defs>

        {/* Rotated so the arc starts at 12 o'clock and drains clockwise */}
        <G transform={`rotate(-90 ${c} ${c})`}>
          <Circle
            cx={c}
            cy={c}
            r={radius}
            stroke={trackColor}
            strokeWidth={strokeWidth + 1}
            fill="none"
          />

          <Circle
            cx={c}
            cy={c}
            r={radius}
            stroke="url(#ringGrad)"
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </G>

        {/* Knob halo + dot at the leading edge of the remaining arc */}
        <Circle
          cx={knobX}
          cy={knobY}
          r={strokeWidth * 1.5}
          fill="#fff"
          opacity={0.16}
        />
        <Circle
          cx={knobX}
          cy={knobY}
          r={strokeWidth * 0.8}
          fill="#fff"
          opacity={0.94}
        />
      </Svg>

      <View style={styles.center}>
        {label && (
          <Text style={styles.label}>{label}</Text>
        )}
        <Text style={styles.time}>{timeDisplay}</Text>
        {elapsedMinutes != null && (
          <Text style={styles.focusedLine}>
            Focused for <Text style={styles.focusedNum}>{elapsedMinutes}</Text> minutes
          </Text>
        )}
        {subtitle && (
          <View style={styles.subtitlePill}>
            <Ionicons name="time-outline" size={12} color="#c4b5fd" />
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>
        )}
        {remainingPercent != null && (
          <Text style={styles.remainingLine}>
            <Text style={styles.remainingNum}>{remainingPercent}%</Text> remaining
          </Text>
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
    backgroundColor: 'rgba(99,102,241,0.12)',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  label: {
    color: '#a78bfa',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  time: {
    color: '#fff',
    fontSize: 74,
    fontWeight: '600',
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
    textShadowColor: 'rgba(0,0,0,0.15)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  focusedLine: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
    fontWeight: '500',
    marginTop: 6,
  },
  focusedNum: {
    color: '#c4b5fd',
    fontWeight: '700',
  },
  remainingLine: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 13,
    fontWeight: '500',
    marginTop: 8,
  },
  remainingNum: {
    color: '#a78bfa',
    fontWeight: '700',
  },
  subtitlePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.35)',
    backgroundColor: 'rgba(168,85,247,0.08)',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 11.5,
    fontWeight: '600',
  },
});
