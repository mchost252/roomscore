/**
 * TaskCard — Enhanced with Status Bar, Task Icon Circle, Liquid Fill & Glows
 * 
 * Layout (matching enhancement mockup):
 *   [Status Bar] [Task Icon Circle] [Title + Badges] [Fraction] [Menu]
 *   [Avatar Stack] [Progress Bar with dots] [Percent]
 *   Liquid fill animation preserved underneath
 */
import React, { useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Dimensions } from 'react-native';
import Animated, { 
  Layout, useSharedValue, useAnimatedStyle, 
  withRepeat, withTiming, interpolate, Easing, FadeIn
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image as ExpoImage } from 'expo-image';
import Svg, { Path, Circle } from 'react-native-svg';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { Task } from '../../types/room';
import { API_BASE_URL } from '../../constants/config';

const { width: W } = Dimensions.get('window');

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
  accentColor?: string;
  variant?: TaskVariant;
}

// ─── Liquid Fill (PRESERVED) ────────────────────────────────────────────────

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
    const baseHeight = interpolate(progress, [0, 100], [20, 140]);
    return {
      height: baseHeight,
      opacity: isDark ? 0.2 : 0.35,
    };
  });

  const waveStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -waveOffset.value }],
  }));

  const wavePath = `M0 12 Q ${W / 4} 0, ${W / 2} 12 T ${W} 12 T ${W * 1.5} 12 T ${W * 2} 12 V 300 H 0 Z`;

  return (
    <Animated.View style={[s.liquidBase, animatedStyle]}>
      <Animated.View style={[{ width: W * 2, height: 300 }, waveStyle]}>
        <Svg width={W * 2} height={300}>
          <Path d={wavePath} fill={color} />
        </Svg>
      </Animated.View>
    </Animated.View>
  );
};

// ─── Hazard Pulse (PRESERVED) ───────────────────────────────────────────────

const HazardPulse = ({ color, active }: { color: string; active: boolean }) => {
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (active) {
      pulse.value = withRepeat(withTiming(0.4, { duration: 1000 }), -1, true);
    } else {
      pulse.value = 1;
    }
  }, [active]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0.4, 1], [0.3, 0.8]),
    transform: [{ scale: interpolate(pulse.value, [0.4, 1], [0.9, 1.1]) }],
  }));

  if (!active) return null;

  return (
    <Animated.View style={[s.hazardIndicator, animatedStyle, { backgroundColor: color }]} />
  );
};

// ─── Task Type Icon ─────────────────────────────────────────────────────────

const TASK_TYPE_ICONS: Record<string, { icon: keyof typeof Ionicons.glyphMap; gradient: [string, string] }> = {
  daily: { icon: 'flash', gradient: ['#6366f1', '#818cf8'] },
  weekly: { icon: 'calendar', gradient: ['#8b5cf6', '#a78bfa'] },
  challenge: { icon: 'trophy', gradient: ['#f59e0b', '#fbbf24'] },
  habit: { icon: 'repeat', gradient: ['#06b6d4', '#22d3ee'] },
  one_time: { icon: 'flag', gradient: ['#ec4899', '#f472b6'] },
};

const TaskTypeIcon = ({ taskType, variant, accent, isDark }: {
  taskType: string;
  variant: TaskVariant;
  accent: string;
  isDark: boolean;
}) => {
  const config = TASK_TYPE_ICONS[taskType] || TASK_TYPE_ICONS.daily;

  // Override icon for completed/spectating variants
  const icon: keyof typeof Ionicons.glyphMap = variant === 'completed'
    ? 'checkmark-circle'
    : variant === 'spectating'
      ? 'eye-outline'
      : config.icon;

  const gradientColors: [string, string] = variant === 'completed'
    ? ['#22c55e', '#4ade80']
    : variant === 'spectating'
      ? ['#64748b', '#94a3b8']
      : config.gradient;

  return (
    <View style={[s.taskIconOuter, {
      shadowColor: gradientColors[0],
      shadowOpacity: isDark ? 0.5 : 0.2,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 3 },
      elevation: 6,
    }]}>
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={s.taskIconGradient}
      >
        <Ionicons name={icon} size={18} color="#fff" />
      </LinearGradient>
    </View>
  );
};

// ─── Progress Track with Node Dots ──────────────────────────────────────────

