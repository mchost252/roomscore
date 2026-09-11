import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Switch,
  Platform, StatusBar, Image, KeyboardAvoidingView,
  ActivityIndicator, ImageBackground, Modal, Pressable, ScrollView, Keyboard,
  InteractionManager, Alert,
} from 'react-native';
import Animated, {
  FadeIn, FadeInDown, useSharedValue, useAnimatedStyle,
  withTiming, interpolate, Extrapolation, runOnJS,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import messageService, { FriendProfile } from '../../services/messageService';
import sqliteService, { LocalDirectMessage } from '../../services/sqliteService';
import syncEngine from '../../services/syncEngine';
import ChatBubble from '../../components/messaging/ChatBubble';
import { Reaction } from '../../components/messaging/MessageRow';
import MessageInput from '../../components/messaging/MessageInput';
import TypingIndicator from '../../components/messaging/TypingIndicator';
import MessageRequestBanner from '../../components/messaging/MessageRequestBanner';
import SwipeableRow from '../../components/messaging/SwipeableRow';
import ConfirmationModal from '../../components/ConfirmationModal';
import { FlashList } from '@shopify/flash-list';
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';

const warmedChats = new Set<string>();
const chatMessageCache = new Map<string, LocalDirectMessage[]>();

// Resting height of the composer: MessageInput's 40px controls plus its 4px top
// and 8px bottom container padding. composerHeight state is seeded with this so the
// inverted list's paddingTop (its visual bottom clearance) is right on the first
// frame; onLayout replaces it with the real measurement one frame later.
const COMPOSER_ESTIMATED_HEIGHT = 52;

function formatScrollDate(timestamp: number): string {
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined });
}

function hasSameMessageWindow(previous: LocalDirectMessage[], next: LocalDirectMessage[]): boolean {
  return previous.length === next.length && previous.every((message, index) => {
    const candidate = next[index];
    return candidate
      && message.local_id === candidate.local_id
      && message.id === candidate.id
      && message.status === candidate.status
      && message.content === candidate.content;
  });
}

/**
 * Decide the next message list after re-reading the newest-50 window from SQLite.
 *
 * `next` is always capped at 50 rows, but `previous` may legitimately be longer
 * because "Load older messages" appended history. Naively replacing would
 * truncate the list back to 50 and visibly jump the viewport, so keep the longer
 * list whenever it already ends with the same message the fresh window does.
 */
function reconcileMessageWindow(
  previous: LocalDirectMessage[],
  next: LocalDirectMessage[],
): LocalDirectMessage[] {
  if (hasSameMessageWindow(previous, next)) return previous;

  if (previous.length > next.length && next.length > 0) {
    const prevLast = previous[previous.length - 1];
    const nextLast = next[next.length - 1];
    const sameTail = prevLast
      && nextLast
      && prevLast.local_id === nextLast.local_id
      && prevLast.status === nextLast.status
      && prevLast.content === nextLast.content;
    if (sameTail) return previous;
  }

  return next;
}

