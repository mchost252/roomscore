import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  RefreshControl,
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
import { useTheme } from '../../context/ThemeContext';
import trophyService, {
  Trophy,
  TrophyRarity,
  TrophyResponse,
  RarityMeta,
  CategoryMeta,
} from '../../services/trophyService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type Filter = 'all' | 'earned' | 'locked';

const ICON_FOR_CATEGORY: Record<string, string> = {
  beginning: 'rocket-outline',
  consistency: 'pulse-outline',
  task_master: 'checkmark-done-circle-outline',
  focused: 'scan-outline',
  community: 'people-outline',
  communication: 'chatbubbles-outline',
  growth: 'trending-up-outline',
  learning: 'book-outline',
  legendary: 'trophy-outline',
};

const ICON_FOR_TROPHY: Record<string, string> = {
  'first-step': 'footsteps-outline',
  'first-win': 'star-outline',
  'first-session': 'timer-outline',
  'first-rhythm': 'musical-notes-outline',
  'getting-started': 'play-outline',
  'finding-your-way': 'compass-outline',
  'on-your-way': 'walk-outline',
  'krios-initiate': 'sparkles-outline',
  'showing-up': 'sunny-outline',
  steady: 'sunny-outline',
  'in-rhythm': 'musical-notes-outline',
  consistent: 'infinite-outline',
  'strong-rhythm': 'infinite-outline',
  dedicated: 'flame-outline',
  unshaken: 'shield-outline',
  constant: 'infinite-outline',
  'first-streak': 'flame-outline',
  'keep-going': 'flame-outline',
  'on-fire': 'flame',
  'unstoppable-streak': 'flame',
  'iron-rhythm': 'shield',
  'legendary-streak': 'bonfire-outline',
  'task-starter': 'checkmark-outline',
  'task-runner': 'checkmark-outline',
  'task-handler': 'checkmark-done-outline',
  'task-master': 'checkmark-done-circle',
  'task-crusher': 'medal-outline',
  'execution-mode': 'flash-outline',
  'task-veteran': 'medal-outline',
  'task-legend': 'trophy-outline',
  'first-room': 'enter-outline',
  'team-player': 'people-outline',
  'good-company': 'people-circle-outline',
  contributor: 'hand-left-outline',
  'reliable-one': 'shield-checkmark-outline',
  'core-member': 'ribbon-outline',
  'team-builder': 'construct-outline',
  'community-pillar': 'business-outline',
  'room-creator': 'add-circle-outline',
  'gathering-point': 'grid-outline',
  'shared-momentum': 'trending-up-outline',
  'first-connection': 'paper-plane-outline',
  'open-channel': 'chatbox-outline',
  'good-communicator': 'chatbubbles',
  'in-sync': 'sync-outline',
  'clear-signal': 'radio-outline',
  'always-in-sync': 'sync',
  connected: 'git-network-outline',
  'krios-connector': 'git-merge-outline',
  'rising-star': 'star',
  'multi-talented': 'star',
  'krios-elite': 'star',
  'krios-master': 'star',
  'complete-journey': 'flag-outline',
  'peak-performance': 'speedometer-outline',
  'unstoppable-legend': 'flame',
  'krios-legend': 'trophy',
};

const RARITY_FALLBACK: RarityMeta = {
  id: 'common',
  label: 'Common',
  color: '#38bdf8',
  glow: '#38bdf880',
};

function iconFor(trophy: Trophy): string {
  return ICON_FOR_TROPHY[trophy.id] ?? ICON_FOR_CATEGORY[trophy.category] ?? 'trophy-outline';
}

function rarityFor(rarity: RarityMeta | undefined, responseRarity: Record<TrophyRarity, RarityMeta>): RarityMeta {
  if (rarity) return rarity;
  return responseRarity?.[RARITY_FALLBACK.id] ?? RARITY_FALLBACK;
}

