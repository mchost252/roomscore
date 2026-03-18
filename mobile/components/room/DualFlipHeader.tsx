/**
 * DualFlipHeader - Room Header with Flip Animation
 * Front: Calendar view + Room Title
 * Back: Dashboard with Doom Clock + Room Code + Owner controls
 * Uses Reanimated 3 rotateX for vertical flip animation (smooth drop-down)
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import DoomClock from './DoomClock';

interface DualFlipHeaderProps {
  roomName: string;
  roomCode: string;
  expiresAt: number;
  isOwner: boolean;
  memberCount: number;
  taskCount: number;
  onShareCode?: () => void;
  onSettings?: () => void;
}

export default function DualFlipHeader({
  roomName,
  roomCode,
  expiresAt,
  isOwner,
  memberCount,
  taskCount,
  onShareCode,
  onSettings,
}: DualFlipHeaderProps) {
  const { colors, gradients, isDark } = useTheme();
  const [isFlipped, setIsFlipped] = useState(false);
  
  // Shared value for flip animation
  const flipProgress = useSharedValue(0);

  const handleFlip = () => {
    const targetValue = isFlipped ? 0 : 1;
    flipProgress.value = withSpring(targetValue, {
      damping: 15,
      stiffness: 100,
    });
    setIsFlipped(!isFlipped);
  };

  // Front face animation - Vertical flip (drop-down)
  const frontAnimatedStyle = useAnimatedStyle(() => {
    const rotateX = interpolate(
      flipProgress.value,
      [0, 1],
      [0, 180],
      Extrapolation.CLAMP
    );
    const opacity = interpolate(
      flipProgress.value,
      [0, 0.5, 1],
      [1, 0, 0],
      Extrapolation.CLAMP
    );
    
    return {
      transform: [{ perspective: 1000 }, { rotateX: `${rotateX}deg` }],
      opacity,
    };
  });

  // Back face animation - Vertical flip (drop-down)
  const backAnimatedStyle = useAnimatedStyle(() => {
    const rotateX = interpolate(
      flipProgress.value,
      [0, 1],
      [180, 360],
      Extrapolation.CLAMP
    );
    const opacity = interpolate(
      flipProgress.value,
      [0, 0.5, 1],
      [0, 0, 1],
      Extrapolation.CLAMP
    );
    
    return {
      transform: [{ perspective: 1000 }, { rotateX: `${rotateX}deg` }],
      opacity,
    };
  });

  // Get current week dates
  const getWeekDates = () => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const dates = [];
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(now);
      date.setDate(now.getDate() - dayOfWeek + i);
      dates.push({
        day: date.toLocaleDateString('en-US', { weekday: 'short' }),
        num: date.getDate(),
        isToday: i === dayOfWeek,
      });
    }
    return dates;
  };

  const weekDates = getWeekDates();

  return (
    <Pressable onPress={handleFlip} style={styles.container}>
      {/* Front Face - Calendar + Title */}
      <Animated.View style={[styles.face, styles.frontFace, frontAnimatedStyle]}>
        <LinearGradient
          colors={isDark ? ['#1e1e3f', '#16162a'] : ['#ffffff', '#f8fafc']}
          style={styles.frontGradient}
        >
          {/* Week Calendar */}
          <View style={styles.calendarRow}>
            {weekDates.map((date, index) => (
              <View
                key={index}
                style={[
                  styles.calendarDay,
                  date.isToday && styles.calendarDayToday,
                ]}
              >
                <Text
                  style={[
                    styles.calendarDayText,
                    { color: date.isToday ? colors.primary : colors.textSecondary },
                    date.isToday && styles.calendarDayTextToday,
                  ]}
                >
                  {date.day}
                </Text>
                <Text
                  style={[
                    styles.calendarDateText,
                    { color: date.isToday ? colors.primary : colors.text },
                    date.isToday && styles.calendarDateTextToday,
                  ]}
                >
                  {date.num}
                </Text>
              </View>
            ))}
          </View>

          {/* Room Title */}
          <View style={styles.titleRow}>
            <Text style={[styles.roomTitle, { color: colors.text }]} numberOfLines={1}>
              {roomName}
            </Text>
            <View style={[styles.flipHint, { backgroundColor: colors.surface }]}>
              <Ionicons name="swap-vertical" size={14} color={colors.textSecondary} />
              <Text style={[styles.flipHintText, { color: colors.textSecondary }]}>
                Tap for details
              </Text>
            </View>
          </View>
        </LinearGradient>
      </Animated.View>

      {/* Back Face - Dashboard with Doom Clock */}
      <Animated.View style={[styles.face, styles.backFace, backAnimatedStyle]}>
        <LinearGradient
          colors={isDark ? ['#1a1a2e', '#16162a'] : ['#f1f5f9', '#e2e8f0']}
          style={styles.backGradient}
        >
          {/* Header */}
          <View style={styles.backHeader}>
            <Text style={[styles.backTitle, { color: colors.text }]}>Room Dashboard</Text>
            <TouchableOpacity onPress={handleFlip} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Doom Clock */}
          <View style={styles.doomClockContainer}>
            <DoomClock expiresAt={expiresAt} size={100} />
            <Text style={[styles.expiryLabel, { color: colors.textSecondary }]}>
              {isOwner ? 'Room Expires' : 'Ban Countdown'}
            </Text>
          </View>

          {/* Room Code */}
          <TouchableOpacity
            style={[styles.codeContainer, { backgroundColor: colors.surface, borderColor: colors.border.primary }]}
            onPress={onShareCode}
            activeOpacity={0.7}
          >
            <View style={styles.codeContent}>
              <Text style={[styles.codeLabel, { color: colors.textSecondary }]}>Room Code</Text>
              <Text style={[styles.codeValue, { color: colors.primary }]}>{roomCode}</Text>
            </View>
            <Ionicons name="share-outline" size={20} color={colors.primary} />
          </TouchableOpacity>

          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={[styles.statItem, { backgroundColor: colors.surface }]}>
              <Ionicons name="people" size={18} color={colors.primary} />
              <Text style={[styles.statValue, { color: colors.text }]}>{memberCount}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Members</Text>
            </View>
            <View style={[styles.statItem, { backgroundColor: colors.surface }]}>
              <Ionicons name="checkmark-circle" size={18} color="#22c55e" />
              <Text style={[styles.statValue, { color: colors.text }]}>{taskCount}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Tasks</Text>
            </View>
          </View>

          {/* Owner Controls */}
          {isOwner && (
            <TouchableOpacity
              style={[styles.ownerBtn, { backgroundColor: colors.primary }]}
              onPress={onSettings}
              activeOpacity={0.8}
            >
              <Ionicons name="settings" size={18} color="#fff" />
              <Text style={styles.ownerBtnText}>Room Settings</Text>
            </TouchableOpacity>
          )}
        </LinearGradient>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 140,
  },
  face: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    backfaceVisibility: 'hidden',
  },
  frontFace: {
    zIndex: 1,
  },
  backFace: {
    zIndex: 0,
  },
  frontGradient: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    borderRadius: 16,
  },
  backGradient: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
  },
  calendarRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  calendarDay: {
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  calendarDayToday: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
  },
  calendarDayText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  calendarDayTextToday: {
    fontWeight: '700',
  },
  calendarDateText: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 2,
  },
  calendarDateTextToday: {
    fontWeight: '800',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  roomTitle: {
    fontSize: 24,
    fontWeight: '800',
    flex: 1,
  },
  flipHint: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  flipHintText: {
    fontSize: 11,
    fontWeight: '500',
  },
  backHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  backTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
  },
  doomClockContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  expiryLabel: {
    fontSize: 12,
    marginTop: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  codeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  codeContent: {
    flexDirection: 'column',
  },
  codeLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  codeValue: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 2,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    gap: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  ownerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 12,
    gap: 8,
  },
  ownerBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});
