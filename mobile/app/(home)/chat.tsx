import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Platform, StatusBar, Image, KeyboardAvoidingView,
  ActivityIndicator, Dimensions,
} from 'react-native';
import Animated, {
  FadeIn, FadeInDown, useSharedValue, useAnimatedStyle,
  withSpring, withTiming, interpolate, Extrapolation,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import messageService from '../../services/messageService';
import sqliteService, { LocalDirectMessage } from '../../services/sqliteService';
import ChatBubble from '../../components/messaging/ChatBubble';
import MessageInput from '../../components/messaging/MessageInput';
import TypingIndicator from '../../components/messaging/TypingIndicator';
import MessageRequestBanner from '../../components/messaging/MessageRequestBanner';

const { width: SW } = Dimensions.get('window');

// ═══════════════════════════════════════════════════════════
// Chat Screen — Cosmic Glass Sheet + Crystal Bubbles
// ═══════════════════════════════════════════════════════════

export default function ChatScreen() {
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    friendId: string;
    friendUsername: string;
    username: string;
    friendAvatar: string;
    avatar: string;
    requestStatus: string;
  }>();

  const friendId = params.friendId;
  const friendUsername = params.friendUsername || params.username || 'User';
  const friendAvatar = params.friendAvatar || params.avatar || '';
  const initialRequestStatus = params.requestStatus || 'accepted';

  // ─── State ──────────────────────────────────────────────
  const [messages, setMessages] = useState<LocalDirectMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [replyTo, setReplyTo] = useState<{ id: string; text: string; username?: string } | null>(null);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [friendBio, setFriendBio] = useState<string>('');

  // Message request state
  const [requestStatus, setRequestStatus] = useState<string>(initialRequestStatus);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [requestLoading, setRequestLoading] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const sheetOpacity = useSharedValue(0);
  const sheetTranslateY = useSharedValue(30);

  // ─── Colors ─────────────────────────────────────────────
  const bg = isDark ? '#080810' : '#f8f9ff';
  const sheetBg = isDark ? 'rgba(20,20,35,0.95)' : 'rgba(255,255,255,0.92)';
  const glassHeader = isDark ? 'rgba(30,30,50,0.85)' : 'rgba(248,249,255,0.85)';
  const textColor = isDark ? '#f1f5f9' : '#1e293b';
  const subtextColor = isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.4)';
  const borderColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const accentColor = '#6366f1';
  const violetAccent = '#8b5cf6';

  // ─── Load Messages + Check Friendship ──────────────────
  useEffect(() => {
    if (!user || !friendId) return;

    sheetOpacity.value = withTiming(1, { duration: 400 });
    sheetTranslateY.value = withSpring(0, { mass: 0.5, damping: 18, stiffness: 180 });

    let isSubscribed = true;

    const init = async () => {
      await messageService.initialize(user.id);

      // Load cached messages first (don't refetch if already loaded)
      if (messages.length === 0) {
        const cached = await messageService.getMessages(friendId);
        if (isSubscribed) {
          setMessages(cached);
          setLoading(false);
        }
      } else {
        setLoading(false);
      }

      // Mark as read
      await messageService.markAsRead(friendId);

      // Check friendship / request status
      const friendship = await messageService.checkFriendship(friendId);
      if (isSubscribed) {
        setRequestStatus(friendship.requestStatus);
        if (friendship.requestId) setRequestId(friendship.requestId);
      }

      // Check local conversation for cached online status (instant)
      const convs = await sqliteService.getConversations();
      const conv = convs.find(c => c.friend_id === friendId);
      if (conv && isSubscribed) {
        setIsOnline(conv.is_online === 1);
        if (conv.request_status && conv.request_status !== 'none') {
          setRequestStatus(conv.request_status);
          if (conv.request_id) setRequestId(conv.request_id);
        }
      }

      // Fetch fresh online status in background (non-blocking)
      api.get(`/friends/status/${friendId}`)
        .then(statusResp => {
          if (statusResp.data?.isOnline !== undefined && isSubscribed) {
            setIsOnline(statusResp.data.isOnline);
          }
        })
        .catch(() => {});
    };

    init();

    return () => {
      isSubscribed = false;
    };
  }, [user, friendId]);

  // ─── Real-time Listeners ───────────────────────────────
  useEffect(() => {
    const unsubs: (() => void)[] = [];

    unsubs.push(
      messageService.on('message', (msg: LocalDirectMessage) => {
        if (msg.from_user_id === friendId || msg.to_user_id === friendId) {
          setMessages(prev => {
            if (prev.some(m => m.id === msg.id || m.local_id === msg.local_id)) return prev;
            return [...prev, msg];
          });
          if (msg.from_user_id === friendId) {
            messageService.markAsRead(friendId);
          }
        }
      })
    );

    unsubs.push(
      messageService.on('message_sent', (msg: LocalDirectMessage) => {
        if (msg.to_user_id === friendId) {
          setMessages(prev => {
            if (prev.some(m => m.local_id === msg.local_id)) return prev;
            return [...prev, msg];
          });
          setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
        }
      })
    );

    unsubs.push(
      messageService.on('message_synced', ({ localId, serverId }: { localId: string; serverId: string }) => {
        setMessages(prev =>
          prev.map(m =>
            m.local_id === localId || m.id === localId
              ? { ...m, id: serverId, status: 'sent' as const, synced: 1 }
              : m
          )
        );
      })
    );

    unsubs.push(
      messageService.on('message_failed', (localId: string) => {
        setMessages(prev =>
          prev.map(m =>
            m.local_id === localId || m.id === localId
              ? { ...m, status: 'failed' as const }
              : m
          )
        );
      })
    );

    unsubs.push(
      messageService.on('message_retry', (localId: string) => {
        setMessages(prev =>
          prev.map(m =>
            m.local_id === localId || m.id === localId
              ? { ...m, status: 'sending' as const }
              : m
          )
        );
      })
    );

    unsubs.push(
      messageService.on('read', (data: { readBy: string }) => {
        if (data.readBy === friendId) {
          setMessages(prev =>
            prev.map(m =>
              m.from_user_id === user?.id && m.to_user_id === friendId
                ? { ...m, status: 'read' as const }
                : m
            )
          );
        }
      })
    );

    unsubs.push(
      messageService.on('delivered', (data: { messageIds: string[] }) => {
        setMessages(prev =>
          prev.map(m =>
            data.messageIds.includes(m.id) ? { ...m, status: 'delivered' as const } : m
          )
        );
      })
    );

    unsubs.push(
      messageService.on('typing', (data: { userId: string; isTyping: boolean }) => {
        if (data.userId === friendId) setIsTyping(data.isTyping);
      })
    );

    unsubs.push(
      messageService.on('online_status', (data: { userId: string; isOnline: boolean }) => {
        if (data.userId === friendId) setIsOnline(data.isOnline);
      })
    );

    unsubs.push(
      messageService.on('friend_removed', (removedFriendId: string) => {
        if (removedFriendId === friendId) {
          setRequestStatus('removed');
        }
      })
    );

    unsubs.push(
      messageService.on('messages_synced', async (syncedFriendId: string) => {
        if (syncedFriendId === friendId && user) {
          const fresh = await sqliteService.getDirectMessages(user.id, friendId, 50);
          setMessages(fresh);
        }
      })
    );

    unsubs.push(
      messageService.on('request_accepted', (acceptedFriendId: string) => {
        if (acceptedFriendId === friendId) {
          setRequestStatus('none');
          setRequestId(null);
        }
      })
    );

    unsubs.push(
      messageService.on('conversations_updated', async () => {
        const convs = await sqliteService.getConversations();
        const conv = convs.find(c => c.friend_id === friendId);
        if (conv) {
          setRequestStatus(conv.request_status || 'none');
          setRequestId(conv.request_id || null);
        }
      })
    );

    return () => unsubs.forEach(u => u());
  }, [friendId, user]);

  // ─── Send Message ─────────────────────────────────────
  const handleSend = useCallback(async (text: string) => {
    if (!user || !friendId) return;
    await messageService.sendMessage(
      friendId, text, friendUsername, friendAvatar || null,
      replyTo ? { id: replyTo.id, text: replyTo.text } : undefined,
    );
    setReplyTo(null);
  }, [friendId, user, replyTo, friendUsername, friendAvatar]);

  // ─── Retry Failed ─────────────────────────────────────
  const handleRetry = useCallback(async (msg: LocalDirectMessage) => {
    await messageService.retryMessage(msg.local_id, msg.to_user_id, msg.content, msg.reply_to_id);
  }, []);

  // ─── Reply ────────────────────────────────────────────
  const handleReply = useCallback((msg: LocalDirectMessage) => {
    const isFromFriend = msg.from_user_id === friendId;
    setReplyTo({
      id: msg.id,
      text: msg.content,
      username: isFromFriend ? friendUsername : 'You',
    });
  }, [friendId, friendUsername]);

  // ─── Load More ────────────────────────────────────────
  const handleLoadMore = useCallback(async () => {
    if (loadingMore || !user || messages.length === 0) return;
    setLoadingMore(true);
    const oldest = messages[0];
    const older = await sqliteService.getDirectMessages(user.id, friendId, 50, oldest.created_at);
    if (older.length > 0) setMessages(prev => [...older, ...prev]);
    setLoadingMore(false);
  }, [messages, loadingMore, user, friendId]);

  // ─── Typing Emission ──────────────────────────────────
  const handleTyping = useCallback((typing: boolean) => {
    messageService.emitTyping(friendId, typing);
  }, [friendId]);

  // ─── Message Request Actions ──────────────────────────
  const handleAcceptRequest = useCallback(async () => {
    if (!requestId || !friendId) return;
    setRequestLoading(true);
    const success = await messageService.acceptRequest(requestId, friendId);
    if (success) {
      setRequestStatus('none');
      setRequestId(null);
    }
    setRequestLoading(false);
  }, [requestId, friendId]);

  const handleDeclineRequest = useCallback(async () => {
    if (!requestId || !friendId) return;
    setRequestLoading(true);
    const success = await messageService.declineRequest(requestId, friendId);
    if (success) router.back();
    setRequestLoading(false);
  }, [requestId, friendId, router]);

  const handleBlockUser = useCallback(async () => {
    if (!friendId) return;
    setRequestLoading(true);
    await messageService.blockUser(friendId);
    router.back();
  }, [friendId, router]);

  // ─── Scroll Handling ──────────────────────────────────
  const onScroll = useCallback((e: any) => {
    const offsetY = e.nativeEvent.contentOffset.y;
    const contentH = e.nativeEvent.contentSize.height;
    const layoutH = e.nativeEvent.layoutMeasurement.height;
    setShowScrollDown(contentH - offsetY - layoutH > 300);
  }, []);

  const scrollToBottom = useCallback(() => {
    flatListRef.current?.scrollToEnd({ animated: true });
  }, []);

  // ─── Helpers ──────────────────────────────────────────
  const getInitials = (name: string) => name.charAt(0).toUpperCase();

  const isPendingReceived = requestStatus === 'pending_received';
  const isPendingSent = requestStatus === 'pending_sent';

  // ─── Animated Styles ──────────────────────────────────
  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    opacity: sheetOpacity.value,
    transform: [{ translateY: sheetTranslateY.value }],
  }));

  // ─── Render Helpers ───────────────────────────────────
  const renderMessage = useCallback(({ item, index }: { item: LocalDirectMessage; index: number }) => (
    <Animated.View entering={FadeInDown.duration(250).delay(index * 20)}>
      <ChatBubble
        message={item}
        isMine={item.from_user_id === user?.id}
        isDark={isDark}
        onRetry={handleRetry}
        onReply={handleReply}
      />
    </Animated.View>
  ), [user, isDark, handleRetry, handleReply]);

  const keyExtractor = useCallback((item: LocalDirectMessage) => item.local_id || item.id, []);

  return (
    <View style={[styles.root, { backgroundColor: bg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* ── Glass Header ── */}
      <Animated.View
        style={[styles.header, {
          backgroundColor: glassHeader,
          paddingTop: insets.top + 14,
          paddingBottom: 14,
        }]}
        entering={FadeIn.duration(300)}
      >
        <View style={styles.headerRow}>
          {/* Back */}
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-back" size={26} color={textColor} />
          </TouchableOpacity>

          {/* Avatar */}
          <View style={styles.headerAvatarWrap}>
            {friendAvatar ? (
              <Image source={{ uri: friendAvatar }} style={styles.headerAvatar} />
            ) : (
              <LinearGradient colors={[accentColor, violetAccent] as any} style={styles.headerAvatar}>
                <Text style={styles.headerInitial}>{getInitials(friendUsername)}</Text>
              </LinearGradient>
            )}
            {isOnline && (
              <View style={[styles.onlineDotOuter, { borderColor: glassHeader }]}>
                <View style={styles.onlineDot} />
              </View>
            )}
          </View>

          {/* Name + status */}
          <View style={styles.headerInfo}>
            <Text style={[styles.headerName, { color: textColor }]} numberOfLines={1}>
              {friendUsername}
            </Text>
            <Text style={[styles.headerStatus, { color: isOnline ? '#22c55e' : subtextColor }]}>
              {isTyping ? 'typing...' : isOnline ? 'online' : 'offline'}
            </Text>
            {friendBio ? (
              <Text 
                style={[styles.bioChip, { 
                  color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)',
                  fontSize: 11,
                }]} 
                numberOfLines={1}
              >
                {friendBio.length > 40 ? friendBio.slice(0, 40) + '...' : friendBio}
              </Text>
            ) : null}
          </View>

          {/* Pending badge */}
          {isPendingSent && (
            <View style={[styles.pendingBadge, {
              backgroundColor: isDark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.1)',
            }]}>
              <Ionicons name="time-outline" size={11} color={accentColor} />
              <Text style={styles.pendingBadgeText}>Pending</Text>
            </View>
          )}
        </View>
      </Animated.View>

      {/* ── Curved Sheet Container ── */}
      <Animated.View
        style={[styles.sheet, {
          backgroundColor: sheetBg,
          borderTopLeftRadius: 32,
          borderTopRightRadius: 32,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: isDark ? 0.4 : 0.08,
          shadowRadius: 20,
          elevation: 12,
        }, sheetAnimatedStyle]}
      >
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={0}
        >
          {/* Curved top handle */}
          <View style={styles.sheetHandle}>
            <View style={[styles.sheetHandleBar, {
              backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)',
            }]} />
          </View>

          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color={accentColor} />
            </View>
          ) : (
            <>
              <FlatList
                ref={flatListRef as any}
                data={messages}
                keyExtractor={keyExtractor}
                renderItem={renderMessage}
                contentContainerStyle={[
                  styles.listContent,
                  messages.length === 0 && styles.listEmpty,
                ]}
                showsVerticalScrollIndicator={false}
                onScroll={onScroll}
                scrollEventThrottle={16}
                onEndReached={handleLoadMore}
                onEndReachedThreshold={0.3}
                onContentSizeChange={() => {
                  if (messages.length > 0 && !loading) {
                    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 50);
                  }
                }}
                ListHeaderComponent={
                  <>
                    {loadingMore && (
                      <View style={styles.loadingMore}>
                        <ActivityIndicator size="small" color={accentColor} />
                      </View>
                    )}
                    {isPendingReceived && (
                      <MessageRequestBanner
                        isDark={isDark}
                        username={friendUsername}
                        onAccept={handleAcceptRequest}
                        onDecline={handleDeclineRequest}
                        onBlock={handleBlockUser}
                      />
                    )}
                  </>
                }
                ListEmptyComponent={
                  <View style={styles.emptyChat}>
                    <View style={[styles.emptyIcon, { 
                      backgroundColor: isDark ? 'rgba(99,102,241,0.1)' : 'rgba(99,102,241,0.06)' 
                    }]}>
                      <Ionicons name="chatbubble-outline" size={36} color={accentColor} />
                    </View>
                    <Text style={[styles.emptyText, { color: textColor }]}>
                      Start the conversation
                    </Text>
                    <Text style={[styles.emptySub, { color: subtextColor }]}>
                      Say hi to {friendUsername} 👋
                    </Text>
                  </View>
                }
                ListFooterComponent={
                  <TypingIndicator isDark={isDark} visible={isTyping} username={friendUsername} />
                }
              />

              {/* Scroll to bottom FAB */}
              {showScrollDown && (
                <TouchableOpacity
                  style={[styles.scrollFab, {
                    backgroundColor: isDark ? 'rgba(40,40,60,0.9)' : 'rgba(255,255,255,0.95)',
                    borderColor,
                  }]}
                  onPress={scrollToBottom}
                  activeOpacity={0.8}
                >
                  <Ionicons name="chevron-down" size={20} color={accentColor} />
                </TouchableOpacity>
              )}
            </>
          )}

          {/* Pending Sent Info Bar */}
          {isPendingSent && !loading && (
            <View style={[styles.pendingBar, {
              backgroundColor: isDark ? 'rgba(99,102,241,0.08)' : 'rgba(99,102,241,0.05)',
              borderTopColor: borderColor,
            }]}>
              <Ionicons name="hourglass-outline" size={14} color={violetAccent} />
              <Text style={[styles.pendingBarText, { color: subtextColor }]}>
                Waiting for {friendUsername} to accept
              </Text>
            </View>
          )}

          {/* Input */}
          <View style={[styles.inputWrap, {
            backgroundColor: sheetBg,
            borderTopColor: borderColor,
            paddingBottom: insets.bottom || 12,
            paddingTop: 8,
          }]}>
            <MessageInput
              isDark={isDark}
              onSend={handleSend}
              onTyping={handleTyping}
              replyTo={replyTo}
              onCancelReply={() => setReplyTo(null)}
              disabled={requestLoading || isPendingReceived}
            />
          </View>
        </KeyboardAvoidingView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  
  // Header
  header: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center', marginRight: 2,
  },
  headerAvatarWrap: {
    position: 'relative', marginRight: 12,
  },
  headerAvatar: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: 'center', justifyContent: 'center',
  },
  headerInitial: { color: '#fff', fontSize: 17, fontWeight: '700' },
  onlineDotOuter: {
    position: 'absolute', right: -2, bottom: -2,
    width: 15, height: 15, borderRadius: 7.5,
    borderWidth: 2.5, alignItems: 'center', justifyContent: 'center',
  },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22c55e' },
  headerInfo: { flex: 1 },
  headerName: { fontSize: 17, fontWeight: '700', letterSpacing: -0.3 },
  headerStatus: { fontSize: 12, fontWeight: '500', marginTop: 1 },
  bioChip: { fontSize: 11, marginTop: 1, maxWidth: 200 },
  pendingBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 12,
  },
  pendingBadgeText: {
    fontSize: 10.5, fontWeight: '700', color: '#6366f1', letterSpacing: 0.1,
  },

  // Curved Sheet
  sheet: {
    flex: 1,
    marginTop: -8, // Overlap with header
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  sheetHandle: {
    alignItems: 'center', paddingTop: 10, paddingBottom: 6,
  },
  sheetHandleBar: {
    width: 36, height: 5, borderRadius: 2.5,
  },
  
  // List
  listContent: { paddingVertical: 12, paddingHorizontal: 4 },
  listEmpty: { flex: 1, justifyContent: 'center' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingMore: { paddingVertical: 16, alignItems: 'center' },
  
  // Empty
  emptyChat: {
    alignItems: 'center', justifyContent: 'center', paddingVertical: 50,
  },
  emptyIcon: {
    width: 72, height: 72, borderRadius: 36,
    alignItems: 'center', justifyContent: 'center', marginBottom: 14,
  },
  emptyText: { fontSize: 18, fontWeight: '700', letterSpacing: -0.3, marginBottom: 4 },
  emptySub: { fontSize: 13 },
  
  // Scroll FAB
  scrollFab: {
    position: 'absolute', right: 16, bottom: 90,
    width: 38, height: 38, borderRadius: 19,
    borderWidth: 1, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 8, elevation: 6,
  },
  
  // Pending bar
  pendingBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 10,
    borderTopWidth: 1,
  },
  pendingBarText: { fontSize: 12, fontWeight: '500', flex: 1 },
  
  // Input wrapper
  inputWrap: { borderTopWidth: 1 },
});
