/**
 * RoomHeader — Compact Deck-Swap Header (v5)
 *
 * Refined:
 *   1. "Deck Swap" Swipe — front card fades/scales down, back layer scales up
 *   2. Reduced height — significantly more compact
 *   3. Integrated Status Glows — via updated AvatarStack
 *   4. Scroll Reactivity — title fades out as user scrolls up
 */
import React, { useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
  Extrapolation,
  runOnJS,
  SharedValue,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Image as ExpoImage } from 'expo-image';

import { useTheme } from '../../context/ThemeContext';
import { RoomMember, Task } from '../../types/room';
import AvatarStack from './AvatarStack';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SLIDE_DISTANCE = SCREEN_WIDTH * 0.7;
const SWIPE_THRESHOLD = 50;

const SPRING_CONFIG = { damping: 20, stiffness: 150 };

interface RoomHeaderProps {
  roomName: string;
  roomCode: string;
  members: RoomMember[];
  tasks: Task[];
  daysActive: number;
  chatRetentionDays: number;
  scrollOffset?: SharedValue<number>;
  onMembersPress?: () => void;
}

const RoomHeader: React.FC<RoomHeaderProps> = ({
  roomName,
  roomCode,
  members,
  tasks,
  daysActive,
  chatRetentionDays,
  scrollOffset,
  onMembersPress,
}) => {
  const { colors, isDark } = useTheme();
  const translateX = useSharedValue(0);
  const isShowingBack = useSharedValue(false);

  // ── Stats ───────────────────────────────────────────────────────────────
  const completedCount = useMemo(() => tasks.filter(t => t.isCompleted).length, [tasks]);
  
  // Map members to their task status for the Halo effect
  const memberStatuses = useMemo(() => {
    const map: Record<string, 'completed' | 'active' | 'spectating'> = {};
    members.forEach(m => {
      const userId = m.userId || m.id;
      // Heuristic: find if this user completed any tasks today
      const hasCompleted = tasks.some(t => t.completions?.some(c => c.userId === userId));
      const hasJoined = tasks.some(t => t.participants?.some(p => p.userId === userId));
      map[userId] = hasCompleted ? 'completed' : hasJoined ? 'active' : 'spectating';
    });
    return map;
  }, [members, tasks]);

  const handleCopyCode = useCallback(async () => {
    try {
      await Clipboard.setStringAsync(roomCode);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}
  }, [roomCode]);

  // ── Swipe Gesture ────────────────────────────────────────────────────────
  const panGesture = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .onUpdate(e => {
      const base = isShowingBack.value ? -SLIDE_DISTANCE : 0;
      translateX.value = Math.max(-SLIDE_DISTANCE, Math.min(0, base + e.translationX));
    })
    .onEnd(e => {
      const base = isShowingBack.value ? -SLIDE_DISTANCE : 0;
      const finalPos = base + e.translationX;

      if (!isShowingBack.value && finalPos < -SWIPE_THRESHOLD) {
        translateX.value = withSpring(-SLIDE_DISTANCE, SPRING_CONFIG);
        isShowingBack.value = true;
        runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
      } else if (isShowingBack.value && finalPos > -SLIDE_DISTANCE + SWIPE_THRESHOLD) {
        translateX.value = withSpring(0, SPRING_CONFIG);
        isShowingBack.value = false;
        runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
      } else {
        translateX.value = withSpring(isShowingBack.value ? -SLIDE_DISTANCE : 0, SPRING_CONFIG);
      }
    });

  // ── Animated Styles ──────────────────────────────────────────────────────
  
  const frontStyle = useAnimatedStyle(() => {
    const scale = interpolate(translateX.value, [-SLIDE_DISTANCE, 0], [0.94, 1], Extrapolation.CLAMP);
    const opacity = interpolate(translateX.value, [-SLIDE_DISTANCE, -SLIDE_DISTANCE * 0.4, 0], [0, 0.4, 1], Extrapolation.CLAMP);
    const scrollAlpha = scrollOffset ? interpolate(scrollOffset.value, [0, 50], [1, 0], Extrapolation.CLAMP) : 1;

    return {
      transform: [{ translateX: translateX.value }, { scale }],
      opacity: Math.min(opacity, scrollAlpha),
    };
  });

  const backStyle = useAnimatedStyle(() => {
    const scale = interpolate(translateX.value, [-SLIDE_DISTANCE, 0], [1, 0.9], Extrapolation.CLAMP);
    const opacity = interpolate(translateX.value, [-SLIDE_DISTANCE, -SLIDE_DISTANCE * 0.6, 0], [1, 0, 0], Extrapolation.CLAMP);
    return {
      transform: [{ scale }],
      opacity,
    };
  });

  const glassBg = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.7)';
  const glassBorder = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';

  return (
    <View style={styles.container}>
      <GestureDetector gesture={panGesture}>
        <View style={styles.swipeArea}>
          
          {/* Back layer (metadata) */}
          <Animated.View style={[styles.backLayer, backStyle]}>
            <Text style={[styles.metaHeading, { color: isDark ? '#fff' : '#000' }]}>MISSION INTEL</Text>
            <View style={styles.metaPillGrid}>
              <TouchableOpacity onPress={handleCopyCode} style={[styles.metaPill, { backgroundColor: isDark ? 'rgba(99,102,241,0.1)' : 'rgba(99,102,241,0.05)', borderColor: isDark ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.1)' }]}>
                <Ionicons name="key-outline" size={12} color={colors.primary} />
                <Text style={[styles.metaPillText, { color: isDark ? '#fff' : '#000' }]}>{roomCode}</Text>
              </TouchableOpacity>
              <View style={[styles.metaPill, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', borderColor: glassBorder }]}>
                <Ionicons name="flame-outline" size={12} color="#f59e0b" />
                <Text style={[styles.metaPillText, { color: isDark ? '#fff' : '#000' }]}>{daysActive}d active</Text>
              </View>
              <View style={[styles.metaPill, { backgroundColor: isDark ? 'rgba(34,197,94,0.1)' : 'rgba(34,197,94,0.05)', borderColor: 'rgba(34,197,94,0.2)' }]}>
                <Ionicons name="checkmark-circle-outline" size={12} color="#22c55e" />
                <Text style={[styles.metaPillText, { color: isDark ? '#fff' : '#000' }]}>{completedCount}/{tasks.length} SECURED</Text>
              </View>
            </View>
          </Animated.View>

          {/* Front layer (identity) */}
          <Animated.View style={[styles.frontLayer, frontStyle]}>
            <View style={[styles.glassCard, { backgroundColor: glassBg, borderColor: glassBorder }]}>
              <View style={styles.identityRow}>
                <View style={styles.nameCol}>
                  <Text style={[styles.roomName, { color: isDark ? '#fff' : '#000' }]} numberOfLines={1}>
                    {roomName}
                  </Text>
                  <TouchableOpacity
                    style={styles.avatarRow}
                    onPress={onMembersPress}
                    activeOpacity={0.7}
                  >
                    <AvatarStack members={members} size={28} memberStatuses={memberStatuses} />
                    <Text style={[styles.memberCount, { color: colors.primary }]}>+{members.length} OPS</Text>
                  </TouchableOpacity>
                </View>
                {/* Brand Logo Placeholder */}
                <View style={styles.logoContainer}>
                  <LinearGradient colors={['#6366f1', '#8b5cf6']} style={styles.logoCircle}>
                    <Ionicons name="infinite" size={24} color="#fff" />
                  </LinearGradient>
                </View>
              </View>
            </View>
          </Animated.View>

        </View>
      </GestureDetector>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginTop: 4, marginBottom: 8 },
  swipeArea: { position: 'relative', height: 90, justifyContent: 'center' },
  backLayer: { ...StyleSheet.absoluteFillObject, paddingHorizontal: 24, justifyContent: 'center' },
  metaHeading: { fontSize: 10, fontWeight: '900', letterSpacing: 1, marginBottom: 8, opacity: 0.5 },
  metaPillGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  metaPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, borderWidth: 1 },
  metaPillText: { fontSize: 11, fontWeight: '800' },
  frontLayer: { paddingHorizontal: 16 },
  glassCard: { borderRadius: 20, borderWidth: 1, padding: 16, overflow: 'hidden' },
  identityRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  nameCol: { flex: 1, gap: 4 },
  roomName: { fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  memberCount: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  logoContainer: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden' },
  logoCircle: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});

export default React.memo(RoomHeader);