const ProgressTrack = ({ percent, colors: progressColors, isDark }: {
  percent: number;
  colors: [string, string];
  isDark: boolean;
}) => {
  const trackBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';

  return (
    <View style={s.progressContainer}>
      <View style={[s.progressTrack, { backgroundColor: trackBg }]}>
        <LinearGradient
          colors={progressColors as any}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[s.progressFill, { width: `${percent}%` }]}
        />
        {/* Progress node dots */}
        {percent > 0 && percent < 100 && (
          <View style={[s.progressDot, {
            left: `${Math.max(2, percent - 2)}%`,
            backgroundColor: progressColors[1],
            shadowColor: progressColors[0],
            shadowOpacity: isDark ? 0.8 : 0.4,
            shadowRadius: 4,
          }]} />
        )}
        {/* Start dot */}
        <View style={[s.progressEndDot, {
          left: 0,
          backgroundColor: percent > 0 ? progressColors[0] : trackBg,
        }]} />
        {/* Mid dot */}
        <View style={[s.progressEndDot, {
          left: '50%',
          backgroundColor: percent >= 50 ? progressColors[0] : (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'),
        }]} />
      </View>
      <Text style={[s.progressPct, {
        color: percent >= 100
          ? '#22c55e'
          : percent > 0
            ? progressColors[0]
            : (isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.25)'),
      }]}>
        {percent}%
      </Text>
    </View>
  );
};

// ─── Main Component ──────────────────────────────────────────────────────────

