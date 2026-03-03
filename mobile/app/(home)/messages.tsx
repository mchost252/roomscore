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
  Dimensions, Platform, StatusBar, Alert, Modal, FlatList, Image,
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
import messageService from '../../services/messageService';
import { LocalConversation } from '../../services/sqliteService';
import ConversationCard from '../../components/messaging/ConversationCard';
import { CircularKMenu } from '../../components/CircularKMenu';
import SidebarNav from '../../components/SidebarNav';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: W, height: H } = Dimensions.get('window');
const COLLAPSE_AT = 80;
const primary   = '#6366f1';
const accent    = '#8b5cf6';
const cyan      = '#06b6d4';

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

  useEffect(() => {
    AsyncStorage.getItem('krios_nav_style').then(v => {
      if (v === 'sidebar' || v === 'bottom') setNavStyle(v as 'bottom' | 'sidebar');
    });
  }, []);

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
      if (user?.id) await messageService.initialize(user.id);
      const convs = await messageService.getConversations();
      setConversations(convs);
      setOnlineFriends(convs.filter(c => c.is_online === 1).slice(0, 12));
    } catch (e) {
      console.warn('[Messages]', e);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [user?.id]);

  // Initial load
  useEffect(() => { loadData(); }, [loadData]);

  // Refresh on screen focus — clears search too
  useFocusEffect(useCallback(() => {
    setSearch('');
    setSearchResults([]);
    setAddFriendSearch('');
    setAddFriendResults([]);
    loadData(true);
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

    (messageService as any).on?.('conversations_updated', refresh);
    (messageService as any).on?.('message_received', refresh);
    (messageService as any).on?.('message_sent', refresh);
    (messageService as any).on?.('online_status', handleOnlineStatus);
    (messageService as any).on?.('online_users', handleOnlineUsers);
    
    return () => {
      (messageService as any).off?.('conversations_updated', refresh);
      (messageService as any).off?.('message_received', refresh);
      (messageService as any).off?.('message_sent', refresh);
      (messageService as any).off?.('online_status', handleOnlineStatus);
      (messageService as any).off?.('online_users', handleOnlineUsers);
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
  const handleAddFriendSearch = useCallback((q: string) => {
    setAddFriendSearch(q);
    if (!q.trim()) { setAddFriendResults([]); return; }
    const results = conversations.filter(c =>
      (c.username || '').toLowerCase().includes(q.toLowerCase())
    );
    setAddFriendResults(results);
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
    Alert.alert(
      'Remove Friend',
      `Remove ${conv.username} from your friends? You'll need to send a new message request to chat again. This only affects your side.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove', style: 'destructive',
          onPress: async () => {
            // Optimistically remove from UI immediately
            setConversations(prev => prev.filter(c => c.friend_id !== conv.friend_id));
            setOnlineFriends(prev => prev.filter(c => c.friend_id !== conv.friend_id));
            // Call backend to delete friendship + clear messages
            try {
              await messageService.deleteFriend(conv.friend_id);
            } catch (err) {
              console.warn('[Messages] Delete friend failed:', err);
              // Reload conversations if it failed
              loadData(true);
            }
          },
        },
      ]
    );
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
            style={[s.searchInput, { color: text }]}
            value={search}
            onChangeText={handleSearch}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder="Search conversations..."
            placeholderTextColor={textTert}
            returnKeyType="search"
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
        contentContainerStyle={{ paddingBottom: insets.bottom + 110, paddingTop: insets.top + 110 }}
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

        {/* ── Online shelf ── */}
        {!search && (
          <View style={[s.shelf, { backgroundColor: shelfBg }]}>
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
                      <View style={[s.avatarInner, { backgroundColor: avatarColor(f.friend_id) }]}>
                        <Text style={s.avatarTxt}>
                          {(f.username || '?').slice(0, 1).toUpperCase()}
                        </Text>
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
        {!search && <View style={{ height: 18 }} />}

        {/* ── Chat list container (its own curved surface) ── */}
        <View style={[s.chatContainer, { backgroundColor: shelfBg }]}
        >
          {!search && (
            <Svg width={W} height={26} viewBox={`0 0 ${W} 26`}>
              {/* Solid curve only (no gradient line) */}
              <Path
                d={`M0,18 Q${W/2},0 ${W},18 L${W},26 L0,26 Z`}
                fill={shelfBg}
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

          {/* ── Conversation list ── */}
          {loading ? (
          // Skeleton
          [1,2,3,4,5].map(i => (
            <View key={i} style={[s.skeleton, {
              backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
              opacity: 1 - i * 0.15,
            }]} />
          ))
        ) : filtered.length > 0 ? (
          filtered.map((item, index) => (
            <Animated.View key={item.friend_id} entering={FadeInDown.delay(index * 40).springify().damping(18)}>
              <ConversationCard
                conversation={item}
                onPress={() => goToChat(item)}
                onDelete={() => handleDelete(item)}
                isDark={isDark}
              />
            </Animated.View>
          ))
        ) : (
          // Empty state
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
                onPress={() => router.push('/(home)/profile')}
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
                style={[s.modalSearchInput, { color: text }]}
                value={addFriendSearch}
                onChangeText={handleAddFriendSearch}
                placeholder="Search friends..."
                placeholderTextColor={textTert}
                returnKeyType="search"
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
              keyExtractor={(item) => item.friend_id}
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
      </Modal>

      {/* ── Nav bars ── */}
      {navStyle === 'sidebar' && (
        <SidebarNav
          onAIPress={() => router.push('/(home)/ai-chat')}
          onAddTask={() => router.push('/(home)/profile')}
        />
      )}
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
  chatContainer: { borderTopLeftRadius: 26, borderTopRightRadius: 26, overflow: 'hidden', paddingTop: 0, marginTop: 2 },
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