// ═══════════════════════════════════════════════════════════
// Chat Screen — Rebuilt: local-first, no spinner blocking,
// consolidated events, fixed load-more direction
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
  const initialCachedMessages = chatMessageCache.get(friendId) ?? [];
  const [messages, setMessages] = useState<LocalDirectMessage[]>(() => initialCachedMessages);
  const [loading, setLoading] = useState(() => !warmedChats.has(friendId) && !chatMessageCache.has(friendId));
  const [loadingMore, setLoadingMore] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [replyTo, setReplyTo] = useState<{ id: string; text: string; username?: string } | null>(null);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [friendProfile, setFriendProfile] = useState<FriendProfile | null>(null);
  const [coverImageFailed, setCoverImageFailed] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [profileOpen, setProfileOpen] = useState(false);
  const [stageHeight, setStageHeight] = useState(0);
  const [composerHeight, setComposerHeight] = useState(COMPOSER_ESTIMATED_HEIGHT);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [scrollDate, setScrollDate] = useState<string | null>(null);
  // Mute state. Previously the panel rendered a decorative View that looked like a
  // switch but was wired to nothing; is_muted has existed on the conversations
  // table all along, and messageService.updateConversationPreferences persists it
  // and syncs to the server.
  const [isMuted, setIsMuted] = useState(false);

  // Message request state
  const [requestStatus, setRequestStatus] = useState<string>(initialRequestStatus);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [requestMessage, setRequestMessage] = useState<string | null>(null);
  const [requestLoading, setRequestLoading] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [clearChatModalVisible, setClearChatModalVisible] = useState(false);
  const [deleteFriendModalVisible, setDeleteFriendModalVisible] = useState(false);
  const [blockUserModalVisible, setBlockUserModalVisible] = useState(false);
  // Reaction state: messageId -> Reaction[] for display (emoji, count, reacted)
  const [reactions, setReactions] = useState<Record<string, Reaction[]>>({});

  const hydrateReactions = useCallback(async (messageList: LocalDirectMessage[]) => {
    const loaded: Record<string, Reaction[]> = {};
    await Promise.all(messageList.map(async (msg) => {
      const msgId = msg.id || msg.local_id;
      if (!msgId) return;
      const rows = await messageService.getMessageReactions(msgId);
      if (rows.length) {
        loaded[msgId] = rows.map(r => ({
          emoji: r.emoji,
          count: r.count,
          reacted: r.userReacted,
        }));
      }
    }));
    setReactions(loaded);
  }, []);

  // Keep requestStatusRef in sync with requestStatus state
  useEffect(() => {
    requestStatusRef.current = requestStatus;
  }, [requestStatus]);

  // Refs
  const flatListRef = useRef<FlashList<LocalDirectMessage>>(null);
  const profileScrollRef = useRef<ScrollView>(null);
  const inputWrapRef = useRef<any>(null);
  const hasInitializedChat = useRef(false);
  const hasScrolledToBottom = useRef(false);
  const lastMarkReadCall = useRef(0);
  // Track the message count at last render to only animate new messages
  const prevMessageCountRef = useRef(initialCachedMessages.length);
  // How many items at the head of the inverted list are new arrivals this render.
  const newAtHeadCountRef = useRef(0);
  // Set once pagination has exhausted local history, so onEndReached stops
  // re-querying on every scroll to the visual top. Reset when the chat changes.
  const reachedOldestRef = useRef(false);

  // Ensure smooth composer repositioning on keyboard show/hide. Some Android
  // devices don't settle the window resize immediately; explicitly measure the
  // input wrapper and update composerHeight to remove persistent gaps.
  useEffect(() => {
    // Accept the keyboard event when available so OEM-reported keyboard height
    // can be used as an extra hint for layout/scrolling. Fall back to measuring
    // the input wrapper when the event is not provided.
    const onShow = (e?: any) => {
      setKeyboardVisible(true);
      // If the native event provides the keyboard height, try to use it to
      // ensure the composer is positioned above the keyboard immediately.
      const kbHeight = e?.endCoordinates?.height || 0;

      // measure shortly after the keyboard settles, and again later for laggy OEMs
      const measureNow = () => {
        try {
          if (inputWrapRef.current && inputWrapRef.current.measure) {
            inputWrapRef.current.measure((_x: number, _y: number, _w: number, h: number) => {
              if (h && h !== composerHeight) setComposerHeight(h);
            });
          }
        } catch (err) {
          // best-effort
        }
      };

      // Immediate scroll to newest message so the composer doesn't get occluded.
      try {
        flatListRef.current?.scrollToIndex?.({ index: 0, animated: true });
      } catch (err) {
        try { flatListRef.current?.scrollToOffset?.({ offset: 0, animated: true }); } catch {}
      }

      // Measure shortly after show (typical) and again after a longer delay to
      // catch OEMs that animate the keyboard more slowly.
      setTimeout(measureNow, 120);
      setTimeout(measureNow, 350 + (kbHeight ? Math.min(200, Math.round(kbHeight / 4)) : 0));
    };
    const onHide = () => {
      setKeyboardVisible(false);
      // remeasure after hide to remove possible gap
      setTimeout(() => {
        try {
          if (inputWrapRef.current && inputWrapRef.current.measure) {
            inputWrapRef.current.measure((_x: any, _y: any, _w: any, h: number) => {
              if (h && h !== composerHeight) setComposerHeight(h);
            });
          }
        } catch (e) {
          // ignore — best-effort
        }
      }, 80);
    };

    const showSub = Keyboard.addListener('keyboardDidShow', onShow);
    const hideSub = Keyboard.addListener('keyboardDidHide', onHide);
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [composerHeight]);
  // Track requestStatus to avoid stale closures in async callbacks
  const requestStatusRef = useRef(initialRequestStatus);
  const isUserScrollingRef = useRef(false);
  // True while the viewport is pinned near the end of the list. Gates the
  // auto-scrolls below so we never yank a user who is reading scrollback.
  const isNearBottomRef = useRef(true);
  const datePillTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { height: keyboardHeight } = useReanimatedKeyboardAnimation();
  const composerKeyboardStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: keyboardHeight.value }],
  }));

  // Reset init guard when friendId changes.
  // Skipped on first mount: the useState initialisers above already seeded
  // messages/loading from the cache, and repeating that work here caused a
  // second render pass before the list had even painted once.
  const didMountRef = useRef(false);
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    hasInitializedChat.current = false;
    hasScrolledToBottom.current = false;
    isNearBottomRef.current = true;
    reachedOldestRef.current = false;
    const cachedMessages = chatMessageCache.get(friendId) ?? [];
    setMessages(cachedMessages);
    prevMessageCountRef.current = cachedMessages.length;
    setLoading(!warmedChats.has(friendId) && cachedMessages.length === 0);
  }, [friendId]);

  useEffect(() => {
    if (friendId) chatMessageCache.set(friendId, messages);
  }, [friendId, messages]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSubscription = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hideSubscription = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));
    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  // When the keyboard hides, re-measure the composer wrapper after the
  // layout pass so composerHeight is accurate and no gap remains under the
  // input. This guards against platform quirks where KeyboardAvoidingView or
  // windowSoftInputMode resizing leaves stale values until remount.
  useEffect(() => {
    if (!inputWrapRef.current) return;
    if (!keyboardVisible) {
      const id = setTimeout(() => {
        try {
          // measure(callback) -> x,y,width,height,pageX,pageY
          inputWrapRef.current.measure((_x: any, _y: any, _w: any, h: number) => {
            if (h && h > 0) setComposerHeight(h);
          });
        } catch (e) {
          // ignore — best-effort
        }
      }, 80);
      return () => clearTimeout(id);
    }
    return;
  }, [keyboardVisible]);

  // Animation values
  const sheetOffset = useSharedValue(0);
  const sheetStartOffset = useSharedValue(0);
  const maxSheetOffset = useSharedValue(0);
  const profileScrollY = useSharedValue(0);
  const listOpacity = useSharedValue(0);

  // ─── Colors ─────────────────────────────────────────────
  const bg = isDark ? '#080810' : '#f8f9ff';
  const sheetBg = isDark ? '#12121e' : '#ffffff';
  // Same rgb as sheetBg at zero alpha, for the composer fade gradient. Must match
  // sheetBg exactly or the band shows as a tinted edge.
  const sheetBgTransparent = isDark ? 'rgba(18,18,30,0)' : 'rgba(255,255,255,0)';
  const glassHeader = isDark ? '#0d0d17' : '#f8f9ff';
  const textColor = isDark ? '#f1f5f9' : '#1e293b';
  const subtextColor = isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.4)';
  const borderColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const accentColor = '#6366f1';
  const violetAccent = '#8b5cf6';

  // ═══════════════════════════════════════════════════════════
  // INIT: Load messages from SQLite IMMEDIATELY, never block on network
  // ═══════════════════════════════════════════════════════════
  useEffect(() => {
    if (!user || !friendId) return;
    if (hasInitializedChat.current) return;
    hasInitializedChat.current = true;

    let isSubscribed = true;

    const init = async () => {
      try {
        // Start service init but DO NOT await it. initialize() assigns
        // currentUserId synchronously before its own awaits (friendship cache
        // load + offline queue flush, both of which can hit the network), so the
        // SQLite read below is already safe — and no longer blocked behind that
        // network round-trip. Awaiting here was what delayed the first paint.
        messageService.initialize(user.id).catch((err) => {
          console.warn('[Chat] messageService.initialize failed:', err);
        });

        // 1. Load from SQLite IMMEDIATELY (never stuck on spinner)
        const cached = await messageService.getMessages(friendId);
        // Ensure messages are sorted chronologically (oldest first)
        const sorted = [...cached].sort((a, b) => a.created_at - b.created_at);
        if (isSubscribed) {
          setMessages(previous => reconcileMessageWindow(previous, sorted));
          hydrateReactions(sorted).catch(() => {});
          prevMessageCountRef.current = sorted.length;
          warmedChats.add(friendId);
          setLoading(false);
        }

        // 2. Check local conversation for cached request status + presence
        const conv = await sqliteService.getConversationByFriendId(friendId);
        if (conv && isSubscribed) {
          setIsOnline(conv.is_online === 1);
          setIsMuted(conv.is_muted === 1);
          if (conv.request_status && conv.request_status !== 'none') {
            setRequestStatus(conv.request_status);
            if (conv.request_id) setRequestId(conv.request_id);
            if (conv.last_message) setRequestMessage(conv.last_message);
          }
        }

      } finally {
        // First entry may have no local messages; never leave that state loading.
        if (isSubscribed) setLoading(false);
      }

      // 3. Background: check friendship + mark as read (non-blocking)
      messageService.checkFriendship(friendId, true).then((friendship) => {
        if (!isSubscribed) return;
        
        // Don't override 'removed' status
        if (requestStatusRef.current === 'removed') return;
        
        setRequestStatus(friendship.requestStatus);
        if (friendship.requestId) setRequestId(friendship.requestId);

        // Mark as read once on open (only if accepted/none)
        const effectiveStatus = friendship.requestStatus || requestStatusRef.current;
        if (effectiveStatus === 'accepted' || effectiveStatus === 'none') {
          const now = Date.now();
          if (now - lastMarkReadCall.current > 2000) {
            lastMarkReadCall.current = now;
            messageService.markAsRead(friendId).catch((err) => {
              console.warn('[Chat] markAsRead failed:', err);
            });
          }
        }
      }).catch((err) => {
        console.warn('[Chat] checkFriendship failed:', err);
      });
    };

    init();

    // Subscribe to friend's online status
    syncEngine.subscribeToUserStatus(friendId);

    return () => {
      isSubscribed = false;
      syncEngine.unsubscribeFromUserStatus(friendId);
    };
  }, [user, friendId]);

  /**
   * Fetch the friend's profile (cover image, stats, friendsSince).
   *
   * This used to fire only once profileOpen became true, which meant the very first
   * pull-down always rendered the DEFAULT cover asset — the real cover arrived a
   * beat later, or not at all if you closed the panel quickly. That is why the
   * backdrop looked wrong rather than showing the friend's own.
   *
   * Now it prefetches after interactions settle, so the cover is ready before the
   * first drag while still not competing with the screen's slide-in animation.
   */
  const profileFetchedRef = useRef(false);
  useEffect(() => {
    if (profileFetchedRef.current || !friendId) return;
    profileFetchedRef.current = true;
    let active = true;
    const handle = InteractionManager.runAfterInteractions(() => {
      messageService.getFriendProfile(friendId).then((profile) => {
        if (active && profile) {
          setFriendProfile(profile);
        } else if (active) {
          profileFetchedRef.current = false;
        }
      }).catch(() => {
        if (active) profileFetchedRef.current = false;
      });
    });
    return () => {
      active = false;
      handle.cancel();
    };
  }, [friendId, profileOpen]);

  useEffect(() => {
    const availableHeight = Math.max(0, stageHeight - composerHeight - headerHeight);
    maxSheetOffset.value = availableHeight;
    if (sheetOffset.value > availableHeight) {
      sheetOffset.value = withTiming(availableHeight, { duration: 180 });
    }
  }, [composerHeight, headerHeight, stageHeight, maxSheetOffset, sheetOffset]);

  useEffect(() => {
    setCoverImageFailed(false);
  }, [friendProfile?.coverImage]);

  // ═══════════════════════════════════════════════════════════
  // EVENT LISTENERS — Consolidated (6 instead of 12)
  // ═══════════════════════════════════════════════════════════
  useEffect(() => {
    const unsubs: (() => void)[] = [];

    // ── message:new — handles BOTH incoming and sent messages ──
    unsubs.push(
      messageService.on('message:new', (msg: LocalDirectMessage) => {
        if (msg.from_user_id === friendId || msg.to_user_id === friendId) {
          setMessages(prev => {
            // Dedup by id AND local_id
            if (prev.some(m => m.id === msg.id || m.local_id === msg.local_id)) return prev;
            // Add new message and sort chronologically
            const updated = [...prev, msg];
            return updated.sort((a, b) => a.created_at - b.created_at);
          });

          // Auto-scroll for sent messages. Inverted list: the newest message is at
          // offset 0, so scrollToEnd here would jump to the OLDEST message.
          if (msg.from_user_id === user?.id) {
            setTimeout(() => {
              flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
              hasScrolledToBottom.current = true;
              isNearBottomRef.current = true;
            }, 100);
          }

          // Mark as read for incoming messages while chat is open
          if (msg.from_user_id === friendId) {
            const now = Date.now();
            if (now - lastMarkReadCall.current > 2000) {
              lastMarkReadCall.current = now;
              messageService.markAsRead(friendId).catch(() => {});
            }
          }
        }
      })
    );

    // ── message:status — handles synced, failed, retry, read, delivered ──
    unsubs.push(
      messageService.on('message:status', (data: any) => {
        const { type } = data;

        if (type === 'synced') {
          // Message got a server ID
          setMessages(prev =>
            prev.map(m =>
              m.local_id === data.localId || m.id === data.localId
                ? { ...m, id: data.serverId, status: 'sent' as const, synced: 1 }
                : m
            )
          );
        } else if (type === 'failed') {
          setMessages(prev =>
            prev.map(m =>
              m.local_id === data.localId || m.id === data.localId
                ? { ...m, status: 'failed' as const }
                : m
            )
          );
        } else if (type === 'retry') {
          setMessages(prev =>
            prev.map(m =>
              m.local_id === data.localId || m.id === data.localId
                ? { ...m, status: 'sending' as const }
                : m
            )
          );
        } else if (type === 'read' && data.friendId === friendId) {
          // Friend read our messages — update all my messages to this friend
          setMessages(prev =>
            prev.map(m =>
              m.from_user_id === user?.id && m.to_user_id === friendId
                ? { ...m, status: 'read' as const }
                : m
            )
          );
        } else if (type === 'delivered') {
          setMessages(prev =>
            prev.map(m =>
              data.messageIds?.includes(m.id) ? { ...m, status: 'delivered' as const } : m
            )
          );
        }
      })
    );

    // ── messages_synced — delta sync found new messages from server ──
    unsubs.push(
      messageService.on('messages_synced', async (syncedFriendId: string) => {
        if (syncedFriendId === friendId && user) {
          const fresh = await messageService.getMessages(friendId, undefined, { skipSync: true });
          // Ensure messages are sorted chronologically (oldest first)
          const sorted = [...fresh].sort((a, b) => a.created_at - b.created_at);
          setMessages(previous => reconcileMessageWindow(previous, sorted));
          hydrateReactions(sorted).catch(() => {});
        }
      })
    );

    // ── typing:changed ──
    unsubs.push(
      messageService.on('typing:changed', (data: { userId: string; isTyping: boolean }) => {
        if (data.userId === friendId) setIsTyping(data.isTyping);
      })
    );

    // ── presence:changed ──
    unsubs.push(
      messageService.on('presence:changed', (data: { userId: string; isOnline: boolean }) => {
        if (data.userId === friendId) setIsOnline(data.isOnline);
      })
    );

    // ── friend_removed ──
    unsubs.push(
      messageService.on('friend_removed', async (payload: { friendId: string; initiatedByMe: boolean }) => {
        console.log('[Chat] friend_removed event:', payload);
        if (payload.friendId !== friendId) return;
        
        if (payload.initiatedByMe) {
          // I deleted them - navigate back to messages list
          console.log('[Chat] I deleted this friend, navigating back to messages');
          router.replace('/(home)/messages');
        } else {
          // They deleted me - reload to update status
          console.log('[Chat] Friend removed me, reloading conversation');
          // Reload conversation data
          const conv = await sqliteService.getConversationByFriendId(friendId);
          if (conv) {
            setRequestStatus(conv.request_status || 'none');
            if (conv.request_id) setRequestId(conv.request_id);
            if (conv.last_message) setRequestMessage(conv.last_message);
          }
        }
      })
    );

    // ── request_accepted ──
    unsubs.push(
      messageService.on('request_accepted', (acceptedFriendId: string) => {
        if (acceptedFriendId === friendId) {
          setRequestStatus('none');
          setRequestId(null);
        }
      })
    );

    // ── message:reaction — update local reactions display ──
    unsubs.push(
      messageService.on('message:reaction', (data: any) => {
        const msgId: string = data?.messageId || data?.message_id;
        const emoji: string = data?.emoji;
        const action: string = data?.action;
        const userId: string = data?.userId;
        if (!msgId || !emoji) return;

        // Optimistic / incremental update for snappy UI
        setReactions(prev => {
          const current = (prev[msgId] || []).slice();
          const idx = current.findIndex(r => r.emoji === emoji);
          if (action === 'add') {
            if (idx === -1) {
              // add new reaction chip (reacted only for this user)
              current.push({ emoji, count: 1, reacted: userId === user?.id });
            } else {
              // increment count and mark reacted if this user
              current[idx] = { ...current[idx], count: current[idx].count + 1, reacted: current[idx].reacted || userId === user?.id };
            }
          } else if (action === 'remove') {
            if (idx !== -1) {
              const updatedCount = Math.max(0, current[idx].count - 1);
              if (updatedCount === 0) {
                current.splice(idx, 1);
              } else {
                current[idx] = { ...current[idx], count: updatedCount, reacted: current[idx].reacted && userId !== user?.id };
              }
            }
          }
          return { ...prev, [msgId]: current };
        });

        // Schedule a reconciliation read from the DB shortly after to correct any races
        setTimeout(async () => {
          try {
            const rows = await messageService.getMessageReactions(msgId);
            if (rows && rows.length > 0) {
              const mapped: Reaction[] = rows.map((r: any) => ({ emoji: r.emoji, count: r.count, reacted: r.userReacted }));
              setReactions(prev => ({ ...prev, [msgId]: mapped }));
            } else {
              setReactions(prev => {
                const copy = { ...prev };
                delete copy[msgId];
                return copy;
              });
            }
          } catch (e) {
            // ignore reconciliation failures
          }
        }, 400);
      })
    );

    // ── conversation:list — update request status from conversation data ──
    unsubs.push(
      messageService.on('conversation:list', async () => {
        const conv = await sqliteService.getConversationByFriendId(friendId);
        if (conv) {
          setRequestStatus(conv.request_status || 'none');
          setRequestId(conv.request_id || null);
          if (conv.last_message) setRequestMessage(conv.last_message);
        }
      })
    );

    return () => unsubs.forEach(u => u());
  }, [friendId, user]);

  // ─── Send Message ─────────────────────────────────────
  const handleSend = useCallback(async (text: string) => {
    if (!user || !friendId) return;
    
    // If status is 'removed', send a new friend request instead of message
    if (requestStatus === 'removed') {
      const result = await messageService.sendFriendRequest(friendId, text);
      if (result.success) {
        setRequestStatus('pending_sent');
        setRequestId(result.requestId || null);
      }
      return;
    }
    
    await messageService.sendMessage(
      friendId, text, friendUsername, friendAvatar || null,
      replyTo ? { id: replyTo.id, text: replyTo.text } : undefined,
    );
    setReplyTo(null);
  }, [friendId, user, replyTo, friendUsername, friendAvatar, requestStatus]);

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

  // ─── Load More (older messages — triggered at TOP of list) ──
  const handleLoadMore = useCallback(async () => {
    if (loadingMore || !user || messages.length === 0) return;
    // Now wired to onEndReached, so this fires on every scroll to the visual top —
    // not just on an explicit tap. Without this guard an exhausted history would
    // re-query SQLite on every such scroll, forever.
    if (reachedOldestRef.current) return;
    setLoadingMore(true);
    const oldest = messages[0];
    const older = await messageService.getMessages(friendId, oldest.created_at);
    if (older.length > 0) {
      setMessages(prev => {
        const existingIds = new Set(prev.map(m => m.local_id || m.id));
        const unique = older.filter(m => !existingIds.has(m.local_id || m.id));
        // Nothing new despite rows coming back — we are at the start of history.
        if (unique.length === 0) reachedOldestRef.current = true;
        return unique.length === 0 ? prev : [...unique, ...prev];
      });
    } else {
      reachedOldestRef.current = true;
    }
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
    setBlockUserModalVisible(false);
    setRequestLoading(true);
    try {
      const success = await messageService.blockUser(friendId);
      if (success) router.back();
      else Alert.alert('Unable to block user', 'Please try again.');
    } catch (error) {
      Alert.alert('Unable to block user', 'Please try again.');
    } finally {
      setRequestLoading(false);
    }
  }, [friendId, router]);

  /**
   * Toggle mute. Optimistic so the switch feels instant, reverting if the write
   * fails — updateConversationPreferences persists is_muted locally and syncs to
   * the server.
   */
  const handleToggleMute = useCallback(async (next: boolean) => {
    setIsMuted(next);
    try {
      await messageService.updateConversationPreferences(friendId, { muted: next });
    } catch (err) {
      console.warn('[Chat] mute toggle failed:', err);
      setIsMuted(!next);
    }
  }, [friendId]);

  // ─── Scroll Handling ──────────────────────────────────
  // The list is inverted: offset 0 is the NEWEST message, at the visual bottom.
  // So "near the bottom" simply means a small scroll offset — no need to involve
  // contentSize or layoutMeasurement at all.
  const onScroll = useCallback((e: any) => {
    const offsetY = e.nativeEvent.contentOffset.y;
    isNearBottomRef.current = offsetY < 150;
    setShowScrollDown(offsetY > 300);
  }, []);

  const scrollToBottom = useCallback((animated = true) => {
    // Inverted: the newest message lives at offset 0.
    flatListRef.current?.scrollToOffset({ offset: 0, animated });
    hasScrolledToBottom.current = true;
    isNearBottomRef.current = true;
  }, []);

  /**
   * Reveal the list. With the inverted list there is no scroll-to-bottom to wait
   * for — the newest message is rendered in place on the first frame — so this is
   * only cheap insurance against a first-frame flash while cells measure.
   */
  const revealList = useCallback(() => {
    listOpacity.value = withTiming(1, { duration: 140 });
  }, [listOpacity]);

  // Reveal as soon as there is anything to show, or once loading resolves for an
  // empty conversation. No content-size handshake required any more.
  useEffect(() => {
    if (messages.length === 0 && loading) return;
    const id = requestAnimationFrame(revealList);
    return () => cancelAnimationFrame(id);
  }, [messages.length, loading, revealList]);

  // Final backstop so the list can never be stranded invisible.
  useEffect(() => {
    const id = setTimeout(revealList, 700);
    return () => clearTimeout(id);
  }, [revealList]);

  // Re-hide briefly when switching conversations so the next chat also opens
  // without a flash of the previous window.
  useEffect(() => {
    listOpacity.value = 0;
  }, [friendId, listOpacity]);

  // NOTE: the two scrollToEnd correction effects that used to live here (one for
  // the composer height settling, one for the typing bubble) are gone. Inverting
  // the list pins the newest message at the visual bottom permanently, so neither
  // a padding change nor a taller footer can push it out of view.

  // ─── Helpers ──────────────────────────────────────────
  const getInitials = (name: string) => name.charAt(0).toUpperCase();

  const isPendingReceived = requestStatus === 'pending_received';
  const isPendingSent = requestStatus === 'pending_sent';
  const pendingSentCount = useMemo(() => {
    if (!isPendingSent) return 0;
    const myId = user?.id;
    if (!myId) return 0;
    return messages.filter(m => m.from_user_id === myId && m.to_user_id === friendId).length;
  }, [isPendingSent, messages, user?.id, friendId]);
  // When status is 'removed', user CAN type to send a new friend request
  // Input is only locked for: loading, pending_received, or pending_sent with 2+ messages
  const isInputLocked =
    requestLoading ||
    isPendingReceived ||
    (isPendingSent && pendingSentCount >= 2);

  const formatFriendshipDate = useCallback((value?: string) => {
    if (!value) return 'Recently';
    return new Date(value).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
  }, []);

  const dismissScrollDate = useCallback(() => {
    if (datePillTimeoutRef.current) clearTimeout(datePillTimeoutRef.current);
    datePillTimeoutRef.current = setTimeout(() => {
      isUserScrollingRef.current = false;
      setScrollDate(null);
    }, 850);
  }, []);

  const handleViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (!isUserScrollingRef.current) return;
    const firstMessage = viewableItems.find((entry: any) => entry.isViewable && entry.item?.created_at)?.item as LocalDirectMessage | undefined;
    if (!firstMessage) return;

    setScrollDate(formatScrollDate(firstMessage.created_at));
    if (datePillTimeoutRef.current) clearTimeout(datePillTimeoutRef.current);
  }).current;

  useEffect(() => () => {
    if (datePillTimeoutRef.current) clearTimeout(datePillTimeoutRef.current);
  }, []);

  const closeProfile = useCallback(() => {
    profileScrollY.value = 0;
    profileScrollRef.current?.scrollTo({ y: 0, animated: false });
    setProfileOpen(false);
    sheetOffset.value = withTiming(0, { duration: 160 });
  }, [profileScrollY, sheetOffset]);

  const openProfile = useCallback(() => {
    profileScrollY.value = 0;
    profileScrollRef.current?.scrollTo({ y: 0, animated: false });
    setProfileOpen(true);
    sheetOffset.value = withTiming(maxSheetOffset.value, { duration: 180 });
  }, [maxSheetOffset, profileScrollY, sheetOffset]);

  const sheetGesture = useMemo(() => Gesture.Pan()
    .activeOffsetY([-6, 6])
    .failOffsetX([-18, 18])
    .onBegin(() => {
      sheetStartOffset.value = sheetOffset.value;
    })
    .onUpdate((event) => {
      const nextOffset = sheetStartOffset.value + event.translationY;
      sheetOffset.value = Math.min(maxSheetOffset.value, Math.max(0, nextOffset));
    })
    .onEnd((event) => {
      const shouldOpen = event.velocityY > 450 || sheetOffset.value > maxSheetOffset.value * 0.42;
      if (shouldOpen) {
        runOnJS(setProfileOpen)(true);
        sheetOffset.value = withTiming(maxSheetOffset.value, { duration: 180 });
      } else {
        runOnJS(closeProfile)();
      }
    }), [closeProfile, maxSheetOffset, sheetOffset, sheetStartOffset]);

  // ─── Animated Styles ──────────────────────────────────
  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetOffset.value }],
  }));

  const profileContentAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      sheetOffset.value,
      [0, maxSheetOffset.value * 0.12, maxSheetOffset.value * 0.45],
      [0, 0.25, 1],
      Extrapolation.CLAMP,
    ),
    transform: [{
      translateY: interpolate(
        sheetOffset.value,
        [0, maxSheetOffset.value],
        [16, 0],
        Extrapolation.CLAMP,
      ),
    }],
  }));

  const headerIdentityAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(profileScrollY.value, [0, 56], [1, 0], Extrapolation.CLAMP),
    transform: [{
      translateX: interpolate(sheetOffset.value, [0, maxSheetOffset.value], [0, 12], Extrapolation.CLAMP),
    }, {
      // Reduce vertical travel so the identity stays centered above the stats
      translateY: interpolate(sheetOffset.value, [0, maxSheetOffset.value], [0, 80], Extrapolation.CLAMP),
    }, {
      // Slightly larger but not excessive scale
      scale: interpolate(sheetOffset.value, [0, maxSheetOffset.value], [1, 1.35], Extrapolation.CLAMP),
    }],
  }));

  const headerBackdropAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(sheetOffset.value, [0, maxSheetOffset.value * 0.55], [1, 0], Extrapolation.CLAMP),
  }));

  const fixedHandleAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(sheetOffset.value, [0, maxSheetOffset.value * 0.4, maxSheetOffset.value], [0, 0, 1], Extrapolation.CLAMP),
  }));

  const listAnimatedStyle = useAnimatedStyle(() => ({
    opacity: listOpacity.value,
  }));

  // The "Pull down to view profile" hint fades out as soon as the drag starts, so
  // it does not sit on top of the profile content as the panel travels down.
  const pullHintAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      sheetOffset.value,
      [0, Math.max(maxSheetOffset.value, 1) * 0.12],
      [1, 0],
      Extrapolation.CLAMP,
    ),
  }));

  const performClear = useCallback(async () => {
    if (!user?.id || !friendId) return;
    try {
      await messageService.clearConversationHistory(friendId);
      setMessages([]);
      listOpacity.value = withTiming(1, { duration: 300 });
    } catch (error) {
      console.warn('[Chat] Failed to clear conversation history:', error);
    }
  }, [user?.id, friendId, listOpacity]);

  const performDeleteFriend = useCallback(async () => {
    try {
      await messageService.deleteFriend(friendId);
      router.back();
    } catch (err) {
      console.warn('Delete friend failed:', err);
    }
  }, [friendId, router]);

  // ─── Render Helpers ───────────────────────────────────
  const renderMessage = useCallback(({ item, index }: { item: LocalDirectMessage; index: number }) => {
    // Only animate genuinely new arrivals. The list is inverted, so new messages
    // land at index 0 rather than at the end — an `index >= prevCount` test (which
    // is what this was) would animate the OLDEST messages instead, and would
    // re-animate a whole screenful every time the window changed.
    const isNew = index < newAtHeadCountRef.current;
    // Build reactions array for this message (already stored as Reaction[] in state)
    const msgReactions: Reaction[] = reactions[item.id] || reactions[item.local_id] || [];
    const isMine = item.from_user_id === user?.id;
    const bubble = (
      <SwipeableRow onReply={() => handleReply(item)}>
        <ChatBubble
          message={item}
          isMine={isMine}
          onRetry={handleRetry}
          onReply={handleReply}
          reactions={msgReactions}
        />
      </SwipeableRow>
    );

    if (isNew) {
      return (
        <Animated.View entering={FadeInDown.duration(200)}>
          {bubble}
        </Animated.View>
      );
    }
    return bubble;
  }, [user, handleRetry, handleReply, reactions]);

  // Track how many messages were appended at the tail since the last render, so
  // the inverted list knows how many head items (index 0..n) are genuinely new
  // and should animate in. Pagination prepends to the head of `messages`, which
  // becomes the TAIL of the inverted list, so it correctly animates nothing.
  useEffect(() => {
    const grew = messages.length - prevMessageCountRef.current;
    newAtHeadCountRef.current = grew > 0 && prevMessageCountRef.current > 0 ? grew : 0;
    prevMessageCountRef.current = messages.length;
  }, [messages.length]);

  const keyExtractor = useCallback((item: LocalDirectMessage) => item.local_id || item.id, []);

  /**
   * Data for the inverted list: newest message first.
   *
   * `messages` stays oldest-first everywhere else (SQLite order, pagination,
   * reconcile logic, prevMessageCountRef) — only the render order flips. With
   * `inverted`, index 0 sits at the visual bottom, so the list opens on the newest
   * message natively. No scrollToEnd, no top-down first frame, and only the
   * on-screen window gets rendered instead of everything down to the bottom.
   */
  const invertedMessages = useMemo(() => {
    return [...messages].reverse().map(msg => ({
      ...msg,
      // Inject reactions directly into data item so FlashList detects change
      __reactions: (reactions[msg.id] || reactions[msg.local_id] || []).map(r => `${r.emoji}:${r.count}:${r.reacted ? 1 : 0}`).join(','),
    }));
  }, [messages, reactions]);

  return (
    <View style={[styles.root, { backgroundColor: bg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* ── Glass Header ── */}
      <View
        style={[styles.header, {
          paddingTop: insets.top + 14,
          paddingBottom: 14,
        }]}
        onLayout={(event) => setHeaderHeight(event.nativeEvent.layout.height)}
      >
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: glassHeader }, headerBackdropAnimatedStyle]} />
        <View style={styles.headerRow}>
          {/* Back */}
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-back" size={26} color={profileOpen ? '#ffffff' : textColor} />
          </TouchableOpacity>

          <Animated.View style={[styles.headerIdentity, headerIdentityAnimatedStyle]}>
          <TouchableOpacity onPress={openProfile} activeOpacity={0.8} style={styles.headerAvatarWrap}>
            {(friendProfile?.avatar || friendAvatar) ? (
              <Image source={{ uri: friendProfile?.avatar || friendAvatar }} style={styles.headerAvatar} />
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
          </TouchableOpacity>

          {/* Name + status */}
          <View style={styles.headerInfo}>
            <Text style={[styles.headerName, { color: profileOpen ? '#ffffff' : textColor }]} numberOfLines={1}>
              {friendUsername}
            </Text>
            <Text style={[styles.headerStatus, { color: isOnline ? '#22c55e' : profileOpen ? 'rgba(255,255,255,0.75)' : subtextColor }]}>
              {isTyping ? 'typing...' : isOnline ? 'online' : 'offline'}
            </Text>
          </View>
          </Animated.View>

          {/* Pending badge */}
          {isPendingSent && (
            <View style={[styles.pendingBadge, {
              backgroundColor: isDark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.1)',
            }]}>
              <Ionicons name="time-outline" size={11} color={accentColor} />
              <Text style={styles.pendingBadgeText}>Pending</Text>
            </View>
          )}

          {/* 3-dot menu */}
          <TouchableOpacity
            style={styles.menuBtn}
            onPress={() => setMenuVisible(true)}
          >
            <Ionicons name="ellipsis-vertical" size={20} color={profileOpen ? '#ffffff' : textColor} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Custom Menu Modal */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <Pressable style={styles.menuOverlay} onPress={() => setMenuVisible(false)}>
          <Pressable style={[styles.menuContent, { backgroundColor: isDark ? '#1e1e2e' : '#ffffff' }]} onPress={() => {}}>
            <TouchableOpacity
              style={[styles.menuItem, { borderBottomColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' }]}
              onPress={() => {
                setMenuVisible(false);
                setTimeout(() => setClearChatModalVisible(true), 150);
              }}
            >
              <Ionicons name="trash-outline" size={20} color="#ef4444" />
              <Text style={[styles.menuItemText, { color: '#ef4444' }]}>Clear Chat</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.menuItem, { borderBottomColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' }]}
              onPress={() => {
                setMenuVisible(false);
                setTimeout(() => setDeleteFriendModalVisible(true), 150);
              }}
            >
              <Ionicons name="person-remove-outline" size={20} color="#ef4444" />
              <Text style={[styles.menuItemText, { color: '#ef4444' }]}>Delete Friend</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.menuItem, { borderBottomWidth: 0 }]}
              onPress={() => setMenuVisible(false)}
            >
              <Text style={[styles.menuCancelText, { color: isDark ? '#fff' : '#1e293b' }]}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Confirmation Modals */}
      <ConfirmationModal
        visible={clearChatModalVisible}
        title="Clear Chat"
        message="Delete all messages from this conversation? This cannot be undone."
        confirmText="Clear"
        onCancel={() => setClearChatModalVisible(false)}
        onConfirm={async () => {
          setClearChatModalVisible(false);
          listOpacity.value = withTiming(0, { duration: 250 }, (finished) => {
            if (finished) {
              runOnJS(performClear)();
            }
          });
        }}
        isDark={isDark}
        destructive
      />

      <ConfirmationModal
        visible={deleteFriendModalVisible}
        title="Delete Friend"
        message={`Remove ${friendUsername} from your friends?`}
        confirmText="Delete"
        onCancel={() => setDeleteFriendModalVisible(false)}
        onConfirm={() => {
          setDeleteFriendModalVisible(false);
          listOpacity.value = withTiming(0, { duration: 250 }, (finished) => {
            if (finished) {
              runOnJS(performDeleteFriend)();
            }
          });
        }}
        isDark={isDark}
        destructive
      />

      <ConfirmationModal
        visible={blockUserModalVisible}
        title="Block User"
        message={`Block ${friendUsername}? They will not be able to message you or send you friend requests.`}
        confirmText="Block"
        onCancel={() => setBlockUserModalVisible(false)}
        onConfirm={handleBlockUser}
        isDark={isDark}
        destructive
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <View style={styles.stage} onLayout={(event) => setStageHeight(event.nativeEvent.layout.height)}>
          <Animated.View style={[styles.profileLayer, profileContentAnimatedStyle]}>
            <ScrollView
              ref={profileScrollRef}
              contentContainerStyle={styles.profileContent}
              onScroll={(event) => { profileScrollY.value = event.nativeEvent.contentOffset.y; }}
              scrollEventThrottle={16}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.profileCard}>
                {/* Cover + centred identity, per the reference: avatar with online
                    dot, name, status, then "Friend since" as quiet metadata. */}
                <ImageBackground
                  source={!coverImageFailed && friendProfile?.coverImage
                    ? { uri: friendProfile.coverImage }
                    : require('../../assets/profile_bg_default.png')}
                  style={styles.profileCover}
                  resizeMode="cover"
                  onError={() => setCoverImageFailed(true)}
                >
                  <LinearGradient
                    colors={['rgba(4,6,14,0.25)', 'rgba(4,6,14,0.92)']}
                    style={StyleSheet.absoluteFill}
                  />
                  {/* No avatar/name/status here on purpose. The fixed header's
                      identity block (avatar + name + status) animates down into
                      this space via headerIdentityAnimatedStyle — a real
                      shared-element transition. Rendering a second copy here is
                      what produced two profile images during the drag. Only the
                      metadata that does NOT exist in the header lives here. */}
                  <View style={styles.profileIdentity}>
                    <View style={styles.profileSinceRow}>
                      <Ionicons name="calendar-outline" size={12} color="rgba(255,255,255,0.55)" />
                      <Text style={styles.profileSinceText}>
                        Friend since {formatFriendshipDate(friendProfile?.friendsSince)}
                      </Text>
                    </View>
                  </View>
                  {friendProfile?.bio ? (
                    <View style={styles.bioOverlay}>
                      <Text style={styles.bioOverlayLabel}>BIO</Text>
                      <Text style={styles.bioOverlayText} numberOfLines={2}>
                        {friendProfile.bio}
                      </Text>
                    </View>
                  ) : null}
                </ImageBackground>

                <View style={styles.statsRowContainer}>
                  <View style={[styles.statsCard, { borderColor, backgroundColor: isDark ? '#1c1c2c' : '#faf9ff' }]}>
                  <View style={styles.statItem}>
                    <Ionicons name="people-outline" size={20} color={violetAccent} />
                    <Text style={[styles.statValue, { color: textColor }]}>{friendProfile?.mutualRoomsCount ?? 0}</Text>
                    <Text style={[styles.statLabel, { color: subtextColor }]}>Mutual Rooms</Text>
                  </View>
                  <View style={[styles.statDivider, { backgroundColor: borderColor }]} />
                  <View style={styles.statItem}>
                    <Ionicons name="checkbox-outline" size={20} color={violetAccent} />
                    <Text style={[styles.statValue, { color: textColor }]}>{friendProfile?.tasksTogether ?? 0}</Text>
                    <Text style={[styles.statLabel, { color: subtextColor }]}>Active Tasks</Text>
                  </View>
                  <View style={[styles.statDivider, { backgroundColor: borderColor }]} />
                  <View style={styles.statItem}>
                    <Ionicons name="flame-outline" size={20} color="#f59e0b" />
                    <Text style={[styles.statValue, { color: textColor }]}>{friendProfile?.streak ?? 0}</Text>
                    <Text style={[styles.statLabel, { color: subtextColor }]}>Current Streak</Text>
                  </View>
                </View>

                </View>

                {/* CONVERSATION — only Mute ships here. The reference also lists
                    Search in conversation / Media, Links & Files / Pinned Messages /
                    Notes, but none of those have backing code, so they are omitted
                    rather than shipped as dead rows. */}
                <Text style={[styles.profileSectionLabel, { color: subtextColor }]}>CONVERSATION</Text>
                <View style={[styles.profileList, { borderColor, backgroundColor: isDark ? '#1c1c2c' : '#faf9ff' }]}>
                  <View style={styles.profileListRow}>
                    <Ionicons name="notifications-outline" size={19} color={violetAccent} />
                    <Text style={[styles.profileListText, { color: textColor }]}>Mute notifications</Text>
                    <Switch
                      value={isMuted}
                      onValueChange={handleToggleMute}
                      trackColor={{ false: isDark ? '#303044' : '#e5e7eb', true: `${violetAccent}80` }}
                      thumbColor={isMuted ? violetAccent : '#f4f3f4'}
                    />
                  </View>
                </View>

                <Text style={[styles.profileSectionLabel, { color: subtextColor }]}>RELATIONSHIP</Text>
                <View style={[styles.profileList, { borderColor, backgroundColor: isDark ? '#1c1c2c' : '#fffafa' }]}>
                  <TouchableOpacity onPress={() => setBlockUserModalVisible(true)} style={[styles.profileListRow, { borderBottomColor: borderColor, borderBottomWidth: StyleSheet.hairlineWidth }]}>
                    <Ionicons name="ban-outline" size={20} color="#ef4444" />
                    <Text style={[styles.profileDangerText, styles.profileDangerTextFill]}>Block {friendUsername}</Text>
                    <Ionicons name="chevron-forward" size={17} color="#ef4444" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setDeleteFriendModalVisible(true)} style={[styles.profileListRow, { borderBottomColor: borderColor, borderBottomWidth: StyleSheet.hairlineWidth }]}>
                    <Ionicons name="person-remove-outline" size={20} color="#ef4444" />
                    <Text style={[styles.profileDangerText, styles.profileDangerTextFill]}>Delete Friend</Text>
                    <Ionicons name="chevron-forward" size={17} color="#ef4444" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setClearChatModalVisible(true)} style={styles.profileListRow}>
                    <Ionicons name="trash-outline" size={20} color="#ef4444" />
                    <View style={styles.profileDangerTextWrap}>
                      <Text style={styles.profileDangerText}>Clear Chat</Text>
                      <Text style={[styles.profileDangerSub, { color: subtextColor }]}>
                        This will remove all messages in this conversation.
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={17} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </Animated.View>

          <Animated.View
        style={[styles.sheet, {
          top: headerHeight,
          backgroundColor: sheetBg,
          // Straight edges — the rounded 32px corners made the message area read
          // as a floating card rather than the screen itself.
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: isDark ? 0.4 : 0.08,
          shadowRadius: 20,
          elevation: 12,
        }, sheetAnimatedStyle]}
      >
        <View style={styles.flex}>
          {/* Pull-down affordance. A bare grab-pill gave no indication of what the
              gesture did; this states it outright, and fades out as the panel opens
              so it never competes with the profile content. */}
          <GestureDetector gesture={sheetGesture}>
            <View style={styles.sheetHandle}>
              <View style={[styles.sheetHandleBar, {
                backgroundColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.14)',
              }]} />
              <Animated.View style={[styles.pullHintRow, pullHintAnimatedStyle]}>
                <Text style={[styles.pullHintText, { color: subtextColor }]}>
                  Pull down to view profile
                </Text>
                <Ionicons name="chevron-down" size={13} color={subtextColor} />
              </Animated.View>
            </View>
          </GestureDetector>

          {/* Inverted list — index 0 is the newest message and sits at the visual
              bottom, so the chat opens ON the latest message with nothing to scroll
              and only the visible window rendered. This replaced a top-down list
              plus a scrollToEnd, which painted the OLDEST message first and then
              jumped (the open "blink"), and could reveal cells FlashList had not
              measured yet (messages intermittently missing).

              FlashList counter-flips cells, header and footer automatically
              (getTransform in FlashList.js). The empty state is rendered outside
              the list so list padding and inversion cannot move or flip it. */}
          <Animated.View style={[styles.flex, listAnimatedStyle]}>
              <FlashList
                ref={flatListRef}
                data={invertedMessages}
                inverted
                keyExtractor={keyExtractor}
                renderItem={renderMessage}
                estimatedItemSize={64}
                // FlashList caches rendered cells and does NOT re-render them just
                // because renderItem's closure changed. Reactions live in component
                // state outside `data`, so extraData below is what makes a reaction
                // on an already-rendered bubble actually appear.
                // Inverted: the content start is the visual BOTTOM, so composer
                // clearance is paddingTop rather than paddingBottom.
                contentContainerStyle={messages.length === 0
                  ? { ...styles.listContent, paddingTop: composerHeight + 12 }
                  : { ...styles.listContent, paddingTop: composerHeight + 12 }}
                showsVerticalScrollIndicator={false}
                onScroll={onScroll ? (e) => { messageService.emit('picker:close_all'); onScroll(e); } : undefined}
                onScrollBeginDrag={() => {
                  isUserScrollingRef.current = true;
                  messageService.emit('picker:close_all');
                  if (datePillTimeoutRef.current) clearTimeout(datePillTimeoutRef.current);
                }}
                onScrollEndDrag={dismissScrollDate}
                onMomentumScrollEnd={dismissScrollDate}
                onViewableItemsChanged={handleViewableItemsChanged}
                extraData={reactions}
                viewabilityConfig={{ itemVisiblePercentThreshold: 10 }}
                scrollEventThrottle={16}
                // Inverted, the list "end" is the visual TOP — i.e. the oldest
                // message — so onEndReached is exactly the pagination trigger.
                // This is what the old onStartReached workaround was faking.
                onEndReached={handleLoadMore}
                onEndReachedThreshold={0.3}
                // Rendered at the visual TOP (inverted swaps these): the
                // load-older affordance belongs above the oldest message.
                ListFooterComponent={
                  <>
                    {loadingMore && (
                      <View style={styles.loadingMoreTop}>
                        <ActivityIndicator size="small" color={accentColor} />
                      </View>
                    )}
                    {/* Manual fallback — onEndReached covers the common case, this
                        stays for when the list is too short to trigger it. */}
                    {messages.length >= 50 && !loadingMore && (
                      <TouchableOpacity
                        style={[styles.loadMoreBtn, {
                          backgroundColor: isDark ? 'rgba(99,102,241,0.08)' : 'rgba(99,102,241,0.05)'
                        }]}
                        onPress={handleLoadMore}
                      >
                        <Ionicons name="chevron-up" size={14} color={accentColor} />
                        <Text style={[styles.loadMoreText, { color: accentColor }]}>Load older messages</Text>
                      </TouchableOpacity>
                    )}
                  </>
                }
                // Rendered at the visual BOTTOM, directly above the composer:
                // request banners and the typing bubble.
                ListHeaderComponent={
                  <>
                    {isPendingReceived && (
                      <MessageRequestBanner
                        isDark={isDark}
                        username={friendUsername}
                        message={requestMessage || undefined}
                        loading={requestLoading}
                        onAccept={handleAcceptRequest}
                        onDecline={handleDeclineRequest}
                        onBlock={() => setBlockUserModalVisible(true)}
                      />
                    )}
                    {requestStatus === 'removed' && (
                      <View style={[styles.removedBanner, {
                        backgroundColor: isDark ? 'rgba(239,68,68,0.1)' : 'rgba(239,68,68,0.05)',
                        borderColor: isDark ? 'rgba(239,68,68,0.2)' : 'rgba(239,68,68,0.1)',
                        marginTop: 8,
                        marginHorizontal: 16,
                        marginBottom: 16,
                      }]}>
                        <Ionicons name="person-remove-outline" size={24} color="#ef4444" style={{ marginBottom: 8 }} />
                        <Text style={{ color: textColor, fontWeight: '600', marginBottom: 4 }}>You are no longer friends</Text>
                        <Text style={{ color: subtextColor, fontSize: 12, textAlign: 'center', marginHorizontal: 16, marginBottom: 12 }}>
                          {friendUsername} has removed you from their friends list. Send a new message to send a friend request.
                        </Text>
                      </View>
                    )}
                    <TypingIndicator isDark={isDark} visible={isTyping} username={friendUsername} />
                  </>
                }
                ListEmptyComponent={null}
              />
              {!loading && messages.length === 0 && requestStatus !== 'removed' && (
                <View pointerEvents="none" style={[styles.emptyOverlay, { bottom: composerHeight + 12 }]}>
                  <View style={[styles.emptyChat, { transform: [{ translateY: -40 }] }]}>
                    <View style={[styles.emptyIcon, {
                      backgroundColor: isDark ? 'rgba(99,102,241,0.1)' : 'rgba(99,102,241,0.06)'
                    }]}>
                      <Ionicons name="chatbubble-outline" size={36} color={accentColor} />
                    </View>
                    <Text style={[styles.emptyText, { color: textColor }]}>
                      Start the conversation
                    </Text>
                    <Text style={[styles.emptySub, { color: subtextColor }]}>
                      Say hi to {friendUsername}
                    </Text>
                  </View>
                </View>
              )}

              {scrollDate && (
                <Animated.View entering={FadeIn.duration(120)} style={[styles.scrollDatePill, { backgroundColor: isDark ? 'rgba(38,38,56,0.96)' : 'rgba(30,41,59,0.9)' }]}>
                  <Text style={styles.scrollDateText}>{scrollDate}</Text>
                </Animated.View>
              )}

              {/* Scroll to bottom FAB */}
              {showScrollDown && (
                <TouchableOpacity
                  style={[styles.scrollFab, {
                    backgroundColor: isDark ? 'rgba(40,40,60,0.9)' : 'rgba(255,255,255,0.95)',
                    borderColor,
                  }]}
                  onPress={() => scrollToBottom()}
                  activeOpacity={0.8}
                >
                  <Ionicons name="chevron-down" size={20} color={accentColor} />
                </TouchableOpacity>
              )}
            </Animated.View>

          {/* Fade-out band above the composer.
              Messages used to slide visibly under the transparent composer; now
              they dissolve just before reaching it, the way WhatsApp/Telegram do.

              Implemented as a gradient to the sheet's own background colour rather
              than a MaskedView alpha mask. MaskedView forces an offscreen render
              pass over the whole list on every frame, which is exactly the cost
              this screen cannot afford on a low-end device. Because the sheet
              background is a solid colour, fading to it is visually identical to a
              real mask for a fraction of the work.

              Both stops use the SAME rgb with different alpha on purpose — a
              literal 'transparent' stop renders as transparent-black on Android and
              would haze the messages grey. */}
          <LinearGradient
            colors={[sheetBgTransparent, sheetBg]}
            style={[styles.composerFade, { bottom: composerHeight }]}
            pointerEvents="none"
          />

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

        </View>
          </Animated.View>

          <Animated.View
            ref={inputWrapRef}
            onLayout={(event) => setComposerHeight(event.nativeEvent.layout.height)}
            style={[styles.inputWrap, composerKeyboardStyle, {
              // Keep the wrapper transparent so custom chat backgrounds remain visible.
              // Messages will visually dissolve into the background using the fade band
              // above the composer rather than being covered by a full-width opaque bar.
              backgroundColor: 'transparent',
              bottom: Platform.OS === 'android' && !keyboardVisible
                ? -Math.max(insets.bottom, 6)
                : 0,
              paddingBottom: Platform.OS === 'ios'
                ? Math.max(insets.bottom, 8)
                : keyboardVisible ? 4 : Math.max(insets.bottom, 6),
              paddingTop: 0,
            }]}
          >
            <MessageInput
              onSend={handleSend}
              onTyping={handleTyping}
              replyTo={replyTo}
              onCancelReply={() => setReplyTo(null)}
              disabled={isInputLocked}
              onFocus={() => {
                setKeyboardVisible(true);
                if (profileOpen) closeProfile();
              }}
              onBlur={() => {
                setKeyboardVisible(false);
                handleTyping(false);
              }}
            />
          </Animated.View>
          <GestureDetector gesture={sheetGesture}>
            <Animated.View
              style={[
                styles.fixedSheetHandle,
                { bottom: Math.max(composerHeight - 8, 0), backgroundColor: sheetBg },
                fixedHandleAnimatedStyle,
              ]}
            >
              <View style={[styles.sheetHandleBar, { backgroundColor: violetAccent }]}                 />
                {profileOpen && <BlurView intensity={18} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} pointerEvents="none" />}
            </Animated.View>
          </GestureDetector>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  stage: { flex: 1, position: 'relative', overflow: 'hidden' },

  profileLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  profileContent: {
    paddingBottom: 120,
  },
  profileCard: {
    minHeight: '100%',
  },
  profileCover: {
    width: '100%',
    // Shorter than before — the previous 300 (and the original 230) left a lot of
    // dead space above the stats card. The header identity animates into this area,
    // so it only needs room for that plus the "Friend since" line.
    height: 200,
    justifyContent: 'flex-end',
  },
  // Holds only the metadata that does NOT exist in the fixed header. The avatar,
  // name and status arrive by animation, not by being re-rendered here.
  profileIdentity: {
    alignItems: 'center',
    paddingBottom: 12,
    paddingHorizontal: 20,
  },
  profileSinceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: -6,
  },
  profileSinceText: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 10,
  },
  profileSectionLabel: {
    fontSize: 10.5,
    fontWeight: '600',
    letterSpacing: 0.8,
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 6,
  },
  profileDangerTextWrap: {
    flex: 1,
  },
  // Single-line danger rows (Block, Delete Friend) use this to push the chevron to
  // the far edge, the way profileListText does for normal rows.
  profileDangerTextFill: {
    flex: 1,
  },
  profileDangerSub: {
    fontSize: 11,
    marginTop: 2,
  },
  statsRowContainer: { flexDirection: 'row', alignItems: 'flex-start', marginHorizontal: 12, gap: 10 },
  statsCard: {
    flex: 1,
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 10,
    marginHorizontal: 0,
    marginBottom: 8,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  statItem: { flex: 1, alignItems: 'center', gap: 2, paddingHorizontal: 6 },
  statDivider: { width: StyleSheet.hairlineWidth, marginVertical: 2 },
  statValue: { fontSize: 16, fontWeight: '800' },
  statLabel: { fontSize: 9, fontWeight: '600', textAlign: 'center' },
  bioOverlay: {
    position: 'absolute',
    right: 12,
    bottom: 48,
    width: 128,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: 'rgba(8,8,20,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  bioOverlayLabel: {
    color: 'rgba(196,181,253,0.9)',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 2,
  },
  bioOverlayText: {
    color: 'rgba(255,255,255,0.86)',
    fontSize: 10,
    lineHeight: 13,
  },
  profileList: {
    borderWidth: 1,
    borderRadius: 12,
    marginHorizontal: 12,
    marginBottom: 10,
    overflow: 'hidden',
  },
  profileListRow: {
    alignItems: 'center',
    // No unconditional border — rows that need a divider set borderBottomWidth
    // inline, so a single-row section (Mute) does not get a dangling line.
    flexDirection: 'row',
    gap: 10,
    minHeight: 48,
    paddingHorizontal: 12,
  },
  profileListText: { flex: 1, fontSize: 14, fontWeight: '600' },
  profileDangerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 16,
    gap: 9,
    marginHorizontal: 16,
    marginBottom: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  // No flex here — Block/Delete rows rely on profileListText-style filling via the
  // row's own layout, and Clear Chat wraps this in profileDangerTextWrap which
  // carries the flex. Keeping flex:1 on both would double-flex that row.
  profileDangerText: { color: '#ef4444', fontSize: 13, fontWeight: '700' },
  
  // Header
  header: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    overflow: 'visible',
    paddingHorizontal: 16,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIdentity: { alignItems: 'center', flex: 1, flexDirection: 'row', zIndex: 5 },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center', marginRight: 2,
  },
  headerAvatarWrap: {
    position: 'relative', marginRight: 13,
  },
  headerAvatar: {
    width: 46, height: 46, borderRadius: 23,
    alignItems: 'center', justifyContent: 'center',
  },
  headerInitial: { color: '#fff', fontSize: 18, fontWeight: '700' },
  onlineDotOuter: {
    position: 'absolute', right: -2, bottom: -2,
    width: 15, height: 15, borderRadius: 7.5,
    borderWidth: 2.5, alignItems: 'center', justifyContent: 'center',
  },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22c55e' },
  headerInfo: { flex: 1 },
  headerName: { fontSize: 17, fontWeight: '700', letterSpacing: -0.3 },
  headerStatus: { fontSize: 10, fontWeight: '600', marginTop: 1 },
  pendingBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 12,
  },
  pendingBadgeText: {
    fontSize: 10.5, fontWeight: '700', color: '#6366f1', letterSpacing: 0.1,
  },
  menuBtn: {
    padding: 8,
    marginLeft: 'auto',
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuContent: {
    borderRadius: 16,
    width: '75%',
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
    borderBottomWidth: 1,
  },
  menuItemText: {
    fontSize: 16,
  },
  menuCancelText: {
    fontSize: 16,
    textAlign: 'center',
    width: '100%',
  },

  // Curved Sheet
  sheet: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
    // Squared off — no border radius. The message area is the screen, not a card.
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  sheetHandle: {
    // Compact: the bar and label together were eating noticeable height off the
    // message area, so the bar is inline with the label rather than stacked above.
    alignItems: 'center', paddingTop: 5, paddingBottom: 4,
  },
  sheetHandleBar: {
    width: 26, height: 2.5, borderRadius: 0,
  },
  pullHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  pullHintText: {
    fontSize: 10.5,
    fontWeight: '500',
  },
  fixedSheetHandle: {
    alignItems: 'center',
    // Squared off to match the sheet.
    height: 24,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    zIndex: 4,
  },
  
  // List
  listContent: { paddingVertical: 12, paddingHorizontal: 4 },
  // Sits directly on top of the composer's upper edge; `bottom` is set inline from
  // the measured composerHeight.
  composerFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    // Slightly smaller fade band to avoid obscuring custom backgrounds while
    // still dissolving bubbles before they reach the composer.
    height: 12,
    zIndex: 2,
  },
  listEmpty: { flex: 1, justifyContent: 'center' },

  // Load more at top (non-layout-shifting)
  loadingMoreTop: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  loadMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginHorizontal: 40,
    marginBottom: 8,
    borderRadius: 20,
  },
  loadMoreText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Removed banner
  removedBanner: {
    borderWidth: 1,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  
  // Empty
  emptyOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  scrollDatePill: {
    alignSelf: 'center',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    position: 'absolute',
    top: 12,
    zIndex: 3,
  },
  scrollDateText: { color: '#ffffff', fontSize: 12, fontWeight: '600' },
  
  // Pending bar
  pendingBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 10,
    borderTopWidth: 1,
  },
  pendingBarText: { fontSize: 12, fontWeight: '500', flex: 1 },
  
  // Input wrapper
  inputWrap: { position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 3 },
});
