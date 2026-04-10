/**
 * AbsoluteHeader — Fixed 180px header with Side A/B crossfade
 *
 * Architecture:
 *   - position: absolute, top: 0, height: HEADER_HEIGHT (fixed)
 *   - Side A (Calendar): Identity row + subtext + CalendarStrip
 *   - Side B (Command Deck): Identity row + StatsGrid 2x2 control widgets
 *   - Crossfade via Reanimated opacity — NO height change
 *   - Title tap toggles between sides
 *   - "+" button in top-right when isOwner is true (triggers onAddPress)
 *
 * The container height NEVER changes during crossfade.
 * FlashList below uses paddingTop = HEADER_HEIGHT + safeAreaTop → no jump.
 */
import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { Task, RoomMember } from '../../types/room';
import CalendarStrip from './CalendarStrip';
import StatsGrid from './StatsGrid';

// ─── Constants ───────────────────────────────────────────────────────────────
export const HEADER_HEIGHT = 180;
const CROSSFADE_MS = 280;

interface AbsoluteHeaderProps {
  roomName: string;
  roomCode: string;
  members: RoomMember[];
  tasks: Task[];
  daysLeft: number;
  streak: number;
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  onBackPress: () => void;
  onMenuPress: () => void;
  onSettingsPress: () => void;
  /** Show "+" add button in top-right for room owners */
  isOwner?: boolean;
  /** Called when owner taps the "+" button */
  onAddPress?: () => void;
  // ── Command Deck (Side B) props ─────────────────────────────────────────
  chatRetentionDays?: number;
  isPublic?: boolean;
  onTogglePrivacy?: (isPublic: boolean) => void;
  onManageMembers?: () => void;
}

