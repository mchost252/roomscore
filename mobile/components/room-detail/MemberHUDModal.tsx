import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Image,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../context/ThemeContext';
import { RoomMember, Task } from '../../types/room';
import RoomService, { PendingMember } from '../../services/roomService';

const { height: H } = Dimensions.get('window');

// ── Rank colors for leaderboard ─────────────────────────────────────────────
const RANK_COLORS = ['#f59e0b', '#94a3b8', '#cd7f32'] as const; // gold, silver, bronze

interface MemberHUDModalProps {
  visible: boolean;
  onClose: () => void;
  members: RoomMember[];
  tasks: Task[];
  isOwner: boolean;
  ownerId?: string;
  roomId?: string;
  onKickMember?: (id: string) => void;
  onPromoteMember?: (id: string) => void;
}

// ── Point computation ───────────────────────────────────────────────────────
interface MemberWithPoints extends RoomMember {
  points: number;
  completedCount: number;
  rank: number;
}

export default function MemberHUDModal({
  visible,
  onClose,
  members,
  tasks,
  isOwner,
  ownerId,
  roomId,
  onKickMember,
  onPromoteMember,
}: MemberHUDModalProps) {
  const { isDark, colors } = useTheme();

  // ── Pending members state (owner only) ──────────────────────────────────
  const [pendingMembers, setPendingMembers] = useState<PendingMember[]>([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'members' | 'requests'>('members');

  // ── Compute points per member from task completions ─────────────────────
  const rankedMembers: MemberWithPoints[] = useMemo(() => {
    const pointMap = new Map<string, { points: number; completedCount: number }>();

    // Seed every member at 0
    for (const m of members) {
      const uid = m.userId || m.id;
      if (!pointMap.has(uid)) pointMap.set(uid, { points: 0, completedCount: 0 });
    }

    // Walk task completions and accumulate points
    for (const t of tasks) {
      if (!t.completions) continue;
      for (const c of t.completions) {
        if (!c.userId) continue;
        const existing = pointMap.get(c.userId) || { points: 0, completedCount: 0 };
        existing.points += t.points || 0;
        existing.completedCount += 1;
        pointMap.set(c.userId, existing);
      }
    }

    // Merge with member data and sort descending by points
    const merged = members.map(m => {
      const uid = m.userId || m.id;
      const stats = pointMap.get(uid) || { points: 0, completedCount: 0 };
      return { ...m, points: stats.points, completedCount: stats.completedCount, rank: 0 };
    });

    merged.sort((a, b) => b.points - a.points);
    merged.forEach((m, i) => { m.rank = i + 1; });

    return merged;
  }, [members, tasks]);

  // Solid opaque backgrounds
  const sheetBg = isDark ? '#0f0f1e' : '#ffffff';
  const cardBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.025)';
  const statusDotBorder = isDark ? '#0f0f1e' : '#ffffff';

  // Fetch pending members when modal opens (owner only)
  useEffect(() => {
    if (visible && isOwner && roomId) {
      fetchPending();
    }
    if (!visible) {
      setActiveTab('members');
    }
  }, [visible, isOwner, roomId]);

  const fetchPending = useCallback(async () => {
    if (!roomId) return;
    setPendingLoading(true);
    try {
      const pending = await RoomService.getPendingMembers(roomId);
      setPendingMembers(pending);
    } catch (error) {
      console.error('[MemberHUD] Failed to fetch pending:', error);
      setPendingMembers([]);
    } finally {
      setPendingLoading(false);
    }
  }, [roomId]);

  const handleApprove = useCallback(async (userId: string) => {
    if (!roomId) return;
    setActionLoading(userId);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try {
      await RoomService.approveMember(roomId, userId);
      setPendingMembers(prev => prev.filter(m => m.userId !== userId));
    } catch (error) {
      console.error('[MemberHUD] Failed to approve:', error);
    } finally {
      setActionLoading(null);
    }
  }, [roomId]);

  const handleReject = useCallback(async (userId: string) => {
    if (!roomId) return;
    setActionLoading(userId);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await RoomService.rejectMember(roomId, userId);
      setPendingMembers(prev => prev.filter(m => m.userId !== userId));
    } catch (error) {
      console.error('[MemberHUD] Failed to reject:', error);
    } finally {
      setActionLoading(null);
    }
  }, [roomId]);

  // ── Helpers ──────────────────────────────────────────────────────────────
  const getRankIcon = (rank: number) => {
    if (rank === 1) return 'trophy';
    if (rank === 2) return 'medal';
    if (rank === 3) return 'ribbon';
    return undefined;
  };

  const getRankColor = (rank: number) => {
    if (rank <= 3) return RANK_COLORS[rank - 1];
    return colors.textTertiary;
  };

  const isMemberOwner = (m: MemberWithPoints) => {
    const uid = m.userId || m.id;
    return uid === ownerId;
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      {/* Scrim */}
      <TouchableOpacity
        style={[styles.scrim, { backgroundColor: colors.overlay }]}
        activeOpacity={1}
        onPress={onClose}
      />

      {/* Bottom Sheet */}
      <View style={[styles.sheet, { backgroundColor: sheetBg }]}>
        {/* Handle bar */}
        <View style={styles.handleBar}>
          <View style={[styles.handle, { backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)' }]} />
        </View>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.title, { color: colors.text }]}>Squad</Text>
            <Text style={[styles.subtitle, { color: colors.textTertiary }]}>
              {members.length} member{members.length !== 1 ? 's' : ''}
            </Text>
          </View>
          <TouchableOpacity
            onPress={onClose}
            style={[styles.closeBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}
          >
            <Ionicons name="close" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* ── Tabs (owner sees both, members just see the list) ──────────── */}
        {isOwner && roomId && (
          <View style={[styles.tabBar, { borderBottomColor: colors.borderColor }]}>
            <TouchableOpacity
              onPress={() => setActiveTab('members')}
              style={[
                styles.tab,
                activeTab === 'members' && styles.tabActive,
                activeTab === 'members' && { borderBottomColor: colors.primary },
              ]}
            >
              <Ionicons
                name="people"
                size={15}
                color={activeTab === 'members' ? colors.primary : colors.textTertiary}
              />
              <Text
                style={[
                  styles.tabLabel,
                  { color: activeTab === 'members' ? colors.primary : colors.textTertiary },
                ]}
              >
                Members
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setActiveTab('requests')}
              style={[
                styles.tab,
                activeTab === 'requests' && styles.tabActive,
                activeTab === 'requests' && { borderBottomColor: '#f59e0b' },
              ]}
            >
              <Ionicons
                name="time"
                size={15}
                color={activeTab === 'requests' ? '#f59e0b' : colors.textTertiary}
              />
              <Text
                style={[
                  styles.tabLabel,
                  { color: activeTab === 'requests' ? '#f59e0b' : colors.textTertiary },
                ]}
              >
                Requests
              </Text>
              {pendingMembers.length > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{pendingMembers.length}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* ── Content ────────────────────────────────────────────────────── */}
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {activeTab === 'members' ? (
            /* ═══════════════════════════════════════════════════════════════
               MEMBERS LEADERBOARD
               ═══════════════════════════════════════════════════════════════ */
            <>
              {rankedMembers.map((m) => {
                const rankColor = getRankColor(m.rank);
                const rankIcon = getRankIcon(m.rank);
                const memberIsOwner = isMemberOwner(m);

                return (
                  <View
                    key={m.id}
                    style={[
                      styles.memberCard,
                      {
                        backgroundColor: cardBg,
                        borderColor: m.rank <= 3
                          ? isDark
                            ? `${rankColor}18`
                            : `${rankColor}12`
                          : 'transparent',
                      },
                    ]}
                  >
                    {/* Rank indicator */}
                    <View style={styles.rankCol}>
                      {rankIcon ? (
                        <Ionicons name={rankIcon as any} size={16} color={rankColor} />
                      ) : (
                        <Text style={[styles.rankNumber, { color: colors.textTertiary }]}>
                          {m.rank}
                        </Text>
                      )}
                    </View>

                    {/* Avatar + Online dot */}
                    <View style={styles.avatarWrap}>
                      {m.avatar ? (
                        <Image source={{ uri: m.avatar }} style={styles.avatar} />
                      ) : (
                        <View
                          style={[
                            styles.avatarFallback,
                            {
                              backgroundColor: isDark ? '#1e1b4b' : '#e0e7ff',
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.avatarInitial,
                              { color: isDark ? '#c4b5fd' : '#4f46e5' },
                            ]}
                          >
                            {m.username.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                      )}
                      <View
                        style={[
                          styles.onlineDot,
                          {
                            backgroundColor: m.isOnline ? '#22c55e' : '#64748b',
                            borderColor: statusDotBorder,
                          },
                        ]}
                      />
                    </View>

                    {/* Name + role */}
                    <View style={styles.infoCol}>
                      <View style={styles.nameRow}>
                        <Text
                          style={[styles.memberName, { color: colors.text }]}
                          numberOfLines={1}
                        >
                          {m.username}
                        </Text>
                        {memberIsOwner && (
                          <View style={[styles.ownerPill, { backgroundColor: isDark ? 'rgba(245,158,11,0.12)' : 'rgba(245,158,11,0.08)' }]}>
                            <Ionicons name="star" size={8} color="#f59e0b" />
                            <Text style={styles.ownerPillText}>Owner</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.metaText, { color: colors.textTertiary }]}>
                        {m.completedCount} task{m.completedCount !== 1 ? 's' : ''} done
                      </Text>
                    </View>

                    {/* Points */}
                    <View style={styles.pointsCol}>
                      <Text style={[styles.pointsValue, { color: m.rank <= 3 ? rankColor : colors.text }]}>
                        {m.points}
                      </Text>
                      <Text style={[styles.pointsLabel, { color: colors.textTertiary }]}>
                        pts
                      </Text>
                    </View>

                    {/* Owner actions */}
                    {isOwner && !memberIsOwner && (
                      <TouchableOpacity
                        style={styles.moreBtn}
                        onPress={() => onKickMember?.(m.id)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons
                          name="ellipsis-vertical"
                          size={14}
                          color={colors.textTertiary}
                        />
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}

              {rankedMembers.length === 0 && (
                <View style={styles.emptyState}>
                  <Ionicons name="people-outline" size={40} color={colors.textTertiary} />
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                    No members yet
                  </Text>
                </View>
              )}
            </>
          ) : (
            /* ═══════════════════════════════════════════════════════════════
               PENDING REQUESTS
               ═══════════════════════════════════════════════════════════════ */
            <>
              {pendingLoading ? (
                <View style={styles.emptyState}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                    Loading requests...
                  </Text>
                </View>
              ) : pendingMembers.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={40}
                    color={colors.textTertiary}
                  />
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                    No pending requests
                  </Text>
                  <Text style={[styles.emptyHint, { color: colors.textTertiary }]}>
                    New join requests will appear here
                  </Text>
                </View>
              ) : (
                pendingMembers.map((pm) => (
                  <View
                    key={pm.id}
                    style={[
                      styles.requestCard,
                      {
                        backgroundColor: cardBg,
                        borderColor: isDark ? 'rgba(245,158,11,0.1)' : 'rgba(245,158,11,0.06)',
                      },
                    ]}
                  >
                    {/* Avatar */}
                    <View style={styles.avatarWrap}>
                      {pm.avatar ? (
                        <Image source={{ uri: pm.avatar }} style={styles.avatar} />
                      ) : (
                        <View
                          style={[
                            styles.avatarFallback,
                            { backgroundColor: isDark ? 'rgba(245,158,11,0.15)' : 'rgba(245,158,11,0.08)' },
                          ]}
                        >
                          <Text style={[styles.avatarInitial, { color: '#f59e0b' }]}>
                            {pm.username.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                      )}
                      {/* Pending indicator dot */}
                      <View
                        style={[
                          styles.onlineDot,
                          { backgroundColor: '#f59e0b', borderColor: statusDotBorder },
                        ]}
                      />
                    </View>

                    {/* Info */}
                    <View style={styles.infoCol}>
                      <Text
                        style={[styles.memberName, { color: colors.text }]}
                        numberOfLines={1}
                      >
                        {pm.username}
                      </Text>
                      <Text style={[styles.metaText, { color: colors.textTertiary }]}>
                        {formatTimeAgo(pm.requestedAt)}
                      </Text>
                    </View>

                    {/* Actions */}
                    {actionLoading === pm.userId ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <View style={styles.requestActions}>
                        <TouchableOpacity
                          style={[styles.rejectBtn, { backgroundColor: isDark ? 'rgba(239,68,68,0.1)' : 'rgba(239,68,68,0.06)' }]}
                          onPress={() => handleReject(pm.userId)}
                        >
                          <Ionicons name="close" size={16} color="#ef4444" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.approveBtn}
                          onPress={() => handleApprove(pm.userId)}
                        >
                          <LinearGradient
                            colors={['#22c55e', '#16a34a']}
                            style={styles.approveBtnGradient}
                          >
                            <Ionicons name="checkmark" size={16} color="#fff" />
                            <Text style={styles.approveBtnText}>Accept</Text>
                          </LinearGradient>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                ))
              )}
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

// ── Utility ───────────────────────────────────────────────────────────────────
function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD === 1) return 'Yesterday';
  if (diffD < 7) return `${diffD}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: H * 0.78,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  handleBar: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 4,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },

  // ── Header ──────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 1,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Tabs ────────────────────────────────────────────────────────────────
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    gap: 4,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {},
  tabLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  badge: {
    backgroundColor: '#f59e0b',
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '900',
  },

  // ── Scroll area ─────────────────────────────────────────────────────────
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },

  // ── Member card ─────────────────────────────────────────────────────────
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
    gap: 10,
  },
  rankCol: {
    width: 22,
    alignItems: 'center',
  },
  rankNumber: {
    fontSize: 13,
    fontWeight: '800',
  },
  avatarWrap: {
    position: 'relative',
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  avatarFallback: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 15,
    fontWeight: '800',
  },
  onlineDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 2,
  },
  infoCol: {
    flex: 1,
    gap: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  memberName: {
    fontSize: 14,
    fontWeight: '700',
  },
  ownerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  ownerPillText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#f59e0b',
  },
  metaText: {
    fontSize: 11,
    fontWeight: '500',
  },
  pointsCol: {
    alignItems: 'flex-end',
    minWidth: 40,
  },
  pointsValue: {
    fontSize: 16,
    fontWeight: '900',
  },
  pointsLabel: {
    fontSize: 9,
    fontWeight: '600',
    marginTop: -1,
  },
  moreBtn: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Request card ────────────────────────────────────────────────────────
  requestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
    gap: 10,
  },
  requestActions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  rejectBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  approveBtn: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  approveBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  approveBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },

  // ── Empty state ─────────────────────────────────────────────────────────
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyHint: {
    fontSize: 12,
    fontWeight: '400',
  },
});
