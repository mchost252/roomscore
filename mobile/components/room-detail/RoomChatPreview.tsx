/**
 * RoomChatPreview — Clean Chat Preview Section (v2)
 *
 * Reference layout:
 *   Chat  [12]                    See all
 *   ┌─────────────────────────────────────┐
 *   │ [Avatar+dot]  Alex Morgan      2m   │
 *   │               Let's sync...    [1]  │
 *   │─────────────────────────────────────│
 *   │ [Avatar]      Olivia Rhye  Yesterday│
 *   │               Are you still...      │
 *   └─────────────────────────────────────┘
 */
import React, { useState, useEffect, useCallback, memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useTheme } from '../../context/ThemeContext';
import { RoomService, RoomChatMessage } from '../../services/roomService';
import { API_BASE_URL } from '../../constants/config';

const getFullImageUrl = (url?: string | null) => {
  if (!url || url === 'undefined' || url === 'null') return undefined;
  if (url.startsWith('http') || url.startsWith('file://') || url.startsWith('data:')) return url;
  if (url.startsWith('/')) return `${API_BASE_URL}${url}`;
  return `${API_BASE_URL}/${url}`;
};

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return 'now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  const d = new Date(dateStr);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return 'Today';
  const y = new Date(today);
  y.setDate(y.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

interface Props {
  roomId: string;
  onSeeAll: () => void;
}

const RoomChatPreview: React.FC<Props> = ({ roomId, onSeeAll }) => {
  const { isDark } = useTheme();
  const [messages, setMessages] = useState<RoomChatMessage[]>([]);

  useEffect(() => {
    let active = true;
    RoomService.getRoomChat(roomId, { limit: 2 })
      .then((msgs) => {
        if (active) setMessages(msgs);
      })
      .catch(() => {});
    return () => { active = false; };
  }, [roomId]);

  const handleSeeAll = useCallback(() => {
    onSeeAll();
  }, [onSeeAll]);

  const cardBg = isDark ? 'rgba(16,16,30,0.95)' : 'rgba(248,248,255,0.95)';
  const borderColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';
  const textColor = isDark ? '#f1f5f9' : '#1e293b';
  const subtextColor = isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)';

  return (
    <View style={st.wrapper}>
      {/* Section Header — same level as "Active Tasks" */}
      <View style={st.sectionHeader}>
        <View style={st.headerLeft}>
          <Text style={[st.sectionTitle, { color: textColor }]}>Chat</Text>
        </View>
        <TouchableOpacity onPress={handleSeeAll} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={st.seeAll}>See all</Text>
        </TouchableOpacity>
      </View>

      {/* Message Card */}
      <TouchableOpacity activeOpacity={0.8} onPress={handleSeeAll} style={[st.card, { backgroundColor: cardBg, borderColor }]}>
        {messages.length === 0 ? (
          <View style={st.emptyState}>
            <Text style={[st.emptyText, { color: subtextColor }]}>No messages yet. Start the conversation!</Text>
          </View>
        ) : (
          messages.slice(0, 2).map((msg, idx) => {
            const avatarUri = getFullImageUrl(msg.avatar);
            const isFirst = idx === 0;

            return (
              <View key={msg.id} style={[st.row, !isFirst && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: borderColor }]}>
                {/* Avatar */}
                <View style={st.avatarWrap}>
                  {avatarUri ? (
                    <ExpoImage source={{ uri: avatarUri }} style={st.avatar} contentFit="cover" />
                  ) : (
                    <View style={[st.avatarFallback, { backgroundColor: isDark ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.1)' }]}>
                      <Text style={st.avatarInitial}>
                        {(msg.username || '?')[0].toUpperCase()}
                      </Text>
                    </View>
                  )}
                  {isFirst && <View style={st.onlineDot} />}
                </View>

                {/* Content */}
                <View style={st.rowContent}>
                  <View style={st.nameRow}>
                    <Text style={[st.name, { color: textColor }]} numberOfLines={1}>{msg.username}</Text>
                    <Text style={[st.time, { color: subtextColor }]}>{timeAgo(msg.createdAt)}</Text>
                  </View>
                  <View style={st.messageRow}>
                    <Text
                      style={[st.message, { color: subtextColor }, msg.type === 'system' && st.systemMessage]}
                      numberOfLines={msg.type === 'system' ? undefined : 1}
                    >
                      {msg.content}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </TouchableOpacity>
    </View>
  );
};

const st = StyleSheet.create({
  wrapper: {
    marginTop: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  badge: {
    backgroundColor: '#6366f1',
    borderRadius: 10,
    minWidth: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  seeAll: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6366f1',
  },
  card: {
    marginHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  emptyState: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 12,
  },
  avatarWrap: {
    position: 'relative',
    width: 42,
    height: 42,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  avatarFallback: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: '#6366f1',
    fontSize: 16,
    fontWeight: '700',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#22c55e',
    borderWidth: 2,
    borderColor: 'rgba(16,16,30,0.95)',
  },
  rowContent: {
    flex: 1,
    gap: 3,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },
  time: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 8,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  message: {
    fontSize: 13,
    fontWeight: '400',
    flex: 1,
  },
  systemMessage: {
    fontStyle: 'italic',
  },
  unreadBadge: {
    backgroundColor: '#6366f1',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    marginLeft: 8,
  },
  unreadText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
});

export default memo(RoomChatPreview);
