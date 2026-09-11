/**
 * TaskCard — Clean Dark Card (v2)
 *
 * Reference layout:
 *   [Green/Purple Status Bar 4px] [Purple Icon Circle 48px] [Title row: dot + name | fraction + menu]
 *                                                           [Badges: ACTIVE, Daily]
 *   [Avatars F N]  [──────●──────────○──────] [50%]
 *
 * No liquid fill, no hazard pulse, no gradient overlays. Clean and professional.
 */
import React, { useMemo, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Dimensions } from 'react-native';
import Animated, { Layout, FadeIn, useSharedValue, useAnimatedStyle, withRepeat, withTiming, interpolate, Easing } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image as ExpoImage } from 'expo-image';
import Svg, { Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../context/ThemeContext';
import { Task } from '../../types/room';
import { API_BASE_URL } from '../../constants/config';

const { width: W } = Dimensions.get('window');

// ─── Liquid Fill ────────────────────────────────────────────────────────────

const LiquidFill = ({ progress, color, isDark }: { progress: number; color: string; isDark: boolean }) => {
  const waveOffset = useSharedValue(0);

  useEffect(() => {
    waveOffset.value = withRepeat(
      withTiming(W, { duration: 4000, easing: Easing.linear }),
      -1,
      false
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    const baseHeight = interpolate(progress, [0, 100], [0, 120]);
    return {
      height: baseHeight,
      opacity: isDark ? 0.15 : 0.25,
    };
  });

  const waveStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -waveOffset.value }],
  }));

  const wavePath = `M0 12 Q ${W / 4} 0, ${W / 2} 12 T ${W} 12 T ${W * 1.5} 12 T ${W * 2} 12 V 300 H 0 Z`;

  return (
    <Animated.View style={[s.liquidBase, animatedStyle]} pointerEvents="none">
      <Animated.View style={[{ width: W * 2, height: 300 }, waveStyle]}>
        <Svg width={W * 2} height={300}>
          <Path d={wavePath} fill={color} />
        </Svg>
      </Animated.View>
    </Animated.View>
  );
};

const getFullImageUrl = (url?: string) => {
  if (!url || url === 'undefined' || url === 'null') return undefined;
  if (url.startsWith('http') || url.startsWith('file://') || url.startsWith('data:')) return url;
  if (url.startsWith('/')) return `${API_BASE_URL}${url}`;
  return `${API_BASE_URL}/${url}`;
};

type TaskVariant = 'active' | 'completed' | 'spectating';

interface TaskCardProps {
  task: Task;
  index: number;
  onPress: () => void;
  onMenuPress?: (task: Task) => void;
  onComplete?: (task: Task) => void;
  accentColor?: string;
  variant?: TaskVariant;
}

// ─── Task Type Icon ─────────────────────────────────────────────────────────

const TASK_TYPE_ICONS: Record<string, { icon: keyof typeof Ionicons.glyphMap; gradient: [string, string] }> = {
  daily: { icon: 'flash', gradient: ['#6366f1', '#818cf8'] },
  custom: { icon: 'calendar', gradient: ['#8b5cf6', '#a78bfa'] },
  challenge: { icon: 'trophy', gradient: ['#f59e0b', '#fbbf24'] },
  habit: { icon: 'repeat', gradient: ['#06b6d4', '#22d3ee'] },
  'one-time': { icon: 'flag', gradient: ['#ec4899', '#f472b6'] },
};

// ─── Main Component ──────────────────────────────────────────────────────────

