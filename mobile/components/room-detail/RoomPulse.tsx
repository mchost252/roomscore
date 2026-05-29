/**
 * RoomPulse — Progress Insight Banner (v3)
 *
 * Matches reference mockup:
 *   - Sparkle icon on the left in a rounded square
 *   - "Good progress, Nuelist!" title + subtitle with highlighted %
 *   - "View Insights >" outlined button on the right
 *   - Dismissible with X button
 *   - Glass card with subtle border
 *   - Below the banner: live activity ticker (cycling through completions)
 */
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Animated, { FadeInRight, FadeOutLeft, FadeIn, FadeOut } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { Task, RoomMember } from '../../types/room';

interface PulseItem {
  id: string;
  username: string;
  message: string;
  timestamp: Date;
}

function getTimeAgo(date: Date): string {
  const diffMin = Math.floor((Date.now() - date.getTime()) / 60000);
  if (diffMin < 1) return 'now';
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  return `${Math.floor(diffHr / 24)}d`;
}

/** Derive a progress insight message from task data */
function getProgressInsight(tasks: Task[]): { title: string; subtitle: string; percent: number; positive: boolean } {
  const total = tasks.length;
  if (total === 0) {
    return { title: 'Ready to start!', subtitle: 'No tasks yet. Create one to begin.', percent: 0, positive: true };
  }

  const completed = tasks.filter(t => t.isCompleted).length;
  const percent = Math.round((completed / total) * 100);

  if (percent >= 80) {
    return { title: 'Outstanding work!', subtitle: `You're ${percent}% through today's goals.`, percent, positive: true };
  }
  if (percent >= 50) {
    return { title: 'Great momentum!', subtitle: `You're ${percent}% ahead of your daily goal.`, percent, positive: true };
  }
  if (percent >= 30) {
    return { title: 'Good progress, Nuelist!', subtitle: `You're ${percent}% ahead of your daily goal.`, percent, positive: true };
  }
  if (percent > 0) {
    return { title: 'Keep pushing!', subtitle: `You've completed ${percent}% so far today.`, percent, positive: true };
  }
  return { title: 'Time to get moving!', subtitle: `${total} task${total > 1 ? 's' : ''} waiting for you today.`, percent: 0, positive: false };
}

interface RoomPulseProps {
  tasks: Task[];
  members: RoomMember[];
  onPress?: () => void;
  onViewInsights?: () => void;
}

