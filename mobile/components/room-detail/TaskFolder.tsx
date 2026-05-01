/**
 * TaskFolder — Enhanced Multi-State Task Card with Liquid Progress and Tactical Effects
 */
import React, { useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Dimensions } from 'react-native';
import Animated, { 
  Layout, useSharedValue, useAnimatedStyle, 
  withRepeat, withSequence, withTiming, interpolate, Easing
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Task } from '../../types/room';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';

const { width: W } = Dimensions.get('window');

export enum TaskState {
  ACTIVE = 'ACTIVE',
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  SPECTATING = 'SPECTATING',
}

interface TaskFolderProps {
  task: Task;
  index: number;
  onPress: () => void;
  onMenuPress?: (task: Task) => void;
}

// ─── Sub-Components for Visual Effects ──────────────────────────────────────

const LiquidBackground = ({ progress, color, isDark }: { progress: number, color: string, isDark: boolean }) => {
  const waveAnim = useSharedValue(0);
  
  useEffect(() => {
    waveAnim.value = withRepeat(withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    const height = interpolate(progress, [0, 100], [0, 140]); // Max height of card approx 140
    const translateY = interpolate(waveAnim.value, [0, 1], [-2, 2]);
    return {
      height,
      transform: [{ translateY }],
      opacity: isDark ? 0.12 : 0.08,
    };
  });

  return (
    <Animated.View style={[s.liquidBase, animatedStyle, { backgroundColor: color }]}>
      <LinearGradient
        colors={['transparent', color]}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
};

const TaskStatusLine = ({ state, color, isDark, priority }: { state: TaskState, color: string, isDark: boolean, priority?: string }) => {
  const pulse = useSharedValue(1);
  const stripePos = useSharedValue(0);

  useEffect(() => {
    if (state === TaskState.ACTIVE || state === TaskState.PENDING) {
      pulse.value = withRepeat(withSequence(withTiming(0.4, { duration: 1000 }), withTiming(1, { duration: 1000 })), -1, true);
    }
    if (priority === 'urgent' || state === TaskState.PENDING) {
      stripePos.value = withRepeat(withTiming(1, { duration: 2000, easing: Easing.linear }), -1, false);
    }
  }, [state, priority]);

  const animatedDotStyle = useAnimatedStyle(() => ({
    opacity: pulse.value,
    transform: [{ scale: interpolate(pulse.value, [0.4, 1], [0.8, 1.1]) }]
  }));

  const isUrgent = priority === 'urgent' || state === TaskState.PENDING;

  return (
    <View style={s.trackCol}>
      <View style={[s.trackLine, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
        {isUrgent && (
           <View style={StyleSheet.absoluteFill}>
             {/* Hazard Stripe Simulation */}
             <LinearGradient 
                colors={['transparent', color, 'transparent']} 
                style={{ height: '100%', width: '100%', opacity: 0.3 }} 
             />
           </View>
        )}
      </View>
      <Animated.View style={[s.trackDot, { borderColor: color, backgroundColor: isDark ? '#0a0a16' : '#ffffff' }, animatedDotStyle]}>
        <View style={[s.innerDot, { backgroundColor: color }]} />
      </Animated.View>
    </View>
  );
};

// ─── Main Component ──────────────────────────────────────────────────────────

export const TaskFolder: React.FC<TaskFolderProps> = ({ task, index, onPress, onMenuPress }) => {
  const { colors, isDark } = useTheme();
  const { user } = useAuth();

  const completionCount = task.completions?.length || 0;
  const participantCount = task.participants?.length || 0;
  const hasCurrentUserCompleted = task.completions?.some(c => c.userId === user?.id || c.id === user?.id);

  const isActuallyCompleted = participantCount > 0
    ? (hasCurrentUserCompleted && completionCount >= participantCount)
    : !!task.isCompleted;

  const progressPercent = participantCount > 0
    ? Math.min(100, Math.round((completionCount / participantCount) * 100))
    : (task.isCompleted ? 100 : 0);

  let state: TaskState = TaskState.SPECTATING;
  if (isActuallyCompleted) state = TaskState.COMPLETED;
  else if (hasCurrentUserCompleted || (task as any).status === 'pending') state = TaskState.PENDING;
  else if (task.isJoined || task.status === 'accepted') state = TaskState.ACTIVE;

  const statusConfig = useMemo(() => {
    switch (state) {
      case TaskState.COMPLETED: return { color: colors.success, label: 'SECURED', opacity: 0.7 };
      case TaskState.PENDING: return { color: colors.warning, label: 'AWAITING VOUCH', opacity: 1 };
      case TaskState.SPECTATING: return { color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)', label: 'SPECTATING', opacity: 0.8 };
      default: return { color: colors.primary, label: 'ACTIVE', opacity: 1 };
    }
  }, [state, colors, isDark]);

  return (
    <Animated.View layout={Layout.springify()} style={{ marginBottom: 14, flexDirection: 'row', opacity: statusConfig.opacity }}>
      
      <TaskStatusLine state={state} color={statusConfig.color} isDark={isDark} priority={(task as any).priority} />

      <TouchableOpacity onPress={onPress} activeOpacity={0.9} style={{ flex: 1 }}>
        <View style={[s.cardWrapper, { borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)', backgroundColor: isDark ? '#12121A' : '#FFFFFF' }]}>
          
          <LiquidBackground progress={progressPercent} color={statusConfig.color} isDark={isDark} />

          <BlurView intensity={isDark ? 20 : 40} tint={isDark ? 'dark' : 'light'} style={s.cardInner}>
            <View style={s.topRow}>
              <View style={[s.statusBadge, { backgroundColor: statusConfig.color + '15' }]}>
                <Text style={[s.statusText, { color: statusConfig.color }]}>{statusConfig.label}</Text>
              </View>
              {progressPercent > 0 && !isActuallyCompleted && (
                <Text style={s.progressText}>{progressPercent}% OPS</Text>
              )}
              <View style={{ flex: 1 }} />
              {onMenuPress && (
                <TouchableOpacity onPress={() => onMenuPress(task)} hitSlop={15}>
                  <Ionicons name="ellipsis-horizontal" size={16} color={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)'} />
                </TouchableOpacity>
              )}
            </View>

            <Text style={[s.title, { color: isDark ? '#FFF' : '#000', textDecorationLine: isActuallyCompleted ? 'line-through' : 'none' }]} numberOfLines={2}>
              {task.title}
            </Text>

            <View style={s.footer}>
              <View style={s.metaWrap}>
                <Ionicons name="flash" size={10} color={statusConfig.color} />
                <Text style={[s.metaText, { color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }]}>{task.points} GHOST PTS</Text>
              </View>

              <View style={s.avatarStack}>
                {task.participants?.slice(0, 3).map((p, i) => (
                  <View key={p.id} style={[s.miniAvatar, { marginLeft: i > 0 ? -8 : 0, borderColor: isDark ? '#12121A' : '#FFF', backgroundColor: colors.primary + '30' }]}>
                    <Text style={s.avatarText}>{(p.username || 'U').charAt(0).toUpperCase()}</Text>
                  </View>
                ))}
              </View>
            </View>
          </BlurView>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const s = StyleSheet.create({
  trackCol: { width: 32, alignItems: 'center', marginRight: 8 },
  trackLine: { position: 'absolute', top: 0, bottom: -14, width: 1, overflow: 'hidden' },
  trackDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginTop: 14, zIndex: 2 },
  innerDot: { width: 4, height: 4, borderRadius: 2 },
  cardWrapper: { flex: 1, borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  cardInner: { padding: 16 },
  liquidBase: { position: 'absolute', bottom: 0, left: 0, right: 0, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  topRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  progressText: { fontSize: 10, fontWeight: '700', color: 'rgba(99,102,241,0.6)' },
  title: { fontSize: 16, fontWeight: '800', marginBottom: 12, letterSpacing: -0.3 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  metaWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 10, fontWeight: '700' },
  avatarStack: { flexDirection: 'row', alignItems: 'center' },
  miniAvatar: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 8, fontWeight: '900', color: '#6366f1' },
});

export default React.memo(TaskFolder);
