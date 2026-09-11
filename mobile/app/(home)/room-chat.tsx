/**
 * Room Chat — Expanded room chat screen with ChatBubble, reactions, light mode.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  StatusBar, KeyboardAvoidingView, Platform, Keyboard,
} from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { RoomService, RoomChatMessage } from '../../services/roomService';
import syncEngine from '../../services/syncEngine';
import MessageInput from '../../components/messaging/MessageInput';
import ChatBubble from '../../components/messaging/ChatBubble';
import SwipeableRow from '../../components/messaging/SwipeableRow';
import { LocalDirectMessage } from '../../services/sqliteService';
import { Reaction } from '../../components/messaging/MessageRow';

const ACCENT = '#7c3aed';
const ACCENT_LIGHT = '#a78bfa';
const roomChatCache = new Map<string, RoomChatMessage[]>();

function mapToDirectMessage(msg: RoomChatMessage): LocalDirectMessage {
  return {
    id: msg.id,
    local_id: msg.id,
    from_user_id: msg.userId || '',
    to_user_id: '',
    content: msg.content,
    status: 'sent' as const,
    reply_to_id: msg.replyToId || null,
    reply_to_text: msg.replyToText || null,
    created_at: new Date(msg.createdAt).getTime(),
    synced: 1,
  };
}

function mergeMessages(current: RoomChatMessage[], incoming: RoomChatMessage[]) {
  const byId = new Map(current.map(message => [message.id, message]));
  incoming.forEach(message => byId.set(message.id, { ...byId.get(message.id), ...message }));
  return Array.from(byId.values()).sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

export default function RoomChatScreen() {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { roomId, roomName } = useLocalSearchParams<{ roomId: string; roomName: string }>();

  const [messages, setMessages] = useState<RoomChatMessage[]>(() => roomChatCache.get(roomId) || []);
  const [reactions, setReactions] = useState<Record<string, Reaction[]>>({});
  const [replyTo, setReplyTo] = useState<{ id: string; text: string; username?: string } | null>(null);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const listRef = useRef<FlashList<RoomChatMessage>>(null);
  const atEndRef = useRef(true);

  // WhatsApp-style pinning: when the keyboard opens while already at the
  // bottom, stay pinned to the latest message instead of being covered.
  useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidShow', () => {
      if (atEndRef.current) {
        requestAnimationFrame(() => {
          try { listRef.current?.scrollToEnd({ animated: true }); } catch {}
        });
      }
    });
    return () => sub.remove();
  }, []);

  const myId = user?.id || '';

  const BG = isDark ? '#050510' : '#f8f9fc';
  const HEADER_BG = isDark ? 'rgba(5,5,16,0.95)' : 'rgba(248,249,252,0.95)';
  const INPUT_BG = isDark ? '#050510' : '#f8f9fc';
  const TEXT_PRIMARY = isDark ? '#e2d9f3' : '#1e293b';
  const TEXT_SECONDARY = isDark ? 'rgba(167,139,250,0.5)' : 'rgba(100,100,120,0.6)';
  const DIVIDER_COLOR = isDark ? 'rgba(124,58,237,0.25)' : 'rgba(124,58,237,0.15)';

  useEffect(() => {
    if (!roomId) return;
    let active = true;
    RoomService.getRoomChat(roomId, { limit: 50 })
      .then((msgs) => {
        if (active) {
          const hydrated: Record<string, Reaction[]> = {};
          for (const message of msgs) {
            const grouped = new Map<string, Reaction>();
            for (const reaction of message.reactions || []) {
              const current = grouped.get(reaction.emoji);
              grouped.set(reaction.emoji, {
                emoji: reaction.emoji,
                count: (current?.count || 0) + 1,
                reacted: current?.reacted || reaction.userId === myId,
              });
            }
            if (grouped.size) hydrated[message.id] = [...grouped.values()];
          }
          setReactions(hydrated);
          setMessages(prev => {
            const next = mergeMessages(prev, msgs);
            roomChatCache.set(roomId, next);
            return next;
          });
          setLoading(false);
        }
      })
      .catch(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [roomId]);

  useEffect(() => {
    if (!roomId) return;

    const handleMessage = (data: any) => {
      const msg = data?.message;
      if (!msg || msg.roomId !== roomId) return;
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg._id || m.id === msg.id)) return prev;
        const mapped: RoomChatMessage = {
          id: msg._id || msg.id,
          roomId: msg.roomId,
          userId: typeof msg.userId === 'object' ? msg.userId?._id : msg.userId,
          username: msg.userId?.username ?? msg.username ?? 'Member',
          avatar: msg.userId?.avatar ?? msg.avatar ?? null,
          content: msg.content ?? '',
          type: msg.type || 'user',
          replyToId: msg.replyToId,
          replyToText: msg.replyToText,
          createdAt: msg.createdAt || new Date().toISOString(),
        };
        const next = mergeMessages(prev, [mapped]);
        roomChatCache.set(roomId, next);
        return next;
      });
    };

    const handleReaction = (data: any) => {
      const messageId = data?.messageId || data?.message_id;
      const emoji = data?.emoji;
      if (!messageId || !emoji) return;
      setReactions(prev => {
        const current = [...(prev[messageId] || [])];
        const index = current.findIndex(reaction => reaction.emoji === emoji);
        const action = data?.action === 'remove' || data?.action === 'removed' ? 'remove' : 'add';
        if (action === 'remove') {
          if (index >= 0) {
            const nextCount = current[index].count - 1;
            nextCount > 0 ? current.splice(index, 1, { ...current[index], count: nextCount }) : current.splice(index, 1);
          }
        } else if (index >= 0) {
          current[index] = { ...current[index], count: current[index].count + 1 };
        } else {
          current.push({ emoji, count: 1, reacted: data?.userId === myId });
        }
        return { ...prev, [messageId]: current };
      });
    };

    // Attach resiliently: on first mount the socket may still be connecting,
    // and bailing out then meant live messages never arrived until re-enter.
    let disposed = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let detach: (() => void) | undefined;
    const attach = () => {
      if (disposed) return;
      syncEngine.joinRoom(roomId);
      const s = syncEngine.getSocket();
      if (s?.connected) {
        s.on('chat:message', handleMessage);
        s.on('chat:reaction', handleReaction);
        s.on('room:chat:reaction', handleReaction);
        detach = () => {
          s.off('chat:message', handleMessage);
          s.off('chat:reaction', handleReaction);
          s.off('room:chat:reaction', handleReaction);
        };
      } else {
        retry = setTimeout(attach, 1000);
      }
    };
    attach();
    return () => {
      disposed = true;
      if (retry) clearTimeout(retry);
      detach?.();
      syncEngine.leaveRoom(roomId);
    };
  }, [roomId]);

  const handleReply = useCallback((msg: RoomChatMessage) => {
    setReplyTo({
      id: msg.id,
      text: msg.content,
      username: msg.userId === myId ? 'You' : (msg.username || 'Member'),
    });
  }, [myId]);

  const handleSend = useCallback(async () => {
    const content = text.trim();
    if (!content || !roomId) return;
    setText('');
    const outgoingReply = replyTo;
    setReplyTo(null);
    try {
      const sent = await RoomService.sendRoomChat(
        roomId,
        content,
        outgoingReply ? { id: outgoingReply.id, text: outgoingReply.text } : undefined,
      );
      setMessages(prev => {
        const next = mergeMessages(prev, [sent]);
        roomChatCache.set(roomId, next);
        return next;
      });
    } catch (error) {
      console.error('[RoomChat] Failed to send message:', error);
    }
  }, [text, roomId, replyTo]);

  const handleInputChange = useCallback((value: string) => {
    setText(value);
  }, []);

  const handleReaction = useCallback((messageId: string, emoji: string) => {
    const existing = reactions[messageId] || [];
    const current = existing.find((reaction) => reaction.emoji === emoji);
    const action = current?.reacted ? 'remove' : 'add';
    syncEngine.emit('chat:reaction', { roomId, messageId, emoji, action });
    setReactions((prev) => {
      const existing = prev[messageId] || [];
      const idx = existing.findIndex((r) => r.emoji === emoji);
      let updated: Reaction[];
      if (idx >= 0) {
        const r = existing[idx];
        if (r.reacted) {
          if (r.count <= 1) {
            updated = existing.filter((_, i) => i !== idx);
          } else {
            updated = existing.map((x, i) => i === idx ? { ...x, count: x.count - 1, reacted: false } : x);
          }
        } else {
          updated = existing.map((x, i) => i === idx ? { ...x, count: x.count + 1, reacted: true } : x);
        }
      } else {
        updated = [...existing, { emoji, count: 1, reacted: true }];
      }
      return { ...prev, [messageId]: updated };
    });
  }, []);

  const renderMessage = useCallback(({ item, index }: { item: RoomChatMessage; index: number }) => {
    const isMine = item.userId === myId;
    const isSystem = item.type === 'system';

    if (isSystem) {
      return (
        <View style={[styles.systemWrap, { backgroundColor: BG }]}>
          <Text style={[styles.systemText, { color: TEXT_SECONDARY }]}>{item.content}</Text>
        </View>
      );
    }

    // WhatsApp-style grouping: consecutive messages from the same sender form
    // one visual group — name once at the top, avatar once at the bottom.
    const prev = messages[index - 1];
    const next = messages[index + 1];
    const sameAsPrev = !!prev && prev.type !== 'system' && prev.userId === item.userId;
    const sameAsNext = !!next && next.type !== 'system' && next.userId === item.userId;
    const showName = !isMine && !sameAsPrev;
    const showAvatar = !isMine && !sameAsNext;

    const dmMsg = mapToDirectMessage(item);
    const msgReactions: Reaction[] = reactions[item.id] || [];

    return (
      <View style={[styles.msgRow, { marginTop: sameAsPrev ? 2 : 10 }]}>
        {!isMine && (
          showAvatar ? (
            <View style={styles.avatarCol}>
              {item.avatar ? (
                <Image source={{ uri: item.avatar }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Text style={styles.avatarText}>{(item.username || '?')[0].toUpperCase()}</Text>
                </View>
              )}
            </View>
          ) : <View style={styles.avatarCol} />
        )}
        <View style={styles.bubbleCol}>
          <SwipeableRow onReply={() => handleReply(item)}>
            <ChatBubble
              message={dmMsg}
              isMine={isMine}
              reactions={msgReactions}
              onReaction={(emoji) => handleReaction(item.id, emoji)}
              senderName={showName ? item.username : undefined}
              senderAvatar={showName ? item.avatar : undefined}
            />
          </SwipeableRow>
        </View>
      </View>
    );
  }, [myId, messages, reactions, BG, TEXT_SECONDARY, handleReaction, handleReply]);

  const keyExtractor = useCallback((item: RoomChatMessage) => item.id, []);
  const inputBottom = Math.max(insets.bottom, 12);

  // Android: the OS already resizes the window (app.json adjustResize), so KAV
  // behavior stays undefined — 'height' compensated twice and left a gap.
  // iOS: padding with zero offset (full-screen KAV, no native header).
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
      style={[styles.root, { backgroundColor: BG }]}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Glow line — top */}
      <View style={[styles.glowLine, { top: 0, paddingTop: insets.top }]} />

      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: insets.top + 12, backgroundColor: HEADER_BG }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={isDark ? '#fff' : '#1e293b'} />
        </TouchableOpacity>

        <View style={styles.headerInfo} pointerEvents="none">
          <Text style={[styles.headerName, { color: TEXT_PRIMARY }]} numberOfLines={1}>{roomName || 'Room'}</Text>
        </View>
      </View>

      {/* ── Messages ── */}
      <View style={styles.messageList}>
      <FlashList
        ref={listRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={keyExtractor}
        estimatedItemSize={64}
        extraData={reactions}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={16}
        onScroll={(e) => {
          const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
          atEndRef.current = contentSize.height - (contentOffset.y + layoutMeasurement.height) < 120;
        }}
        contentContainerStyle={{ ...styles.listContent, paddingBottom: inputBottom + 80 }}
        onContentSizeChange={() => {
          // Guard: scrollToEnd on an empty/unlaid-out list crashes
          // recyclerlistview (reads .x of undefined).
          if (messages.length === 0) return;
          try { listRef.current?.scrollToEnd({ animated: false }); } catch {}
        }}
        ListHeaderComponent={
          <View style={styles.dateDivider}>
            <View style={[styles.dividerLine, { backgroundColor: DIVIDER_COLOR }]} />
            <Text style={[styles.dateDividerText, { color: ACCENT_LIGHT }]}>TODAY</Text>
            <View style={[styles.dividerLine, { backgroundColor: DIVIDER_COLOR }]} />
          </View>
        }
      />
      </View>

      {/* ── Input ── */}
      <View style={[styles.inputBar, { paddingBottom: inputBottom, backgroundColor: INPUT_BG }]}>
        <MessageInput
          value={text}
          onChangeText={handleInputChange}
          onSend={handleSend}
          placeholder="Enter message..."
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
        />
      </View>

      {/* Glow line — bottom */}
      <View style={styles.glowLineBottom} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  messageList: { flex: 1 },

  glowLine: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 2,
    backgroundColor: ACCENT,
    shadowColor: ACCENT, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8, shadowRadius: 12, elevation: 8,
    zIndex: 10,
  },
  glowLineBottom: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 2,
    backgroundColor: ACCENT,
    shadowColor: ACCENT, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8, shadowRadius: 12, elevation: 8,
    zIndex: 10,
  },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 14,
    gap: 10,
  },
  backBtn: { padding: 4 },
  headerInfo: {
    position: 'absolute',
    left: 56,
    right: 56,
    alignItems: 'center',
  },
  headerName: { fontSize: 17, fontWeight: '700', textAlign: 'center' },
  headerIcon: { padding: 8 },

  listContent: { paddingHorizontal: 14, paddingTop: 4 },

  dateDivider: {
    flexDirection: 'row', alignItems: 'center',
    marginVertical: 14, gap: 10,
  },
  dividerLine: {
    flex: 1, height: StyleSheet.hairlineWidth,
  },
  dateDividerText: {
    fontSize: 11, fontWeight: '800', letterSpacing: 1,
  },

  msgRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 1 },
  avatarCol: { width: 30, marginRight: 6, alignItems: 'center', justifyContent: 'flex-end' },
  avatar: { width: 30, height: 30, borderRadius: 15 },
  avatarFallback: {
    backgroundColor: 'rgba(124,58,237,0.15)',
    borderWidth: 1, borderColor: 'rgba(139,92,246,0.4)',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: ACCENT_LIGHT, fontSize: 12, fontWeight: '700' },
  bubbleCol: { flex: 1, flexShrink: 1 },

  systemWrap: { alignItems: 'center', marginVertical: 8, paddingHorizontal: 14 },
  systemText: {
    fontSize: 12, fontWeight: '500', fontStyle: 'italic',
  },

  inputBar: {
    paddingTop: 6,
  },
});
