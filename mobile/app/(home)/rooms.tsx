/**
 * Rooms Screen (Refactored)
 * Tabbed interface with My Rooms, Discover, and Join with Code
 * Samsung-style collapsing header with liquid gradient glow
 */

import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, RefreshControl, Dimensions, Platform, StatusBar,
} from 'react-native';

import Animated, {
  useSharedValue, useAnimatedStyle, useAnimatedScrollHandler,
  interpolate, Extrapolation, FadeInDown,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { FlashList } from '@shopify/flash-list';
import * as Haptics from 'expo-haptics';

import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useRoomsManager, TabType } from '../../hooks/room/useRoomsManager';
import { RoomCard } from '../../components/rooms/RoomCard';
import { CreateRoomModal } from '../../components/rooms/CreateRoomModal';
import ConfirmationModal from '../../components/ConfirmationModal';
import api from '../../services/api';

const { height: H } = Dimensions.get('window');
const COLLAPSE_AT = 80;
const primary = '#6366f1';
const accent = '#8b5cf6';

export default function RoomsScreen() {
  const { isDark } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  // ── Colors ──────────────────────────────────────────────
  const bg = isDark ? '#080810' : '#f8f9ff';
  const text = isDark ? '#ffffff' : '#0f172a';
  const textSub = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(15,23,42,0.55)';
  const textTert = isDark ? 'rgba(255,255,255,0.28)' : 'rgba(15,23,42,0.28)';
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';
  const inputBg = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)';
  const headerBg = isDark ? 'rgba(8,8,16,0.94)' : 'rgba(248,249,255,0.94)';

  const manager = useRoomsManager();

  // Additional local state for actions
  const [longPressRoom, setLongPressRoom] = useState<any>(null);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // ── Samsung-style scroll ───────────────────────────────
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({
    onScroll: e => { scrollY.value = e.contentOffset.y; },
  });

  const largeTitleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, COLLAPSE_AT * 0.55], [1, 0], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(scrollY.value, [0, COLLAPSE_AT], [0, -8], Extrapolation.CLAMP) }],
  }));

  const smallTitleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [COLLAPSE_AT * 0.5, COLLAPSE_AT], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateX: interpolate(scrollY.value, [COLLAPSE_AT * 0.5, COLLAPSE_AT], [-14, 0], Extrapolation.CLAMP) }],
  }));

  const headerBgStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, COLLAPSE_AT * 0.65], [0, 1], Extrapolation.CLAMP),
  }));

  // ── Actions ─────────────────────────────────────────────
  const handleRoomPress = useCallback((room: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({
      pathname: '/(home)/room-detail',
      params: { roomId: room.id },
    });
  }, [router]);

  const handleRoomLongPress = useCallback((room: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setLongPressRoom(room);
    const isOwner = room.ownerId === user?.id;
    if (isOwner) {
      setShowDeleteConfirm(true);
    } else {
      setShowLeaveConfirm(true);
    }
  }, [user]);

  const handleLeaveRoom = async () => {
    if (!longPressRoom) return;
    try {
      await api.post(`/rooms/${longPressRoom.id}/leave`);
      manager.setSuccess('Left room successfully');
      manager.refresh();
    } catch (err: any) {
      manager.setError(err.response?.data?.message || 'Failed to leave room');
    } finally {
      setShowLeaveConfirm(false);
      setLongPressRoom(null);
    }
  };

  const handleDeleteRoom = async () => {
    if (!longPressRoom) return;
    try {
      await api.delete(`/rooms/${longPressRoom.id}`);
      manager.setSuccess('Room deleted successfully');
      manager.refresh();
    } catch (err: any) {
      manager.setError(err.response?.data?.message || 'Failed to delete room');
    } finally {
      setShowDeleteConfirm(false);
      setLongPressRoom(null);
    }
  };

  // ── Render Content ──────────────────────────────────────
  const renderList = (data: any[], type: 'my' | 'public') => {
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
          <Ionicons name={type === 'my' ? "home-outline" : "globe-outline"} size={48} color={textTert} />
          <Text style={[s.emptyTitle, { color: text }]}>{type === 'my' ? "No rooms yet" : "No public rooms"}</Text>
          <Text style={[s.emptySubtitle, { color: textSub }]}>
            {type === 'my' ? "Deploy your first mission to begin." : "Be the first to create a public room."}
          </Text>
          {type === 'my' && (
            <TouchableOpacity onPress={() => manager.setCreateRoomModalVisible(true)} style={s.emptyButton}>
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
      <FlashList
        data={data}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <RoomCard 
            room={item} 
            isDark={isDark} 
            user={user} 
            isMember={type === 'my'}
            onPress={handleRoomPress}
            onLongPress={handleRoomLongPress}
            onJoin={manager.handleJoinPublicRoom}
          />
        )}
        estimatedItemSize={120}
        contentContainerStyle={s.roomsList}
      />
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

  return (
    <View style={[s.root, { backgroundColor: bg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Fixed Header */}
      <View style={[s.header, { paddingTop: insets.top + 4 }]}>
        <Animated.View style={[StyleSheet.absoluteFill, headerBgStyle]}>
          {Platform.OS === 'ios'
            ? <BlurView intensity={75} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
            : <View style={[StyleSheet.absoluteFill, { backgroundColor: headerBg }]} />
          }
        </Animated.View>
        
        <View style={s.smallTitleRow}>
          <TouchableOpacity onPress={() => router.back()} style={s.backButton}>
            <Ionicons name="chevron-back" size={24} color={text} />
          </TouchableOpacity>
          <Animated.Text style={[s.titleSmall, { color: text }, smallTitleStyle]}>Rooms</Animated.Text>
          <TouchableOpacity onPress={() => manager.setCreateRoomModalVisible(true)} style={s.createButton}>
            <LinearGradient colors={[primary, accent]} style={s.createButtonGradient}>
              <Ionicons name="add" size={20} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <View style={s.tabsContainer}>
          {(['my-rooms', 'discover', 'join-code'] as TabType[]).map(tab => (
            <TouchableOpacity key={tab} onPress={() => manager.setActiveTab(tab)} style={[s.tab, manager.activeTab === tab && s.tabActive]}>
              <Text style={[s.tabText, { color: manager.activeTab === tab ? primary : textTert }]}>
                {tab === 'my-rooms' ? 'My Rooms' : tab === 'discover' ? 'Discover' : 'Join Code'}
              </Text>
              {manager.activeTab === tab && <View style={[s.tabIndicator, { backgroundColor: primary }]} />}
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Main Scroll Content */}
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 140, paddingTop: insets.top + 140, minHeight: H + 100 }}
        refreshControl={<RefreshControl refreshing={manager.refreshing} onRefresh={manager.refresh} tintColor={primary} />}
      >
        <View style={{ paddingHorizontal: 20, paddingBottom: 16 }}>
          <Animated.Text style={[s.titleLarge, { color: text }, largeTitleStyle]}>Rooms</Animated.Text>
        </View>

        <View style={[s.searchBar, { backgroundColor: inputBg, borderColor: manager.searchFocused ? primary : border }]}>
          <Ionicons name="search-outline" size={15} color={textTert} />
          <TextInput
            style={[s.searchInput, { color: text }]}
            value={manager.searchQuery}
            onChangeText={manager.setSearchQuery}
            onFocus={() => manager.setSearchFocused(true)}
            onBlur={() => manager.setSearchFocused(false)}
            placeholder="Search rooms..."
            placeholderTextColor={textTert}
          />
        </View>

        <View style={s.tabContent}>
          {manager.activeTab === 'my-rooms' && renderList(manager.myRooms, 'my')}
          {manager.activeTab === 'discover' && renderList(manager.publicRooms, 'public')}
          {manager.activeTab === 'join-code' && renderJoinCode()}
        </View>
      </Animated.ScrollView>

      {/* Modals */}
      <CreateRoomModal 
        visible={manager.createRoomModalVisible} 
        onClose={() => manager.setCreateRoomModalVisible(false)}
        onSuccess={(room) => {
          manager.setCreateRoomModalVisible(false);
          manager.setSuccess('Mission Deployed!');
          manager.refresh();
          router.push({ pathname: '/(home)/room-detail', params: { roomId: room.id || room._id } });
        }}
        isDark={isDark}
      />

      <ConfirmationModal
        visible={showLeaveConfirm}
        title="Leave Room"
        message={`Are you sure you want to leave ${longPressRoom?.name}?`}
        onConfirm={handleLeaveRoom}
        onCancel={() => setShowLeaveConfirm(false)}
        isDark={isDark}
      />

      <ConfirmationModal
        visible={showDeleteConfirm}
        title="Delete Room"
        message={`This will permanently destroy ${longPressRoom?.name} and all data. Proceed?`}
        onConfirm={handleDeleteRoom}
        onCancel={() => setShowDeleteConfirm(false)}
        confirmText="DELETE"
        destructive
        isDark={isDark}
      />

      {/* Alerts */}
      {manager.error && (
        <Animated.View entering={FadeInDown} style={s.alertError}>
          <Text style={s.alertText}>{manager.error}</Text>
        </Animated.View>
      )}
      {manager.success && (
        <Animated.View entering={FadeInDown} style={s.alertSuccess}>
          <Text style={s.alertText}>{manager.success}</Text>
        </Animated.View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { zIndex: 20, position: 'absolute', left: 0, right: 0, top: 0 },
  headerBorder: { height: 1, position: 'absolute', bottom: 0, left: 0, right: 0 },
  smallTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 50 },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  titleSmall: { fontSize: 17, fontWeight: '800' },
  createButton: { width: 36, height: 36, borderRadius: 12, overflow: 'hidden' },
  createButtonGradient: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabsContainer: { flexDirection: 'row', paddingHorizontal: 12, height: 44 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabActive: {},
  tabText: { fontSize: 13, fontWeight: '700' },
  tabIndicator: { height: 3, width: 24, borderRadius: 1.5, position: 'absolute', bottom: 4 },
  titleLarge: { fontSize: 34, fontWeight: '900', letterSpacing: -0.5 },
  searchBar: { flexDirection: 'row', alignItems: 'center', height: 40, borderRadius: 12, borderWidth: 1, marginHorizontal: 20, paddingHorizontal: 12, gap: 8, marginBottom: 16 },
  searchInput: { flex: 1, fontSize: 14 },
  tabContent: { flex: 1 },
  roomsList: { paddingBottom: 40 },
  loadingContainer: { height: 200, justifyContent: 'center' },
  emptyContainer: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '800', marginTop: 16 },
  emptySubtitle: { fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  emptyButton: { marginTop: 24, borderRadius: 14, overflow: 'hidden' },
  emptyButtonGradient: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 12 },
  emptyButtonText: { color: '#fff', fontSize: 14, fontWeight: '800' },
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
  alertError: { position: 'absolute', bottom: 100, left: 20, right: 20, backgroundColor: '#ef4444', padding: 16, borderRadius: 12, zIndex: 100 },
  alertSuccess: { position: 'absolute', bottom: 100, left: 20, right: 20, backgroundColor: '#22c55e', padding: 16, borderRadius: 12, zIndex: 100 },
  alertText: { color: '#fff', fontWeight: '800', textAlign: 'center' },
});
