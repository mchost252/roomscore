import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Svg, Circle, Path } from 'react-native-svg';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { RoomDetail } from '../../types/room';

const { width: W } = Dimensions.get('window');

// ─── Constants ───────────────────────────────────────────
const primary = '#6366f1';
const accent = '#8b5cf6';
const cyan = '#06b6d4';
const gold = '#fbbf24';
const green = '#22c55e';

// ─── Avatar gradient palettes ────────────────────────────
const AVATAR_GRADIENTS: [string, string][] = [
  ['#6366f1', '#8b5cf6'],  // indigo-purple
  ['#ec4899', '#f43f5e'],  // pink-rose
  ['#06b6d4', '#3b82f6'],  // cyan-blue
  ['#f59e0b', '#ef4444'],  // amber-red
  ['#10b981', '#06b6d4'],  // emerald-cyan
  ['#8b5cf6', '#ec4899'],  // purple-pink
  ['#3b82f6', '#6366f1'],  // blue-indigo
  ['#f43f5e', '#f59e0b'],  // rose-amber
];

// ─── Helpers ─────────────────────────────────────────────
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function getCapacityStatus(memberCount: number, maxMembers: number) {
  const ratio = memberCount / maxMembers;
  if (ratio >= 1) return { color: '#ef4444', label: 'FULL', glowColor: 'rgba(239,68,68,0.3)' };
  if (ratio >= 0.85) return { color: '#f59e0b', label: 'ALMOST FULL', glowColor: 'rgba(245,158,11,0.3)' };
  return { color: green, label: 'ACTIVE', glowColor: 'rgba(34,197,94,0.3)' };
}

// ─── Room Avatar ─────────────────────────────────────────
const RoomAvatar = ({ name, size = 56, isDark }: { name: string; size?: number; isDark: boolean }) => {
  const gradientIndex = hashString(name) % AVATAR_GRADIENTS.length;
  const gradientColors = AVATAR_GRADIENTS[gradientIndex];
  const initials = getInitials(name);

  return (
    <View style={[styles.avatarContainer, {
      width: size,
      height: size,
      borderRadius: size / 2,
      shadowColor: gradientColors[0],
      shadowOpacity: isDark ? 0.5 : 0.25,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 6,
    }]}>
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.avatarGradient, {
          width: size,
          height: size,
          borderRadius: size / 2,
        }]}
      >
        <Text style={[styles.avatarText, { fontSize: size * 0.36 }]}>{initials}</Text>
      </LinearGradient>
    </View>
  );
};

// ─── Capacity Ring (Doom Clock) ──────────────────────────
const CapacityRing = ({
  endDate,
  memberCount,
  maxMembers,
  isDark,
  size = 48,
}: {
  endDate?: string | Date;
  memberCount: number;
  maxMembers: number;
  isDark: boolean;
  size?: number;
}) => {
  const radius = (size - 4) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  // Doom clock days
  let daysLeft = 0;
  let hasDoomClock = false;
  if (endDate) {
    const end = new Date(endDate);
    const now = new Date();
    const diff = end.getTime() - now.getTime();
    daysLeft = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
    hasDoomClock = true;
  }

  // Ring color based on days or capacity
  const ringColor = hasDoomClock
    ? daysLeft <= 3 ? '#ef4444' : daysLeft <= 7 ? '#f59e0b' : primary
    : getCapacityStatus(memberCount, maxMembers).color;

  // Progress: days-based if doom clock, capacity-based otherwise
  const progress = hasDoomClock
    ? Math.min(1, daysLeft / 30)
    : Math.min(1, memberCount / maxMembers);

  const strokeDashoffset = circumference * (1 - progress);
  const trackColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

  const displayText = hasDoomClock ? `${daysLeft}d` : `${memberCount}`;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Track */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={3}
        />
        {/* Progress arc */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={ringColor}
          strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray={`${circumference}`}
          strokeDashoffset={strokeDashoffset}
          transform={`rotate(-90 ${center} ${center})`}
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={[styles.ringText, { color: ringColor, fontSize: size * 0.3 }]}>
          {displayText}
        </Text>
      </View>
    </View>
  );
};

