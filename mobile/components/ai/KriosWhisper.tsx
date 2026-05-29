/**
 * KriosWhisper — Focus mode AI message bar
 * 
 * A glassmorphic pill that shows rotating AI encouragement
 * during focus sessions. Minimal, non-intrusive.
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import LiquidBlob from '../ui/LiquidBlob';

const WHISPERS = [
  "Stay focused. You've got this.",
  "One step at a time.",
  "You're in the zone.",
  "Great progress so far.",
  "Almost there. Keep going.",
  "Deep breaths. You're doing great.",
  "This is your time.",
  "Small wins build big results.",
  "Stay present. Stay strong.",
  "You're making it happen.",
];

interface KriosWhisperProps {
  intervalMs?: number;    // how often to rotate (default 45s)
  paused?: boolean;
}

export default function KriosWhisper({
  intervalMs = 45000,
  paused = false,
}: KriosWhisperProps) {
  const { isDark, colors } = useTheme();
  const [index, setIndex] = useState(Math.floor(Math.random() * WHISPERS.length));
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (paused) return;
    const timer = setInterval(() => {
      // Fade out, change text, fade in
      Animated.timing(fadeAnim, { toValue: 0, duration: 400, useNativeDriver: true }).start(() => {
        setIndex(prev => (prev + 1) % WHISPERS.length);
        Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
      });
    }, intervalMs);
    return () => clearInterval(timer);
  }, [paused, intervalMs]);

  const glassBg: [string, string] = isDark
    ? ['rgba(255,255,255,0.04)', 'rgba(255,255,255,0.02)']
    : ['rgba(255,255,255,0.80)', 'rgba(255,255,255,0.60)'];
  const borderColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

  return (
    <LinearGradient
      colors={glassBg}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.container, { borderColor }]}
    >
      <LiquidBlob size={20} color={colors.primary} intensity="calm" />
      <Animated.Text
        style={[styles.text, { color: colors.textSecondary, opacity: fadeAnim }]}
        numberOfLines={1}
      >
        {WHISPERS[index]}
      </Animated.Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1,
    alignSelf: 'center',
  },
  text: {
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
});
