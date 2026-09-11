/**
 * Messages Screen
 * Fixed compact header with a conversation-only scroll area
 * AddFriendModal bottom sheet for adding friends
 * Rich Krios styling Ã¢â‚¬â€ edge shine, gradients, glassmorphism
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, RefreshControl, Pressable,
  Dimensions, Platform, StatusBar, Modal, FlatList, Image,
  KeyboardAvoidingView, Keyboard, InteractionManager,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { HomeNavContext } from '../../context/HomeNavContext';
import messageService from '../../services/messageService';
import api from '../../services/api';
import { LocalConversation } from '../../services/sqliteService';
import ConversationCard from '../../components/messaging/ConversationCard';
import ConfirmationModal from '../../components/ConfirmationModal';
const { height: H } = Dimensions.get('window');
const primary   = '#6366f1';
const accent    = '#8b5cf6';
const cyan      = '#06b6d4';
const AnimatedFlashList = Animated.createAnimatedComponent(FlashList) as any;

export default function MessagesScreen() {
  const { isDark } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  // Ã¢â€â‚¬Ã¢â€â‚¬ Colors Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  const bg       = isDark ? '#080810' : '#f8f9ff';
  const text     = isDark ? '#ffffff' : '#0f172a';
  const textSub  = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(15,23,42,0.55)';
  const textTert = isDark ? 'rgba(255,255,255,0.28)' : 'rgba(15,23,42,0.28)';
  const border   = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';
  const surf     = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
  const inputBg  = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)';

  // Ã¢â€â‚¬Ã¢â€â‚¬ State Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  const [conversations, setConversations] = useState<LocalConversation[]>([]);
  const [search, setSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchResults, setSearchResults] = useState<LocalConversation[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [addFriendModalVisible, setAddFriendModalVisible] = useState(false);
  const [addFriendSearch, setAddFriendSearch] = useState('');
  const [addFriendResults, setAddFriendResults] = useState<LocalConversation[]>([]);
  const [removeModalVisible, setRemoveModalVisible] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<LocalConversation | null>(null);
  const [conversationActionTarget, setConversationActionTarget] = useState<LocalConversation | null>(null);
  const [preferenceSaving, setPreferenceSaving] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Keyboard listeners for perfect modal input handling
  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      e => setKeyboardHeight(e.endCoordinates.height)
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardHeight(0)
    );
    return () => { show.remove(); hide.remove(); };
  }, []);

  // Register + button to open add friend modal (instead of task modal on home)
  const { setOpenAIChat, setOpenAddTask } = React.useContext(HomeNavContext);
  const openAddFriend = React.useCallback(() => {
    setAddFriendModalVisible(true);
  }, []);
  const closeAddFriend = React.useCallback(() => {
    Keyboard.dismiss();
    setAddFriendModalVisible(false);
    setAddFriendSearch('');
    setAddFriendResults([]);
  }, []);
  

  // Also re-register when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      const handle = InteractionManager.runAfterInteractions(() => {
        setOpenAIChat(() => router.push('/(home)/ai-chat'));
        setOpenAddTask(openAddFriend);
      });
      return () => handle.cancel();
    }, [openAddFriend, setOpenAIChat, setOpenAddTask, router])
  );

  // Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Load data Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  const loadData = useCallback(async (silent = false) => {
    try {
      if (user?.id) {
        await messageService.initialize(user.id);
      }
      const convs = await messageService.getConversations();
      console.log('[Messages] Loaded conversations:', convs.length);
      setConversations(convs);
    } catch (e) {
      console.warn('[Messages] loadData error:', e);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [user?.id]);

  // Initial load
  useEffect(() => { loadData(); }, [loadData]);

  // Refresh on screen focus Ã¢â‚¬â€ clears search, refreshes conversations + online snapshot
  useFocusEffect(useCallback(() => {
    setSearch('');
    setSearchResults([]);
    setAddFriendSearch('');
    setAddFriendResults([]);
    InteractionManager.runAfterInteractions(() => {
      loadData(true);
    });
    
    // Defer non-critical API calls to prioritize UI rendering
    setTimeout(() => {
      // Ask server for fresh online snapshot (lower priority)
      messageService.requestOnlineSnapshot();
      
      // Also fetch friends list to get online status for all friends (deferred)
      messageService.getFriends().then(friends => {
        console.log('[Messages] Loaded friends for presence:', friends.length);
        // Update conversations with online status based on friends
        setConversations(prev => {
          const friendIds = new Set(friends.map(f => f.id));
          // All friends start as potentially online - will be updated by presence events
          return prev;
        });
      }).catch(err => console.warn('[Messages] getFriends failed:', err));
    }, 500); // Delay secondary API calls by 500ms
  }, [loadData]));

  // Real-time events Ã¢â‚¬â€ debounce rapid conversation:list + message:new to avoid
  // two back-to-back SQLite reads + setConversations calls within milliseconds.
  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const debouncedRefresh = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => loadData(true), 80);
    };
    const handleOnlineStatus = (data: { userId: string; isOnline: boolean }) => {
      setConversations(prev => {
        const next = prev.map(c =>
          c.friend_id === data.userId ? { ...c, is_online: data.isOnline ? 1 : 0 } : c
        );
        return next;
      });
    };

    const handleOnlineUsers = (userIds: string[]) => {
      setConversations(prev => {
        const setIds = new Set(userIds);
        const next = prev.map(c => ({ ...c, is_online: setIds.has(c.friend_id) ? 1 : 0 }));
        return next;
      });
    };

    const unsubs: (() => void)[] = [];
    unsubs.push(messageService.on('conversation:list', debouncedRefresh));
    unsubs.push(messageService.on('message:new', debouncedRefresh));
    unsubs.push(messageService.on('presence:changed', handleOnlineStatus));
    unsubs.push(messageService.on('presence:bulk', handleOnlineUsers));
    
    // Handle friend removal - immediately remove conversation from list
    unsubs.push(messageService.on('friend_removed', (payload: { friendId: string; initiatedByMe: boolean }) => {
      console.log('[Messages] friend_removed event received:', payload);
      if (payload.initiatedByMe) {
        // I deleted them - remove from list immediately
        setConversations(prev => prev.filter(c => c.friend_id !== payload.friendId));
      } else {
        // They deleted me - keep conversation but update status (loadData will handle it)
        loadData(true);
      }
    }));
    
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      unsubs.forEach(u => u());
    };
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  // Ã¢â€â‚¬Ã¢â€â‚¬ Search (local only - friends in conversations) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  const handleSearch = useCallback((q: string) => {
    setSearch(q);
    if (!q.trim()) { setSearchResults([]); return; }
    const local = conversations.filter(c =>
      (c.username || '').toLowerCase().includes(q.toLowerCase())
    );
    setSearchResults(local);
  }, [conversations]);

  // Ã¢â€â‚¬Ã¢â€â‚¬ Search for AddFriendModal Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const handleAddFriendSearch = useCallback((q: string) => {
    setAddFriendSearch(q);
    
    // Clear previous timeout
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    
    if (!q.trim()) { 
      setAddFriendResults([]); 
      return; 
    }
    
    // Debounce API call
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await api.get(`/friends/search?query=${encodeURIComponent(q)}`);
        if (res.data?.users) {
          // Transform to LocalConversation format
          const transformed = res.data.users.map((u: any) => ({
            friend_id: u.id,
            username: u.username,
            avatar: null,
            last_message: null,
            is_online: 0,
            unread_count: 0,
            request_status: 'none',
            updated_at: new Date().toISOString(),
          }));
          setAddFriendResults(transformed);
        }
      } catch (err) {
        console.warn('[AddFriend] Search failed:', err);
        // Fallback to local filter
        const results = conversations.filter(c =>
          (c.username || '').toLowerCase().includes(q.toLowerCase())
        );
        setAddFriendResults(results);
      }
    }, 300);
  }, [conversations]);

  // Ã¢â€â‚¬Ã¢â€â‚¬ Navigate Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  const goToChat = useCallback((conv: LocalConversation) => {
    router.push({
      pathname: '/(home)/chat',
      params: {
        friendId: conv.friend_id,
        friendUsername: conv.username || '',
        friendAvatar: conv.avatar || '',
        requestStatus: conv.request_status || 'accepted',
      },
    });
  }, [router]);

  // Ã¢â€â‚¬Ã¢â€â‚¬ Delete with warning + actual API call Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  const handleDelete = useCallback((conv: LocalConversation) => {
    setRemoveTarget(conv);
    setRemoveModalVisible(true);
  }, [loadData]);

  // Ã¢â€â‚¬Ã¢â€â‚¬ Computed Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  const filtered = (search.trim() ? searchResults : conversations)

  const pinnedConversations = conversations.filter(conversation => conversation.is_pinned === 1)
  const recentConversations = conversations.filter(conversation => conversation.is_pinned !== 1)
  const displayedConversations = search.trim() ? filtered : recentConversations;
  const totalUnread = conversations.reduce((s, c) => s + (c.unread_count || 0), 0);

  const updateConversationPreference = useCallback(async (preference: 'pinned' | 'muted') => {
    if (!conversationActionTarget || preferenceSaving) return;
    const nextValue = preference === 'pinned'
      ? conversationActionTarget.is_pinned !== 1
      : conversationActionTarget.is_muted !== 1;

    setPreferenceSaving(true);
    try {
      await messageService.updateConversationPreferences(conversationActionTarget.friend_id, { [preference]: nextValue });
      // Close modal immediately after API succeeds Ã¢â‚¬â€ don't wait for loadData
      setConversationActionTarget(null);
      // Refresh in background
      await loadData(true);
    } catch (error) {
      console.warn('[Messages] conversation preference update failed:', error);
    } finally {
      setPreferenceSaving(false);
    }
  }, [conversationActionTarget, loadData, preferenceSaving]);

  // Consistent avatar color per user
  const avatarPalette = ['#6366f1','#8b5cf6','#06b6d4','#f59e0b','#22c55e','#ec4899','#f97316'];
  const avatarColor = (id: string) =>
    avatarPalette[id.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % avatarPalette.length];

  return (
    <View style={[s.root, { backgroundColor: bg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <ConfirmationModal
        visible={removeModalVisible}
        title="Remove Friend"
        message={
          removeTarget
            ? `Remove ${removeTarget.username} from your friends? You'll need to send a new message request to chat again. This only affects your side.`
            : 'Remove this friend?'
        }
        confirmText="Remove"
        cancelText="Cancel"
        destructive
        isDark={isDark}
        onCancel={() => {
          setRemoveModalVisible(false);
          setRemoveTarget(null);
        }}
        onConfirm={async () => {
          const target = removeTarget;
          setRemoveModalVisible(false);
          setRemoveTarget(null);
          if (!target) return;
          // Optimistically remove from UI immediately
          setConversations(prev => prev.filter(c => c.friend_id !== target.friend_id));
          try {
            await messageService.deleteFriend(target.friend_id);
          } catch (err) {
            console.warn('[Messages] Delete friend failed:', err);
            loadData(true);
          }
        }}
      />

      <Modal
        transparent
        animationType="fade"
        visible={!!conversationActionTarget}
        onRequestClose={() => setConversationActionTarget(null)}
      >
        <Pressable style={s.actionOverlay} onPress={() => setConversationActionTarget(null)}>
          <Pressable style={[s.actionSheet, { backgroundColor: isDark ? '#161625' : '#ffffff', borderColor: border }]} onPress={() => {}}>
            <Text style={[s.actionTitle, { color: text }]} numberOfLines={1}>{conversationActionTarget?.username}</Text>
            <TouchableOpacity disabled={preferenceSaving} onPress={() => updateConversationPreference('pinned')} style={[s.actionRow, { borderBottomColor: border }]}>
              <Ionicons name={conversationActionTarget?.is_pinned === 1 ? 'pin-outline' : 'pin'} size={20} color={primary} />
              <Text style={[s.actionText, { color: text }]}>{conversationActionTarget?.is_pinned === 1 ? 'Unpin conversation' : 'Pin conversation'}</Text>
            </TouchableOpacity>
            <TouchableOpacity disabled={preferenceSaving} onPress={() => updateConversationPreference('muted')} style={[s.actionRow, { borderBottomColor: border }]}>
              <Ionicons name={conversationActionTarget?.is_muted === 1 ? 'notifications-outline' : 'notifications-off-outline'} size={20} color={primary} />
              <Text style={[s.actionText, { color: text }]}>{conversationActionTarget?.is_muted === 1 ? 'Unmute notifications' : 'Mute notifications'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setConversationActionTarget(null)} style={s.actionRow}>
              <Text style={[s.actionCancel, { color: textSub }]}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

       {/* Ã¢â€â‚¬Ã¢â€â‚¬ Background (shared gradient for header + body) Ã¢â€â‚¬Ã¢â€â‚¬ */}
       <LinearGradient
         colors={isDark ? ['#080810','#0d0d1e','#080810'] : ['#f8f9ff','#f0f0ff','#f8f9ff']}
         locations={[0, 0.5, 1]} start={{ x: 0.3, y: 0 }} end={{ x: 0.7, y: 1 }}
         style={StyleSheet.absoluteFill}
       />
       <LinearGradient
         colors={[`rgba(99,102,241,${isDark ? '0.12' : '0.05'})`, 'transparent']}
         start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
         style={StyleSheet.absoluteFill}
       />
       {/* Edge shine Ã¢â‚¬â€ left */}
       <LinearGradient
         colors={[`rgba(139,92,246,${isDark ? '0.2' : '0.08'})`, 'transparent']}
         start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
         style={[StyleSheet.absoluteFill, { width: 2 }]}
       />

       {/* Ã¢â€â‚¬Ã¢â€â‚¬ Header (normal flow, not absolute) Ã¢â€â‚¬Ã¢â€â‚¬ */}
       <View style={[s.header, { paddingTop: insets.top + 4, zIndex: 20 }]}>
          <View style={s.fixedHeroRow}>
            <Image source={require('../../assets/krios new logo with no background.png')} style={s.kriosLogo} resizeMode="contain" />
            <Text style={[s.fixedTitle, { color: text }]}>Messages</Text>
            <TouchableOpacity onPress={openAddFriend} style={[s.fixedAction, s.fixedCompose]}>
              <Ionicons name="create-outline" size={18} color="#ffffff" />
            </TouchableOpacity>
          </View>

         <View style={[s.fixedSearch, { backgroundColor: inputBg, borderColor: searchFocused ? primary : border }]}>
          <Ionicons name="search-outline" size={20} color={textTert} />
          <TextInput
            id="messages-search-input"
            style={[s.fixedSearchInput, { color: text }]}
            value={search}
            onChangeText={handleSearch}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder="Search conversations..."
            placeholderTextColor={textTert}
            returnKeyType="search"
            accessibilityLabel="messages-search-input"
            testID="messages-search-input"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => handleSearch('')}>
              <Ionicons name="close-circle" size={18} color={textTert} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Ã¢â€â‚¬Ã¢â€â‚¬ Scrollable content (starts below absolute header) Ã¢â€â‚¬Ã¢â€â‚¬ */}
      <AnimatedFlashList
        data={loading ? [] : displayedConversations}
        estimatedItemSize={76}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing} onRefresh={onRefresh}
            tintColor={primary} colors={[primary]}
          />
        }
        ListHeaderComponent={
          <View>
            {!search && conversations.some(c => c.is_online === 1) ? (
              <View style={s.onlineAvatarsRow}>
                {conversations.filter(c => c.is_online === 1).slice(0, 5).map((c) => {
                  const initials = (c.username || '?').slice(0, 1).toUpperCase();
                  const bgColor = avatarColor(c.friend_id);
                  return (
                    <TouchableOpacity
                      key={`online-${c.friend_id}`}
                      onPress={() => goToChat(c)}
                      activeOpacity={0.8}
                      style={[
                        s.onlineAvatar,
                        {
                          backgroundColor: bgColor,
                          borderColor: bg,
                        },
                      ]}
                    >
                      {c.avatar ? (
                        <Image source={{ uri: c.avatar }} style={s.onlineAvatarImg} />
                      ) : (
                        <Text style={[s.onlineAvatarText, { color: '#fff' }]}>{initials}</Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : (
              <TouchableOpacity onPress={openAddFriend} activeOpacity={0.85} style={[s.startConversationCard, { borderColor: border }]}>
                <LinearGradient colors={['rgba(99,102,241,0.25)', 'rgba(139,92,246,0.08)']} style={s.startConversationIcon}>
                  <Ionicons name="add" size={20} color="#a78bfa" />
                </LinearGradient>
                <View style={s.startConversationCopy}>
                  <Text style={[s.startConversationTitle, { color: text }]}>Start a conversation</Text>
                  <Text style={[s.startConversationSub, { color: textSub }]}>Message anyone on Krios</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={textSub} />
              </TouchableOpacity>
            )}

            {!search && pinnedConversations.length > 0 && (
              <View style={s.pinnedSection}>
                <View style={s.referenceSectionRow}>
                  <Text style={[s.referenceSectionLabel, { color: textSub }]}>PINNED</Text>
                  <Text style={[s.referenceSectionLink, { color: primary }]}>{pinnedConversations.length} pinned</Text>
                </View>
                <View style={s.pinnedList}>
                  {pinnedConversations.map(conversation => (
                    <ConversationCard
                      key={conversation.friend_id}
                      conversation={conversation}
                      isDark={isDark}
                      onPress={() => goToChat(conversation)}
                      onLongPress={() => setConversationActionTarget(conversation)}
                      onDelete={() => handleDelete(conversation)}
                    />
                  ))}
                </View>
              </View>
            )}

            {/* Recent conversations */}
            <View style={s.chatContainer}>
              <View style={s.sectionRow}>
                <Text style={[s.sectionLabel, { color: textTert }]}>
                  {search ? (searchResults.length > 0 ? `${searchResults.length} found` : 'No results') : 'Recent'}
                </Text>
                {!search && totalUnread > 0 && (
                  <View style={[s.badge, { backgroundColor: primary }]}><Text style={s.badgeTxt}>{totalUnread}</Text></View>
                )}
              </View>
            </View>
          </View>
        }
        renderItem={({ item, index }: { item: any, index: number }) => (
          <Animated.View>
            <ConversationCard
              conversation={item}
              onPress={() => goToChat(item)}
              onLongPress={() => setConversationActionTarget(item)}
              onDelete={() => handleDelete(item)}
              isDark={isDark}
            />
          </Animated.View>
        )}
        ListEmptyComponent={
          <View style={s.emptyWrap}>
            {loading ? (
              [1, 2, 3, 4, 5].map(i => (
                <View key={i} style={[s.skeleton, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)', opacity: 1 - i * 0.15 }]} />
              ))
            ) : (
              <>
                <LinearGradient colors={['rgba(99,102,241,0.12)', 'rgba(139,92,246,0.07)']} style={[s.emptyIcon, { borderColor: `${primary}33` }]}>
                  <Ionicons name="chatbubbles-outline" size={34} color={primary} />
                </LinearGradient>
                <Text style={[s.emptyTitle, { color: text }]}>{search ? 'No conversations found' : 'No messages yet'}</Text>
                <Text style={[s.emptySub, { color: textSub }]}>{search ? 'Try a different name' : 'Add friends to start chatting'}</Text>
                {!search && (
                  <TouchableOpacity style={{ borderRadius: 22, overflow: 'hidden', marginTop: 8 }} onPress={() => setAddFriendModalVisible(true)}>
                    <LinearGradient colors={[primary, accent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.emptyBtn}>
                      <Ionicons name="person-add-outline" size={16} color="#fff" />
                      <Text style={s.emptyBtnTxt}>Find Friends</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        }
        ListFooterComponent={
          <View style={{ height: 20 }} />
        }
      />

      {/* Ã¢â€â‚¬Ã¢â€â‚¬ AddFriendModal Bottom Sheet Ã¢â€â‚¬Ã¢â€â‚¬ */}
      <Modal
        transparent
        animationType="slide"
        visible={!!addFriendModalVisible}
        onRequestClose={closeAddFriend}
      >
         <Pressable style={[s.modalOverlay, { backgroundColor: isDark ? 'rgba(8,8,16,0.6)' : 'rgba(0,0,0,0.4)', paddingBottom: Math.max(insets.bottom, keyboardHeight) }]} onPress={closeAddFriend}>
          <Pressable style={[s.modalContent, { backgroundColor: bg }]} onPress={() => {}}>
            {/* Header with close button */}
            <View style={[s.modalHeader, { borderBottomColor: border }]}>
              <Text style={[s.modalTitle, { color: text }]}>Message Friends</Text>
              <TouchableOpacity
                onPress={closeAddFriend}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close-outline" size={24} color={text} />
              </TouchableOpacity>
            </View>

            {/* Search input */}
            <View style={[s.modalSearchBar, {
              backgroundColor: inputBg,
              borderColor: border,
            }]}>
              <Ionicons name="search-outline" size={15} color={textTert} />
              <TextInput
                id="friend-search-input"
                style={[s.modalSearchInput, { color: text }]}
                value={addFriendSearch}
                onChangeText={handleAddFriendSearch}
                placeholder="Search friends..."
                placeholderTextColor={textTert}
                returnKeyType="search"
                accessibilityLabel="friend-search-input"
                testID="friend-search-input"
              />
              {addFriendSearch.length > 0 && (
                <TouchableOpacity onPress={() => handleAddFriendSearch('')}>
                  <Ionicons name="close-circle" size={15} color={textTert} />
                </TouchableOpacity>
              )}
            </View>

            {/* Friends list */}
            <FlatList
              data={addFriendSearch.trim() ? addFriendResults : conversations}
              keyExtractor={(item) => `${item.friend_id}-${item.request_status || 'none'}`}
              scrollEnabled={true}
              contentContainerStyle={s.modalListContent}
              renderItem={({ item, index }) => (
                <Animated.View entering={FadeInDown.delay(index * 40)}>
                  <TouchableOpacity
                    style={[s.modalFriendItem, { borderBottomColor: border }]}
                    onPress={() => {
                      goToChat(item);
                      closeAddFriend();
                    }}
                  >
                    <View style={[s.modalAvatarContainer, { backgroundColor: avatarColor(item.friend_id) }]}>
                      <Text style={s.modalAvatarText}>
                        {(item.username || '?').slice(0, 1).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.modalFriendName, { color: text }]}>
                        {item.username || 'Unknown'}
                      </Text>
                      {item.last_message && (
                        <Text style={[s.modalFriendMessage, { color: textSub }]} numberOfLines={1}>
                          {item.last_message}
                        </Text>
                      )}
                    </View>
                    {item.is_online === 1 && (
                      <View style={s.modalOnlineBadge} />
                    )}
                  </TouchableOpacity>
                </Animated.View>
              )}
              ListEmptyComponent={
                <View style={s.modalEmptyWrap}>
                  <Text style={[s.modalEmptyText, { color: textTert }]}>
                    {addFriendSearch ? 'No friends found' : 'No friends yet'}
                  </Text>
                </View>
              }
            />
          </Pressable>
        </Pressable>
      </Modal>

      {/* SidebarNav is now rendered globally in _layout.tsx */}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  // Header
  header: {
    paddingHorizontal: 20, paddingBottom: 12,
    zIndex: 20,
  },
  fixedHeroRow: { alignItems: 'center', flexDirection: 'row', gap: 10, marginBottom: 11 },
  kriosLogo: { height: 38, width: 38 },
  fixedTitle: { flex: 1, fontSize: 27, fontWeight: '700', letterSpacing: -0.5 },
  fixedAction: { alignItems: 'center', borderRadius: 16, borderWidth: 1, height: 34, justifyContent: 'center', width: 34 },
  fixedCompose: { backgroundColor: primary, borderColor: '#a78bfa', shadowColor: primary, shadowOpacity: 0.35, shadowRadius: 8, elevation: 4 },
  fixedSearch: { alignItems: 'center', borderRadius: 22, borderWidth: 1, flexDirection: 'row', gap: 10, height: 48, paddingHorizontal: 14 },
  fixedSearchInput: { flex: 1, fontSize: 15, padding: 0 },
   startConversationCard: { alignItems: 'center', borderRadius: 16, borderWidth: 1, flexDirection: 'row', marginHorizontal: 20, marginBottom: 24, paddingVertical: 10, paddingHorizontal: 14, minHeight: 44 },
   startConversationIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: 12, shadowColor: primary, shadowOpacity: 0.4, shadowRadius: 10 },
   startConversationCopy: { flex: 1 },
   startConversationTitle: { fontSize: 16, fontWeight: '700', marginBottom: 3 },
   startConversationSub: { fontSize: 13 },
  pinnedSection: { marginBottom: 18 },
  referenceSectionRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 10 },
  referenceSectionLabel: { fontSize: 12, fontWeight: '800', letterSpacing: 1.1 },
  referenceSectionLink: { fontSize: 13, fontWeight: '700' },
  pinnedList: { marginHorizontal: 20 },
  onlineAvatarsRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: 20, paddingVertical: 4 },
  onlineAvatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 1.5 },
  onlineAvatarImg: { width: '100%', height: '100%', borderRadius: 14 },
  onlineAvatarText: { fontSize: 12, fontWeight: '700' },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  badgeTxt: { color: '#fff', fontSize: 11, fontWeight: '700' },
  chatContainer: { paddingTop: 8 },
  // Section
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 6 },
  sectionLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  // Skeleton
  skeleton: { height: 70, borderRadius: 18, marginHorizontal: 16, marginBottom: 10 },
  // Empty
  emptyWrap: { alignItems: 'center', paddingTop: 40, paddingHorizontal: 32 },
  emptyIcon: { width: 78, height: 78, borderRadius: 39, alignItems: 'center', justifyContent: 'center', borderWidth: 1, marginBottom: 18, overflow: 'hidden' },
  emptyTitle: { fontSize: 17, fontWeight: '700', marginBottom: 6, textAlign: 'center' },
  emptySub: { fontSize: 13, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 24, paddingVertical: 12 },
  emptyBtnTxt: { color: '#fff', fontSize: 14, fontWeight: '700' },
  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: H * 0.85, paddingTop: 0, overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  modalSearchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 22, borderWidth: 1.5, marginHorizontal: 16, marginVertical: 12, paddingHorizontal: 14, paddingVertical: 9 },
  modalSearchInput: { flex: 1, fontSize: 14, padding: 0 },
  modalListContent: { paddingHorizontal: 8, paddingBottom: 20 },
  modalFriendItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  modalAvatarContainer: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  modalAvatarText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  modalFriendName: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  modalFriendMessage: { fontSize: 12 },
  modalOnlineBadge: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#22c55e' },
  modalEmptyWrap: { alignItems: 'center', paddingVertical: 40 },
  modalEmptyText: { fontSize: 13, fontStyle: 'italic' },
  actionOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  actionSheet: { borderTopLeftRadius: 26, borderTopRightRadius: 26, borderWidth: 1, overflow: 'hidden', paddingTop: 8 },
  actionTitle: { fontSize: 17, fontWeight: '700', paddingHorizontal: 20, paddingVertical: 16 },
  actionRow: { alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: 13, minHeight: 56, paddingHorizontal: 20 },
  actionText: { fontSize: 16, fontWeight: '600' },
  actionCancel: { fontSize: 16, fontWeight: '700', textAlign: 'center', width: '100%' },
});







