/**
 * Rooms Screen
 * Tabbed interface with My Rooms, Discover, and Join with Code
 * Samsung-style collapsing header with liquid gradient glow
 * Rich Krios styling — edge shine, gradients, glassmorphism
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, RefreshControl, Pressable, ScrollView,
  Dimensions, Platform, StatusBar, Modal, FlatList,
  KeyboardAvoidingView, ActivityIndicator, Switch
} from 'react-native';

import Animated, {
  useSharedValue, useAnimatedStyle, useAnimatedScrollHandler,
  interpolate, Extrapolation, FadeIn, FadeInDown, FadeInUp,
  withSpring, withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Svg, Path } from 'react-native-svg';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { HomeNavContext } from './_layout';
import api from '../../services/api';
import { RoomDetail } from '../../types/room';
import ConfirmationModal from '../../components/ConfirmationModal';
import { useRoomsInstant } from '../../hooks/room/useRoomsInstant';

import { FlashList } from '@shopify/flash-list';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { Canvas, LinearGradient as SkiaLinearGradient, Rect, vec } from '@shopify/react-native-skia';

const { width: W, height: H } = Dimensions.get('window');
const COLLAPSE_AT = 80;
const primary = '#6366f1';
const accent = '#8b5cf6';
const cyan = '#06b6d4';
const gold = '#fbbf24';
const AnimatedFlashList = Animated.createAnimatedComponent(FlashList);


type TabType = 'my-rooms' | 'discover' | 'join-code';

// ─── Sub-Components ───────────────────────────────────────

/**
 * Doom Clock — Circular countdown timer for room expiry
 */
const DoomClock = ({ endDate, isDark }: { endDate?: string | Date; isDark: boolean }) => {
  if (!endDate) return null;
  
  const end = new Date(endDate);
  const now = new Date();
  const diff = end.getTime() - now.getTime();
  const daysLeft = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  
  // Color based on urgency
  const color = daysLeft <= 3 ? '#ef4444' : daysLeft <= 7 ? '#f59e0b' : '#6366f1';
  
  return (
    <View style={s.doomClock}>
      <Svg width={32} height={32} viewBox="0 0 32 32">
        <Path
          d="M16 2 A14 14 0 1 1 15.99 2"
          fill="none"
          stroke={isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}
          strokeWidth={2}
        />
        <Path
          d="M16 2 A14 14 0 1 1 15.99 2"
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeDasharray={`${(daysLeft / 30) * 88} 88`}
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={[s.doomClockText, { color }]}>{daysLeft}d</Text>
      </View>
    </View>
  );
};

/**
 * Premium Glow — High-end Skia gradient with tactical shimmer
 */
