import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  LayoutAnimation,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Polyline } from 'react-native-svg';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { ActivityHeatmap } from '../../components/profile/ActivityHeatmap';
import activityService, {
  ActivityData,
  getCurrentMonthKey,
  toDailySeries,
  toHeatmapData,
} from '../../services/activityService';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-07-10" -> "Jul 10" */
const fmtDay = (iso: string | null | undefined): string => {
  if (!iso) return '';
  const [, m, d] = iso.split('-');
  return `${MONTH_NAMES[parseInt(m, 10) - 1]} ${parseInt(d, 10)}`;
};

const fmtRange = (start: string | null, end: string | null): string => {
  if (!start || !end) return 'No streak yet';
  if (start === end) return fmtDay(start);
  return `${fmtDay(start)} – ${fmtDay(end)}`;
};

/** Minimal sparkline built on react-native-svg (already a project dep). */
function Sparkline({ data, color, width = 96, height = 30 }: { data: number[]; color: string; width?: number; height?: number }) {
  const points = useMemo(() => {
    if (!data.length) return '';
    const max = Math.max(...data, 1);
    const stepX = data.length > 1 ? width / (data.length - 1) : 0;
    return data
      .map((v, i) => `${(i * stepX).toFixed(1)},${(height - 3 - (v / max) * (height - 6)).toFixed(1)}`)
      .join(' ');
  }, [data, width, height]);

  if (!points) return <View style={{ width, height }} />;

  return (
    <Svg width={width} height={height}>
      <Polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default function ActivityScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const [activity, setActivity] = useState<ActivityData | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  const C = useMemo(() => ({
    bg: isDark ? '#050714' : '#f5f7fb',
    surface: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.85)',
    elevated: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.95)',
    border: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(15,23,42,0.08)',
    text: isDark ? '#f8fafc' : '#0f172a',
    muted: isDark ? 'rgba(226,232,240,0.62)' : 'rgba(51,65,85,0.60)',
    faint: isDark ? 'rgba(226,232,240,0.30)' : 'rgba(71,85,105,0.35)',
  }), [isDark]);

  const monthKey = getCurrentMonthKey();

  const load = useCallback(async () => {
    const data = await activityService.getMyActivity(monthKey);
    if (data) {
      setActivity(data);
      return;
    }
    // Synthesized fallback (same hybrid pattern as trophies.tsx) so the screen
    // never renders blank on a fresh install with no cache and no network.
    const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    setActivity({
      month: monthKey,
      days: {},
      activeDays: 0,
      elapsedDays: new Date().getDate(),
      daysInMonth,
      consistency: 0,
      currentStreak: user?.streak || 0,
      bestStreak: { days: user?.longestStreak || 0, start: null, end: null },
      streakHistory: [],
      weekly: [1, 2, 3, 4, 5].map((i) => ({ week: `W${i}`, percent: 0 })),
      totalTasksCompleted: user?.totalTasksCompleted || 0,
    });
  }, [monthKey, user?.streak, user?.longestStreak, user?.totalTasksCompleted]);

  useEffect(() => {
    load();
  }, [load]);

  // Refetch whenever the screen gains focus so fresh completions appear.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const heatmapData = useMemo(
    () => (activity ? toHeatmapData(activity) : []),
    [activity]
  );
  const dailySeries = useMemo(
    () => (activity ? toDailySeries(activity) : []),
    [activity]
  );

  const consistency = activity?.consistency ?? 0;
  const activeDays = activity?.activeDays ?? 0;
  const currentStreak = activity?.currentStreak ?? user?.streak ?? 0;
  const bestStreak = activity?.bestStreak ?? { days: user?.longestStreak || 0, start: null, end: null };
  const weekly = activity?.weekly ?? [];

  const streakCopy = currentStreak >= 7 ? "You're on fire." : currentStreak > 0 ? 'Keep it going!' : 'Start today.';

  const toggleHistory = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setHistoryOpen((v) => !v);
  };

  return (
    <View style={[styles.root, { backgroundColor: C.bg }]}>
      <LinearGradient
        colors={[C.bg, isDark ? '#0a0d1a' : '#e8eef8', C.bg] as [string, string, string]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0.6 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 14, paddingHorizontal: 20 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color={C.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: C.text }]}>Activity</Text>
        <TouchableOpacity style={styles.headerBtn} activeOpacity={0.7} onPress={toggleHistory}>
          <Ionicons name="ellipsis-horizontal" size={20} color={C.muted} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 60, paddingTop: 16 }]}
      >
        {/* ── Heatmap card ── */}
        <View style={[styles.card, { backgroundColor: C.surface, borderColor: C.border }]}>
          <ActivityHeatmap isDark={isDark} data={heatmapData} size="large" activeDays={activeDays} />
        </View>

        {/* ── Activity summary ── */}
        <View style={[styles.card, { backgroundColor: C.surface, borderColor: C.border }]}>
          <View style={styles.cardHeaderRow}>
            <View style={[styles.iconChip, { backgroundColor: isDark ? 'rgba(139,92,246,0.18)' : 'rgba(99,102,241,0.12)' }]}>
              <Ionicons name="trending-up" size={18} color="#8b5cf6" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: C.text }]}>Activity summary</Text>
              <Text style={[styles.cardSubtitle, { color: C.muted }]}>Here's how you've been showing up.</Text>
            </View>
          </View>
          <View style={styles.statRow}>
            <View style={styles.statCell}>
              <Text style={[styles.statValue, { color: C.text }]}>{activeDays}</Text>
              <Text style={[styles.statLabel, { color: C.muted }]}>Active days</Text>
            </View>
            <View style={styles.statCell}>
              <Text style={[styles.statValue, { color: C.text }]}>{consistency}%</Text>
              <Text style={[styles.statLabel, { color: C.muted }]}>Consistency</Text>
            </View>
            <View style={styles.statCell}>
              <Text style={[styles.statValue, { color: C.text }]}>{currentStreak}d</Text>
              <Text style={[styles.statLabel, { color: C.muted }]}>Current streak</Text>
            </View>
          </View>
        </View>

        {/* ── Streaks ── */}
        <View style={[styles.card, { backgroundColor: C.surface, borderColor: C.border }]}>
          <View style={styles.cardHeaderRow}>
            <View style={[styles.iconChip, { backgroundColor: isDark ? 'rgba(245,158,11,0.16)' : 'rgba(245,158,11,0.12)' }]}>
              <Ionicons name="flame" size={18} color="#f59e0b" />
            </View>
            <Text style={[styles.cardTitle, { color: C.text, flex: 1 }]}>Streaks</Text>
            {(activity?.streakHistory?.length ?? 0) > 0 && (
              <TouchableOpacity onPress={toggleHistory} activeOpacity={0.7} style={{ paddingVertical: 6, paddingHorizontal: 8 }}>
                <Text style={styles.viewAllText}>{historyOpen ? 'Hide' : 'View all'}</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.streakGrid}>
            <View style={[styles.streakCard, { backgroundColor: C.elevated, borderColor: C.border }]}>
              <Text style={[styles.streakLabel, { color: C.muted }]}>Current streak</Text>
              <Text style={[styles.streakValue, { color: C.text }]}>{currentStreak} days</Text>
              <Text style={[styles.streakSub, { color: C.muted }]}>{streakCopy}</Text>
              <View style={styles.sparklineWrap}>
                <Sparkline data={dailySeries} color="#f59e0b" />
              </View>
            </View>
            <View style={[styles.streakCard, { backgroundColor: C.elevated, borderColor: C.border }]}>
              <Text style={[styles.streakLabel, { color: C.muted }]}>Best streak</Text>
              <Text style={[styles.streakValue, { color: C.text }]}>{bestStreak.days} days</Text>
              <Text style={[styles.streakSub, { color: C.muted }]} numberOfLines={1}>
                {fmtRange(bestStreak.start, bestStreak.end)}
              </Text>
              <View style={styles.sparklineWrap}>
                <Sparkline data={dailySeries} color="#8b5cf6" />
              </View>
            </View>
          </View>

          {/* Inline streak history (View all) */}
          {historyOpen && (activity?.streakHistory?.length ?? 0) > 0 && (
            <View style={{ marginTop: 12, gap: 8 }}>
              {activity!.streakHistory.map((run, i) => (
                <View
                  key={`${run.start}-${run.end}-${i}`}
                  style={[styles.historyRow, { backgroundColor: C.elevated, borderColor: C.border }]}
                >
                  <View style={[styles.historyRank, { backgroundColor: isDark ? 'rgba(245,158,11,0.14)' : 'rgba(245,158,11,0.10)' }]}>
                    <Text style={styles.historyRankText}>#{i + 1}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.historyDays, { color: C.text }]}>{run.days} days</Text>
                    <Text style={[styles.historyRange, { color: C.muted }]}>{fmtRange(run.start, run.end)}</Text>
                  </View>
                  <Ionicons name="flame" size={14} color={i === 0 ? '#f59e0b' : C.faint} />
                </View>
              ))}
            </View>
          )}
        </View>

        {/* ── Monthly rhythm ── */}
        <View style={[styles.card, { backgroundColor: C.surface, borderColor: C.border }]}>
          <View style={styles.cardHeaderRow}>
            <View style={[styles.iconChip, { backgroundColor: isDark ? 'rgba(99,102,241,0.18)' : 'rgba(99,102,241,0.12)' }]}>
              <Ionicons name="bar-chart" size={18} color="#6366f1" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: C.text }]}>Monthly rhythm</Text>
              <Text style={[styles.cardSubtitle, { color: C.muted }]}>Your activity by week</Text>
            </View>
          </View>

          <View style={styles.barsRow}>
            {weekly.map((bucket, index) => (
              <View key={bucket.week || index} style={styles.barColumn}>
                <Text style={[styles.barPercent, { color: C.muted }]}>{bucket.percent}%</Text>
                <View style={[styles.barTrack, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)' }]}>
                  <LinearGradient
                    colors={['#8b5cf6', '#6366f1']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                    style={[
                      styles.barFill,
                      { height: `${Math.max(bucket.percent, 4)}%` },
                      bucket.percent === 0 && { opacity: 0.2 },
                    ]}
                  />
                </View>
                <Text style={[styles.barLabel, { color: C.faint }]}>{bucket.week}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Motivational footer ── */}
        <LinearGradient
          colors={isDark ? ['rgba(139,92,246,0.35)', 'rgba(99,102,241,0.18)'] : ['rgba(139,92,246,0.18)', 'rgba(99,102,241,0.10)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.footerCard, { borderColor: isDark ? 'rgba(139,92,246,0.35)' : 'rgba(99,102,241,0.25)' }]}
        >
          <LinearGradient
            colors={['#8b5cf6', '#6366f1']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.footerIcon}
          >
            <Ionicons name="ribbon" size={20} color="#fff" />
          </LinearGradient>
          <View style={{ flex: 1 }}>
            <Text style={[styles.footerTitle, { color: C.text }]}>Consistency is your superpower.</Text>
            <Text style={[styles.footerCopy, { color: C.muted }]}>
              Small daily wins create unstoppable momentum.
            </Text>
          </View>
        </LinearGradient>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 6,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  scrollContent: {
    paddingHorizontal: 20,
    gap: 14,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  iconChip: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '900',
  },
  cardSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  statRow: {
    flexDirection: 'row',
  },
  statCell: {
    flex: 1,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 3,
    textTransform: 'capitalize',
  },
  viewAllText: {
    color: '#6366f1',
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: 0.5,
  },
  streakGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  streakCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
  },
  streakLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  streakValue: {
    fontSize: 17,
    fontWeight: '900',
    marginTop: 4,
  },
  streakSub: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  sparklineWrap: {
    marginTop: 8,
    alignItems: 'flex-start',
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  historyRank: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyRankText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#f59e0b',
  },
  historyDays: {
    fontSize: 13,
    fontWeight: '900',
  },
  historyRange: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1,
  },
  barsRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-end',
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  barPercent: {
    fontSize: 10,
    fontWeight: '800',
  },
  barTrack: {
    width: '70%',
    height: 110,
    borderRadius: 10,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    borderRadius: 10,
  },
  barLabel: {
    fontSize: 10,
    fontWeight: '800',
  },
  footerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
  },
  footerIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerTitle: {
    fontSize: 14,
    fontWeight: '900',
  },
  footerCopy: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
    lineHeight: 16,
  },
});