const AbsoluteHeader: React.FC<AbsoluteHeaderProps> = ({
  roomName,
  roomCode,
  members,
  tasks,
  daysLeft,
  streak,
  selectedDate,
  onSelectDate,
  onBackPress,
  onMenuPress,
  onSettingsPress,
  isOwner = false,
  onAddPress,
  chatRetentionDays = 3,
  isPublic = false,
  onTogglePrivacy,
  onManageMembers,
}) => {
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const activeView = useSharedValue(0); // 0 = calendar, 1 = stats
  const [showingStats, setShowingStats] = useState(false);

  const activeTasks = useMemo(
    () => tasks.filter(t => !t.isCompleted),
    [tasks]
  );

  const taskDates = useMemo(
    () => tasks.filter(t => t.createdAt).map(t => new Date(t.createdAt)),
    [tasks]
  );

  const handleTitleTap = () => {
    const next = activeView.value === 0 ? 1 : 0;
    activeView.value = next;
    setShowingStats(next === 1);
  };

  // ── Crossfade animated styles ──────────────────────────────────────────────
  const calendarStyle = useAnimatedStyle(() => ({
    opacity: withTiming(activeView.value === 0 ? 1 : 0, {
      duration: CROSSFADE_MS,
      easing: Easing.inOut(Easing.ease),
    }),
  }));

  const statsStyle = useAnimatedStyle(() => ({
    opacity: withTiming(activeView.value === 1 ? 1 : 0, {
      duration: CROSSFADE_MS,
      easing: Easing.inOut(Easing.ease),
    }),
  }));

  // ── Subtext ────────────────────────────────────────────────────────────────
  const subtextStr = `${members.length} Member${members.length !== 1 ? 's' : ''} · ${activeTasks.length} Active Task${activeTasks.length !== 1 ? 's' : ''}`;

  return (
    <View
      style={[
        styles.wrapper,
        { height: HEADER_HEIGHT + insets.top },
      ]}
    >
      {/* ── Gradient background (Deep Navy → Purple) ──────────────────────── */}
      <LinearGradient
        colors={
          isDark
            ? ['#1e1b4b', '#312e81', '#0f172a']
            : ['#e0e7ff', '#c7d2fe', '#f0f9ff']
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Subtle accent glow */}
      <LinearGradient
        colors={
          isDark
            ? ['rgba(99,102,241,0.12)', 'transparent']
            : ['rgba(99,102,241,0.06)', 'transparent']
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0.4 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Top edge shimmer line */}
      <LinearGradient
        colors={
          isDark
            ? [
                'transparent',
                'rgba(139,92,246,0.5)',
                'rgba(99,102,241,0.7)',
                'rgba(139,92,246,0.5)',
                'transparent',
              ]
            : [
                'transparent',
                'rgba(99,102,241,0.2)',
                'rgba(139,92,246,0.3)',
                'rgba(99,102,241,0.2)',
                'transparent',
              ]
        }
        locations={[0, 0.2, 0.5, 0.8, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.shimmerLine, { top: insets.top }]}
      />

      {/* ── Content container (below safe area) ───────────────────────────── */}
      <View style={[styles.content, { paddingTop: insets.top + 6 }]}>
        {/* ── Identity Row ─────────────────────────────────────────────────── */}
        <View style={styles.identityRow}>
          <TouchableOpacity onPress={onBackPress} style={styles.iconBtn}>
            <Ionicons name="arrow-back" size={18} color="#FFFFFF" />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleTitleTap}
            activeOpacity={0.7}
            style={styles.titleWrap}
          >
            <Text style={styles.roomTitle} numberOfLines={1}>
              {roomName}
            </Text>
            <Ionicons
              name={showingStats ? 'calendar-outline' : 'grid-outline'}
              size={11}
              color="rgba(255,255,255,0.45)"
              style={{ marginLeft: 6 }}
            />
          </TouchableOpacity>

          {/* Right side: "+" for owners, then menu/settings */}
          <View style={styles.rightIcons}>
            {isOwner && onAddPress ? (
              <TouchableOpacity onPress={onAddPress} style={styles.iconBtn}>
                <Ionicons name="add" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              onPress={showingStats ? onSettingsPress : onMenuPress}
              style={styles.iconBtn}
            >
              <Ionicons
                name={showingStats ? 'settings-outline' : 'ellipsis-vertical'}
                size={18}
                color="#FFFFFF"
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Subtext Row ──────────────────────────────────────────────────── */}
        <View style={styles.subtextRow}>
          <Text style={styles.subtextStr}>{subtextStr}</Text>
        </View>

        {/* ── Content Zone (crossfade area) ─────────────────────────────────
             Both sides absolutely positioned → height is fixed → no jump    */}
        <View style={styles.contentZone}>
          {/* Side A: Calendar */}
          <Animated.View
            style={[styles.side, calendarStyle]}
            pointerEvents={showingStats ? 'none' : 'auto'}
          >
            <CalendarStrip
              selectedDate={selectedDate}
              onSelectDate={onSelectDate}
              taskDates={taskDates}
            />
          </Animated.View>

          {/* Side B: Command Deck */}
          <Animated.View
            style={[styles.side, statsStyle]}
            pointerEvents={showingStats ? 'auto' : 'none'}
          >
            <StatsGrid
              daysLeft={daysLeft}
              roomCode={roomCode}
              members={members}
              streak={streak}
              chatRetentionDays={chatRetentionDays}
              isPublic={isPublic}
              onTogglePrivacy={onTogglePrivacy}
              onManageMembers={onManageMembers}
              isOwner={isOwner}
            />
          </Animated.View>
        </View>
      </View>

      {/* ── Bottom edge fade into screen bg (softened: taller, gentler) ───── */}
      <LinearGradient
        colors={
          isDark
            ? ['transparent', 'rgba(8,8,16,0.3)', 'rgba(8,8,16,0.7)', '#080810']
            : ['transparent', 'rgba(248,249,255,0.3)', 'rgba(248,249,255,0.7)', '#f8f9ff']
        }
        locations={[0, 0.3, 0.7, 1]}
        style={styles.bottomFade}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    overflow: 'hidden',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },

  // ── Identity row ──────────────────────────────────────────────────────────
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 32,
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rightIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  titleWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 12,
  },
  roomTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },

  // ── Subtext ───────────────────────────────────────────────────────────────
  subtextRow: {
    alignItems: 'center',
    marginTop: 3,
    marginBottom: 4,
  },
  subtextStr: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.2,
  },

  // ── Content zone (crossfade container) ─────────────────────────────────────
  contentZone: {
    flex: 1,
    position: 'relative',
  },
  side: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
  },

  // ── Decorative ────────────────────────────────────────────────────────────
  shimmerLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1.5,
  },
  bottomFade: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 36,
  },
});

export { AbsoluteHeader, HEADER_HEIGHT as ROOM_HEADER_HEIGHT };
export default AbsoluteHeader;
