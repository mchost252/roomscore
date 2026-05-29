/**
 * AchievementBadge - Updated version with image support
 * Shows achievement badges with rarity colors and local images
 */

import React from 'react';
import { View, Text, StyleSheet, Image, ImageSourcePropType } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

interface AchievementBadgeProps {
  image?: ImageSourcePropType;
  icon?: string; // Fallback icon
  title: string;
  description: string;
  unlocked: boolean;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  isDark?: boolean;
}

export function AchievementBadge({
  image,
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
        style={[
          styles.badge, 
          { borderColor: unlocked ? 'rgba(255,255,255,0.2)' : lockedBadgeBorder },
          !unlocked && { opacity: 0.7 }
        ]}
      >
        <View style={styles.contentContainer}>
          {image ? (
            <Image 
              source={image} 
              style={[
                styles.badgeImage, 
                !unlocked && { tintColor: 'gray', opacity: 0.5 }
              ]} 
              resizeMode="contain" 
            />
          ) : (
            <Ionicons
              name={icon as any || 'trophy'}
              size={32}
              color={unlocked ? '#fff' : (isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.25)')}
            />
          )}
        </View>
      </LinearGradient>

      <Text style={[styles.title, { color: titleColor }, !unlocked && styles.lockedText]}>
        {title}
      </Text>
      
      {!unlocked && (
        <View style={styles.lockIconWrap}>
           <Ionicons name="lock-closed" size={12} color="rgba(255,255,255,0.8)" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    width: 90,
    marginHorizontal: 6,
  },
  badge: {
    width: 76,
    height: 76,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    overflow: 'hidden',
    borderWidth: 1.5,
  },
  contentContainer: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeImage: {
    width: '75%',
    height: '75%',
  },
  title: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 2,
    lineHeight: 14,
  },
  lockedText: {
    opacity: 0.5,
  },
  lockIconWrap: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  }
});
