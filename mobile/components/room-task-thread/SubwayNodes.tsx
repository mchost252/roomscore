/**
 * SubwayNodes — The visual building blocks of the RoomTaskThread
 * 
 * 1. HeroBriefNode: Highly compact row with title, points, and deadline
 * 2. PinWallNode: Horizontal scroll of approved images (or user's own uploads)
 * 3. ProofNode: Compact image card (h:150) with Vouch/Auto-Approve mechanics
 * 4. ChatNode: Smaller text bubble offset to the right
 * 
 * Supports Light & Dark modes seamlessly.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInRight, ZoomIn } from 'react-native-reanimated';
import FastProofImage from './FastProofImage';
import { RoomTaskNode } from '../../types/room';
import { useTheme } from '../../context/ThemeContext';

// ─── Shared Theme Colors ─────────────────────────────────────────────────────
const SUBWAY_COLOR = '#8b5cf6'; // Neon Violet default
const APPROVED_COLOR = '#22d3ee'; // Neon Cyan

// ─── Helper: 11 PM Auto-Approve Check ───────────────────────────────────────
export function checkIsAutoApproved(createdAt: string): boolean {
  if (!createdAt) return false;
  const createdDate = new Date(createdAt);
  const now = new Date();
  
  if (
    now.getDate() === createdDate.getDate() &&
    now.getMonth() === createdDate.getMonth() &&
    now.getFullYear() === createdDate.getFullYear() &&
    now.getHours() >= 23
  ) {
    return true;
  }
  
  if (now.getTime() > createdDate.getTime() && now.getDate() !== createdDate.getDate()) {
    return true;
  }
  
  return false;
}

// ─── Subway Line Column Wrapper ─────────────────────────────────────────────
interface TrackProps {
  children: React.ReactNode;
  isLast?: boolean;
  dotColor?: string;
  lineColor?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  isDark: boolean;
  alignRight?: boolean; // When user's own content, move line to right
}

const SubwayTrack: React.FC<TrackProps> = ({ 
  children, 
  isLast = false, 
  dotColor = SUBWAY_COLOR,
  lineColor = SUBWAY_COLOR,
  icon,
  isDark,
  alignRight = false,
}) => {
  return (
    <View style={[styles.trackRow, alignRight && { flexDirection: 'row-reverse' }]}>
      <View style={[styles.trackCol]}>
        <View style={[styles.trackLine, { backgroundColor: lineColor, bottom: isLast ? '50%' : 0 }]} />
        <View style={[styles.trackDot, { borderColor: dotColor, backgroundColor: isDark ? '#0a0a16' : '#ffffff' }]}>
          {icon ? <Ionicons name={icon as any} size={10} color={dotColor} style={styles.trackIcon} /> : null}
        </View>
      </View>
      <View style={[styles.trackContent, alignRight && { alignItems: 'flex-end', paddingLeft: 0, paddingRight: 12 }]}>
        {children}
      </View>
    </View>
  );
};

// ─── 1. Hero Brief Node (Compact Sticky Version) ──────────────────────────────
export const HeroBriefNode: React.FC<{
  title: string;
  description: string;
  points: number;
  dueDate?: string;
  taskType?: string;
}> = ({ title, description, points, dueDate, taskType }) => {
  const { isDark } = useTheme();
  
  return (
    <Animated.View entering={FadeIn.duration(300)} style={[styles.heroCard, { 
      backgroundColor: isDark ? 'rgba(99,102,241,0.08)' : 'rgba(99,102,241,0.04)',
      borderColor: isDark ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.1)'
    }]}>
      <View style={styles.heroRow}>
        <View style={styles.heroLeft}>
          <Text style={[styles.heroTitle, { color: isDark ? '#fff' : '#0f172a' }]} numberOfLines={1}>{title}</Text>
          <Text style={[styles.heroDesc, { color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(15,23,42,0.6)' }]} numberOfLines={1}>{description || 'Impact goal & mission spec'}</Text>
        </View>

        <View style={styles.heroRight}>
          <View style={styles.pointsBadge}>
            <Text style={styles.pointsText}>{points} PTS</Text>
          </View>
          {dueDate ? (
            <View style={styles.deadlineRow}>
              <Ionicons name="time-outline" size={10} color="#f59e0b" />
              <Text style={styles.deadlineText}>{dueDate}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Animated.View>
  );
};

// ─── 2. Pin Wall Node (Compact Sticky Version) ───────────────────────────────
export const PinWallNode: React.FC<{
  proofs: RoomTaskNode[];
  onDateChangePress: () => void;
}> = ({ proofs, onDateChangePress }) => {
  const { colors, isDark } = useTheme();
  
  if (!proofs || proofs.length === 0) return null;

  return (
    <Animated.View entering={FadeInRight.duration(400)} style={[styles.pinWallContainer, {
      backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
      borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'
    }]}>
      <View style={styles.pinWallHeader}>
        <Text style={[styles.pinWallTitle, { color: colors.textSecondary }]}>PIN WALL</Text>
        <View style={styles.pinWallHeaderRight}>
          <TouchableOpacity style={[styles.filterBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }]} onPress={onDateChangePress}>
            <Ionicons name="calendar-outline" size={12} color={colors.primary} />
            <Text style={[styles.filterBtnText, { color: colors.primary }]}>Filter</Text>
          </TouchableOpacity>
          <Ionicons name="pin" size={14} color={colors.primary} style={{ marginLeft: 8 }} />
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pinWallScroll}>
        {proofs.map((proof, i) => (
          <Animated.View key={proof.id} entering={ZoomIn.delay(i * 100).springify()}>
            <View style={styles.pinFrame}>
              <FastProofImage 
                mediaUrl={proof.mediaUrl!} 
                blurHash={proof.blurHash} 
                width={56} 
                height={56} 
                borderRadius={6} 
                isGhostApproved={proof.status === 'GHOST_APPROVED'} 
              />
            </View>
          </Animated.View>
        ))}
      </ScrollView>
    </Animated.View>
  );
};

// ─── 3. Proof Node (Compact Card) ─────────────────────────────────────────────
export const ProofNode: React.FC<{
  node: RoomTaskNode & { isGroupStart?: boolean };
  currentUserId: string;
  isOwner?: boolean;
  onVouch: (nodeId: string) => void;
  onApprove?: (nodeId: string) => void;
  isLast?: boolean;
}> = ({ node, currentUserId, isOwner, onVouch, onApprove, isLast }) => {
  const { isDark } = useTheme();
  const [timeLeft, setTimeLeft] = useState<string>('');
  
  const isApproved = node.status === 'GHOST_APPROVED' || checkIsAutoApproved(node.createdAt) || (node.vouchCount || 0) >= 3;
  const isVouchedByMe = node.isVouchedByMe || false;
  const isMyProof = node.userId === currentUserId || node.user?.id === currentUserId;
  const showHeader = node.isGroupStart !== false;

  useEffect(() => {
    if (isApproved) return;
    const interval = setInterval(() => {
      const diff = new Date(node.createdAt).getTime() + (4 * 60 * 60 * 1000) - Date.now();
      if (diff <= 0) {
        setTimeLeft('Expired');
        clearInterval(interval);
      } else {
        setTimeLeft(`${Math.floor(diff / 3600000)}h ${Math.floor((diff % 3600000) / 60000)}m`);
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [node.createdAt, isApproved]);

  const lineColor = isApproved ? APPROVED_COLOR : SUBWAY_COLOR;
  const cardBorderColor = isApproved ? (isDark ? 'rgba(34,211,238,0.3)' : 'rgba(34,211,238,0.5)') : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)');
  const bgColor = isDark ? '#151522' : '#ffffff';

  return (
    <SubwayTrack isLast={isLast} dotColor={lineColor} lineColor={lineColor} icon={isApproved ? "shield-checkmark" : "time"} isDark={isDark} alignRight={isMyProof}>
      <Animated.View entering={FadeIn.duration(400)} style={[
        styles.proofCard, 
        { 
          borderColor: cardBorderColor, 
          backgroundColor: bgColor,
          alignSelf: isMyProof ? 'flex-end' : 'flex-start',
          marginTop: showHeader ? 4 : 2,
        }
      ]}>
        
        {showHeader && (
          <View style={styles.proofHeader}>
            <View style={styles.proofUser}>
              <View style={[styles.avatarMock, { 
                backgroundColor: isMyProof 
                  ? (isDark ? 'rgba(139,92,246,0.2)' : 'rgba(139,92,246,0.1)') 
                  : (isDark ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.1)')
              }]}>
                <Text style={[styles.avatarInitial, isMyProof && { color: '#c4b5fd' }]}>{isMyProof ? 'M' : (node.user?.username?.charAt(0) || 'U')}</Text>
              </View>
              <View>
                <Text style={[styles.proofUsername, { color: isMyProof ? '#a5b4fc' : (isDark ? '#fff' : '#0f172a') }]}>
                  {isMyProof ? 'Me' : (node.user?.username || 'User')}
                </Text>
                <Text style={[styles.proofTime, { color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(15,23,42,0.4)' }]}>
                  {new Date(node.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </Text>
              </View>
            </View>

            {isApproved ? (
              <View style={styles.approvedTag}>
                <Ionicons name="shield-checkmark" size={10} color="#000" />
                <Text style={styles.approvedTagText}>
                  {node.vouchCount > 0 ? `Ghost Approved • ${node.vouchCount} Vouches` : 'Ghost Approved'}
                </Text>
              </View>
            ) : (
              <View style={styles.pendingTag}>
                <Ionicons name="time-outline" size={10} color="#f59e0b" />
                <Text style={styles.pendingTagText}>
                  {timeLeft || '4h 0m'}{node.vouchCount > 0 ? ` • ${node.vouchCount} Vouches` : ''}
                </Text>
              </View>
            )}
          </View>
        )}

        {node.content ? <Text style={[styles.proofText, { color: isDark ? 'rgba(255,255,255,0.9)' : 'rgba(15,23,42,0.9)' }]}>{node.content}</Text> : null}
        {node.mediaUrl ? (
          <View style={{ marginTop: 8 }}>
            <FastProofImage mediaUrl={node.mediaUrl} blurHash={node.blurHash} height={150} borderRadius={8} isGhostApproved={isApproved} />
          </View>
        ) : null}

        {!isApproved ? (
          <View style={[styles.vouchRow, { borderTopColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }]}>
            <Text style={[styles.vouchCount, { color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(15,23,42,0.5)' }]}>
              {node.vouchCount} / 3 Vouches
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {isOwner && onApprove ? (
                <TouchableOpacity 
                  style={[styles.vouchBtn, { backgroundColor: 'rgba(34,211,238,0.1)', borderWidth: 1, borderColor: 'rgba(34,211,238,0.3)' }]} 
                  onPress={() => onApprove(node.id)}
                >
                  <Ionicons name="checkmark-done" size={12} color="#22d3ee" />
                  <Text style={[styles.vouchBtnText, { color: '#22d3ee' }]}>Approve</Text>
                </TouchableOpacity>
              ) : null}
              {!isMyProof ? (
                <TouchableOpacity 
                  style={[styles.vouchBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }, isVouchedByMe && styles.vouchedBtn]} 
                  onPress={() => onVouch(node.id)}
                  disabled={isVouchedByMe}
                >
                  <Ionicons name="flame" size={12} color={isVouchedByMe ? "#f59e0b" : (isDark ? "#fff" : "#0f172a")} />
                  <Text style={[styles.vouchBtnText, { color: isDark ? '#fff' : '#0f172a' }, isVouchedByMe && { color: '#f59e0b' }]}>
                    {isVouchedByMe ? 'Vouched' : '+1 Vouch'}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        ) : null}
      </Animated.View>
    </SubwayTrack>
  );
};

// ─── 4. Chat Node ─────────────────────────────────────────────────────────────
export const ChatNode: React.FC<{
  node: RoomTaskNode & { isGroupStart?: boolean };
  isLast?: boolean;
  currentUserId?: string;
}> = ({ node, isLast, currentUserId }) => {
  const { isDark } = useTheme();
  const isMyMessage = node.userId === currentUserId || node.user?.id === currentUserId;
  const showHeader = node.isGroupStart !== false;
  
  return (
    <SubwayTrack isLast={isLast} dotColor={isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.15)"} isDark={isDark} alignRight={isMyMessage}>
      <Animated.View entering={FadeIn.duration(300)} style={[styles.chatCard, {
        backgroundColor: isMyMessage 
          ? (isDark ? 'rgba(139,92,246,0.15)' : 'rgba(139,92,246,0.1)')
          : (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'),
        alignSelf: isMyMessage ? 'flex-end' : 'flex-start',
        borderColor: isMyMessage ? 'rgba(139,92,246,0.3)' : 'transparent',
        borderWidth: isMyMessage ? 1 : 0,
        borderTopRightRadius: (isMyMessage && showHeader) ? 4 : 12,
        borderTopLeftRadius: (!isMyMessage && showHeader) ? 4 : 12,
        marginTop: showHeader ? 4 : 2,
      }]}>
        {showHeader && (
          <View style={styles.chatHeader}>
            <Text style={[styles.chatUsername, { color: isMyMessage ? '#a5b4fc' : (isDark ? '#fff' : '#0f172a') }]}>
              {isMyMessage ? 'Me' : (node.user?.username || 'User')}
            </Text>
            <Text style={[styles.chatTime, { color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(15,23,42,0.3)' }]}>
              {new Date(node.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
            </Text>
          </View>
        )}
        <Text style={[styles.chatText, { color: isDark ? 'rgba(255,255,255,0.85)' : 'rgba(15,23,42,0.85)' }]}>{node.content}</Text>
      </Animated.View>
    </SubwayTrack>
  );
};

// ─── Date Divider Node ────────────────────────────────────────────────────────
export const DateDividerNode: React.FC<{ dateLabel: string }> = ({ dateLabel }) => {
  const { isDark } = useTheme();
  const lineCol = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  
  return (
    <View style={styles.dateDividerRow}>
      <View style={[styles.dateDividerLine, { backgroundColor: lineCol }]} />
      <View style={[styles.dateDividerBadge, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }]}>
        <Text style={[styles.dateDividerText, { color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(15,23,42,0.5)' }]}>{dateLabel}</Text>
      </View>
      <View style={[styles.dateDividerLine, { backgroundColor: lineCol }]} />
    </View>
  );
};

const styles = StyleSheet.create({
  // Subway Line
  trackRow: { flexDirection: 'row', marginBottom: 12 },
  trackCol: { width: 36, alignItems: 'center', position: 'relative' },
  trackLine: { position: 'absolute', top: 0, bottom: -12, width: 2, opacity: 0.6 },
  trackDot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginTop: 12, zIndex: 2 },
  trackIcon: { marginTop: 0 },
  trackContent: { flex: 1, paddingRight: 16 },

  // Hero Brief (Compact)
  heroCard: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, marginHorizontal: 16, marginBottom: 8 },
  heroRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroLeft: { flex: 1, paddingRight: 12 },
  heroRight: { alignItems: 'flex-end', gap: 4 },
  heroTitle: { fontSize: 13, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 2 },
  heroDesc: { fontSize: 11, fontWeight: '500' },
  pointsBadge: { backgroundColor: '#f59e0b', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  pointsText: { fontSize: 9, fontWeight: '800', color: '#000' },
  deadlineRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  deadlineText: { fontSize: 9, color: '#f59e0b', fontWeight: '700' },

  // Pin Wall (Compact)
  pinWallContainer: { borderRadius: 8, padding: 8, paddingBottom: 10, marginHorizontal: 16, marginBottom: 12, borderWidth: 1 },
  pinWallHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, paddingHorizontal: 4 },
  pinWallTitle: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  pinWallHeaderRight: { flexDirection: 'row', alignItems: 'center' },
  filterBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  filterBtnText: { fontSize: 10, fontWeight: '700' },
  pinWallScroll: { gap: 8, paddingHorizontal: 4 },
  pinFrame: { width: 56, height: 56, borderRadius: 6, backgroundColor: 'rgba(0,0,0,0.2)' },

  // Proof Node
  proofCard: { borderRadius: 12, borderWidth: 1, padding: 14, marginTop: 4, maxWidth: '95%' },
  proofHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, gap: 12 },
  proofUser: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  avatarMock: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 12, fontWeight: '700', color: '#a5b4fc' },
  proofUsername: { fontSize: 13, fontWeight: '700' },
  proofTime: { fontSize: 9, marginTop: 1 },
  approvedTag: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: APPROVED_COLOR, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4, flexShrink: 0 },
  approvedTagText: { fontSize: 9, fontWeight: '800', color: '#000' },
  pendingTag: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(245,158,11,0.1)', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4, borderWidth: 1, borderColor: 'rgba(245,158,11,0.3)', flexShrink: 0 },
  pendingTagText: { fontSize: 9, fontWeight: '700', color: '#f59e0b' },
  proofText: { fontSize: 13, lineHeight: 18, marginBottom: 4 },
  vouchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  vouchCount: { fontSize: 11, fontWeight: '600' },
  vouchBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
  vouchedBtn: { backgroundColor: 'rgba(245,158,11,0.15)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.3)' },
  vouchBtnText: { fontSize: 11, fontWeight: '700' },

  // Chat Node
  chatCard: { borderRadius: 12, padding: 12, marginTop: 4, maxWidth: '95%' },
  chatHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
  chatUsername: { fontSize: 11, fontWeight: '700', color: '#a5b4fc' },
  chatTime: { fontSize: 9 },
  chatText: { fontSize: 13, lineHeight: 18 },

  // Proof Node - user own proof gets max width
  proofCardOwn: { maxWidth: '75%' },

  // Date Divider
  dateDividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 12, paddingRight: 16 },
  dateDividerLine: { flex: 1, height: StyleSheet.hairlineWidth },
  dateDividerBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8, marginHorizontal: 10 },
  dateDividerText: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
});
