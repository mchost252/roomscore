/**
 * TaskFolder — Refactored Multi-State Task Card for "Tactical Archive"
 */
import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import Animated, { 
  FadeInDown, FadeOutUp, Layout, 
  useSharedValue, useAnimatedStyle, 
  withRepeat, withSequence, withTiming 
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { Task } from '../../types/room';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';

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

// Map Priority to color
const PRIORITY_COLOR: Record<string, string> = {
  urgent: '#ef4444',
  high: '#f97316',
  medium: '#6366f1',
  low: '#22c55e',
};

// Formatter for timestamps
const formatTime = (dateStr: string) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')} • ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
};

export const TaskFolder: React.FC<TaskFolderProps> = ({
  task,
  index,
  onPress,
  onMenuPress,
}) => {
  const { colors, isDark } = useTheme();

  // Calculate Progress — per-user completion logic
  const { user } = useAuth();
  const completionCount = task.completions?.length || 0;
  const participantCount = task.participants?.length || 0;
  const hasCurrentUserCompleted = task.completions?.some(c => c.userId === user?.id || c.id === user?.id);
  // Per-user: only mark COMPLETED if current user completed AND all participants completed
  // If no participants tracked, fall back to isCompleted (per-user from backend)
  const isActuallyCompleted = participantCount > 0
    ? (hasCurrentUserCompleted && completionCount >= participantCount)
    : !!task.isCompleted;
  const progressPercent = participantCount > 0
    ? Math.min(100, Math.round((completionCount / participantCount) * 100))
    : (task.isCompleted ? 100 : 0);

  // Derived State Logic
  let state: TaskState = TaskState.SPECTATING;
  if (isActuallyCompleted) {
    state = TaskState.COMPLETED;
  } else if (hasCurrentUserCompleted || (task as any).status === 'pending') {
    state = TaskState.PENDING;
  } else if (task.isJoined || task.status === 'accepted') {
    state = TaskState.ACTIVE;
  }

  // Visual Properties based on State
  let opacity = 1;
  let subwayColor: string = colors.primary;
  let statusLabel = 'ACTIVE';
  let isMuted = false;

  switch (state) {
    case TaskState.COMPLETED:
      opacity = 0.6;
      subwayColor = colors.success;
      statusLabel = 'COMPLETED';
      break;
    case TaskState.PENDING:
      subwayColor = colors.warning;
      statusLabel = hasCurrentUserCompleted ? 'AWAITING SQUAD' : 'AWAITING VOUCH';
      break;
    case TaskState.SPECTATING:
      isMuted = true;
      subwayColor = colors.textTertiary || 'gray';
      statusLabel = 'SPECTATING';
      break;
    case TaskState.ACTIVE:
    default:
      subwayColor = colors.primary;
      statusLabel = 'ACTIVE';
      break;
  }

  // Reanimated Pulse for PENDING
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (state === TaskState.PENDING) {
      pulse.value = withRepeat(
        withSequence(
          withTiming(0.4, { duration: 800 }),
          withTiming(1, { duration: 800 })
        ),
        -1,
        true
      );
    } else {
      pulse.value = 1;
    }
  }, [state, pulse]);

  const animatedBorder = useAnimatedStyle(() => {
    if (state !== TaskState.PENDING) return {};
    return {
      borderColor: `rgba(245, 158, 11, ${pulse.value})`, // warning color pulse
    };
  });

  const pColor = PRIORITY_COLOR[(task as any).priority || 'medium'] || colors.primary;

  return (
    <Animated.View
      entering={FadeInDown.duration(400).delay(index * 60).springify()}
      exiting={FadeOutUp.duration(300)}
      layout={Layout.springify()}
      style={{ marginBottom: 12, opacity, flexDirection: 'row' }}
    >
      {/* Visual Alignment with RoomTaskThread Subway Line */}
      <View style={styles.trackCol}>
        <View style={[styles.trackLine, { backgroundColor: subwayColor }]} />
        <View style={[styles.trackDot, { borderColor: subwayColor, backgroundColor: isDark ? '#0a0a16' : '#ffffff' }]} />
      </View>

      <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={{ flex: 1 }}>
        <Animated.View
          style={[
            styles.cardWrapper,
            {
              // Tactical Light Mode: 1px Sharp Border (#D1D1D1) and subtle elevation
              borderColor: isDark ? colors.borderColor : '#D1D1D1',
              shadowColor: isDark ? '#000' : '#00000020',
              elevation: isDark ? 4 : 2,
            },
            isMuted && { borderColor: isDark ? 'rgba(255,255,255,0.05)' : '#E5E5E5' },
            animatedBorder,
          ]}
        >
          <BlurView 
            intensity={isDark ? 40 : 80} 
            tint={isDark ? 'dark' : 'light'}
            style={[styles.card, { backgroundColor: isDark ? 'rgba(20,20,30,0.6)' : 'rgba(255,255,255,0.8)' }]}
          >
            <View style={[styles.cardContent, isMuted ? { opacity: 0.6 } : null]}>
              {/* Header: Status Badge & Menu */}
              <View style={styles.topRow}>
                <View style={styles.topRowLeft}>
                  <View style={[styles.statusBadge, { backgroundColor: subwayColor + '20' }]}>
                    <Text style={[styles.statusText, { color: subwayColor }]}>{statusLabel}</Text>
                  </View>
                  {!isActuallyCompleted && state !== TaskState.SPECTATING ? (
                    <View style={[styles.statusBadge, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', marginLeft: 4 }]}>
                      <Text style={[styles.statusText, { color: colors.textSecondary }]}>{progressPercent}%</Text>
                    </View>
                  ) : null}
                </View>

                {onMenuPress ? (
                  <TouchableOpacity onPress={() => onMenuPress(task)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Ionicons name="ellipsis-vertical" size={16} color={colors.textSecondary} />
                  </TouchableOpacity>
                ) : null}
              </View>

              {/* Title (High Contrast) */}
              <Text
                style={[
                  styles.title,
                  { color: isDark ? '#FFFFFF' : '#1A1A1A' }, // Tactical Light Mode contrast
                  state === TaskState.COMPLETED ? { textDecorationLine: 'line-through' } : null,
                ]}
                numberOfLines={2}
              >
                {task.title}
              </Text>

              {/* Timestamps */}
              <View style={styles.timestampRow}>
                <Ionicons name="time-outline" size={10} color={colors.textTertiary || 'gray'} />
                <Text style={[styles.timestampText, { color: colors.textSecondary }]}>
                  Created: {formatTime(task.createdAt)} {task.dueDate ? `• Due: ${task.dueDate}` : ''}
                </Text>
              </View>

              {/* Meta Footer */}
              <View style={styles.metaRow}>
                <View style={[styles.priorityDot, { backgroundColor: pColor }]} />
                <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                  {(task as any).priority || 'medium'}
                </Text>

                {task.points > 0 ? (
                  <Text style={[styles.metaText, { color: colors.textSecondary }]}> • {task.points} pts</Text>
                ) : null}

                {/* Participant avatar stack */}
                {task.participants && task.participants.length > 0 ? (
                  <View style={styles.participantStack}>
                    {task.participants.slice(0, 4).map((p, i) => (
                      <View 
                        key={p.userId || p.id || i}
                        style={[
                          styles.participantAvatar, 
                          { 
                            marginLeft: i > 0 ? -6 : 0, 
                            zIndex: 10 - i,
                            backgroundColor: isDark ? 'rgba(99,102,241,0.25)' : 'rgba(99,102,241,0.12)',
                            borderColor: isDark ? '#0a0a16' : '#ffffff',
                          }
                        ]}
                      >
                        <Text style={[styles.participantInitial, { color: colors.primary }]}>
                          {(p.username || 'U').charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    ))}
                    {task.participants.length > 4 ? (
                      <View style={[styles.participantAvatar, { marginLeft: -6, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', borderColor: isDark ? '#0a0a16' : '#ffffff' }]}>
                        <Text style={[styles.participantOverflow, { color: colors.textSecondary }]}>+{task.participants.length - 4}</Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}

                <View style={{ flex: 1 }} />
                
                {state === TaskState.SPECTATING ? (
                  <View style={styles.actionBtn}>
                    <Text style={[styles.actionBtnText, { color: colors.primary }]}>View Brief</Text>
                    <Ionicons name="chevron-forward" size={12} color={colors.primary} />
                  </View>
                ) : null}
                {state === TaskState.ACTIVE ? (
                  <View style={styles.actionBtn}>
                    <Text style={[styles.actionBtnText, { color: colors.primary }]}>Update</Text>
                    <Ionicons name="chevron-forward" size={12} color={colors.primary} />
                  </View>
                ) : null}
              </View>
            </View>
          </BlurView>
        </Animated.View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  cardWrapper: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  card: {
    flexDirection: 'row',
    padding: 12,
  },
  cardContent: {
    flex: 1,
    paddingLeft: 4,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  topRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  timestampRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  timestampText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 10,
    fontWeight: '500',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  priorityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  metaText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  trackCol: {
    width: 36,
    alignItems: 'center',
    position: 'relative',
    marginRight: 4,
  },
  trackLine: {
    position: 'absolute',
    top: 0,
    bottom: -12,
    width: 2,
    opacity: 0.6,
  },
  trackDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    zIndex: 2,
  },
  participantStack: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  participantAvatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  participantInitial: {
    fontSize: 8,
    fontWeight: '800',
  },
  participantOverflow: {
    fontSize: 7,
    fontWeight: '800',
  },
});

export default React.memo(TaskFolder);