function progressText(t: Trophy): string {
  if (t.unlocked) return 'Unlocked';
  if (!t.criterion) return 'Coming soon';
  const c = t.criterion;
  if (typeof c.threshold === 'number' && typeof t.progress === 'number') {
    const cur = Math.floor((t.progress / 100) * c.threshold);
    return `${cur}/${c.threshold}`;
  }
  return `${t.progress ?? 0}%`;
}

export default function TrophiesScreen() {
  const router = useRouter();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<Filter>('all');

  const [data, setData] = useState<TrophyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const C = useMemo(
    () => ({
      bg: isDark ? '#050714' : '#f5f7fb',
      surface: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.85)',
      elevated: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.95)',
      border: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(15,23,42,0.08)',
      text: isDark ? '#f8fafc' : '#0f172a',
      muted: isDark ? 'rgba(226,232,240,0.62)' : 'rgba(51,65,85,0.60)',
      faint: isDark ? 'rgba(226,232,240,0.30)' : 'rgba(71,85,105,0.35)',
    }),
    [isDark],
  );

  const load = useCallback(async (force = false) => {
    try {
      if (force) setRefreshing(true);
      const payload = await trophyService.fetch(force);
      setData(payload);
      setError(null);
    } catch (err: any) {
      setError(err?.message ?? 'Could not load trophies');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load(false);
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load(false);
    }, [load]),
  );

  const grouped = data?.grouped ?? [];
  const summary = data?.summary;
  const rarityMap = data?.rarity ?? ({} as Record<TrophyRarity, RarityMeta>);

  // Only the first category is expanded by default. Seed once when the
  // grouped data first arrives; never re-seed (which would re-open the
  // first category the moment the user collapses it).
  const seededRef = useRef(false);
  useEffect(() => {
    if (!seededRef.current && grouped.length > 0) {
      seededRef.current = true;
      setExpanded(new Set([grouped[0].id]));
    }
  }, [grouped]);

  const toggleCategory = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const allTrophies: Trophy[] = useMemo(
    () => grouped.flatMap((g) => g.trophies),
    [grouped],
  );

  const earned = useMemo(() => allTrophies.filter((t) => t.unlocked), [allTrophies]);
  const locked = useMemo(() => allTrophies.filter((t) => !t.unlocked), [allTrophies]);

  const visibleGroups = useMemo(() => {
    return grouped
      .map((g) => {
        const filtered = g.trophies.filter((t) =>
          filter === 'all' ? true : filter === 'earned' ? t.unlocked : !t.unlocked,
        );
        return { ...g, trophies: filtered };
      })
      .filter((g) => g.trophies.length > 0);
  }, [grouped, filter]);

  const featured: Trophy = useMemo(() => {
    const sorted = [...earned].sort(
      (a, b) => new Date(b.unlockedAt ?? 0).getTime() - new Date(a.unlockedAt ?? 0).getTime(),
    );
    return sorted[0] ?? allTrophies[0];
  }, [earned, allTrophies]);

  const nextLocked: Trophy | undefined = useMemo(() => {
    const withProgress = locked
      .filter((t) => t.criterion)
      .sort((a, b) => (b.progress ?? 0) - (a.progress ?? 0));
    return withProgress[0];
  }, [locked]);

  if (loading && !data) {
    return (
      <View style={[styles.root, { backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ color: C.muted, fontSize: 14, fontWeight: '700' }}>Loading trophies…</Text>
      </View>
    );
  }

  if (error && !data) {
    return (
      <View style={[styles.root, { backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', padding: 24 }]}>
        <Ionicons name="cloud-offline-outline" size={42} color={C.muted} />
        <Text style={{ color: C.text, fontSize: 16, fontWeight: '800', marginTop: 12 }}>Could not load trophies</Text>
        <Text style={{ color: C.muted, fontSize: 13, textAlign: 'center', marginTop: 6 }}>{error}</Text>
        <TouchableOpacity onPress={() => load(true)} style={[styles.retryBtn, { backgroundColor: C.elevated, borderColor: C.border }]}>
          <Text style={{ color: C.text, fontWeight: '800' }}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: C.bg }]}>
      <LinearGradient
        colors={[C.bg, isDark ? '#0a0d1a' : '#e8eef8', C.bg] as [string, string, string]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0.6 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.header, { paddingTop: insets.top + 14, paddingHorizontal: 20 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color={C.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: C.text }]}>Trophies</Text>
        <View style={styles.headerCount}>
          <Text style={[styles.headerCountText, { color: C.muted }]}>
            {summary ? `${summary.unlocked}/${summary.total}` : ''}
          </Text>
        </View>
      </View>

      <View style={[styles.filterRow, { paddingHorizontal: 20, marginTop: 8 }]}>
        {([
          { key: 'all' as Filter, label: 'All' },
          { key: 'earned' as Filter, label: 'Earned' },
          { key: 'locked' as Filter, label: 'Locked' },
        ]).map((f) => (
          <TouchableOpacity
            key={f.key}
            onPress={() => setFilter(f.key)}
            style={[styles.filterPill, filter === f.key ? styles.filterPillActive : {}]}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.filterText,
                filter === f.key ? { color: '#fff', fontWeight: '900' } : { color: C.muted, fontWeight: '700' },
              ]}
            >
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 60, paddingTop: 20 }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            tintColor={isDark ? '#fff' : '#0f172a'}
          />
        }
      >
        {featured && (
          <View style={[styles.featuredWrap, { paddingHorizontal: 20 }]}>
            <FeaturedTrophyCard
              trophy={featured}
              rarity={rarityFor(rarityMap[featured.rarity], rarityMap)}
              isDark={isDark}
              C={C}
            />
          </View>
        )}

        {visibleGroups.length === 0 ? (
          <View style={{ paddingHorizontal: 20, marginTop: 40, alignItems: 'center' }}>
            <Ionicons name="lock-closed-outline" size={32} color={C.muted} />
            <Text style={{ color: C.muted, fontSize: 14, fontWeight: '700', marginTop: 10 }}>
              No trophies in this view yet.
            </Text>
          </View>
        ) : (
          visibleGroups.map((group) => (
            <CategorySection
              key={group.id}
              category={group}
              rarityMap={rarityMap}
              C={C}
              expanded={expanded.has(group.id)}
              onToggle={() => toggleCategory(group.id)}
            />
          ))
        )}

        {nextLocked && (
          <View style={[styles.nextWrap, { paddingHorizontal: 20, marginTop: 32, marginBottom: 24 }]}>
            <NextTrophyCard trophy={nextLocked} rarity={rarityFor(rarityMap[nextLocked.rarity], rarityMap)} C={C} />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function FeaturedTrophyCard({
  trophy,
  rarity,
  isDark,
  C,
}: {
  trophy: Trophy;
  rarity: RarityMeta;
  isDark: boolean;
  C: { text: string; muted: string; faint: string };
}) {
  return (
    <LinearGradient
      colors={[`${rarity.glow}`, 'rgba(255,255,255,0.02)'] as [string, string]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.featuredCard}
    >
      <View
        style={[
          styles.featuredIconWrap,
          { borderColor: rarity.color + '66', shadowColor: rarity.color, shadowOpacity: 0.35, shadowRadius: 18, shadowOffset: { width: 0, height: 12 } },
        ]}
      >
        <LinearGradient
          colors={[`${rarity.color}22`, 'rgba(0,0,0,0)'] as [string, string]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <Ionicons name={iconFor(trophy) as any} size={36} color={trophy.unlocked ? rarity.color : (C.faint ?? '#888')} />
      </View>

      <Text style={[styles.featuredTitle, { color: C.text }]}>
        {trophy.unlocked ? trophy.title : trophy.criterion ? 'Locked trophy' : 'Coming soon'}
      </Text>
      <Text style={[styles.featuredDesc, { color: C.muted }]} numberOfLines={2}>
        {trophy.unlocked ? trophy.description : trophy.criterion?.description ?? trophy.description}
      </Text>
      <View style={[styles.featuredBadge, { backgroundColor: rarity.color + '1a', borderColor: rarity.color + '33' }]}>
        <Text style={[styles.featuredBadgeText, { color: rarity.color }]}>{rarity.label}</Text>
      </View>
    </LinearGradient>
  );
}

function CategorySection({
  category,
  rarityMap,
  C,
  expanded,
  onToggle,
}: {
  category: CategoryMeta & { trophies: Trophy[] };
  rarityMap: Record<TrophyRarity, RarityMeta>;
  C: any;
  expanded: boolean;
  onToggle: () => void;
}) {
  const unlockedCount = category.trophies.filter((t) => t.unlocked).length;
  const total = category.trophies.length;
  const parentIcon = ICON_FOR_CATEGORY[category.id] ?? 'trophy-outline';
  const allUnlocked = unlockedCount === total;

  return (
    <View style={{ paddingHorizontal: 20, marginTop: 22 }}>
      <TouchableOpacity
        onPress={onToggle}
        activeOpacity={0.7}
        style={styles.sectionHeader}
      >
        <View style={[styles.sectionIcon, { backgroundColor: 'rgba(99,102,241,0.12)' }]}>
          <Ionicons name={parentIcon as any} size={16} color="#818cf8" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.sectionTitle, { color: C.text }]}>{category.title}</Text>
          <Text style={[styles.sectionSub, { color: C.muted }]}>
            {unlockedCount} of {total}{allUnlocked ? ' · complete' : ''}
          </Text>
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={C.muted}
        />
      </TouchableOpacity>
      {expanded && (
        <View style={styles.trophyGrid}>
          {category.trophies.map((trophy) => (
            <TrophyCell
              key={trophy.id}
              trophy={trophy}
              rarity={rarityFor(rarityMap[trophy.rarity], rarityMap)}
              C={C}
            />
          ))}
        </View>
      )}
    </View>
  );
}

function TrophyCell({ trophy, rarity, C }: { trophy: Trophy; rarity: RarityMeta; C: any }) {
  const locked = !trophy.unlocked;
  return (
    <View
      style={[
        styles.trophyCell,
        {
          backgroundColor: trophy.unlocked ? C.elevated : 'rgba(148,163,184,0.06)',
          borderColor: trophy.unlocked ? rarity.color + '33' : C.border,
          opacity: trophy.unlocked ? 1 : 0.65,
        },
      ]}
    >
      <LinearGradient
        colors={
          trophy.unlocked
            ? [`${rarity.color}10`, 'transparent']
            : ['rgba(148,163,184,0.08)', 'transparent']
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View
        style={[
          styles.trophyCellIcon,
          { backgroundColor: trophy.unlocked ? rarity.color + '18' : 'rgba(148,163,184,0.10)' },
        ]}
      >
        <Ionicons
          name={(trophy.unlocked ? iconFor(trophy) : 'lock-closed') as any}
          size={22}
          color={trophy.unlocked ? rarity.color : C.faint}
        />
      </View>
      <Text style={[styles.trophyCellTitle, { color: trophy.unlocked ? C.text : C.muted }]} numberOfLines={1}>
        {trophy.title}
      </Text>
      <Text style={[styles.trophyCellSubtitle, { color: C.muted }]} numberOfLines={2}>
        {trophy.description}
      </Text>
      <View style={styles.trophyCellFooter}>
        <Text style={[styles.trophyCellBadge, { color: trophy.unlocked ? rarity.color : C.faint }]}>
          {rarity.label}
        </Text>
        <Text style={[styles.trophyCellProgress, { color: C.faint }]}>{progressText(trophy)}</Text>
      </View>
      {!locked && trophy.progress < 100 ? (
        <View style={[styles.miniTrack, { backgroundColor: 'rgba(148,163,184,0.18)' }]}>
          <View
            style={[
              styles.miniFill,
              { width: `${trophy.progress}%`, backgroundColor: rarity.color },
            ]}
          />
        </View>
      ) : null}
    </View>
  );
}

function NextTrophyCard({ trophy, rarity, C }: { trophy: Trophy; rarity: RarityMeta; C: any }) {
  const pct = Math.max(0, Math.min(100, trophy.progress ?? 0));
  return (
    <LinearGradient
      colors={['rgba(139,92,246,0.15)', 'rgba(139,92,246,0.05)', 'rgba(255,255,255,0.02)'] as [string, string, string]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.nextCard}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 16 }}>
        <View style={[styles.nextIcon, { backgroundColor: 'rgba(139,92,246,0.15)', borderColor: 'rgba(139,92,246,0.25)' }]}>
          <Ionicons name={iconFor(trophy) as any} size={28} color="#8b5cf6" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.nextTitle, { color: '#8b5cf6' }]}>Next Trophy</Text>
          <Text style={[styles.nextSubtitle, { color: C.text }]}>{trophy.title}</Text>
          <Text style={[styles.nextDesc, { color: C.muted }]}>{trophy.description}</Text>
          <View style={{ marginTop: 12 }}>
            <View style={[styles.progressTrack, { backgroundColor: 'rgba(148,163,184,0.18)' }]}>
              <LinearGradient
                colors={['#8b5cf6', '#6366f1']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.progressFill, { width: `${pct}%` }]}
              />
            </View>
            <Text style={[styles.progressLabel, { color: C.muted, marginTop: 6 }]}>
              {progressText(trophy)} · {pct}%
            </Text>
          </View>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', zIndex: 10 },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.06)' },
  headerTitle: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  headerCount: { minWidth: 60, alignItems: 'flex-end' },
  headerCountText: { fontSize: 12, fontWeight: '800' },
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  filterPill: { paddingVertical: 6, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', backgroundColor: 'rgba(255,255,255,0.04)' },
  filterPillActive: { backgroundColor: '#6366f1', borderColor: '#6366f1' },
  filterText: { fontSize: 13, fontWeight: '700' },
  scrollContent: { paddingTop: 8 },
  retryBtn: { marginTop: 18, paddingVertical: 10, paddingHorizontal: 22, borderRadius: 14, borderWidth: 1 },
  featuredWrap: { marginBottom: 4 },
  featuredCard: { borderRadius: 28, padding: 28, alignItems: 'center', overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  featuredIconWrap: { width: 84, height: 84, borderRadius: 28, alignItems: 'center', justifyContent: 'center', borderWidth: 2, overflow: 'hidden', position: 'relative' },
  featuredTitle: { fontSize: 20, fontWeight: '900', marginTop: 18, textAlign: 'center' },
  featuredDesc: { fontSize: 13, fontWeight: '600', textAlign: 'center', marginTop: 6, lineHeight: 19 },
  featuredBadge: { marginTop: 16, paddingHorizontal: 14, paddingVertical: 5, borderRadius: 12, borderWidth: 1 },
  featuredBadgeText: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14, paddingVertical: 6 },
  sectionIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: '900' },
  sectionSub: { fontSize: 11, fontWeight: '700', marginTop: 2 },
  trophyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  trophyCell: { width: (SCREEN_WIDTH - 50) / 2, borderRadius: 20, borderWidth: 1, padding: 16, overflow: 'hidden' },
  trophyCellIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  trophyCellTitle: { fontSize: 14, fontWeight: '900', marginBottom: 3 },
  trophyCellSubtitle: { fontSize: 11, fontWeight: '600', lineHeight: 15, minHeight: 30 },
  trophyCellFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  trophyCellBadge: { fontSize: 9, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.6 },
  trophyCellProgress: { fontSize: 10, fontWeight: '800' },
  miniTrack: { marginTop: 8, height: 3, borderRadius: 2, overflow: 'hidden' },
  miniFill: { height: 3, borderRadius: 2 },
  nextWrap: { marginTop: 28 },
  nextCard: { borderRadius: 24, padding: 22, borderWidth: 1, borderColor: 'rgba(139,92,246,0.10)' },
  nextIcon: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  nextTitle: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.5 },
  nextSubtitle: { fontSize: 16, fontWeight: '900', marginTop: 4 },
  nextDesc: { fontSize: 12, fontWeight: '600', marginTop: 4 },
  progressTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 3 },
  progressLabel: { fontSize: 11, fontWeight: '800' },
});