// ─── Main RoomCard ───────────────────────────────────────
interface RoomCardProps {
  room: RoomDetail;
  isDark: boolean;
  user: any;
  isMember?: boolean;
  index?: number;
  onPress: (room: RoomDetail) => void;
  onLongPress: (room: RoomDetail) => void;
  onJoin?: (room: RoomDetail) => void;
}

export const RoomCard: React.FC<RoomCardProps> = ({
  room,
  isDark,
  user,
  isMember = false,
  index = 0,
  onPress,
  onLongPress,
  onJoin,
}) => {
  const isOwner = room.ownerId === user?.id;
  const memberCount = room.members?.length || (room as any).memberCount || 0;
  const maxMembers = room.maxMembers || 20;
  const isPremiumRoom = room.isPremium === true;
  const activeOps = room.tasks?.length || 0;

  const text = isDark ? '#ffffff' : '#0f172a';
  const textSub = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(15,23,42,0.55)';
  const textTert = isDark ? 'rgba(255,255,255,0.28)' : 'rgba(15,23,42,0.28)';
  const borderColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const dividerColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';

  const capacityStatus = useMemo(() => getCapacityStatus(memberCount, maxMembers), [memberCount, maxMembers]);

  // Card background & border based on state
  const cardBg = isDark ? '#111118' : '#ffffff';
  const cardBorder = isPremiumRoom
    ? `${gold}40`
    : isMember
      ? isDark ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.12)'
      : borderColor;

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 80).duration(400).springify().damping(18)}
      style={styles.cardWrapper}
    >
      <Pressable
        onPress={() => onPress(room)}
        onLongPress={() => onLongPress(room)}
        delayLongPress={600}
        style={({ pressed }) => [
          styles.card,
          {
            backgroundColor: cardBg,
            borderColor: cardBorder,
            borderWidth: isPremiumRoom ? 1.5 : 1,
            shadowColor: isPremiumRoom ? gold : isMember ? primary : '#000',
            shadowOpacity: isDark ? (isPremiumRoom ? 0.4 : 0.3) : (isPremiumRoom ? 0.15 : 0.08),
            shadowRadius: isPremiumRoom ? 16 : 8,
            shadowOffset: { width: 0, height: 4 },
            elevation: isPremiumRoom ? 8 : 3,
            transform: [{ scale: pressed ? 0.975 : 1 }],
            opacity: pressed ? 0.95 : 1,
          },
        ]}
      >
        {/* Subtle top gradient overlay */}
        <LinearGradient
          colors={isPremiumRoom
            ? [isDark ? 'rgba(251,191,36,0.1)' : 'rgba(251,191,36,0.05)', 'transparent']
            : [isDark ? 'rgba(99,102,241,0.06)' : 'rgba(99,102,241,0.03)', 'transparent']
          }
          style={[StyleSheet.absoluteFill, { borderRadius: 18 }]}
        />

        <View style={styles.cardRow}>
          {/* ── Left: Status Bar ── */}
          <View style={[styles.statusBar, { backgroundColor: capacityStatus.color }]} />

          {/* ── Avatar ── */}
          <RoomAvatar name={room.name} size={46} isDark={isDark} />

          {/* ── Content ── */}
          <View style={styles.contentArea}>
            {/* Title */}
            <Text style={[styles.cardTitle, { color: text }]} numberOfLines={1}>
              {room.name}
            </Text>

            {/* Badges */}
            <View style={styles.badgesRow}>
              {isOwner && (
                <View style={[styles.badge, {
                  backgroundColor: isDark ? `${primary}20` : `${primary}12`,
                  borderColor: `${primary}30`,
                  borderWidth: 0.5,
                }]}>
                  <Text style={[styles.badgeText, { color: primary }]}>COMMANDER</Text>
                </View>
              )}
              <View style={[styles.badge, {
                backgroundColor: room.isPublic
                  ? (isDark ? `${cyan}15` : `${cyan}10`)
                  : (isDark ? `${accent}15` : `${accent}10`),
                borderColor: room.isPublic ? `${cyan}25` : `${accent}25`,
                borderWidth: 0.5,
              }]}>
                <Ionicons
                  name={room.isPublic ? 'globe' : 'shield-checkmark'}
                  size={9}
                  color={room.isPublic ? cyan : accent}
                />
                <Text style={[styles.badgeText, { color: room.isPublic ? cyan : accent }]}>
                  {room.isPublic ? 'PUBLIC OPS' : 'PRIVATE SEC'}
                </Text>
              </View>
              {isPremiumRoom && (
                <LinearGradient colors={[gold, '#f59e0b']} style={styles.premiumBadge}>
                  <Ionicons name="sparkles" size={8} color="#000" />
                  <Text style={styles.premiumBadgeText}>PRO</Text>
                </LinearGradient>
              )}
            </View>

            {/* Description */}
            {room.description ? (
              <Text style={[styles.description, { color: textSub }]} numberOfLines={1}>
                {room.description}
              </Text>
            ) : null}
          </View>

          {/* ── Right: Capacity Ring ── */}
          {isMember && (
            <CapacityRing
              endDate={(room as any).endDate}
              memberCount={memberCount}
              maxMembers={maxMembers}
              isDark={isDark}
              size={48}
            />
          )}
        </View>

        {/* ── Divider ── */}
        <View style={[styles.divider, { backgroundColor: dividerColor }]} />

        {/* ── Footer ── */}
        <View style={styles.footer}>
          <View style={styles.footerStats}>
            {/* Member count */}
            <View style={[styles.statChip, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}>
              <Ionicons name="people" size={12} color={capacityStatus.color} />
              <Text style={[styles.statText, {
                color: capacityStatus.color === green ? textSub : capacityStatus.color,
              }]}>
                {memberCount} / {maxMembers}
              </Text>
            </View>

            {/* Active ops */}
            {activeOps > 0 && (
              <View style={[styles.statChip, { backgroundColor: isDark ? `${cyan}12` : `${cyan}08` }]}>
                <View style={[styles.liveDot, { backgroundColor: cyan }]} />
                <Text style={[styles.statText, { color: cyan }]}>
                  {activeOps} ACTIVE OPS
                </Text>
              </View>
            )}

            {/* Full indicator */}
            {capacityStatus.label === 'FULL' && (
              <View style={[styles.statChip, { backgroundColor: isDark ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.08)' }]}>
                <Ionicons name="warning" size={10} color="#ef4444" />
                <Text style={[styles.statText, { color: '#ef4444' }]}>FULL</Text>
              </View>
            )}
          </View>

          {/* Right side: connected status or join button */}
          {isMember && (
            <View style={styles.connectedIndicator}>
              <Ionicons name="wifi" size={12} color={green} />
              <Text style={[styles.connectedText, { color: green }]}>CONNECTED</Text>
            </View>
          )}

          {!isMember && room.isPublic && onJoin && (
            <TouchableOpacity
              onPress={() => {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                onJoin(room);
              }}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={[primary, accent]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.joinButton}
              >
                <Text style={styles.joinButtonText}>
                  {room.requireApproval ? 'REQUEST' : 'JOIN'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
};

// ─── Styles ──────────────────────────────────────────────
const styles = StyleSheet.create({
  cardWrapper: {
    marginBottom: 14,
    marginHorizontal: 20,
  },
  card: {
    borderRadius: 18,
    overflow: 'hidden',
  },

  // ── Main row: status bar + avatar + content + ring ──
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 10,
    paddingRight: 16,
    paddingLeft: 0,
    gap: 12,
  },

  // ── Status bar ──
  statusBar: {
    width: 4,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
    alignSelf: 'stretch',
    marginRight: 0,
  },

  // ── Avatar ──
  avatarContainer: {
    overflow: 'hidden',
  },
  avatarGradient: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#ffffff',
    fontWeight: '800',
    letterSpacing: 1,
  },

  // ── Content area ──
  contentArea: {
    flex: 1,
    gap: 4,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  badgesRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  premiumBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#000',
  },
  description: {
    fontSize: 12,
    lineHeight: 15,
    marginTop: 2,
  },

  // ── Capacity ring ──
  ringText: {
    fontWeight: '900',
    letterSpacing: -0.5,
  },

  // ── Divider ──
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 16,
    marginTop: 8,
  },

  // ── Footer ──
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  footerStats: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    flex: 1,
  },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  statText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  // ── Connected indicator ──
  connectedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  connectedText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  // ── Join button ──
  joinButton: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 12,
  },
  joinButtonText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
