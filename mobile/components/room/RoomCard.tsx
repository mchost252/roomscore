/**
 * RoomCard - Enhanced Card component for Room List display
 * Shows room preview with Doom Clock, member avatars, task count
 * Features: Colorful accent bars, glow effects, animated entrance
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Platform } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring,
  FadeInRight,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { EnhancedRoom } from '../../types';

interface RoomCardProps {
  room: EnhancedRoom;
  onPress: () => void;
  onLongPress?: () => void;
  isFirstEntry?: boolean;
  index?: number;
}

// Animated flip indicator
function FlipIndicator({ isFlipped }: { isFlipped: boolean }) {
  const { colors } = useTheme();
  
  const rotateY = useSharedValue(0);
  
  React.useEffect(() => {
    rotateY.value = withSpring(isFlipped ? 180 : 0, {
      damping: 15,
      stiffness: 100,
    });
  }, [isFlipped]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 1000 }, { rotateY: `${rotateY.value}deg` }],
  }));

  return (
    <Animated.View style={[styles.flipIndicator, animatedStyle]}>
      <View style={[styles.flipIcon, { backgroundColor: colors.surface }]}>
        <Ionicons 
          name={isFlipped ? 'eye' : 'eye-off'} 
          size={12} 
          color={isFlipped ? colors.primary : colors.textTertiary} 
        />
      </View>
    </Animated.View>
  );
}

// Doom Clock Mini - Shows time remaining
function DoomClockMini({ expiresAt }: { expiresAt: number }) {
  const { colors } = useTheme();
  
  const timeLeft = useMemo(() => {
    const diff = expiresAt - Date.now();
    if (diff <= 0) return { text: 'Ended', color: '#ef4444' };
    
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return { text: `${days}d ${hours % 24}h`, color: '#fbbf24' };
    if (hours > 0) return { text: `${hours}h`, color: '#f97316' };
    return { text: '<1h', color: '#ef4444' };
  }, [expiresAt]);

  return (
    <View style={[styles.doomClock, { backgroundColor: `${timeLeft.color}20` }]}>
      <Ionicons name="time-outline" size={12} color={timeLeft.color} />
      <Text style={[styles.doomText, { color: timeLeft.color }]}>
        {timeLeft.text}
      </Text>
    </View>
  );
}

// Avatar stack for members
function MemberAvatars({ memberCount }: { memberCount: number }) {
  const { colors } = useTheme();
  
  // Generate pseudo-avatars based on member count
  const avatars = Array.from({ length: Math.min(memberCount, 3) }, (_, i) => 
    `https://api.dicebear.com/7.x/avataaars/png?seed=room${i}`
  );

  return (
    <View style={styles.avatarStack}>
      {avatars.map((uri, index) => (
        <Image
          key={index}
          source={{ uri }}
          style={[
            styles.avatar,
            { marginLeft: index > 0 ? -10 : 0, zIndex: 3 - index }
          ]}
        />
      ))}
      {memberCount > 3 && (
        <View style={[styles.extraMembers, { backgroundColor: colors.surface }]}>
          <Text style={[styles.extraText, { color: colors.text }]}>
            +{memberCount - 3}
          </Text>
        </View>
      )}
    </View>
  );
}

// Premium Badge
function PremiumBadge({ isPremium }: { isPremium: boolean }) {
  if (!isPremium) return null;
  
  return (
    <LinearGradient
      colors={['#fbbf24', '#f59e0b']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.premiumBadge}
    >
      <Ionicons name="star" size={10} color="#fff" />
      <Text style={styles.premiumText}>PRO</Text>
    </LinearGradient>
  );
}

export default function RoomCard({
  room,
  onPress,
  onLongPress,
  isFirstEntry = false,
  index = 0,
}: RoomCardProps) {
  const { colors, isDark } = useTheme();

  // Calculate gradient based on room activity and premium status
  const gradientColors = useMemo(() => {
    const roomName = room.name.toLowerCase();
    let accentColors: [string, string] = ['#6366f1', '#8b5cf6']; // Default purple
    
    // Color based on room name keywords
    if (roomName.includes('work') || roomName.includes('study')) {
      accentColors = ['#3b82f6', '#06b6d4']; // Blue
    } else if (roomName.includes('fitness') || roomName.includes('workout') || roomName.includes('health')) {
      accentColors = ['#22c55e', '#10b981']; // Green
    } else if (roomName.includes('read') || roomName.includes('book')) {
      accentColors = ['#f59e0b', '#fbbf24']; // Amber
    } else if (roomName.includes('code') || roomName.includes('dev')) {
      accentColors = ['#ec4899', '#f43f5e']; // Pink
    } else if (roomName.includes('meditate') || roomName.includes('mind')) {
      accentColors = ['#8b5cf6', '#a855f7']; // Violet
    } else if (room.isPremium) {
      accentColors = ['#fbbf24', '#f59e0b']; // Gold for premium
    }
    
    return accentColors;
  }, [room.name, room.isPremium]);

  return (
    <Animated.View
      entering={isFirstEntry ? FadeInRight.delay(index * 100).springify() : undefined}
    >
      <TouchableOpacity
        onPress={onPress}
        onLongPress={onLongPress}
        activeOpacity={0.85}
      >
        {/* Accent Bar + Card Container */}
        <View style={styles.cardWrapper}>
          {/* Left Accent Gradient Bar */}
          <LinearGradient
            colors={gradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.accentBar}
          />
          
          {/* Main Card */}
          <LinearGradient
            colors={gradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[
              styles.cardGlow,
              { opacity: isDark ? 0.15 : 0.08 }
            ]}
          />
          
          <View
            style={[
              styles.card,
              {
                backgroundColor: isDark ? 'rgba(30,30,50,0.8)' : 'rgba(255,255,255,0.95)',
                borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
              },
            ]}
          >
          {/* Top Row: Room Name & Premium Badge */}
          <View style={styles.topRow}>
            <View style={styles.titleContainer}>
              <Text style={[styles.roomName, { color: colors.text }]} numberOfLines={1}>
                {room.name}
              </Text>
              <FlipIndicator isFlipped={room.isFlipped} />
            </View>
            <PremiumBadge isPremium={room.isPremium} />
          </View>

          {/* Room Code */}
          <View style={styles.codeRow}>
            <View style={[styles.codeBadge, { backgroundColor: colors.surface }]}>
              <Ionicons name="key-outline" size={12} color={colors.textSecondary} />
              <Text style={[styles.codeText, { color: colors.textSecondary }]}>
                {room.code}
              </Text>
            </View>
            <DoomClockMini expiresAt={room.expiresAt} />
          </View>

          {/* Bottom Row: Stats */}
          <View style={styles.bottomRow}>
            {/* Member Count */}
            <View style={[styles.statBadge, { backgroundColor: colors.surface }]}>
              <Ionicons name="people-outline" size={14} color={colors.primary} />
              <Text style={[styles.statText, { color: colors.text }]}>
                {room.memberCount}
              </Text>
            </View>

            {/* Task Count */}
            <View style={[styles.statBadge, { backgroundColor: colors.surface }]}>
              <Ionicons name="checkbox-outline" size={14} color="#22c55e" />
              <Text style={[styles.statText, { color: colors.text }]}>
                {room.taskCount}
              </Text>
            </View>

            {/* Member Avatars */}
            <MemberAvatars memberCount={room.memberCount} />
          </View>
        </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  cardWrapper: {
    flexDirection: 'row',
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 14,
  },
  accentBar: {
    width: 5,
    borderTopLeftRadius: 18,
    borderBottomLeftRadius: 18,
  },
  cardGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 18,
  },
  card: {
    flex: 1,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  roomName: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
  },
  flipIndicator: {
    marginLeft: 8,
  },
  flipIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 3,
  },
  premiumText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  codeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
  },
  codeText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  doomClock: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  doomText: {
    fontSize: 12,
    fontWeight: '700',
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
  },
  statText: {
    fontSize: 13,
    fontWeight: '600',
  },
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 'auto',
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#fff',
  },
  extraMembers: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -10,
    borderWidth: 2,
    borderColor: '#fff',
  },
  extraText: {
    fontSize: 10,
    fontWeight: '700',
  },
});
