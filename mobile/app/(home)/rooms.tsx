import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Image, ScrollView,
  StyleSheet, RefreshControl, Dimensions, Platform, StatusBar,
  Animated as RNAnimated, Modal
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, useAnimatedScrollHandler,
  interpolate, Extrapolation, FadeInDown
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';

import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { HomeNavContext } from '../../context/HomeNavContext';
import { useRoomsManager, TabType } from '../../hooks/room/useRoomsManager';
import { RoomCard } from '../../components/rooms/RoomCard';
import { CreateRoomModal } from '../../components/rooms/CreateRoomModal';
import ConfirmationModal from '../../components/ConfirmationModal';
import api from '../../services/api';

const { width: W, height: H } = Dimensions.get('window');

const primary = '#6366f1';
const accent = '#8b5cf6';
const cyan = '#06b6d4';

const TAB_CONFIG: { key: TabType; label: string; icon: keyof typeof Ionicons.glyphMap; iconActive: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'my-rooms', label: 'My Rooms', icon: 'home-outline', iconActive: 'home' },
  { key: 'discover', label: 'Discover', icon: 'compass-outline', iconActive: 'compass' },
  { key: 'join-code', label: 'Join Code', icon: 'grid-outline', iconActive: 'grid' },
];

type FilterKey = 'all' | 'active' | 'public' | 'friends' | 'full';

