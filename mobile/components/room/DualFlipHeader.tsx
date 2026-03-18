/**
 * DualFlipHeader - Room Header with Flip Animation
 * Front: Calendar view + Room Title
 * Back: Dashboard with Doom Clock + Room Code + Owner controls
 * Uses Reanimated rotateX for vertical flip (drop-down)
 * 
 * Styled to match reference: "room-detail view with fliping header.jpeg"
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useHaptics } from '../../hooks';
import DoomClock from './DoomClock';
import { COLORS, GLASS, RADIUS, SPACING, GLOWS } from '../../styles/glassmorphism';

interface DualFlipHeaderProps {
  roomName: string;
  roomCode: string;
  expiresAt: number;
  isOwner: boolean;
  memberCount: number;
  taskCount: number;
  onShareCode?: () => void;
  onSettings?: () => void;
  onBack?: () => void;
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
  onBack,
}: DualFlipHeaderProps) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const haptics = useHaptics();
  const [isFlipped, setIsFlipped] = useState(false);
  
  const flipProgress = useSharedValue(0);

  const handleFlip = () => {
    haptics.selection();
    const targetValue = isFlipped ? 0 : 1;
    flipProgress.value = withSpring(targetValue, {
      damping: 15,
      stiffness: 100,
    });
    setIsFlipped(!isFlipped);
  };

  // Front face animation - Vertical flip
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

  // Back face animation - Vertical flip
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
    <Pressable onPress={handleFlip} style={[styles.container, { paddingTop: Math.max(insets.top, 40) }]}>
      {/* Front Face - Calendar + Title */}
      <Animated.View style={[styles.face, styles.frontFace, frontAnimatedStyle]}>
        <View style={[
          styles.frontContent,
          { 
            backgroundColor: isDark ? 'rgba(26,26,46,0.9)' : 'rgba(255,255,255,0.95)',
            borderColor: GLASS.border,
          }
        ]}>
          {/* Week Calendar Row */}
          <View style={styles.calendarContainer}>
            {weekDates.map((date, index) => (
              <View
                key={index}
                style={[
                  styles.calendarDay,
                  date.isToday && [styles.calendarDayToday, { backgroundColor: `${COLORS.primary}20` }],
                ]}
              >
                <Text
                  style={[
                    styles.calendarDayText,
                    { color: date.isToday ? COLORS.primary : colors.textSecondary },
                  ]}
                >
                  {date.day}
                </Text>
                <Text
                  style={[
                    styles.calendarDateText,
                    { color: date.isToday ? COLORS.primary : colors.text },
                    date.isToday && styles.calendarDateTextToday,
                  ]}
                >
                  {date.num}
                </Text>
              </View>
            ))}
          </View>

          {/* Room Title + Flip Hint */}
          <View style={styles.titleRow}>
            <View style={styles.titleContainer}>
              {onBack && (
                <TouchableOpacity 
                  onPress={onBack} 
                  style={[styles.backBtn, { backgroundColor: isDark ? GLASS.surface : 'rgba(0,0,0,0.05)' }]}
                >
                  <Ionicons name="chevron-back" size={20} color={colors.text} />
                </TouchableOpacity>
              )}
              <Text style={[styles.roomTitle, { color: colors.text }]} numberOfLines={1}>
                {roomName}
              </Text>
            </View>
            <View style={[styles.flipHint, { backgroundColor: isDark ? GLASS.surface : 'rgba(0,0,0,0.05)' }]}>
              <Ionicons name="swap-vertical" size={14} color={colors.textSecondary} />
              <Text style={[styles.flipHintText, { color: colors.textSecondary }]}>
                Tap for details
              </Text>
            </View>
          </View>
        </View>
      </Animated.View>

      {/* Back Face - Dashboard with Doom Clock */}
      <Animated.View style={[styles.face, styles.backFace, backAnimatedStyle]}>
        <View style={[
          styles.backContent,
          { 
            backgroundColor: isDark ? 'rgba(26,26,46,0.95)' : 'rgba(248,250,252,0.98)',
            borderColor: GLASS.border,
          }
        ]}>
          {/* Header */}
          <View style={styles.backHeader}>
            <Text style={[styles.backTitle, { color: colors.text }]}>Room Dashboard</Text>
            <TouchableOpacity onPress={handleFlip} style={[styles.closeBtn, { backgroundColor: isDark ? GLASS.surface : 'rgba(0,0,0,0.05)' }]}>
              <Ionicons name="close" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Doom Clock */}
          <View style={styles.doomClockContainer}>
            <DoomClock expiresAt={expiresAt} size={90} />
            <Text style={[styles.expiryLabel, { color: colors.textSecondary }]}>
              {isOwner ? 'Room Expires' : 'Ban Countdown'}
            </Text>
          </View>

          {/* Room Code */}
          <TouchableOpacity
            style={[
              styles.codeContainer, 
              { 
                backgroundColor: isDark ? GLASS.surface : 'rgba(0,0,0,0.04)',
                borderColor: GLASS.border,
              }
            ]}
            onPress={onShareCode}
            activeOpacity={0.7}
          >
            <View style={styles.codeContent}>
              <Text style={[styles.codeLabel, { color: colors.textSecondary }]}>Room Code</Text>
              <Text style={[styles.codeValue, { color: COLORS.primary }]}>{roomCode}</Text>
            </View>
            <Ionicons name="share-outline" size={20} color={COLORS.primary} />
          </TouchableOpacity>

          {/* Stats Row */}
          <View style={styles.statsRow}>
            <View style={[styles.statItem, { backgroundColor: isDark ? GLASS.surface : 'rgba(0,0,0,0.04)' }]}>
              <Ionicons name="people" size={16} color={COLORS.primary} />
              <Text style={[styles.statValue, { color: colors.text }]}>{memberCount}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Members</Text>
            </View>
            <View style={[styles.statItem, { backgroundColor: isDark ? GLASS.surface : 'rgba(0,0,0,0.04)' }]}>
              <Ionicons name="checkmark-circle" size={16} color={COLORS.secondary} />
              <Text style={[styles.statValue, { color: colors.text }]}>{taskCount}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Tasks</Text>
            </View>
          </View>

          {/* Owner Controls */}
          {isOwner && (
            <TouchableOpacity
              style={[styles.ownerBtn]}
              onPress={onSettings}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={[COLORS.primary, COLORS.primaryLight]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.ownerBtnGradient}
              >
                <Ionicons name="settings" size={16} color="#fff" />
                <Text style={styles.ownerBtnText}>Room Settings</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 150,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
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
  frontContent: {
    flex: 1,
    padding: SPACING.lg,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  backContent: {
    flex: 1,
    padding: SPACING.lg,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  calendarContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  calendarDay: {
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.md,
    minWidth: 38,
  },
  calendarDayToday: {
    backgroundColor: 'rgba(99,102,241,0.15)',
  },
  calendarDayText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: SPACING.sm,
  },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roomTitle: {
    fontSize: 24,
    fontWeight: '800',
    flex: 1,
    letterSpacing: -0.5,
  },
  flipHint: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
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
    marginBottom: SPACING.md,
  },
  backTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doomClockContainer: {
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  expiryLabel: {
    fontSize: 11,
    marginTop: SPACING.sm,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '600',
  },
  codeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    marginBottom: SPACING.md,
  },
  codeContent: {
    flexDirection: 'column',
  },
  codeLabel: {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '600',
  },
  codeValue: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 2,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    gap: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '600',
  },
  ownerBtn: {
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
  },
  ownerBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  ownerBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});
