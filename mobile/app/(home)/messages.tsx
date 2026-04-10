/**
 * Messages Screen
 * Samsung-style collapsing header with liquid gradient glow
 * AddFriendModal bottom sheet for adding friends
 * Rich Krios styling — edge shine, gradients, glassmorphism
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, RefreshControl, Pressable, ScrollView,
  Dimensions, Platform, StatusBar, Modal, FlatList, Image,
  KeyboardAvoidingView,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, useAnimatedScrollHandler,
  interpolate, Extrapolation, FadeIn, FadeInDown,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Svg, Path, Defs, LinearGradient as SvgGrad, Stop } from 'react-native-svg';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { HomeNavContext } from './_layout';
import messageService from '../../services/messageService';
import api from '../../services/api';
import { LocalConversation } from '../../services/sqliteService';
import ConversationCard from '../../components/messaging/ConversationCard';
import ConfirmationModal from '../../components/ConfirmationModal';
import { CircularKMenu } from '../../components/CircularKMenu';
import SidebarNav from '../../components/SidebarNav';
import { secureStorage } from '../../services/storage';
const { width: W, height: H } = Dimensions.get('window');
const COLLAPSE_AT = 80;
const primary   = '#6366f1';
const accent    = '#8b5cf6';
const cyan      = '#06b6d4';
const AnimatedFlatList = Animated.createAnimatedComponent(FlatList);

export default function MessagesScreen() {
  const { isDark } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  // ── Colors ──────────────────────────────────────────────
  const bg       = isDark ? '#080810' : '#f8f9ff';
  const text     = isDark ? '#ffffff' : '#0f172a';
  const textSub  = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(15,23,42,0.55)';
  const textTert = isDark ? 'rgba(255,255,255,0.28)' : 'rgba(15,23,42,0.28)';
  const border   = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';
  const surf     = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
  const inputBg  = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)';
  const shelfBg  = isDark ? 'rgba(255,255,255,0.025)' : 'rgba(99,102,241,0.035)';
  const headerBg = isDark ? 'rgba(8,8,16,0.94)' : 'rgba(248,249,255,0.94)';

  // ── State ────────────────────────────────────────────────
  const [conversations, setConversations] = useState<LocalConversation[]>([]);
  const [onlineFriends, setOnlineFriends] = useState<LocalConversation[]>([]);
  const [search, setSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchResults, setSearchResults] = useState<LocalConversation[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [addFriendModalVisible, setAddFriendModalVisible] = useState(false);
  const [addFriendSearch, setAddFriendSearch] = useState('');
  const [addFriendResults, setAddFriendResults] = useState<LocalConversation[]>([]);
  const [navStyle, setNavStyle] = useState<'bottom' | 'sidebar'>('bottom');
  const [removeModalVisible, setRemoveModalVisible] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<LocalConversation | null>(null);

  useEffect(() => {
    secureStorage.getItem('krios_nav_style').then(v => {
      if (v === 'sidebar' || v === 'bottom') setNavStyle(v as 'bottom' | 'sidebar');
    });
  }, []);

  // Register + button to open add friend modal (instead of task modal on home)
  const { setOpenAIChat, setOpenAddTask } = React.useContext(HomeNavContext);
  const openAddFriend = React.useCallback(() => {
    setAddFriendModalVisible(true);
  }, []);
  
  // Register callbacks on mount
  useEffect(() => {
    setOpenAIChat(() => router.push('/(home)/ai-chat'));
    setOpenAddTask(openAddFriend);
  }, [openAddFriend, setOpenAIChat, setOpenAddTask]);

  // Also re-register when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      setOpenAIChat(() => router.push('/(home)/ai-chat'));
      setOpenAddTask(openAddFriend);
    }, [openAddFriend, setOpenAIChat, setOpenAddTask, router])
  );

  // ── Samsung-style scroll (same as profile.tsx) ───────────
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({
    onScroll: e => { scrollY.value = e.contentOffset.y; },
  });

  // Large title fades + moves up
  const largeTitleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, COLLAPSE_AT * 0.55], [1, 0], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(scrollY.value, [0, COLLAPSE_AT], [0, -8], Extrapolation.CLAMP) }],
  }));

  // Small title fades in from left
  const smallTitleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [COLLAPSE_AT * 0.5, COLLAPSE_AT], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateX: interpolate(scrollY.value, [COLLAPSE_AT * 0.5, COLLAPSE_AT], [-14, 0], Extrapolation.CLAMP) }],
  }));

  // Header bg fades in
  const headerBgStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, COLLAPSE_AT * 0.65], [0, 1], Extrapolation.CLAMP),
  }));

  // ─── Load data ────────────────────────────────────────────
  const loadData = useCallback(async (silent = false) => {
    try {
      if (user?.id) {
        await messageService.initialize(user.id);
      }
      const convs = await messageService.getConversations();
      console.log('[Messages] Loaded conversations:', convs.length);
      setConversations(convs);
      setOnlineFriends(convs.filter(c => c.is_online === 1).slice(0, 12));
    } catch (e) {
      console.warn('[Messages] loadData error:', e);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [user?.id]);

  // Initial load
  useEffect(() => { loadData(); }, [loadData]);

  // Refresh on screen focus — clears search, refreshes conversations + online snapshot
  useFocusEffect(useCallback(() => {
    setSearch('');
    setSearchResults([]);
    setAddFriendSearch('');
    setAddFriendResults([]);
    loadData(true);
    
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

  // Real-time events
  useEffect(() => {
    const refresh = () => loadData(true);
    const handleOnlineStatus = (data: { userId: string; isOnline: boolean }) => {
      setConversations(prev => {
        const next = prev.map(c =>
          c.friend_id === data.userId ? { ...c, is_online: data.isOnline ? 1 : 0 } : c
        );
        // Keep shelf in sync with latest conversations
        setOnlineFriends(next.filter(c => c.is_online === 1).slice(0, 12));
        return next;
      });
    };

    const handleOnlineUsers = (userIds: string[]) => {
      setConversations(prev => {
        const setIds = new Set(userIds);
        const next = prev.map(c => ({ ...c, is_online: setIds.has(c.friend_id) ? 1 : 0 }));
        setOnlineFriends(next.filter(c => c.is_online === 1).slice(0, 12));
        return next;
      });
    };

    const unsubs: (() => void)[] = [];
    unsubs.push(messageService.on('conversation:list', refresh));
    unsubs.push(messageService.on('message:new', refresh));
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
      unsubs.forEach(u => u());
    };
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  // ── Search (local only - friends in conversations) ──────
  const handleSearch = useCallback((q: string) => {
    setSearch(q);
    if (!q.trim()) { setSearchResults([]); return; }
    const local = conversations.filter(c =>
      (c.username || '').toLowerCase().includes(q.toLowerCase())
    );
    setSearchResults(local);
  }, [conversations]);

  // ── Search for AddFriendModal ────────────────────────────
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

  // ── Navigate ─────────────────────────────────────────────
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

  // ── Delete with warning + actual API call ───────────────
  const handleDelete = useCallback((conv: LocalConversation) => {
    setRemoveTarget(conv);
    setRemoveModalVisible(true);
  }, [loadData]);

  // ── Computed ─────────────────────────────────────────────
  const filtered = search.trim() ? searchResults : conversations;
  const totalUnread = conversations.reduce((s, c) => s + (c.unread_count || 0), 0);

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
          setOnlineFriends(prev => prev.filter(c => c.friend_id !== target.friend_id));
          try {
            await messageService.deleteFriend(target.friend_id);
          } catch (err) {
            console.warn('[Messages] Delete friend failed:', err);
            loadData(true);
          }
        }}
      />

      {/* ── Background ── */}
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
      {/* Edge shine — left */}
      <LinearGradient
        colors={[`rgba(139,92,246,${isDark ? '0.2' : '0.08'})`, 'transparent']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={[StyleSheet.absoluteFill, { width: 2 }]}
      />

      {/* ── Fixed header — only small title + search (fades in on scroll) ── */}
      <View style={[s.header, { paddingTop: insets.top + 4, zIndex: 20, position: 'absolute', left: 0, right: 0, top: 0 }]}>
        {/* Blur bg fades in as user scrolls */}
        <Animated.View style={[StyleSheet.absoluteFill, headerBgStyle]}>
          {Platform.OS === 'ios'
            ? <BlurView intensity={75} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
            : <View style={[StyleSheet.absoluteFill, { backgroundColor: headerBg }]} />
          }
        </Animated.View>
        <Animated.View style={[s.headerBorder, { backgroundColor: border }, headerBgStyle]} />

        {/* Small title row — slides in from left when scrolled */}
        <View style={s.smallTitleRow}>
          <Animated.Text style={[s.titleSmall, { color: text }, smallTitleStyle]}>
            Messages
          </Animated.Text>
          {totalUnread > 0 && (
            <Animated.View style={[s.badge, { backgroundColor: primary }, smallTitleStyle]}>
              <Text style={s.badgeTxt}>{totalUnread > 99 ? '99+' : totalUnread}</Text>
            </Animated.View>
          )}
        </View>

        {/* Search — always visible */}
        <View style={[s.searchBar, {
          backgroundColor: inputBg,
          borderColor: searchFocused ? primary : border,
        }]}>
          <Ionicons name="search-outline" size={15} color={textTert} />
          <TextInput
            id="messages-search-input"
            style={[s.searchInput, { color: text }]}
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
              <Ionicons name="close-circle" size={15} color={textTert} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Scrollable content (starts below absolute header) ── */}
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 140, paddingTop: insets.top + 110, minHeight: H + insets.top + 240 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing} onRefresh={onRefresh}
            tintColor={primary} colors={[primary]}
            progressViewOffset={insets.top + 110}
          />
        }
      >
        {/* ── Large title inside scroll (Samsung style) ── */}
        <View style={{ paddingHorizontal: 20, paddingBottom: 4 }}>
          <Animated.Text style={[s.titleLarge, { color: text }, largeTitleStyle]}>
            Messages
          </Animated.Text>
        </View>

        {/* ── Online shelf with top curve (sticky, won't scroll into header) ── */}
        {!search && (
          <View style={[s.shelf, { 
            backgroundColor: isDark ? 'rgba(25,25,40,0.95)' : 'rgba(252,252,255,0.95)', 
            borderTopLeftRadius: 28, 
            borderTopRightRadius: 28, 
            overflow: 'hidden', 
            marginTop: 8,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: isDark ? 0.3 : 0.08,
            shadowRadius: 8,
            elevation: 4,
          }]}>
            {/* Top curve SVG */}
            <Svg width={W} height={28} viewBox={`0 0 ${W} 28`} style={{ position: 'absolute', top: 0, left: 0 }}>
              <Path
                d={`M0,10 Q${W/2},0 ${W},10 L${W},0 L0,0 Z`}
                fill={isDark ? 'rgba(25,25,40,0.95)' : 'rgba(252,252,255,0.95)'}
              />
            </Svg>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.shelfRow}>
              {/* Add friend button */}
              <View style={s.shelfItem}>
                <TouchableOpacity
                  style={[s.addCircle, { borderColor: `${primary}55` }]}
                  onPress={() => setAddFriendModalVisible(true)}
                >
                  <LinearGradient
                    colors={['rgba(99,102,241,0.15)','rgba(139,92,246,0.1)']}
                    style={[StyleSheet.absoluteFill, { borderRadius: 27 }]}
                  />
                  <Ionicons name="add" size={26} color={primary} />
                </TouchableOpacity>
                <Text style={[s.shelfName, { color: textTert }]}>Add</Text>
              </View>

              {/* Online friends */}
              {onlineFriends.map((f, i) => (
                <Animated.View key={f.friend_id} entering={FadeIn.delay(i * 50)} style={s.shelfItem}>
                  <Pressable onPress={() => goToChat(f)}>
                    <LinearGradient
                      colors={[primary, accent]}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                      style={s.onlineRing}
                    >
                      <View style={[s.avatarInner, { backgroundColor: avatarColor(f.friend_id), overflow: 'hidden' }]}>
                        {f.avatar ? (
                          <Image 
                            source={{ uri: f.avatar }} 
                            style={{ width: '100%', height: '100%' }} 
                            resizeMode="cover"
                          />
                        ) : (
                          <Text style={s.avatarTxt}>
                            {(f.username || '?').slice(0, 1).toUpperCase()}
                          </Text>
                        )}
                      </View>
                    </LinearGradient>
                    <View style={[s.onlineDot, { borderColor: isDark ? '#080810' : '#f8f9ff' }]} />
                  </Pressable>
                  <Text style={[s.shelfName, { color: textSub }]} numberOfLines={1}>
                    {(f.username || '').split(' ')[0]}
                  </Text>
                </Animated.View>
              ))}

              {/* If no online friends show placeholder */}
              {onlineFriends.length === 0 && (
                <Text style={[{ color: textTert, fontSize: 13, paddingVertical: 8, fontStyle: 'italic' }]}>
                  No one online right now
                </Text>
              )}
            </ScrollView>
          </View>
        )}

        {/* ── Free middle space (background shows through) ── */}
        {!search && <View style={{ height: 24 }} />}

        {/* ── Chat list container (its own curved surface with distinct color) ── */}
        <View style={[s.chatContainer, { 
          backgroundColor: isDark ? 'rgba(20,20,32,0.85)' : 'rgba(248,249,255,0.9)', 
          borderTopLeftRadius: 28, 
          borderTopRightRadius: 28, 
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: isDark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.08)',
        }]}
        >
          {!search && (
            <Svg width={W} height={28} viewBox={`0 0 ${W} 28`} style={{ position: 'absolute', top: 0, left: 0 }}>
              {/* Top curve only */}
              <Path
                d={`M0,10 Q${W/2},0 ${W},10 L${W},0 L0,0 Z`}
                fill={isDark ? 'rgba(20,20,32,0.85)' : 'rgba(248,249,255,0.9)'}
              />
            </Svg>
          )}

          {/* ── Section label ── */}
          <View style={s.sectionRow}>
          <Text style={[s.sectionLabel, { color: textTert }]}>
            {search ? (searchResults.length > 0 ? `${searchResults.length} found` : 'No results') : 'Recent'}
          </Text>
          {!search && conversations.length > 0 && (
            <Text style={[s.sectionCount, { color: textTert }]}>{conversations.length}</Text>
          )}
        </View>

          {/* ── Conversation list (FlashList for performance) ── */}
          {loading ? (
            [1, 2, 3, 4, 5].map(i => (
              <View
                key={i}
                style={[
                  s.skeleton,
                  {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
                    opacity: 1 - i * 0.15,
                  },
                ]}
              />
            ))
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(item) => `${item.friend_id}-${item.request_status || 'none'}`}
              renderItem={({ item, index }) => (
                <Animated.View
                  entering={FadeInDown.delay(index * 40).springify().damping(18)}
                >
                  <ConversationCard
                    conversation={item}
                    onPress={() => goToChat(item)}
                    onDelete={() => handleDelete(item)}
                    isDark={isDark}
                  />
                </Animated.View>
              )}
              ListEmptyComponent={
                <View style={s.emptyWrap}>
                  <LinearGradient
                    colors={['rgba(99,102,241,0.12)', 'rgba(139,92,246,0.07)']}
                    style={[s.emptyIcon, { borderColor: `${primary}33` }]}
                  >
                    <Ionicons name="chatbubbles-outline" size={34} color={primary} />
                  </LinearGradient>
                  <Text style={[s.emptyTitle, { color: text }]}>
                    {search ? 'No conversations found' : 'No messages yet'}
                  </Text>
                  <Text style={[s.emptySub, { color: textSub }]}>
                    {search ? 'Try a different name' : 'Add friends to start chatting'}
                  </Text>
                  {!search && (
                    <TouchableOpacity
                      style={{ borderRadius: 22, overflow: 'hidden', marginTop: 8 }}
                      onPress={() => setAddFriendModalVisible(true)}
                    >
                      <LinearGradient
                        colors={[primary, accent]}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                        style={s.emptyBtn}
                      >
                        <Ionicons name="person-add-outline" size={16} color="#fff" />
                        <Text style={s.emptyBtnTxt}>Find Friends</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  )}
                </View>
              }
            />
          )}
        </View>
      </Animated.ScrollView>

      {/* ── AddFriendModal Bottom Sheet ── */}
      <Modal
        visible={addFriendModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setAddFriendModalVisible(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <View style={[s.modalOverlay, { backgroundColor: isDark ? 'rgba(8,8,16,0.6)' : 'rgba(0,0,0,0.4)' }]}>
            <View style={[s.modalContent, { backgroundColor: bg }]}>
            {/* Header with close button */}
            <View style={[s.modalHeader, { borderBottomColor: border }]}>
              <Text style={[s.modalTitle, { color: text }]}>Message Friends</Text>
              <TouchableOpacity
                onPress={() => setAddFriendModalVisible(false)}
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
                      setAddFriendModalVisible(false);
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
          </View>
        </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* SidebarNav is now rendered globally in _layout.tsx */}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  // Header
  header: {
    paddingHorizontal: 20, paddingBottom: 10,
    zIndex: 20, overflow: 'hidden',
  },
  headerBorder: { position: 'absolute', bottom: 0, left: 0, right: 0, height: StyleSheet.hairlineWidth },
  titleArea: { width: '100%', marginBottom: 12, minHeight: 44, justifyContent: 'center' },
  titleLarge: { fontSize: 32, fontWeight: '800', letterSpacing: -0.8, textAlign: 'center' },
  smallTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  titleSmall: { fontSize: 18, fontWeight: '700', letterSpacing: -0.3 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  badgeTxt: { color: '#fff', fontSize: 11, fontWeight: '700' },
  iconBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 22, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 9 },
  searchInput: { flex: 1, fontSize: 14, padding: 0 },
  // Shelf
  shelf: { paddingVertical: 16 },
  shelfRow: { paddingHorizontal: 20, gap: 18 },
  shelfItem: { alignItems: 'center', gap: 6, width: 60 },
  addCircle: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderStyle: 'dashed', overflow: 'hidden' },
  onlineRing: { width: 56, height: 56, borderRadius: 28, padding: 2.5, alignItems: 'center', justifyContent: 'center' },
  avatarInner: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { color: '#fff', fontSize: 18, fontWeight: '700' },
  onlineDot: { width: 13, height: 13, borderRadius: 7, backgroundColor: '#22c55e', borderWidth: 2.5, position: 'absolute', bottom: 2, right: 2 },
  shelfName: { fontSize: 11, fontWeight: '500', textAlign: 'center' },
  // Chat container
  chatContainer: { paddingTop: 12 },
  // Section
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 6 },
  sectionLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  sectionCount: { fontSize: 11, fontWeight: '600' },
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
});