const PremiumGlow = () => {
  return (
    <View style={StyleSheet.absoluteFill}>
      <Canvas style={StyleSheet.absoluteFill}>
        <Rect x={0} y={0} width={W} height={250}>
          <SkiaLinearGradient
            start={vec(0, 0)}
            end={vec(W * 0.5, 200)}
            colors={['rgba(251,191,36,0.15)', 'rgba(245,158,11,0.08)', 'transparent']}
          />
        </Rect>
      </Canvas>
    </View>
  );
};

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
  const surf = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
  const inputBg = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)';
  const headerBg = isDark ? 'rgba(8,8,16,0.94)' : 'rgba(248,249,255,0.94)';

  // ── Instant-load data (MMKV-first, 0ms paint) ────────────
  const {
    myRooms,
    publicRooms,
    loading,
    refreshing,
    error: hookError,
    refresh: hookRefresh,
    addRoom,
  } = useRoomsInstant();

  const [activeTab, setActiveTab] = useState<TabType>('my-rooms');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joiningRoom, setJoiningRoom] = useState(false);
  const [createRoomModalVisible, setCreateRoomModalVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Merge hook error into local error state
  useEffect(() => {
    if (hookError) setError(hookError);
  }, [hookError]);

  // Create room form state
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomDescription, setNewRoomDescription] = useState('');
  const [newRoomIsPublic, setNewRoomIsPublic] = useState(false);
  const [newRoomMaxMembers, setNewRoomMaxMembers] = useState('20');
  const [newRoomDuration, setNewRoomDuration] = useState<'1_week' | '2_weeks' | '1_month'>('1_month');
  const [newRoomRetention, setNewRoomRetention] = useState(3);
  const [newRoomColor, setNewRoomColor] = useState(primary);
  const [newRoomRequireApproval, setNewRoomRequireApproval] = useState(false);
  const [modalStep, setModalStep] = useState<1 | 2>(1);
  const [roomTasks, setRoomTasks] = useState<any[]>([]);
  const [showAddTask, setShowAddTask] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskType, setTaskType] = useState<'daily' | 'weekly' | 'custom'>('daily');
  const [taskDays, setTaskDays] = useState<number[]>([]);
  const [taskPoints, setTaskPoints] = useState('5');
  const [creatingRoom, setCreatingRoom] = useState(false);

  // Long-press room action state
  const [longPressRoom, setLongPressRoom] = useState<RoomDetail | null>(null);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // ── Samsung-style scroll ───────────────────────────────
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

  // ─── Compat aliases for existing code ─────────────────────
  const loadData = useCallback(async (_silent = false) => {
    await hookRefresh();
  }, [hookRefresh]);

  // Refresh on screen focus
  useFocusEffect(useCallback(() => {
    hookRefresh();
  }, [hookRefresh]));

  const onRefresh = useCallback(async () => {
    await hookRefresh();
  }, [hookRefresh]);

  // ── Join room with code ────────────────────────────────
  const handleJoinRoom = useCallback(async () => {
    if (!joinCode.trim()) {
      setError('Please enter a join code');
      setTimeout(() => setError(null), 3000);
      return;
    }

    try {
      setJoiningRoom(true);
      setError(null);

      const response = await api.post('/rooms/join', {
        joinCode: joinCode.trim().toUpperCase(),
      });

      setJoinCode('');

      // Check if join request is pending approval
      if (response.data.pending) {
        setSuccess(response.data.message || 'Request sent! Waiting for owner approval.');
        setTimeout(() => setSuccess(null), 4000);
        return;
      }

      setSuccess('Successfully joined room!');
      setTimeout(() => setSuccess(null), 3000);

      // Navigate to the newly joined room
      setTimeout(() => {
        router.push({
          pathname: '/(home)/room-detail',
          params: { roomId: response.data.room._id },
        });
      }, 1000);
    } catch (err: any) {
      console.error('Error joining room:', err);
      setError(err.response?.data?.message || 'Failed to join room');
      setTimeout(() => setError(null), 5000);
    } finally {
      setJoiningRoom(false);
    }
  }, [joinCode, router]);

  // ── Create room ────────────────────────────────────────
  const handleCreateRoom = useCallback(async () => {
    if (!newRoomName.trim()) {
      setError('Mission Title is required');
      setTimeout(() => setError(null), 3000);
      return;
    }

    try {
      setCreatingRoom(true);
      setError(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      const response = await api.post('/rooms', {
        name: newRoomName.trim(),
        description: newRoomDescription.trim() || undefined,
        isPublic: newRoomIsPublic,
        requireApproval: newRoomRequireApproval,
        maxMembers: parseInt(newRoomMaxMembers) || 20,
        duration: newRoomDuration,
        chatRetentionDays: newRoomRetention,
        tasks: roomTasks.map(t => ({
          title: t.title,
          description: t.description,
          taskType: t.type,
          daysOfWeek: t.daysOfWeek,
          points: t.points,
        })),
      });


      setCreateRoomModalVisible(false);
      setModalStep(1);
      setRoomTasks([]);
      setNewRoomName('');
      setNewRoomDescription('');
      setNewRoomIsPublic(false);
      setNewRoomRequireApproval(false);
      setNewRoomMaxMembers('20');

      setSuccess('Mission Deployed successfully!');
      setTimeout(() => setSuccess(null), 3000);

      // Refresh rooms list
      await hookRefresh();

      // Navigate to the newly created room
      setTimeout(() => {
        router.push({
          pathname: '/(home)/room-detail',
          params: { roomId: response.data.room._id },
        });
      }, 500);
    } catch (err: any) {
      console.error('Error creating room:', err);
      setError(err.response?.data?.message || 'Failed to deploy mission');
      setTimeout(() => setError(null), 5000);
    } finally {
      setCreatingRoom(false);
    }
  }, [newRoomName, newRoomDescription, newRoomIsPublic, newRoomRequireApproval, newRoomMaxMembers, newRoomDuration, newRoomRetention, roomTasks, router, hookRefresh]);


  // ── Join public room ───────────────────────────────────
  const handleJoinPublicRoom = useCallback(async (room: RoomDetail) => {
    try {
      setError(null);
      const response = await api.post('/rooms/join', {
        joinCode: room.joinCode,
      });

      // Check if join request is pending approval
      if (response.data.pending) {
        setSuccess(response.data.message || 'Request sent! Waiting for owner approval.');
        setTimeout(() => setSuccess(null), 4000);
        // Refresh room lists to update UI
        loadData(true);
        return;
      }

      setSuccess('Successfully joined room!');
      setTimeout(() => setSuccess(null), 3000);

      // Navigate to the newly joined room after short delay
      setTimeout(() => {
        router.push({
          pathname: '/(home)/room-detail',
          params: { roomId: response.data.room._id },
        });
      }, 1000);
    } catch (err: any) {
      console.error('Error joining room:', err);
      setError(err.response?.data?.message || 'Failed to join room');
      setTimeout(() => setError(null), 5000);
    }
  }, [router, loadData]);

  // ── Long-press: Leave or Delete Room ───────────────────
  const handleLongPressRoom = useCallback((room: RoomDetail) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setLongPressRoom(room);
    const isOwner = room.ownerId === user?.id;
    if (isOwner) {
      setShowDeleteConfirm(true);
    } else {
      setShowLeaveConfirm(true);
    }
  }, [user]);

  const handleLeaveRoom = useCallback(async () => {
    if (!longPressRoom) return;
    try {
      await api.post(`/rooms/${longPressRoom.id}/leave`);
      setSuccess('Left room successfully');
      setTimeout(() => setSuccess(null), 3000);
      hookRefresh();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to leave room');
      setTimeout(() => setError(null), 5000);
    } finally {
      setShowLeaveConfirm(false);
      setLongPressRoom(null);
    }
  }, [longPressRoom, hookRefresh]);

  const handleDeleteRoom = useCallback(async () => {
    if (!longPressRoom) return;
    try {
      await api.delete(`/rooms/${longPressRoom.id}`);
      setSuccess('Room deleted successfully');
      setTimeout(() => setSuccess(null), 3000);
      hookRefresh();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete room');
      setTimeout(() => setError(null), 5000);
    } finally {
      setShowDeleteConfirm(false);
      setLongPressRoom(null);
    }
  }, [longPressRoom, hookRefresh]);

  // ── Filter rooms ───────────────────────────────────────
  const filteredMyRooms = myRooms.filter(room => {
    // Hide expired rooms unless they are premium (maybe they stay longer)
    const isExpired = room.endDate && new Date() > new Date(room.endDate);
    if (isExpired && !room.isPremium) return false;
    
    return room.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    room.description?.toLowerCase().includes(searchQuery.toLowerCase());
  });


  const filteredPublicRooms = publicRooms.filter(room =>
    room.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    room.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ── Room card component ────────────────────────────────
  const RoomCard = ({ room, isMember = false }: { room: RoomDetail; isMember?: boolean }) => {
    const isOwner = room.ownerId === user?.id;
    // Fix: Backend might send members as an array OR we might have a memberCount field
    const memberCount = room.members?.length || (room as any).memberCount || 0;
    const isPremiumRoom = room.isPremium === true;
    
    const handlePress = () => {
      if (isMember) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        router.push({
          pathname: '/(home)/room-detail',
          params: { roomId: room.id },
        });
      }
    };

    return (
      <View style={s.cardShadowWrapper}>
        <Pressable
          onPress={handlePress}
          onLongPress={() => isMember && handleLongPressRoom(room)}
          delayLongPress={600}
          style={({ pressed }) => [
            s.roomCard,
            {
              backgroundColor: isDark ? '#12121a' : '#ffffff',
              borderColor: isPremiumRoom ? gold : border,
              borderWidth: isPremiumRoom ? 1.5 : 1,
              shadowColor: isPremiumRoom ? gold : '#000',
              shadowOpacity: isPremiumRoom ? 0.3 : 0.1,
              shadowRadius: isPremiumRoom ? 10 : 4,
              elevation: isPremiumRoom ? 8 : 2,
              opacity: pressed && isMember ? 0.9 : 1,
              transform: [{ scale: pressed && isMember ? 0.98 : 1 }],
            },
          ]}
        >
          {/* Background Effects */}
          {isPremiumRoom && <PremiumGlow />}
          
          <LinearGradient
            colors={isPremiumRoom 
              ? [isDark ? 'rgba(251,191,36,0.15)' : 'rgba(251,191,36,0.08)', 'transparent']
              : [isDark ? 'rgba(99,102,241,0.08)' : 'rgba(99,102,241,0.04)', 'transparent']
            }
            style={StyleSheet.absoluteFill}
          />

          <View style={s.roomCardInner}>
            <View style={s.roomCardHeaderRow}>
              <View style={{ flex: 1 }}>
                <View style={s.roomCardTitleRow}>
                  <Text style={[s.roomCardTitle, { color: text }]} numberOfLines={1}>
                    {room.name}
                  </Text>
                  {isPremiumRoom && (
                    <LinearGradient
                      colors={[gold, '#f59e0b']}
                      style={s.premiumTag}
                    >
                      <Ionicons name="sparkles" size={10} color="#000" />
                      <Text style={s.premiumTagText}>PREMIUM</Text>
                    </LinearGradient>
                  )}
                </View>
                
                <View style={s.roomCardBadges}>
                  {isOwner && (
                    <View style={[s.badge, { backgroundColor: `${primary}20`, borderColor: `${primary}40`, borderWidth: 0.5 }]}>
                      <Text style={[s.badgeText, { color: primary }]}>COMMANDER</Text>
                    </View>
                  )}
                  <View style={[s.badge, { 
                    backgroundColor: room.isPublic ? `${cyan}15` : `${accent}15`,
                    borderColor: room.isPublic ? `${cyan}30` : `${accent}30`,
                    borderWidth: 0.5
                  }]}>
                    <Ionicons
                      name={room.isPublic ? 'globe' : 'shield-checkmark'}
                      size={10}
                      color={room.isPublic ? cyan : accent}
                    />
                    <Text style={[s.badgeText, { color: room.isPublic ? cyan : accent }]}>
                      {room.isPublic ? 'PUBLIC OPS' : 'PRIVATE SEC'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Only show Doom Clock for joined rooms */}
              {isMember && <DoomClock endDate={(room as any).endDate} isDark={isDark} />}
            </View>

            {room.description ? (
              <Text style={[s.roomCardDescription, { color: textSub }]} numberOfLines={2}>
                {room.description}
              </Text>
            ) : null}

            <View style={s.roomCardFooter}>
              <View style={s.roomCardStats}>
                <View style={[s.roomCardStat, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}>
                  <Ionicons name="people" size={12} color={primary} />
                  <Text style={[s.roomCardStatText, { color: textSub }]}>
                    {memberCount} / {room.maxMembers || 50}
                  </Text>
                </View>
                {room.tasks && room.tasks.length > 0 && (
                  <View style={[s.roomCardStat, { backgroundColor: `${cyan}15` }]}>
                    <View style={[s.activeDot, { backgroundColor: cyan, marginRight: 4 }]} />
                    <Text style={[s.roomCardStatText, { color: cyan }]}>
                      {room.tasks.length} ACTIVE OPS
                    </Text>
                  </View>
                )}
              </View>

              {!isMember && room.isPublic && (
                <TouchableOpacity
                  onPress={() => {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    handleJoinPublicRoom(room);
                  }}
                >
                  <LinearGradient
                    colors={[primary, accent]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={s.joinButtonGradient}
                  >
                    <Text style={s.joinButtonText}>
                      {room.requireApproval ? 'REQUEST ACCESS' : 'JOIN UNIT'}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}
              
              {isMember && (
                <View style={s.activeIndicator}>
                  <View style={[s.activeDot, { backgroundColor: '#22c55e' }]} />
                  <Text style={[s.activeText, { color: '#22c55e' }]}>CONNECTED</Text>
                </View>
              )}
            </View>
          </View>
        </Pressable>
      </View>
    );
  };

  // ── Tab content ────────────────────────────────────────
  const renderTabContent = () => {
    switch (activeTab) {
      case 'my-rooms':
        return (
          <View style={s.tabContent}>
            {loading ? (
              <View style={s.loadingContainer}>
                <ActivityIndicator size="large" color={primary} />
              </View>
            ) : filteredMyRooms.length === 0 ? (
              <View style={s.emptyContainer}>
                <Ionicons name="home-outline" size={48} color={textTert} />
                <Text style={[s.emptyTitle, { color: text }]}>No rooms yet</Text>
                <Text style={[s.emptySubtitle, { color: textSub }]}>
                  Deploy your first mission or join an existing squad to begin operations.
                </Text>
                
                <View style={s.premiumEmptyState}>
                  <LinearGradient
                    colors={['rgba(251,191,36,0.1)', 'transparent']}
                    style={s.premiumEmptyInner}
                  >
                    <Ionicons name="star" size={20} color={gold} />
                    <Text style={[s.premiumEmptyText, { color: textSub }]}>
                      Unlock Tactical Analytics & Priority Support with <Text style={{ color: gold, fontWeight: '700' }}>KRIOS PRO</Text>
                    </Text>
                  </LinearGradient>
                </View>

                <TouchableOpacity
                  onPress={() => setCreateRoomModalVisible(true)}
                  style={s.emptyButton}
                >

                  <LinearGradient
                    colors={[primary, accent]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={s.emptyButtonGradient}
                  >
                    <Ionicons name="add" size={20} color="#fff" />
                    <Text style={s.emptyButtonText}>Create Room</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            ) : (
              <FlashList
                data={filteredMyRooms}
                keyExtractor={(item) => `my-room-${item.id}`}
                renderItem={({ item }) => <RoomCard room={item} isMember />}
                estimatedItemSize={120}
                contentContainerStyle={s.roomsList}
              />
            )}

          </View>
        );

      case 'discover':
        return (
          <View style={s.tabContent}>
            {loading ? (
              <View style={s.loadingContainer}>
                <ActivityIndicator size="large" color={primary} />
              </View>
            ) : filteredPublicRooms.length === 0 ? (
              <View style={s.emptyContainer}>
                <Ionicons name="globe-outline" size={48} color={textTert} />
                <Text style={[s.emptyTitle, { color: text }]}>No public rooms</Text>
                <Text style={[s.emptySubtitle, { color: textSub }]}>
                  Be the first to create a public room
                </Text>
              </View>
            ) : (
              <FlashList
                data={filteredPublicRooms}
                keyExtractor={(item) => `public-room-${item.id}`}
                renderItem={({ item }) => <RoomCard room={item} isMember={false} />}
                estimatedItemSize={120}
                contentContainerStyle={s.roomsList}
              />
            )}

          </View>
        );

      case 'join-code':
        return (
          <View style={s.tabContent}>
            <View style={s.joinCodeContainer}>
              <View style={s.joinCodeIconContainer}>
                <LinearGradient
                  colors={[primary, accent]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={s.joinCodeIconGradient}
                >
                  <Ionicons name="key-outline" size={32} color="#fff" />
                </LinearGradient>
              </View>
              <Text style={[s.joinCodeTitle, { color: text }]}>Join with Code</Text>
              <Text style={[s.joinCodeSubtitle, { color: textSub }]}>
                Enter the room invite code to join a private room
              </Text>

              <View style={[s.joinCodeInputContainer, { backgroundColor: inputBg, borderColor: border }]}>
                <TextInput
                  style={[s.joinCodeInput, { color: text }]}
                  value={joinCode}
                  onChangeText={setJoinCode}
                  placeholder="Enter room code"
                  placeholderTextColor={textTert}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  returnKeyType="join"
                  onSubmitEditing={handleJoinRoom}
                />
              </View>

              <TouchableOpacity
                onPress={handleJoinRoom}
                disabled={joiningRoom || !joinCode.trim()}
                style={[s.joinCodeButton, { opacity: joiningRoom || !joinCode.trim() ? 0.5 : 1 }]}
              >
                <LinearGradient
                  colors={[primary, accent]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={s.joinCodeButtonGradient}
                >
                  {joiningRoom ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="enter-outline" size={20} color="#fff" />
                      <Text style={s.joinCodeButtonText}>Join Room</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        );
    }
  };

  // ── Create Room Modal ──────────────────────────────────
  const renderCreateRoomModal = () => {
    const handleAddTask = () => {
      if (!taskTitle.trim()) return;
      const newTask = {
        id: Math.random().toString(),
        title: taskTitle.trim(),
        type: taskType,
        daysOfWeek: taskType === 'custom' ? taskDays : [],
        points: parseInt(taskPoints) || 5,
      };
      setRoomTasks([newTask, ...roomTasks]);
      setTaskTitle('');
      setShowAddTask(false);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    const removeTask = (id: string) => {
      setRoomTasks(roomTasks.filter(t => t.id !== id));
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    const toggleDay = (day: number) => {
      if (taskDays.includes(day)) {
        setTaskDays(taskDays.filter(d => d !== day));
      } else {
        setTaskDays([...taskDays, day].sort());
      }
    };

    return (
      <Modal
        visible={createRoomModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setCreateRoomModalVisible(false)}
      >
        <View style={[s.modalContainer, { backgroundColor: bg }]}>
          <StatusBar barStyle="light-content" />

          {/* Tactical Header */}
          <LinearGradient
            colors={[primary, '#4f46e5']}
            style={s.modalTacticalHeader}
          >
            <View style={s.modalHeaderContent}>
              <TouchableOpacity
                onPress={() => modalStep === 2 ? setModalStep(1) : setCreateRoomModalVisible(false)}
                style={s.modalTacticalClose}
              >
                <Ionicons name={modalStep === 2 ? "chevron-back" : "close"} size={24} color="#FFF" />
              </TouchableOpacity>
              
              <View style={{ alignItems: 'center' }}>
                <Text style={s.modalTacticalTitle}>
                  {modalStep === 1 ? 'NEW MISSION' : 'ADD OBJECTIVES'}
                </Text>
                <Text style={s.modalTacticalSubtitle}>
                  {modalStep === 1 ? 'Step 1: Deployment Briefing' : 'Step 2: Operational Tasks'}
                </Text>
              </View>

              {modalStep === 1 ? (
                <TouchableOpacity
                  onPress={() => {
                    if (newRoomName.trim()) {
                      setModalStep(2);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    }
                  }}
                  style={[s.modalTacticalCreate, { opacity: !newRoomName.trim() ? 0.6 : 1 }]}
                >
                  <Text style={s.modalTacticalCreateText}>NEXT</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={handleCreateRoom}
                  disabled={creatingRoom}
                  style={s.modalTacticalCreate}
                >
                  {creatingRoom ? (
                    <ActivityIndicator size="small" color={primary} />
                  ) : (
                    <Text style={s.modalTacticalCreateText}>DEPLOY</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </LinearGradient>

          {modalStep === 1 ? (
            <ScrollView
              style={s.modalContent}
              contentContainerStyle={s.modalContentContainer}
              showsVerticalScrollIndicator={false}
            >
              {/* Identification Section */}
              <View style={[s.formSection, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }]}>
                <View style={s.sectionHeader}>
                  <Ionicons name="flag" size={16} color={primary} />
                  <Text style={[s.sectionTitle, { color: textSub }]}>IDENTIFICATION</Text>
                </View>
                
                <View style={s.formGroup}>
                  <Text style={[s.formLabel, { color: textTert }]}>OPERATION NAME</Text>
                  <TextInput
                    style={[s.formInput, { backgroundColor: inputBg, borderColor: border, color: text }]}
                    value={newRoomName}
                    onChangeText={setNewRoomName}
                    placeholder="Operation: Zero Gravity"
                    placeholderTextColor={textTert}
                  />
                </View>

                <View style={s.formGroup}>
                  <Text style={[s.formLabel, { color: textTert }]}>MISSION SUMMARY</Text>
                  <TextInput
                    style={[s.formInput, s.formTextArea, { backgroundColor: inputBg, borderColor: border, color: text }]}
                    value={newRoomDescription}
                    onChangeText={setNewRoomDescription}
                    placeholder="High-level operational goals..."
                    placeholderTextColor={textTert}
                    multiline
                    numberOfLines={3}
                  />
                </View>
              </View>

              {/* Protocol Section */}
              <View style={[s.formSection, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }]}>
                <View style={s.sectionHeader}>
                  <Ionicons name="shield" size={16} color={accent} />
                  <Text style={[s.sectionTitle, { color: textSub }]}>VISIBILITY PROTOCOL</Text>
                </View>

                <View style={s.visibilityToggleRow}>
                  <TouchableOpacity 
                    onPress={() => {
                      setNewRoomIsPublic(true);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                    style={[s.visBtn, newRoomIsPublic && { backgroundColor: `${primary}20`, borderColor: primary }]}
                  >
                    <Ionicons name="globe" size={24} color={newRoomIsPublic ? primary : textTert} />
                    <Text style={[s.visLabel, { color: newRoomIsPublic ? text : textSub }]}>PUBLIC</Text>
                    <Text style={s.visDesc}>Visible to everyone</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    onPress={() => {
                      setNewRoomIsPublic(false);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                    style={[s.visBtn, !newRoomIsPublic && { backgroundColor: `${accent}20`, borderColor: accent }]}
                  >
                    <Ionicons name="lock-closed" size={24} color={!newRoomIsPublic ? accent : textTert} />
                    <Text style={[s.visLabel, { color: !newRoomIsPublic ? text : textSub }]}>PRIVATE</Text>
                    <Text style={s.visDesc}>Invite only access</Text>
                  </TouchableOpacity>
                </View>

                <View style={[s.formToggleRow, { marginTop: 16 }]}>
                  <View>
                    <Text style={[s.formLabel, { color: textTert, marginBottom: 2 }]}>ADMIN APPROVAL</Text>
                    <Text style={{ fontSize: 11, color: textTert }}>Review join requests</Text>
                  </View>
                  <Switch
                    value={newRoomRequireApproval}
                    onValueChange={setNewRoomRequireApproval}
                    trackColor={{ false: '#333', true: primary }}
                  />
                </View>
              </View>

              {/* Logistics Section */}
              <View style={[s.formSection, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }]}>
                <View style={s.sectionHeader}>
                  <Ionicons name="settings" size={16} color={gold} />
                  <Text style={[s.sectionTitle, { color: textSub }]}>LOGISTICS & LIFECYCLE</Text>
                </View>
                
                <View style={s.formGroup}>
                  <Text style={[s.formLabel, { color: textTert }]}>DEPLOYMENT DURATION</Text>
                  <View style={s.durationRow}>
                    {(['1_week', '2_weeks', '1_month'] as const).map((d) => (
                      <TouchableOpacity
                        key={d}
                        onPress={() => setNewRoomDuration(d)}
                        style={[s.durationChip, { backgroundColor: newRoomDuration === d ? primary : inputBg }]}
                      >
                        <Text style={[s.durationChipText, { color: newRoomDuration === d ? '#fff' : textSub }]}>
                          {d.replace('_', ' ').toUpperCase()}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={[s.formGroup, { flex: 1 }]}>
                    <Text style={[s.formLabel, { color: textTert }]}>MAX UNIT SIZE</Text>
                    <TextInput
                      style={[s.formInput, { backgroundColor: inputBg, borderColor: border, color: text }]}
                      value={newRoomMaxMembers}
                      onChangeText={setNewRoomMaxMembers}
                      placeholder="20"
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={[s.formGroup, { flex: 1 }]}>
                    <Text style={[s.formLabel, { color: textTert }]}>RETENTION (DAYS)</Text>
                    <View style={s.retentionControl}>
                      <TouchableOpacity onPress={() => setNewRoomRetention(Math.max(1, newRoomRetention - 1))} style={s.retentionBtn}>
                        <Ionicons name="remove" size={18} color={text} />
                      </TouchableOpacity>
                      <Text style={[s.retentionValue, { color: text }]}>{newRoomRetention}</Text>
                      <TouchableOpacity onPress={() => setNewRoomRetention(Math.min(5, newRoomRetention + 1))} style={s.retentionBtn}>
                        <Ionicons name="add" size={18} color={text} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </View>
              <View style={{ height: 60 }} />
            </ScrollView>
          ) : (
            <View style={{ flex: 1 }}>
              <ScrollView 
                style={s.modalContent} 
                contentContainerStyle={s.modalContentContainer}
              >
                {/* Current Tasks List */}
                <View style={s.taskListContainer}>
                  {roomTasks.length === 0 ? (
                    <View style={s.emptyTasksBox}>
                      <Ionicons name="list" size={40} color={textTert} />
                      <Text style={[s.emptyTasksText, { color: textSub }]}>No mission objectives defined yet.</Text>
                      <Text style={[s.emptyTasksSub, { color: textTert }]}>Add recurring tasks for your unit to complete.</Text>
                    </View>
                  ) : (
                    roomTasks.map((t) => (
                      <View key={t.id} style={[s.taskItem, { backgroundColor: surf, borderColor: border }]}>
                        <View style={{ flex: 1 }}>
                          <Text style={[s.taskItemTitle, { color: text }]}>{t.title}</Text>
                          <Text style={[s.taskItemSub, { color: textSub }]}>
                            {t.type.toUpperCase()} • {t.points} PTS
                            {t.type === 'custom' && ` • Days: ${t.daysOfWeek.join(',')}`}
                          </Text>
                        </View>
                        <TouchableOpacity onPress={() => removeTask(t.id)}>
                          <Ionicons name="trash-outline" size={20} color="#ef4444" />
                        </TouchableOpacity>
                      </View>
                    ))
                  )}
                </View>

                {showAddTask ? (
                  <Animated.View entering={FadeInDown} style={[s.addTaskForm, { backgroundColor: surf, borderColor: primary }]}>
                    <Text style={[s.formLabel, { color: primary }]}>NEW TASK</Text>
                    <TextInput
                      style={[s.formInput, { backgroundColor: inputBg, color: text, marginBottom: 12 }]}
                      value={taskTitle}
                      onChangeText={setTaskTitle}
                      placeholder="e.g., Daily Morning Run"
                      placeholderTextColor={textTert}
                      autoFocus
                    />
                    
                    <Text style={[s.formLabel, { color: textTert }]}>FREQUENCY</Text>
                    <View style={s.durationRow}>
                      {(['daily', 'weekly', 'custom'] as const).map((f) => (
                        <TouchableOpacity
                          key={f}
                          onPress={() => setTaskType(f)}
                          style={[s.durationChip, { backgroundColor: taskType === f ? primary : inputBg }]}
                        >
                          <Text style={[s.durationChipText, { color: taskType === f ? '#fff' : textSub }]}>
                            {f.toUpperCase()}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {taskType === 'custom' && (
                      <View style={s.daysRow}>
                        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                          <TouchableOpacity 
                            key={i} 
                            onPress={() => toggleDay(i)}
                            style={[s.dayBtn, taskDays.includes(i) && { backgroundColor: cyan, borderColor: cyan }]}
                          >
                            <Text style={[s.dayBtnText, taskDays.includes(i) && { color: '#fff' }]}>{day}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.formLabel, { color: textTert }]}>POINTS</Text>
                        <TextInput
                          style={[s.formInput, { backgroundColor: inputBg, color: text }]}
                          value={taskPoints}
                          onChangeText={setTaskPoints}
                          keyboardType="numeric"
                        />
                      </View>
                      <TouchableOpacity 
                        onPress={handleAddTask}
                        style={s.confirmTaskBtn}
                      >
                        <Text style={s.confirmTaskBtnText}>ADD TASK</Text>
                      </TouchableOpacity>
                    </View>
                    
                    <TouchableOpacity 
                      onPress={() => setShowAddTask(false)}
                      style={{ alignSelf: 'center', marginTop: 12 }}
                    >
                      <Text style={{ color: textSub, fontSize: 12 }}>CANCEL</Text>
                    </TouchableOpacity>
                  </Animated.View>
                ) : (
                  <TouchableOpacity 
                    onPress={() => {
                      setShowAddTask(true);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    }}
                    style={s.addTaskBtn}
                  >
                    <Ionicons name="add-circle" size={24} color={primary} />
                    <Text style={[s.addTaskBtnText, { color: primary }]}>ADD NEW TASK</Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
              
              <TouchableOpacity 
                onPress={handleCreateRoom}
                style={[s.deployBottomBtn, { marginBottom: insets.bottom + 20 }]}
              >
                <LinearGradient colors={[primary, accent]} style={s.deployBottomGradient}>
                  <Text style={s.deployBottomText}>DEPLOY MISSION NOW</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>
    );
  };

  // ── Main render ────────────────────────────────────────
  return (
    <View style={[s.root, { backgroundColor: bg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Background */}
      <LinearGradient
        colors={isDark ? ['#080810', '#0d0d1e', '#080810'] : ['#f8f9ff', '#f0f0ff', '#f8f9ff']}
        locations={[0, 0.5, 1]}
        start={{ x: 0.3, y: 0 }}
        end={{ x: 0.7, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={[`rgba(99,102,241,${isDark ? '0.12' : '0.05'})`, 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Edge shine — left */}
      <LinearGradient
        colors={[`rgba(139,92,246,${isDark ? '0.2' : '0.08'})`, 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[StyleSheet.absoluteFill, { width: 2 }]}
      />

      {/* Alerts */}
      {error && (
        <Animated.View
          entering={FadeInDown}
          style={[s.alert, { backgroundColor: isDark ? 'rgba(239,68,68,0.2)' : 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.3)' }]}
        >
          <Ionicons name="alert-circle" size={20} color="#ef4444" />
          <Text style={[s.alertText, { color: '#ef4444' }]}>{error}</Text>
          <TouchableOpacity onPress={() => setError(null)}>
            <Ionicons name="close" size={20} color="#ef4444" />
          </TouchableOpacity>
        </Animated.View>
      )}
      {success && (
        <Animated.View
          entering={FadeInDown}
          style={[s.alert, { backgroundColor: isDark ? 'rgba(34,197,94,0.2)' : 'rgba(34,197,94,0.1)', borderColor: 'rgba(34,197,94,0.3)' }]}
        >
          <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
          <Text style={[s.alertText, { color: '#22c55e' }]}>{success}</Text>
          <TouchableOpacity onPress={() => setSuccess(null)}>
            <Ionicons name="close" size={20} color="#22c55e" />
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Fixed header — only small title + tabs (fades in on scroll) */}
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
          <TouchableOpacity
            onPress={() => router.back()}
            style={s.backButton}
          >
            <Ionicons name="chevron-back" size={24} color={text} />
          </TouchableOpacity>
          <Animated.Text style={[s.titleSmall, { color: text }, smallTitleStyle]}>
            Rooms
          </Animated.Text>
          <TouchableOpacity
            onPress={() => setCreateRoomModalVisible(true)}
            style={s.createButton}
          >
            <LinearGradient
              colors={[primary, accent]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.createButtonGradient}
            >
              <Ionicons name="add" size={20} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View style={s.tabsContainer}>
          {(['my-rooms', 'discover', 'join-code'] as TabType[]).map(tab => (
            <TouchableOpacity
              key={tab}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setActiveTab(tab);
              }}
              style={[s.tab, activeTab === tab && s.tabActive]}
            >

              <Text style={[
                s.tabText,
                { color: activeTab === tab ? primary : textTert },
                activeTab === tab && s.tabTextActive,
              ]}>
                {tab === 'my-rooms' ? 'My Rooms' : tab === 'discover' ? 'Discover' : 'Join Code'}
              </Text>
              {activeTab === tab && (
                <View style={[s.tabIndicator, { backgroundColor: primary }]} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Scrollable content (starts below absolute header) */}
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 140, paddingTop: insets.top + 140, minHeight: H + insets.top + 240 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={primary}
            colors={[primary]}
            progressViewOffset={insets.top + 140}
          />
        }
      >
        {/* Large title inside scroll (Samsung style) */}
        <View style={{ paddingHorizontal: 20, paddingBottom: 16 }}>
          <Animated.Text style={[s.titleLarge, { color: text }, largeTitleStyle]}>
            Rooms
          </Animated.Text>
        </View>

        {/* Search bar */}
        <View style={[s.searchBar, {
          backgroundColor: inputBg,
          borderColor: searchFocused ? primary : border,
          marginHorizontal: 20,
          marginBottom: 16,
        }]}>
          <Ionicons name="search-outline" size={15} color={textTert} />
          <TextInput
            style={[s.searchInput, { color: text }]}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder="Search rooms..."
            placeholderTextColor={textTert}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={15} color={textTert} />
            </TouchableOpacity>
          )}
        </View>

        {/* Tab content */}
        {renderTabContent()}
      </Animated.ScrollView>

      {/* Create Room Modal */}
      {renderCreateRoomModal()}

      {/* Leave Room Confirmation */}
      <ConfirmationModal
        visible={showLeaveConfirm}
        title="Leave Room"
        message={`Are you sure you want to leave "${longPressRoom?.name}"? You can rejoin later with the room code.`}
        confirmText="Leave"
        isDark={isDark}
        destructive
        onConfirm={handleLeaveRoom}
        onCancel={() => { setShowLeaveConfirm(false); setLongPressRoom(null); }}
      />

      {/* Delete Room Confirmation */}
      <ConfirmationModal
        visible={showDeleteConfirm}
        title="Delete Room"
        message={`Are you sure you want to permanently delete "${longPressRoom?.name}"? This will remove all tasks and members. This cannot be undone.`}
        confirmText="Delete"
        isDark={isDark}
        destructive
        onConfirm={handleDeleteRoom}
        onCancel={() => { setShowDeleteConfirm(false); setLongPressRoom(null); }}
      />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1 },

  // Header
  header: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  headerBorder: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 1,
  },
  smallTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  backButton: {
    padding: 4,
  },
  titleSmall: {
    fontSize: 18,
    fontWeight: '700',
  },
  titleLarge: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  createButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
  },
  createButtonGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Tabs
  tabsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    position: 'relative',
  },
  tabActive: {},
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  tabTextActive: {
    fontWeight: '700',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: '20%',
    right: '20%',
    height: 3,
    borderRadius: 2,
  },

  // Search
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    padding: 0,
  },

  // Tab content
  tabContent: {
    paddingHorizontal: 20,
  },

  // Rooms list
  roomsList: {
    paddingBottom: 20,
  },

  // Room card
  cardShadowWrapper: {
    marginHorizontal: 0,
    marginBottom: 16,
  },
  roomCard: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  roomCardInner: {
    padding: 16,
    paddingTop: 14,
  },
  roomCardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  roomCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 6,
  },
  roomCardTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  premiumTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  premiumTagText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#000',
    letterSpacing: 0.5,
  },
  roomCardBadges: {
    flexDirection: 'row',
    gap: 6,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  doomClock: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doomClockText: {
    fontSize: 10,
    fontWeight: '900',
  },
  roomCardDescription: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
    fontWeight: '400',
  },
  roomCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  roomCardStats: {
    flexDirection: 'row',
    gap: 12,
  },
  roomCardStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  roomCardStatText: {
    fontSize: 10,
    fontWeight: '700',
  },
  joinButtonGradient: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  joinButtonText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  activeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(34,197,94,0.1)',
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  activeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },

  // Modal Tactical
  modalTacticalHeader: {
    paddingTop: Platform.OS === 'ios' ? 10 : 20,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  modalHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTacticalClose: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTacticalTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 1,
  },
  modalTacticalSubtitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 2,
    marginTop: 2,
  },
  modalTacticalCreate: {
    backgroundColor: '#FFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  modalTacticalCreateText: {
    color: '#4f46e5',
    fontSize: 11,
    fontWeight: '900',
  },
  formSection: {
    padding: 16,
    borderRadius: 20,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  formGroup: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 6,
  },
  formInput: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: '500',
  },
  formTextArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  durationRow: {
    flexDirection: 'row',
    gap: 8,
  },
  durationChip: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationChipText: {
    fontSize: 11,
    fontWeight: '800',
  },
  retentionControl: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 12,
    padding: 4,
  },
  retentionBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  retentionValue: {
    fontSize: 15,
    fontWeight: '800',
  },
  formToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
  emptyButton: {
    marginTop: 24,
    borderRadius: 12,
    overflow: 'hidden',
  },
  emptyButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
  },
  emptyButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  joinCodeContainer: {
    padding: 20,
    alignItems: 'center',
  },
  joinCodeIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
    marginBottom: 16,
  },
  joinCodeIconGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  joinCodeTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  joinCodeSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  joinCodeInputContainer: {
    width: '100%',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 16,
  },
  joinCodeInput: {
    fontSize: 16,
    textAlign: 'center',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  joinCodeButton: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
  },
  joinCodeButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  joinCodeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  modalContainer: {
    flex: 1,
  },
  modalContent: {
    flex: 1,
  },
  modalContentContainer: {
    paddingBottom: 40,
  },
  alert: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginHorizontal: 16,
    marginBottom: 16,
    gap: 8,
  },
  alertText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  // Create Room Enhancements
  visibilityToggleRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  visBtn: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: 'rgba(0,0,0,0.05)',
    alignItems: 'center',
    gap: 8,
  },
  visLabel: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  visDesc: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
  },
  taskListContainer: {
    padding: 16,
    gap: 12,
  },
  emptyTasksBox: {
    alignItems: 'center',
    padding: 30,
    borderRadius: 20,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.1)',
  },
  emptyTasksText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyTasksSub: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
  taskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  taskItemTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  taskItemSub: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  addTaskBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(99,102,241,0.5)',
    marginTop: 10,
  },
  addTaskBtnText: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
  },
  addTaskForm: {
    margin: 16,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
  },
  daysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 8,
  },
  dayBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayBtnText: {
    fontSize: 10,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.5)',
  },
  confirmTaskBtn: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  confirmTaskBtnText: {
    color: '#4f46e5',
    fontSize: 11,
    fontWeight: '900',
  },
  deployBottomBtn: {
    marginHorizontal: 20,
    borderRadius: 16,
    overflow: 'hidden',
  },
  deployBottomGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  deployBottomText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  premiumEmptyState: {
    width: '100%',
    paddingHorizontal: 20,
    marginTop: 20,
    marginBottom: 10,
  },
  premiumEmptyInner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.2)',
    gap: 12,
  },
  premiumEmptyText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
});

