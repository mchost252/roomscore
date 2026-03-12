import React, { memo, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  Animated, PanResponder, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { LocalConversation } from '../../services/sqliteService';

const { width: SW } = Dimensions.get('window');
const DELETE_THRESHOLD = -80;
const ACCENT_COLOR = '#6366f1';
const VIOLET_ACCENT = '#8b5cf6';

interface ConversationCardProps {
  conversation: LocalConversation;
  isDark: boolean;
  onPress: () => void;
  onDelete?: () => void;
}

function formatRelativeTime(ts: number): string {
  if (!ts) return '';
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function getInitials(name: string): string {
  return name.charAt(0).toUpperCase();
}

function ConversationCard({ conversation, isDark, onPress, onDelete }: ConversationCardProps) {
  const hasUnread = conversation.unread_count > 0;
  const isOnline = conversation.is_online === 1;
  const isPendingSent = conversation.request_status === 'pending_sent';
  const isPendingReceived = conversation.request_status === 'pending_received';
  const isPending = isPendingSent || isPendingReceived;

  // Swipe-to-delete
  const translateX = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > 12 && Math.abs(gs.dy) < 12,
      onPanResponderMove: (_, gs) => {
        if (gs.dx < 0) translateX.setValue(Math.max(gs.dx, -120));
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dx < DELETE_THRESHOLD) {
          Animated.spring(translateX, { 
            toValue: -90, useNativeDriver: true, 
            tension: 180, friction: 18 
          }).start();
        } else {
          Animated.spring(translateX, { 
            toValue: 0, useNativeDriver: true, 
            tension: 180, friction: 18 
          }).start();
        }
      },
    })
  ).current;

  const closeSwipe = useCallback(() => {
    Animated.spring(translateX, { 
      toValue: 0, useNativeDriver: true, 
      tension: 180, friction: 18 
    }).start();
  }, [translateX]);

  const triggerDelete = useCallback(() => {
    closeSwipe();
    onDelete?.();
  }, [closeSwipe, onDelete]);

  const textColor = isDark ? '#f1f5f9' : '#1e293b';
  const subtextColor = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)';
  const divider = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';

  // Delete action opacity — only visible when swiped
  const deleteOpacity = translateX.interpolate({
    inputRange: [-90, -20, 0],
    outputRange: [1, 0.5, 0],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.swipeContainer}>
      {/* Delete action — hidden until swiped */}
      <Animated.View style={[styles.deleteAction, { opacity: deleteOpacity, zIndex: 1 }]}>
        <TouchableOpacity
          onPress={triggerDelete}
          style={styles.deleteBtn}
          activeOpacity={0.8}
        >
          <Ionicons name="trash-outline" size={20} color="#fff" />
        </TouchableOpacity>
      </Animated.View>

      {/* Main card */}
      <Animated.View
        style={[styles.cardOuter, { transform: [{ translateX }], zIndex: 2 }]}
        {...panResponder.panHandlers}
      >
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => { closeSwipe(); onPress(); }}
          style={[styles.card, { borderBottomColor: divider }]}
        >
          {/* Avatar */}
          <View style={styles.avatarWrap}>
            {conversation.avatar ? (
              <Image source={{ uri: conversation.avatar }} style={styles.avatar} />
            ) : (
              <LinearGradient
                colors={isPending ? [VIOLET_ACCENT, '#a78bfa'] as any : [ACCENT_COLOR, VIOLET_ACCENT] as any}
                style={styles.avatar}
              >
                <Text style={styles.initials}>{getInitials(conversation.username)}</Text>
              </LinearGradient>
            )}
            {isOnline && !isPending && (
              <View style={[styles.onlineRing, { borderColor: isDark ? '#080810' : '#f8f9ff' }]}>
                <View style={styles.onlineDot} />
              </View>
            )}
          </View>

          {/* Content */}
          <View style={styles.contentCol}>
            <View style={styles.topRow}>
              <Text
                style={[
                  styles.username,
                  { color: textColor },
                  hasUnread && styles.usernameUnread,
                ]}
                numberOfLines={1}
              >
                {conversation.username}
              </Text>
              <Text
                style={[
                  styles.time,
                  { color: hasUnread ? ACCENT_COLOR : subtextColor },
                ]}
              >
                {formatRelativeTime(conversation.last_message_at)}
              </Text>
            </View>

            <View style={styles.bottomRow}>
              {isPendingSent && (
                <View style={styles.pendingRow}>
                  <Ionicons name="time-outline" size={13} color={VIOLET_ACCENT} />
                  <Text style={[styles.preview, { color: VIOLET_ACCENT }]} numberOfLines={1}>
                    Request sent
                  </Text>
                </View>
              )}
              {isPendingReceived && (
                <View style={styles.pendingRow}>
                  <View style={[styles.requestDot, { backgroundColor: VIOLET_ACCENT }]} />
                  <Text style={[styles.preview, { color: VIOLET_ACCENT, fontWeight: '600' }]} numberOfLines={1}>
                    Message request
                  </Text>
                </View>
              )}
              {!isPending && (
                <Text
                  style={[
                    styles.preview,
                    {
                      color: hasUnread
                        ? isDark ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.7)'
                        : subtextColor,
                    },
                    hasUnread && styles.previewUnread,
                  ]}
                  numberOfLines={1}
                >
                  {conversation.last_message || 'Start a conversation'}
                </Text>
              )}

              {hasUnread && !isPending && (
                <View style={styles.badge}>
                  <LinearGradient colors={[ACCENT_COLOR, VIOLET_ACCENT] as any} style={styles.badgeGrad}>
                    <Text style={styles.badgeText}>
                      {conversation.unread_count > 99 ? '99+' : conversation.unread_count}
                    </Text>
                  </LinearGradient>
                </View>
              )}
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

export default memo(ConversationCard);

const styles = StyleSheet.create({
  swipeContainer: {
    position: 'relative',
    overflow: 'hidden',
  },
  deleteAction: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 90,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ef4444',
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
  },
  deleteBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  cardOuter: {
    backgroundColor: 'transparent',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatarWrap: {
    position: 'relative',
    marginRight: 14,
  },
  avatar: {
    width: 52, height: 52, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center',
  },
  initials: {
    color: '#fff',
    fontSize: 20, fontWeight: '700',
    letterSpacing: -0.5,
  },
  onlineRing: {
    position: 'absolute',
    right: -1, bottom: -1,
    width: 16, height: 16, borderRadius: 8,
    borderWidth: 2.5,
    alignItems: 'center', justifyContent: 'center',
  },
  onlineDot: {
    width: 9, height: 9, borderRadius: 4.5,
    backgroundColor: '#22c55e',
  },
  contentCol: {
    flex: 1,
    justifyContent: 'center',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  username: {
    fontSize: 16.5,
    fontWeight: '600',
    letterSpacing: -0.3,
    flex: 1,
    marginRight: 8,
  },
  usernameUnread: {
    fontWeight: '700',
  },
  time: {
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.1,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  preview: {
    fontSize: 14,
    flex: 1,
    marginRight: 8,
  },
  previewUnread: {
    fontWeight: '600',
  },
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  requestDot: {
    width: 7, height: 7, borderRadius: 3.5,
  },
  badge: {
    borderRadius: 11,
    overflow: 'hidden',
  },
  badgeGrad: {
    minWidth: 22, height: 22, borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: 'center', justifyContent: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