const TaskCard: React.FC<TaskCardProps> = ({
  task,
  index,
  onPress,
  onMenuPress,
  onComplete,
  accentColor,
  variant = 'active',
}) => {
  const { isDark } = useTheme();

  const config = useMemo(() => {
    switch (variant) {
      case 'completed':
        return {
          accent: '#22c55e',
          statusBarColor: '#22c55e',
          badgeLabel: 'SECURED',
          badgeBg: 'rgba(34,197,94,0.12)',
          progressColors: ['#22c55e', '#4ade80'] as [string, string],
          iconGradient: ['#22c55e', '#4ade80'] as [string, string],
          icon: 'checkmark-circle' as keyof typeof Ionicons.glyphMap,
          titleStrike: true,
          opacity: 0.85,
        };
      case 'spectating':
        return {
          accent: '#64748b',
          statusBarColor: '#64748b',
          badgeLabel: 'WATCHING',
          badgeBg: 'rgba(100,116,139,0.12)',
          progressColors: ['#94a3b8', '#64748b'] as [string, string],
          iconGradient: ['#64748b', '#94a3b8'] as [string, string],
          icon: 'eye-outline' as keyof typeof Ionicons.glyphMap,
          titleStrike: false,
          opacity: 0.85,
        };
      default: {
        const acc = accentColor || '#6366f1';
        const normalizedTaskType = task.taskType === 'weekly' ? 'daily' : (task.taskType || 'daily');
        const taskConfig = TASK_TYPE_ICONS[normalizedTaskType] || TASK_TYPE_ICONS.daily;
        return {
          accent: acc,
          statusBarColor: acc,
          badgeLabel: 'ACTIVE',
          badgeBg: 'rgba(99,102,241,0.12)',
          progressColors: [acc, '#818cf8'] as [string, string],
          iconGradient: taskConfig.gradient,
          icon: taskConfig.icon,
          titleStrike: false,
          opacity: 1,
        };
      }
    }
  }, [variant, accentColor, isDark, task.taskType]);

  const completionCount = task.completions?.length || 0;
  const participantCount = task.participants?.length || 1;
  const progressPercent = Math.min(100, Math.round((completionCount / participantCount) * 100));
  const deadlineStr = task.dueDate
    ? `${task.taskType === 'one-time' ? 'One-time' : 'Deadline'}: ${new Date(task.dueDate).toLocaleDateString()}`
    : (task.taskType === 'custom' ? 'Custom days' : 'Daily');

  const cardBg = isDark ? '#111118' : '#FFFFFF';
  const borderColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const textMain = isDark ? '#ffffff' : '#0f172a';
  const textSub = isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.35)';
  const trackBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

  return (
    <Animated.View
      entering={FadeIn.delay(index * 40).duration(300)}
      layout={Layout.springify()}
      style={{ opacity: config.opacity, marginBottom: 10 }}
    >
      <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={[s.card, { backgroundColor: cardBg, borderColor }]}>
        {/* Liquid Fill animation based on progress */}
        {progressPercent > 0 && (
          <LiquidFill progress={progressPercent} color={config.accent} isDark={isDark} />
        )}
        
        <View style={s.cardInner}>
          {/* Left Status Bar */}
          <View style={[s.statusBar, { backgroundColor: config.statusBarColor }]} />

          {/* Icon Circle */}
          <View style={s.iconWrap}>
            <LinearGradient
              colors={config.iconGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.iconCircle}
            >
              <Ionicons name={config.icon} size={22} color="#fff" />
            </LinearGradient>
          </View>

          {/* Content */}
          <View style={s.content}>
            {/* Row 1: Title + Fraction + Menu */}
            <View style={s.titleRow}>
              <View style={s.titleLeft}>
                <View style={[s.activeDot, { backgroundColor: config.accent }]} />
                <Text
                  style={[s.title, {
                    color: textMain,
                    textDecorationLine: config.titleStrike ? 'line-through' : 'none',
                  }]}
                  numberOfLines={1}
                >
                  {task.title}
                </Text>
              </View>
              <View style={s.titleRight}>
                <Ionicons name="flash" size={12} color={config.accent} />
                <Text style={[s.fraction, { color: config.accent }]}>
                  {completionCount}/{participantCount}
                </Text>
                {onComplete && (
                  <TouchableOpacity
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      onComplete(task);
                    }}
                    hitSlop={8}
                    style={s.checkBtn}
                  >
                    <Ionicons
                      name={task.isCompleted ? 'checkmark-circle' : 'ellipse-outline'}
                      size={26}
                      color={task.isCompleted ? '#22c55e' : textSub}
                    />
                  </TouchableOpacity>
                )}
                {onMenuPress && (
                  <TouchableOpacity onPress={() => onMenuPress(task)} hitSlop={10} style={s.menuBtn}>
                    <Ionicons name="ellipsis-vertical" size={16} color={textSub} />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Row 2: Badges */}
            <View style={s.badgesRow}>
              <View style={[s.badge, { backgroundColor: config.badgeBg }]}>
                <Text style={[s.badgeText, { color: config.accent }]}>{config.badgeLabel}</Text>
              </View>
              {task.hasThread && (
                <View style={[s.badge, { backgroundColor: 'rgba(99,102,241,0.12)', flexDirection: 'row', alignItems: 'center', gap: 3 }]}>
                  <Ionicons name="chatbubbles-outline" size={10} color="#6366f1" />
                  <Text style={[s.badgeText, { color: '#6366f1' }]}>THREAD</Text>
                </View>
              )}
              {deadlineStr !== '' && (
                <View style={[s.badge, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}>
                  <Text style={[s.badgeText, { color: textSub }]}>{deadlineStr}</Text>
                </View>
              )}
            </View>

            {/* Row 3: Avatars + Progress Bar + Percent */}
            <View style={s.bottomRow}>
              {/* Mini avatars */}
              <View style={s.avatarStack}>
                {task.participants?.slice(0, 3).map((p, i) => {
                  const avatarUri = getFullImageUrl(p.avatar);
                  return (
                    <View key={p.id || i} style={[s.miniAvatar, {
                      marginLeft: i > 0 ? -6 : 0,
                      borderColor: cardBg,
                      backgroundColor: isDark ? `${config.accent}25` : `${config.accent}15`,
                    }]}>
                      {avatarUri ? (
                        <ExpoImage source={{ uri: avatarUri }} style={s.miniAvatarImg} contentFit="cover" />
                      ) : (
                        <Text style={[s.avatarInitial, { color: config.accent }]}>
                          {(p.username || 'U')[0].toUpperCase()}
                        </Text>
                      )}
                    </View>
                  );
                })}
              </View>

              {/* Progress bar */}
              <View style={s.progressWrap}>
                <View style={[s.progressTrack, { backgroundColor: trackBg }]}>
                  {progressPercent > 0 && (
                    <LinearGradient
                      colors={config.progressColors}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[s.progressFill, { width: `${progressPercent}%` }]}
                    />
                  )}
                  {/* Active dot at progress position */}
                  {progressPercent > 0 && progressPercent < 100 && (
                    <View style={[s.progressDot, {
                      left: `${Math.max(2, progressPercent - 2)}%`,
                      backgroundColor: config.progressColors[1],
                      shadowColor: config.progressColors[0],
                    }]} />
                  )}
                  {/* Milestone dot at 50% */}
                  <View style={[s.milestoneDot, {
                    left: '50%',
                    backgroundColor: progressPercent >= 50 ? config.progressColors[0] : (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)'),
                  }]} />
                </View>
              </View>

              {/* Percent */}
              <Text style={[s.percentText, {
                color: progressPercent >= 100 ? '#22c55e' : progressPercent > 0 ? config.accent : textSub,
              }]}>
                {progressPercent}%
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const s = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  liquidBase: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
  },
  cardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingRight: 6,
  },
  statusBar: {
    width: 4,
    alignSelf: 'stretch',
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  iconWrap: {
    marginLeft: 8,
    marginRight: 8,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  activeDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  title: {
    fontSize: 14,
    fontWeight: '800',
    flex: 1,
    letterSpacing: -0.2,
  },
  titleRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  fraction: {
    fontSize: 13,
    fontWeight: '700',
  },
  menuBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  checkBtn: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'nowrap',
    alignSelf: 'flex-start',
  },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  miniAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  miniAvatarImg: {
    width: '100%',
    height: '100%',
    borderRadius: 11,
  },
  avatarInitial: {
    fontSize: 10,
    fontWeight: '800',
  },
  progressWrap: {
    flex: 1,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    position: 'relative',
    overflow: 'visible',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressDot: {
    position: 'absolute',
    top: -4,
    width: 12,
    height: 12,
    borderRadius: 6,
    shadowOpacity: 0.6,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
    elevation: 3,
  },
  milestoneDot: {
    position: 'absolute',
    top: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: -4,
  },
  percentText: {
    fontSize: 12,
    fontWeight: '800',
    minWidth: 30,
    textAlign: 'right',
  },
});

export default React.memo(TaskCard);