const TaskCard: React.FC<TaskCardProps> = ({
  task,
  index,
  onPress,
  onMenuPress,
  accentColor,
  variant = 'active',
}) => {
  const { colors, isDark } = useTheme();

  const variantConfig = useMemo(() => {
    switch (variant) {
      case 'completed':
        return {
          accent: '#22c55e',
          cardOpacity: 0.85,
          titleStrike: true,
          progressColors: ['#22c55e', '#4ade80'] as [string, string],
          badgeLabel: 'SECURED',
          badgeBg: isDark ? 'rgba(34,197,94,0.12)' : 'rgba(34,197,94,0.08)',
          statusBarColor: '#f59e0b',
          glowBorder: isDark ? 'rgba(245,158,11,0.2)' : 'rgba(245,158,11,0.12)',
        };
      case 'spectating':
        return {
          accent: accentColor || '#64748b',
          cardOpacity: 0.85,
          titleStrike: false,
          progressColors: ['#94a3b8', '#64748b'] as [string, string],
          badgeLabel: 'WATCHING',
          badgeBg: isDark ? 'rgba(100,116,139,0.12)' : 'rgba(100,116,139,0.08)',
          statusBarColor: '#64748b',
          glowBorder: isDark ? 'rgba(100,116,139,0.15)' : 'rgba(100,116,139,0.08)',
        };
      default:
        return {
          accent: accentColor || '#6366f1',
          cardOpacity: 1,
          titleStrike: false,
          progressColors: [accentColor || '#6366f1', '#818cf8'] as [string, string],
          badgeLabel: 'ACTIVE',
          badgeBg: isDark ? 'rgba(99,102,241,0.12)' : 'rgba(99,102,241,0.08)',
          statusBarColor: '#22c55e',
          glowBorder: isDark ? 'rgba(99,102,241,0.25)' : 'rgba(99,102,241,0.12)',
        };
    }
  }, [variant, accentColor, isDark]);

  const completionCount = task.completions?.length || 0;
  const participantCount = task.participants?.length || 1;
  const progressPercent = Math.min(100, Math.round((completionCount / participantCount) * 100));
  const deadlineStr = task.dueDate ? `Deadline: ${task.dueDate}` : (task.taskType === 'daily' ? 'Daily Ops' : '');

  const cardBg = isDark ? '#111118' : '#FFFFFF';
  const borderColor = variantConfig.glowBorder;
  const textMain = isDark ? '#ffffff' : '#0f172a';
  const textSub = isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.4)';

  return (
    <Animated.View
      entering={FadeIn.delay(index * 40).duration(300)}
      layout={Layout.springify()}
      style={{ opacity: variantConfig.cardOpacity, marginBottom: 12 }}
    >
      <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={[s.card, {
        backgroundColor: cardBg,
        borderColor,
        shadowColor: variantConfig.accent,
        shadowOpacity: isDark ? 0.15 : 0.06,
        shadowRadius: 12,
      }]}>
        {/* Liquid fill (PRESERVED) */}
        {progressPercent > 0 && (
          <LiquidFill progress={progressPercent} color={variantConfig.accent} isDark={isDark} />
        )}

        {/* Subtle gradient overlay */}
        <LinearGradient
          colors={[
            isDark ? `${variantConfig.accent}08` : `${variantConfig.accent}04`,
            'transparent',
          ]}
          style={[StyleSheet.absoluteFill, { borderRadius: 16 }]}
        />

        <View style={s.cardRow}>
          {/* ── Left Status Bar ── */}
          <View style={[s.statusBar, { backgroundColor: variantConfig.statusBarColor }]} />

          {/* ── Task Type Icon ── */}
          <TaskTypeIcon
            taskType={task.taskType || 'daily'}
            variant={variant}
            accent={variantConfig.accent}
            isDark={isDark}
          />

          {/* ── Content ── */}
          <View style={s.contentArea}>
            {/* Title row */}
            <View style={s.titleRow}>
              <View style={s.titleLeft}>
                <HazardPulse
                  color={variantConfig.accent}
                  active={variant === 'active' && progressPercent < 100}
                />
                <Text
                  style={[s.title, {
                    color: textMain,
                    textDecorationLine: variantConfig.titleStrike ? 'line-through' : 'none',
                  }]}
                  numberOfLines={1}
                >
                  {task.title}
                </Text>
                {task.taskType === 'daily' && (
                  <Ionicons name="flash" size={12} color={variantConfig.accent} style={{ opacity: 0.6 }} />
                )}
              </View>

              <View style={s.titleRight}>
                <Text style={[s.fraction, {
                  color: progressPercent >= 100 ? '#22c55e' : variantConfig.accent,
                }]}>
                  {completionCount}/{participantCount}
                </Text>
                {onMenuPress && (
                  <TouchableOpacity onPress={() => onMenuPress(task)} hitSlop={10} style={s.menuBtn}>
                    <Ionicons name="ellipsis-vertical" size={16} color={textSub} />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Badges row */}
            <View style={s.badgesRow}>
              <View style={[s.statusBadge, { backgroundColor: variantConfig.badgeBg }]}>
                <Text style={[s.statusText, { color: variantConfig.accent }]}>
                  {variantConfig.badgeLabel}
                </Text>
              </View>
              {deadlineStr !== '' && (
                <View style={[s.deadlineBadge, {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                }]}>
                  <Text style={[s.deadlineText, { color: textSub }]}>{deadlineStr}</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* ── Bottom: Avatars + Progress ── */}
        <View style={s.bottomSection}>
          {/* Avatar stack */}
          <View style={s.avatarStack}>
            {task.participants?.slice(0, 3).map((p, i) => {
              const avatarUri = getFullImageUrl(p.avatar);
              return (
                <View key={p.id || i} style={[s.miniAvatar, {
                  marginLeft: i > 0 ? -8 : 0,
                  borderColor: cardBg,
                  backgroundColor: isDark ? `${variantConfig.accent}20` : `${variantConfig.accent}15`,
                }]}>
                  {avatarUri ? (
                    <ExpoImage source={{ uri: avatarUri }} style={s.miniAvatarImg} contentFit="cover" />
                  ) : (
                    <Text style={[s.avatarText, { color: variantConfig.accent }]}>
                      {(p.username || 'U')[0].toUpperCase()}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>

          {/* Progress track */}
          <ProgressTrack
            percent={progressPercent}
            colors={variantConfig.progressColors}
            isDark={isDark}
          />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    elevation: 3,
    shadowOffset: { width: 0, height: 3 },
  },
  liquidBase: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
  },

  // ── Main row: status bar + icon + content ──
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 14,
    paddingRight: 14,
    paddingLeft: 0,
    gap: 10,
  },

  // ── Status bar ──
  statusBar: {
    width: 4,
    alignSelf: 'stretch',
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
    minHeight: 50,
  },

  // ── Task icon ──
  taskIconOuter: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  taskIconGradient: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Content area ──
  contentArea: {
    flex: 1,
    gap: 6,
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
    gap: 5,
  },
  titleRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  hazardIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    shadowRadius: 4,
    shadowColor: '#fff',
    shadowOpacity: 0.5,
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    flex: 1,
    letterSpacing: -0.2,
  },
  fraction: {
    fontSize: 14,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  menuBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Badges ──
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 5,
  },
  statusText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  deadlineBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 5,
  },
  deadlineText: {
    fontSize: 9,
    fontWeight: '700',
  },

  // ── Bottom section ──
  bottomSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingLeft: 58, // aligned with content (4 status + 40 icon + 10 gap + 4 pad)
    paddingBottom: 14,
    paddingTop: 6,
  },
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  miniAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  miniAvatarImg: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  avatarText: {
    fontSize: 9,
    fontWeight: '900',
  },

  // ── Progress track ──
  progressContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    overflow: 'visible',
    position: 'relative',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressDot: {
    position: 'absolute',
    top: -3,
    width: 10,
    height: 10,
    borderRadius: 5,
    elevation: 2,
    shadowOffset: { width: 0, height: 0 },
  },
  progressEndDot: {
    position: 'absolute',
    top: -1.5,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginLeft: -3.5,
  },
  progressPct: {
    fontSize: 11,
    fontWeight: '800',
    minWidth: 32,
    textAlign: 'right',
  },
});

export default React.memo(TaskCard);
