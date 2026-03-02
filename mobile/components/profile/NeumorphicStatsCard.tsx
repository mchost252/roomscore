import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

interface NeumorphicStatsCardProps {
  icon: string;
  label: string;
  value: number;
  color: string;
  delay?: number;
  maxValue?: number;
}

export function NeumorphicStatsCard({
  icon,
  label,
  value,
  color,
  delay = 0,
  maxValue = 100,
}: NeumorphicStatsCardProps) {
  const scale = useSharedValue(0.8);
  const opacity = useSharedValue(0);
  const progress = useSharedValue(0);

  useEffect(() => {
    scale.value = withDelay(delay, withSpring(1, { damping: 12, stiffness: 100 }));
    opacity.value = withDelay(delay, withTiming(1, { duration: 400 }));
    progress.value = withDelay(
      delay + 200,
      withSpring((value / maxValue) * 100, { damping: 15, stiffness: 80 })
    );
  }, [value, delay, maxValue]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progress.value}%`,
  }));

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <LinearGradient
        colors={['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.02)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        {/* Glow effect */}
        <View style={[styles.glow, { backgroundColor: color + '20' }]} />
        
        {/* Icon */}
        <View style={[styles.iconContainer, { backgroundColor: color + '18' }]}>
          <Ionicons name={icon as any} size={24} color={color} />
        </View>

        {/* Stats */}
        <View style={styles.statsContainer}>
          <Text style={styles.value}>{value}</Text>
          <Text style={styles.label}>{label}</Text>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressBackground}>
          <Animated.View style={[styles.progressBar, { backgroundColor: color }, progressStyle]} />
        </View>
      </LinearGradient>

      {/* Neumorphic Shadow */}
      <View style={[styles.shadow, StyleSheet.absoluteFill]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minWidth: 100,
  },
  card: {
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  glow: {
    position: 'absolute',
    top: -20,
    right: -20,
    width: 80,
    height: 80,
    borderRadius: 40,
    opacity: 0.3,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  statsContainer: {
    marginBottom: 10,
  },
  value: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 2,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  progressBackground: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 2,
  },
  shadow: {
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
});
