import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { RoomDetail } from '../../types/room';

const { width: W } = Dimensions.get('window');

const DEFAULT_BACKDROP = require('../../assets/room_default_bg.jpg');

const primary = '#6366f1';
const accent = '#8b5cf6';
const gold = '#fbbf24';
const green = '#22c55e';

const AVATAR_GRADIENTS: [string, string][] = [
  ['#6366f1', '#8b5cf6'],
  ['#ec4899', '#f43f5e'],
  ['#06b6d4', '#3b82f6'],
  ['#f59e0b', '#ef4444'],
  ['#10b981', '#06b6d4'],
  ['#8b5cf6', '#ec4899'],
  ['#3b82f6', '#6366f1'],
  ['#f43f5e', '#f59e0b'],
];

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function getDaysLeft(endDate?: string | Date): number {
  if (!endDate) return 0;
  const end = new Date(endDate).getTime();
  const now = Date.now();
  return Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)));
}

// ─── Room Avatar ─────────────────────────────────────────
const RoomAvatar = ({ name, size = 64, isDark, imageUri }: { name: string; size?: number; isDark: boolean; imageUri?: string | null }) => {
  const gradientIndex = hashString(name) % AVATAR_GRADIENTS.length;
  const gradientColors = AVATAR_GRADIENTS[gradientIndex];
  const hasCustomImage = !!imageUri && (imageUri.startsWith('https://') || imageUri.startsWith('http://'));

  return (
    <View style={[st.avatarWrap, {
      width: size, height: size, borderRadius: size / 2,
      shadowColor: gradientColors[0],
      shadowOpacity: isDark ? 0.5 : 0.25,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 6,
    }]}> 
      {hasCustomImage ? (
        <Image
          source={{ uri: imageUri! }}
          style={[st.avatarGrad, { width: size, height: size, borderRadius: size / 2 }]}
          resizeMode="cover"
          cachePolicy="memory-disk"
        />
      ) : (
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[st.avatarGrad, { width: size, height: size, borderRadius: size / 2 }]}
        >
          <Ionicons name="infinite" size={size * 0.45} color="#fff" />
        </LinearGradient>
      )}
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
  room, isDark, user, isMember = false, index = 0, onPress, onLongPress, onJoin,
}) => {
  const isOwner = room.ownerId === user?.id;
  const memberCount = room.members?.length || (room as any).memberCount || 0;
  const maxMembers = room.maxMembers || 20;
  const isPremiumRoom = room.isPremium === true;
  const activeOps = room.tasks?.length || 0;
  const daysLeft = getDaysLeft(room.endDate);
  const [backdropError, setBackdropError] = useState(false);

  // Guard: only use coverImage if it's a valid HTTP URL (Cloudinary or other)
  // Prevents rendering of binary/base64 strings from old data
  const hasBackdrop = !backdropError && room.coverImage && (
    room.coverImage.startsWith('https://') ||
    room.coverImage.startsWith('http://')
  );

  const handleMenuPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onLongPress(room);
  };

  return (
    <View style={st.cardWrapper}>
      <Pressable
        onPress={() => onPress(room)}
        onLongPress={() => onLongPress(room)}
        delayLongPress={600}
          style={({ pressed }) => [
          st.card,
          {
            borderColor: isPremiumRoom ? `${gold}40` : isMember ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.08)',
            borderWidth: isMember ? 1.5 : 1,
            shadowColor: isPremiumRoom ? gold : primary,
            shadowOpacity: isDark ? 0.35 : 0.12,
            shadowRadius: isPremiumRoom ? 16 : 10,
            shadowOffset: { width: 0, height: 4 },
            elevation: isPremiumRoom ? 8 : 4,
            transform: [{ scale: pressed ? 0.98 : 1 }],
            opacity: pressed ? 0.92 : 1,
            
          },
        ]}
      >
        {/* ── Backdrop Image ── */}
        <Image
          source={hasBackdrop ? { uri: room.coverImage! } : DEFAULT_BACKDROP}
          style={st.backdrop}
          resizeMode="cover"
          onError={() => setBackdropError(true)}
          cachePolicy="memory-disk"
          transition={200}
        />

        {/* ── Dark Overlay ── */}
        <LinearGradient
          colors={['rgba(5,5,16,0.55)', 'rgba(5,5,16,0.85)']}
          style={st.overlay}
        />

        {/* ── Left Purple Accent Bar ── */}
        <View style={[st.accentBar, { backgroundColor: primary }]} />

        {/* ── Content ── */}
        <View style={st.content}>
          {/* Top Row: Avatar + Name + Menu */}
          <View style={st.topRow}>
            <RoomAvatar name={room.name} size={64} isDark={isDark} imageUri={room.roomDp} />

            <View style={st.nameArea}>
              <Text style={st.roomName} numberOfLines={1}>{room.name}</Text>
              <View style={st.badgesRow}>
                {isOwner && (
                  <View style={[st.badge, { backgroundColor: 'rgba(99,102,241,0.2)', borderColor: 'rgba(99,102,241,0.35)' }]}>
                    <Ionicons name="shield-checkmark" size={10} color={primary} />
                    <Text style={[st.badgeText, { color: primary }]}>OWNER</Text>
                  </View>
                )}
                <View style={[st.badge, {
                  backgroundColor: room.isPublic ? 'rgba(255,255,255,0.08)' : 'rgba(139,92,246,0.12)',
                  borderColor: room.isPublic ? 'rgba(255,255,255,0.12)' : 'rgba(139,92,246,0.25)',
                }]}>
                  <Ionicons
                    name={room.isPublic ? 'globe' : 'lock-closed'}
                    size={10}
                    color={room.isPublic ? 'rgba(255,255,255,0.6)' : accent}
                  />
                  <Text style={[st.badgeText, { color: room.isPublic ? 'rgba(255,255,255,0.6)' : accent }]}>
                    {room.isPublic ? 'Public' : 'Private'}
                  </Text>
                </View>
                {isPremiumRoom && (
                  <View style={[st.badge, { backgroundColor: `${gold}20`, borderColor: `${gold}40` }]}>
                    <Ionicons name="sparkles" size={10} color={gold} />
                    <Text style={[st.badgeText, { color: gold }]}>PREMIUM</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Three-dot menu */}
            <TouchableOpacity onPress={handleMenuPress} style={st.menuBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="ellipsis-vertical" size={18} color="rgba(255,255,255,0.5)" />
            </TouchableOpacity>
            </View>
            
            {/* Bio — only renders if room.description exists, collapses space when absent */}
            {room.description ? (
              <Text style={st.roomBio} numberOfLines={2}>{room.description}</Text>
            ) : null}

            {/* Divider */}
          <View style={st.divider} />

          {/* Stats Row */}
          <View style={st.statsRow}>
            <View style={st.statItem}>
              <Ionicons name="people" size={14} color="rgba(255,255,255,0.45)" />
              <Text style={st.statValue}>{memberCount} / {maxMembers}</Text>
              <Text style={st.statLabel}>Members</Text>
            </View>
            <View style={st.statDivider} />
            <View style={st.statItem}>
              <View style={[st.statDot, { backgroundColor: daysLeft <= 3 ? '#ef4444' : daysLeft <= 7 ? '#f59e0b' : accent }]} />
              <Text style={st.statValue}>{daysLeft}d</Text>
              <Text style={st.statLabel}>Left</Text>
            </View>
            <View style={st.statDivider} />
            <View style={st.statItem}>
              <Ionicons name="flash" size={14} color="rgba(255,255,255,0.45)" />
              <Text style={st.statValue}>{activeOps}</Text>
              <Text style={st.statLabel}>Active Ops</Text>
            </View>
          </View>
        </View>

        {/* ── Join Button Overlay for non-members ── */}
        {!isMember && room.isPublic && onJoin && (
          <TouchableOpacity
            onPress={() => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              onJoin(room);
            }}
            activeOpacity={0.8}
            style={st.joinOverlay}
          >
            <LinearGradient colors={[primary, accent]} style={st.joinBtn}>
              <Text style={st.joinBtnText}>
                {room.requireApproval ? 'REQUEST' : 'JOIN'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
      </Pressable>
    </View>
  );
};

const st = StyleSheet.create({
  cardWrapper: {
    marginBottom: 14,
    marginHorizontal: 20,
  },
  card: {
    borderRadius: 18,
    overflow: 'hidden',
  },

  // ── Backdrop ──
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },

  // ── Left accent bar ──
  accentBar: {
    position: 'absolute',
    left: 0, top: 18, height: 60,
    width: 4, borderRadius: 2,
  },

  // ── Content container ──
  content: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 0,
  },

  // ── Top row: avatar + name + menu ──
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarWrap: {
    overflow: 'hidden',
  },
  avatarGrad: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameArea: {
    flex: 1,
    gap: 6,
  },
  roomName: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  roomBio: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    lineHeight: 15,
    marginTop: 8,
    marginBottom: 6,
    opacity: 0.85,
  },
  badgesRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 0.5,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  menuBtn: {
    padding: 6,
  },

  // ── Divider ──
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginVertical: 10,
  },

  // ── Stats row ──
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingBottom: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statValue: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  statLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    fontWeight: '500',
  },
  statDivider: {
    width: 1,
    height: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  statDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },

  // ── Join overlay ──
  joinOverlay: {
    position: 'absolute',
    right: 14, bottom: 14,
  },
  joinBtn: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 12,
  },
  joinBtnText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});