export default function RoomsScreen() {
  const { isDark } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { setOpenAIChat, setOpenAddTask } = React.useContext(HomeNavContext);

  const bg = isDark ? '#080810' : '#f8f9ff';
  const text = isDark ? '#ffffff' : '#0f172a';
  const textSub = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(15,23,42,0.55)';
  const textTert = isDark ? 'rgba(255,255,255,0.28)' : 'rgba(15,23,42,0.28)';
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';
  const inputBg = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)';
  const chipBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
  const chipActiveBg = isDark ? `${primary}20` : `${primary}12`;

  const manager = useRoomsManager();
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [quickMenuOpen, setQuickMenuOpen] = useState(false);

  const menuAnim = useRef(new RNAnimated.Value(0)).current;

  const toggleQuickMenu = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const toValue = quickMenuOpen ? 0 : 1;
    setQuickMenuOpen(!quickMenuOpen);
    RNAnimated.spring(menuAnim, { toValue, tension: 65, friction: 8, useNativeDriver: true }).start();
  }, [quickMenuOpen, menuAnim]);

  const closeQuickMenu = useCallback(() => {
    setQuickMenuOpen(false);
    RNAnimated.spring(menuAnim, { toValue: 0, tension: 65, friction: 8, useNativeDriver: true }).start();
  }, [menuAnim]);

  const openCreateRoom = useCallback(() => { closeQuickMenu(); manager.setCreateRoomModalVisible(true); }, [manager, closeQuickMenu]);
  const openJoinCode = useCallback(() => { closeQuickMenu(); manager.setActiveTab('join-code'); }, [manager, closeQuickMenu]);
  const openDiscover = useCallback(() => { closeQuickMenu(); manager.setActiveTab('discover'); }, [manager, closeQuickMenu]);

  useFocusEffect(
    useCallback(() => {
      setOpenAIChat(() => router.push('/(home)/ai-chat'));
      setOpenAddTask(() => toggleQuickMenu());
    }, [router, setOpenAIChat, setOpenAddTask, toggleQuickMenu])
  );

  const [longPressRoom, setLongPressRoom] = useState<any>(null);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // ── Physics Dimensions ──
  const MIN_HEADER_HEIGHT = insets.top + 60;
  const MAX_HEADER_HEIGHT = insets.top + 140;
  const SCROLL_DISTANCE = MAX_HEADER_HEIGHT - MIN_HEADER_HEIGHT;
  const STICKY_SECTION_HEIGHT = 146; // Tabs (46) + Search (56) + Filters (44)

  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({
    onScroll: e => { scrollY.value = e.contentOffset.y; },
  });

  // ── Header Animations ──
  const headerHeightStyle = useAnimatedStyle(() => ({
    height: interpolate(scrollY.value, [0, SCROLL_DISTANCE], [MAX_HEADER_HEIGHT, MIN_HEADER_HEIGHT], Extrapolation.CLAMP)
  }));

  const headerIconsStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, SCROLL_DISTANCE], [0, 1], Extrapolation.CLAMP)
  }));

  // Logo scales slightly down
  const logoStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: interpolate(scrollY.value, [0, SCROLL_DISTANCE], [1.1, 0.9], Extrapolation.CLAMP) }
    ]
  }));

  // Image fades out entirely on scroll
  const logoImageOnlyStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, SCROLL_DISTANCE * 0.8], [1, 0], Extrapolation.CLAMP),
    height: interpolate(scrollY.value, [0, SCROLL_DISTANCE], [44, 0], Extrapolation.CLAMP),
    marginBottom: interpolate(scrollY.value, [0, SCROLL_DISTANCE], [6, 0], Extrapolation.CLAMP),
  }));

  // ── Sticky Section Animations ──
  const stickyStyle = useAnimatedStyle(() => {
    // Starts at MAX_HEADER_HEIGHT, moves up with scroll, stops at MIN_HEADER_HEIGHT
    const translateY = interpolate(
      scrollY.value,
      [0, SCROLL_DISTANCE],
      [MAX_HEADER_HEIGHT, MIN_HEADER_HEIGHT],
      Extrapolation.CLAMP
    );
    return { transform: [{ translateY }] };
  });

  // ── Filter logic ──
  const filterCounts = useMemo(() => {
    const rooms = manager.activeTab === 'my-rooms' ? manager.myRooms : manager.publicRooms;
    const active = rooms.filter(r => {
      const memberCount = r.members?.length || (r as any).memberCount || 0;
      const max = r.maxMembers || 20;
      return memberCount < max;
    }).length;
    const publicRooms = rooms.filter(r => r.isPublic).length;
    const full = rooms.filter(r => {
      const memberCount = r.members?.length || (r as any).memberCount || 0;
      const max = r.maxMembers || 20;
      return memberCount >= max;
    }).length;
    return { all: rooms.length, active, public: publicRooms, friends: 0, full };
  }, [manager.myRooms, manager.publicRooms, manager.activeTab]);

  const filteredData = useMemo(() => {
    const rooms = manager.activeTab === 'my-rooms' ? manager.myRooms : manager.publicRooms;
    if (activeFilter === 'all') return rooms;
    return rooms.filter(r => {
      const memberCount = r.members?.length || (r as any).memberCount || 0;
      const max = r.maxMembers || 20;
      switch (activeFilter) {
        case 'active': return memberCount < max;
        case 'public': return r.isPublic;
        case 'full': return memberCount >= max;
        default: return true;
      }
    });
  }, [manager.myRooms, manager.publicRooms, manager.activeTab, activeFilter]);

  const FILTERS: { key: FilterKey; label: string; icon?: keyof typeof Ionicons.glyphMap; dotColor?: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'active', label: 'Active', dotColor: '#22c55e' },
    { key: 'public', label: 'Public', icon: 'globe' },
    { key: 'friends', label: 'Friends', icon: 'people' },
    { key: 'full', label: 'Full', dotColor: '#ef4444' },
  ];

  const handleRoomPress = useCallback((room: any, type: 'my' | 'public' = 'my') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (type === 'public') {
      manager.handleJoinPublicRoom(room);
      return;
    }
    router.push({ pathname: '/(home)/room-detail', params: { roomId: room.id } });
  }, [manager, router]);

  const handleRoomLongPress = useCallback((room: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setLongPressRoom(room);
    const isOwner = room.ownerId === user?.id;
    if (isOwner) setShowDeleteConfirm(true);
    else setShowLeaveConfirm(true);
  }, [user]);

  const handleLeaveRoom = async () => {
    if (!longPressRoom) return;
    try {
      await api.post(`/rooms/${longPressRoom.id}/leave`);
      manager.setSuccess('Left room successfully');
      manager.refresh();
    } catch (err: any) { manager.setError(err.response?.data?.message || 'Failed to leave room'); } 
    finally { setShowLeaveConfirm(false); setLongPressRoom(null); }
  };

  const handleDeleteRoom = async () => {
    if (!longPressRoom) return;
    try {
      await api.delete(`/rooms/${longPressRoom.id}`);
      manager.setSuccess('Room deleted successfully');
      manager.refresh();
    } catch (err: any) { manager.setError(err.response?.data?.message || 'Failed to delete room'); } 
    finally { setShowDeleteConfirm(false); setLongPressRoom(null); }
  };

  const renderRoomList = (data: any[], type: 'my' | 'public') => {
    if (manager.loading && data.length === 0) {
      return (
        <View style={s.loadingContainer}>
          <RefreshControl refreshing={true} tintColor={primary} />
        </View>
      );
    }
    if (data.length === 0) {
      return (
        <View style={s.emptyContainer}>
          <View style={[s.emptyIconCircle, { backgroundColor: isDark ? 'rgba(99,102,241,0.1)' : 'rgba(99,102,241,0.06)' }]}>
            <Ionicons name={type === 'my' ? "planet-outline" : "globe-outline"} size={40} color={primary} />
          </View>
          <Text style={[s.emptyTitle, { color: text }]}>{type === 'my' ? "No rooms yet" : "No public rooms"}</Text>
          <Text style={[s.emptySubtitle, { color: textSub }]}>
            {type === 'my' ? "Deploy your first mission to begin." : "Be the first to create a public room."}
          </Text>
          {type === 'my' && (
            <TouchableOpacity onPress={openCreateRoom} style={s.emptyButton}>
              <LinearGradient colors={[primary, accent]} style={s.emptyButtonGradient}>
                <Ionicons name="add" size={20} color="#fff" />
                <Text style={s.emptyButtonText}>Create Room</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>
      );
    }
    return (
      <View style={s.roomsListContainer}>
        {data.map((item, index) => (
          <RoomCard
            key={item.id} room={item} isDark={isDark} user={user} isMember={type === 'my'}
            index={index} onPress={(room) => handleRoomPress(room, type)} onLongPress={handleRoomLongPress} onJoin={manager.handleJoinPublicRoom}
          />
        ))}
      </View>
    );
  };

  const renderJoinCode = () => (
    <View style={s.tabContent}>
      <View style={s.joinCodeContainer}>
        <View style={s.joinCodeIconContainer}>
          <LinearGradient colors={[primary, accent]} style={s.joinCodeIconGradient}>
            <Ionicons name="key-outline" size={32} color="#fff" />
          </LinearGradient>
        </View>
        <Text style={[s.joinCodeTitle, { color: text }]}>Join with Code</Text>
        <Text style={[s.joinCodeSubtitle, { color: textSub }]}>Enter the room invite code to join a private room</Text>
        <View style={[s.joinCodeInputContainer, { backgroundColor: inputBg, borderColor: border }]}>
          <TextInput
            style={[s.joinCodeInput, { color: text }]}
            value={manager.joinCode}
            onChangeText={manager.setJoinCode}
            placeholder="Enter room code"
            placeholderTextColor={textTert}
            autoCapitalize="characters"
          />
        </View>
        <TouchableOpacity
          onPress={manager.handleJoinRoom}
          disabled={manager.joiningRoom || !manager.joinCode.trim()}
          style={[s.joinCodeButton, { opacity: manager.joiningRoom || !manager.joinCode.trim() ? 0.5 : 1 }]}
        >
          <LinearGradient colors={[primary, accent]} style={s.joinCodeButtonGradient}>
            {manager.joiningRoom ? <RefreshControl refreshing={true} tintColor="#fff" /> : <Text style={s.joinCodeButtonText}>Join Room</Text>}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );

  const QUICK_ACTIONS = [
    { icon: 'add' as const, label: 'Create Room', onPress: openCreateRoom },
    { icon: 'grid-outline' as const, label: 'Join with Code', onPress: openJoinCode },
    { icon: 'people-outline' as const, label: 'Join Room', onPress: openDiscover },
  ];
  const menuRotation = menuAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '45deg'] });

  return (
    <View style={[s.root, { backgroundColor: bg }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* ── 1. The Morphing Header (Top Image & Logo) ── */}
      <Animated.View style={[s.header, headerHeightStyle]}>
         {/* Background Image - Anchored to the top so the shiny part is always visible */}
         <Image 
           source={require('../../assets/room_header_bg_new.webp')} 
           style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 350 }} 
           resizeMode="cover"
         />
         <LinearGradient 
           colors={isDark ? ['rgba(8,8,16,0.1)', 'rgba(8,8,16,0.7)'] : ['rgba(248,249,255,0.1)', 'rgba(248,249,255,0.6)']} 
           style={StyleSheet.absoluteFillObject} 
         />

         {/* Content inside Header */}
         <View style={[s.headerContent, { paddingTop: insets.top }]}>
            {/* Back Button (Fades In) */}
            <Animated.View style={[s.headerBtnWrap, headerIconsStyle]}>
              <TouchableOpacity onPress={() => router.back()} style={s.headerIconBtn}>
                <Ionicons name="chevron-back" size={22} color="#fff" />
              </TouchableOpacity>
            </Animated.View>

            {/* Centered Logo (Scales slightly, image hides on scroll) */}
            <Animated.View style={[s.logoCenter, logoStyle]}>
              <Animated.Image 
                source={require('../../assets/krios-logo.png')} 
                style={[s.logoImage, logoImageOnlyStyle]} 
                resizeMode="contain" 
              />
              <Text style={s.logoLetters}>K  R  I  O  S</Text>
            </Animated.View>

            {/* Quick Action + (Fades In) */}
            <Animated.View style={[s.headerBtnWrap, headerIconsStyle]}>
              <TouchableOpacity onPress={toggleQuickMenu} style={s.headerIconBtn}>
                <Ionicons name="add" size={22} color="#fff" />
              </TouchableOpacity>
            </Animated.View>
         </View>
      </Animated.View>

      {/* ── 2. The Main Scrollable Content ── */}
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          // Start padding exactly below the sticky section
          paddingTop: MAX_HEADER_HEIGHT + STICKY_SECTION_HEIGHT,
          paddingBottom: insets.bottom + 120,
          minHeight: H + 200,
        }}
        refreshControl={<RefreshControl refreshing={manager.refreshing} onRefresh={manager.refresh} tintColor={primary} />}
      >
        <View style={s.contentArea}>
          {manager.activeTab === 'my-rooms' && renderRoomList(filteredData, 'my')}
          {manager.activeTab === 'discover' && renderRoomList(filteredData, 'public')}
          {manager.activeTab === 'join-code' && renderJoinCode()}
        </View>
      </Animated.ScrollView>

      {/* ── 3. The Sticky Section (Tabs, Search, Filters) ── */}
      <Animated.View style={[s.stickySection, { backgroundColor: bg }, stickyStyle]}>
        {/* Tabs */}
        <View style={[s.tabsContainer, { borderBottomColor: border }]}>
          {TAB_CONFIG.map(tab => {
            const isActive = manager.activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key} onPress={() => { Haptics.selectionAsync(); manager.setActiveTab(tab.key); setActiveFilter('all'); }}
                style={[s.tab, isActive && s.tabActive]}
              >
                <View style={s.tabInner}>
                  <Ionicons name={isActive ? tab.iconActive : tab.icon} size={15} color={isActive ? text : textSub} />
                  <Text style={[s.tabText, { color: isActive ? text : textSub }]}>{tab.label}</Text>
                </View>
                {isActive && <View style={[s.tabIndicator, { backgroundColor: primary }]} />}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Search */}
        <View style={[s.searchBar, { backgroundColor: inputBg, borderColor: manager.searchFocused ? primary : border }]}>
          <Ionicons name="search-outline" size={16} color={textTert} />
          <TextInput
            style={[s.searchInput, { color: text }]} value={manager.searchQuery} onChangeText={manager.setSearchQuery}
            onFocus={() => manager.setSearchFocused(true)} onBlur={() => manager.setSearchFocused(false)}
            placeholder="Search rooms..." placeholderTextColor={textTert}
          />
        </View>

        {/* Filters */}
        {manager.activeTab !== 'join-code' && (
          <View style={s.filtersScrollContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filtersRow}>
              {FILTERS.map(filter => {
                const isActive = activeFilter === filter.key;
                const count = filterCounts[filter.key];
                return (
                  <TouchableOpacity key={filter.key} onPress={() => { Haptics.selectionAsync(); setActiveFilter(filter.key); }}
                    style={[s.filterChip, { backgroundColor: isActive ? chipActiveBg : chipBg, borderColor: isActive ? `${primary}40` : 'transparent', borderWidth: 1 }]}
                  >
                    {filter.dotColor && <View style={[s.filterDot, { backgroundColor: filter.dotColor }]} />}
                    {filter.icon && <Ionicons name={filter.icon} size={12} color={isActive ? primary : textSub} />}
                    <Text style={[s.filterLabel, { color: isActive ? primary : textSub }]}>{filter.label}</Text>
                    {filter.key !== 'all' && count > 0 && (
                      <View style={[s.filterCount, { backgroundColor: isActive ? (isDark ? 'rgba(99,102,241,0.25)' : 'rgba(99,102,241,0.15)') : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)') }]}>
                        <Text style={[s.filterCountText, { color: isActive ? primary : textTert }]}>{count}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}
      </Animated.View>

      {/* ── Quick Action Menu Overlay ── */}
      {quickMenuOpen && (
        <TouchableOpacity style={s.menuOverlay} activeOpacity={1} onPress={closeQuickMenu}>
          <BlurView intensity={30} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFillObject} />
        </TouchableOpacity>
      )}

      {QUICK_ACTIONS.map((action, i) => {
        const yOffset = menuAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -(70 * (i + 1))] });
        const itemScale = menuAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0.3, 1] });
        const itemOpacity = menuAnim.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 0, 1] });

        return (
          <RNAnimated.View
            key={action.label}
            style={[s.quickActionItem, { bottom: insets.bottom + 90, right: 24, transform: [{ translateY: yOffset }, { scale: itemScale }], opacity: itemOpacity }]}
            pointerEvents={quickMenuOpen ? 'auto' : 'none'}
          >
            <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); action.onPress(); }} style={s.quickActionTouchable} activeOpacity={0.85}>
              <View style={[s.quickActionLabel, { backgroundColor: isDark ? 'rgba(17,17,24,0.95)' : 'rgba(255,255,255,0.95)', borderColor: isDark ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.12)' }]}>
                <Text style={[s.quickActionText, { color: text }]}>{action.label}</Text>
              </View>
              <View style={[s.quickActionIcon, { backgroundColor: isDark ? '#1a1a2e' : '#ffffff', borderColor: isDark ? 'rgba(99,102,241,0.3)' : 'rgba(99,102,241,0.15)' }]}>
                <Ionicons name={action.icon} size={20} color={primary} />
              </View>
            </TouchableOpacity>
          </RNAnimated.View>
        );
      })}

      {/* ── Modals ── */}
      <CreateRoomModal
        visible={manager.createRoomModalVisible}
        onClose={() => manager.setCreateRoomModalVisible(false)}
        onSuccess={(room) => { manager.setCreateRoomModalVisible(false); manager.setSuccess('Mission Deployed!'); manager.refresh(); router.push({ pathname: '/(home)/room-detail', params: { roomId: room.id || room._id } }); }}
        isDark={isDark}
      />
      <ConfirmationModal visible={showLeaveConfirm} title="Leave Room" message={`Are you sure you want to leave ${longPressRoom?.name}?`} onConfirm={handleLeaveRoom} onCancel={() => setShowLeaveConfirm(false)} isDark={isDark} />
      <ConfirmationModal visible={showDeleteConfirm} title="Delete Room" message={`This will permanently destroy ${longPressRoom?.name} and all data. Proceed?`} onConfirm={handleDeleteRoom} onCancel={() => setShowDeleteConfirm(false)} confirmText="DELETE" destructive isDark={isDark} />
      
      {/* Alerts */}
      {manager.error && <Animated.View entering={FadeInDown} style={s.alertError}><Text style={s.alertText}>{manager.error}</Text></Animated.View>}
      {manager.success && <Animated.View entering={FadeInDown} style={s.alertSuccess}><Text style={s.alertText}>{manager.success}</Text></Animated.View>}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },

  // ── Header (Animated) ──
  header: {
    zIndex: 20,
    position: 'absolute',
    left: 0, right: 0, top: 0,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    overflow: 'hidden',
  },
  headerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  headerBtnWrap: {
    width: 42,
    alignItems: 'center',
  },
  headerIconBtn: {
    width: 38, height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  logoCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  logoImage: { width: 52, height: 52 },
  logoLetters: { color: '#fff', fontSize: 13, fontWeight: '800', letterSpacing: 8 },

  // ── Sticky Section ──
  stickySection: {
    position: 'absolute',
    left: 0, right: 0,
    zIndex: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    paddingBottom: 8,
  },

  // ── Tabs ──
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    height: 46,
    alignItems: 'center',
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', height: '100%' },
  tabActive: {},
  tabInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tabText: { fontSize: 13, fontWeight: '700' },
  tabIndicator: { height: 3, width: 28, borderRadius: 1.5, position: 'absolute', bottom: 0 },

  // ── Search ──
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    height: 44, borderRadius: 14, borderWidth: 1,
    marginHorizontal: 20, paddingHorizontal: 14, gap: 10,
    marginTop: 10, marginBottom: 14,
  },
  searchInput: { flex: 1, fontSize: 14 },
  filterIconBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },

  // ── Filter chips ──
  filtersScrollContainer: { height: 34 },
  filtersRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 8 },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  filterDot: { width: 7, height: 7, borderRadius: 3.5 },
  filterLabel: { fontSize: 12, fontWeight: '700' },
  filterCount: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8, marginLeft: 2 },
  filterCountText: { fontSize: 10, fontWeight: '800' },

  // ── Content ──
  contentArea: { flex: 1, paddingTop: 10 },
  roomsListContainer: { paddingBottom: 40 },
  tabContent: { flex: 1 },

  // ── Empty state ──
  loadingContainer: { height: 200, justifyContent: 'center' },
  emptyContainer: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 40 },
  emptyIconCircle: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '800', marginTop: 12 },
  emptySubtitle: { fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  emptyButton: { marginTop: 24, borderRadius: 14, overflow: 'hidden' },
  emptyButtonGradient: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 12 },
  emptyButtonText: { color: '#fff', fontSize: 14, fontWeight: '800' },

  // ── Join Code ──
  joinCodeContainer: { padding: 40, alignItems: 'center' },
  joinCodeIconContainer: { width: 72, height: 72, borderRadius: 24, overflow: 'hidden', marginBottom: 20 },
  joinCodeIconGradient: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  joinCodeTitle: { fontSize: 22, fontWeight: '900', marginBottom: 8 },
  joinCodeSubtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 30 },
  joinCodeInputContainer: { width: '100%', height: 56, borderRadius: 16, borderWidth: 1, marginBottom: 20, justifyContent: 'center' },
  joinCodeInput: { textAlign: 'center', fontSize: 24, fontWeight: '900', letterSpacing: 4 },
  joinCodeButton: { width: '100%', height: 56, borderRadius: 16, overflow: 'hidden' },
  joinCodeButtonGradient: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  joinCodeButtonText: { color: '#fff', fontSize: 16, fontWeight: '900' },

  // ── Quick Action Menu ──
  menuOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 40 },
  quickActionItem: { position: 'absolute', zIndex: 50, flexDirection: 'row', alignItems: 'center', gap: 10 },
  quickActionTouchable: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  quickActionLabel: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, borderWidth: 1 },
  quickActionText: { fontSize: 13, fontWeight: '700' },
  quickActionIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1, elevation: 4 },

  // ── Alerts ──
  alertError: { position: 'absolute', bottom: 100, left: 20, right: 20, backgroundColor: '#ef4444', padding: 16, borderRadius: 12, zIndex: 100 },
  alertSuccess: { position: 'absolute', bottom: 100, left: 20, right: 20, backgroundColor: '#22c55e', padding: 16, borderRadius: 12, zIndex: 100 },
  alertText: { color: '#fff', fontWeight: '800', textAlign: 'center' },
});