const RoomPulse: React.FC<RoomPulseProps> = ({ tasks, members, onViewInsights }) => {
  const { colors, isDark } = useTheme();
  const [dismissed, setDismissed] = useState(false);

  // ── Insight data ────────────────────────────────────────────────────────
  const insight = useMemo(() => getProgressInsight(tasks), [tasks]);

  // ── Live activity items ─────────────────────────────────────────────────
  const pulseItems = useMemo<PulseItem[]>(() => {
    const items: PulseItem[] = [];
    for (const task of tasks) {
      if (task.completions && task.completions.length > 0) {
        for (const c of task.completions) {
          items.push({
            id: `${task.id}_${c.userId || c.id}`,
            username: c.user?.username || 'Someone',
            message: `completed ${task.title}`,
            timestamp: c.completedAt ? new Date(c.completedAt) : new Date(),
          });
        }
      }
    }
    items.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return items.slice(0, 10);
  }, [tasks]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (pulseItems.length <= 1) return;
    intervalRef.current = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % pulseItems.length);
    }, 5000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [pulseItems.length]);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
  }, []);

  const item = pulseItems[currentIndex];

  // ── Colors ──────────────────────────────────────────────────────────────
  const cardBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.85)';
  const cardBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const textPrimary = isDark ? '#ffffff' : '#1a1a2e';
  const textSecondary = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)';
  const textMuted = isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.25)';
  const accentGreen = '#22c55e';
  const iconGradient: [string, string] = isDark ? ['#6366f1', '#8b5cf6'] : ['#e0e0ff', '#eee8ff'];
  const sparkleColor = isDark ? '#fff' : '#6366f1';

  return (
    <View style={styles.container}>
      {/* ── Progress Insight Banner ──────────────────────────────────────── */}
      {!dismissed && (
        <Animated.View
          entering={FadeIn.duration(300)}
          exiting={FadeOut.duration(200)}
          style={[styles.insightCard, { backgroundColor: cardBg, borderColor: cardBorder }]}
        >
          {/* Sparkle icon */}
          <LinearGradient
            colors={iconGradient}
            style={styles.sparkleBox}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Ionicons name="sparkles" size={20} color={sparkleColor} />
          </LinearGradient>

          {/* Text content */}
          <View style={styles.insightTextCol}>
            <Text style={[styles.insightTitle, { color: textPrimary }]}>
              {insight.title}
            </Text>
            <Text style={[styles.insightSubtitle, { color: textSecondary }]}>
              {insight.percent > 0 ? (
                <>
                  You're <Text style={{ color: accentGreen, fontWeight: '700' }}>{insight.percent}%</Text> ahead of your daily goal.
                </>
              ) : (
                insight.subtitle
              )}
            </Text>
          </View>

          {/* View Insights button */}
          <TouchableOpacity
            onPress={onViewInsights}
            style={[styles.insightsBtn, { borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)' }]}
            activeOpacity={0.7}
          >
            <Text style={[styles.insightsBtnText, { color: textSecondary }]}>View Insights</Text>
            <Ionicons name="chevron-forward" size={12} color={textSecondary} />
          </TouchableOpacity>

          {/* Dismiss X */}
          <TouchableOpacity
            onPress={handleDismiss}
            style={styles.dismissBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={16} color={textMuted} />
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* ── Live Activity Ticker ─────────────────────────────────────────── */}
      {item && (
        <Animated.View
          key={item.id}
          entering={FadeInRight.duration(250)}
          exiting={FadeOutLeft.duration(180)}
          style={styles.pulseRow}
        >
          <View style={[styles.pulseTag, { backgroundColor: colors.success + '15' }]}>
            <Ionicons name="checkmark-circle" size={10} color={colors.success} />
            <Text style={[styles.pulseLabel, { color: colors.success }]}>{getTimeAgo(item.timestamp)}</Text>
          </View>
          <Text style={[styles.pulseMessage, { color: textSecondary }]} numberOfLines={1}>
            <Text style={styles.pulseUsername}>{item.username}</Text> {item.message}
          </Text>
        </Animated.View>
      )}

      {!item && !dismissed && null}
      {!item && dismissed && (
        <View style={styles.pulseRow}>
          <View style={[styles.pulseTag, { backgroundColor: colors.primary + '15' }]}>
            <View style={[styles.pulseDot, { backgroundColor: colors.primary }]} />
            <Text style={[styles.pulseLabel, { color: colors.primary }]}>Pulse</Text>
          </View>
          <Text style={[styles.pulseMessage, { color: textMuted }]}>No recent activity</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginTop: 12,
    gap: 10,
  },

  // ── Insight Banner ──────────────────────────────────────────────────────
  insightCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 14,
    paddingLeft: 14,
    paddingRight: 32, // room for X button
    gap: 12,
  },
  sparkleBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  insightTextCol: {
    flex: 1,
    gap: 2,
  },
  insightTitle: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  insightSubtitle: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
  },
  insightsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  insightsBtnText: {
    fontSize: 11,
    fontWeight: '600',
  },
  dismissBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Live Activity Ticker ────────────────────────────────────────────────
  pulseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 24,
    paddingHorizontal: 4,
  },
  pulseTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  pulseDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  pulseLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  pulseMessage: {
    flex: 1,
    fontSize: 12,
    fontWeight: '500',
  },
  pulseUsername: {
    fontWeight: '700',
  },
});

export default React.memo(RoomPulse);
