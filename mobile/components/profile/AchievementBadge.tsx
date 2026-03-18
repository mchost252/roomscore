/**
 * AchievementBadge - Optimized version without heavy animations
 * Shows achievement badges with rarity colors
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

interface AchievementBadgeProps {
  icon: string;
  title: string;
  description: string;
  unlocked: boolean;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  delay?: number;
  isDark?: boolean;
}

export function AchievementBadge({
  icon,
  title,
  description,
  unlocked,
  rarity,
  isDark = true,
}: AchievementBadgeProps) {
  const rarityColors = {
    common: ['#6366f1', '#8b5cf6'],
    rare: ['#06b6d4', '#0891b2'],
    epic: ['#a855f7', '#ec4899'],
    legendary: ['#fbbf24', '#f59e0b'],
  };

  const titleColor = isDark ? '#fff' : '#111';
  const descColor = isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)';
  const lockedBadgeBorder = isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)';
  const lockedColors: [string, string] = isDark ? ['#374151', '#1f2937'] : ['#d1d5db', '#e5e7eb'];

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={unlocked ? rarityColors[rarity] as any : lockedColors as any}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.badge, { borderColor: unlocked ? 'rgba(255,255,255,0.2)' : lockedBadgeBorder }]}
      >
        <View style={styles.iconContainer}>
          <Ionicons
            name={icon as any}
            size={32}
            color={unlocked ? '#fff' : (isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.25)')}
          />
        </View>
      </LinearGradient>

      <Text style={[styles.title, { color: titleColor }, !unlocked && styles.lockedText]}>
        {title}
      </Text>
      <Text style={[styles.description, { color: descColor }, !unlocked && styles.lockedText]} numberOfLines={2}>
        {description}
      </Text>

      {!unlocked && (
        <View style={[
          styles.lockOverlay, 
          { backgroundColor: isDark ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.45)' }
        ]} 
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    width: 100,
    marginHorizontal: 8,
  },
  badge: {
    width: 80,
    height: 80,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    overflow: 'hidden',
    borderWidth: 2,
  },
  iconContainer: {
    zIndex: 1,
  },
  title: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 2,
  },
  description: {
    fontSize: 10,
    textAlign: 'center',
  },
  lockedText: {
    opacity: 0.4,
  },
  lockOverlay: {
    position: 'absolute',
    top: 0,
    width: 80,
    height: 80,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
