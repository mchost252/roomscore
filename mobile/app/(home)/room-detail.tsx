/**
 * RoomDetailScreen — "Layered Workspace" redesign
 *
 * Architecture:
 *   RoomHeader (swipeable: identity front / metadata back)
 *   RoomCalendar (two-level: weekly strip → full month)
 *   RoomPulse (live activity feed, one notification at a time)
 *   Task Sections (Active [open], Pending [collapsed], Spectating [collapsed])
 *     └─ TaskCard (clean card: title, deadline, avatars, progress bar)
 *
 * Data: useRoomDetail hook → MMKV instant → API background → WebSocket live
 * Navigation: Task press → room-task-thread (NOT home task-thread)
 *
 * NOTE: All data logic, handlers, and modal wiring are preserved exactly
 * from the previous "Tactical Archive" build. This is a UI-only refactor.
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Platform,
  ScrollView,
} from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../../context/ToastContext';
import { useRoomDetail } from '../../hooks/room/useRoomDetail';
import { taskService } from '../../services/taskService';
import { RoomService } from '../../services/roomService';
import { Task } from '../../types/room';
import { roomStorage } from '../../db/roomDb';

import { useAuth } from '../../context/AuthContext';

// ── New UI components ───────────────────────────────────────────────────────
import RoomHeader from '../../components/room-detail/RoomHeader';
import RoomCalendar from '../../components/room-detail/RoomCalendar';
import RoomPulse from '../../components/room-detail/RoomPulse';
import TaskCard from '../../components/room-detail/TaskCard';
import { GhostTaskCard } from '../../components/room-detail/VisualEffects';
import RoomChatPreview from '../../components/room-detail/RoomChatPreview';
import { ScoutInterface } from '../../components/ai/ScoutInterface';

// ── Shared modals / sheets (unchanged) ──────────────────────────────────────
import TaskOptionsSheet from '../../components/room-detail/TaskOptionsSheet';
import MemberHUDModal from '../../components/room-detail/MemberHUDModal';
import MissionBriefModal from '../../components/room-detail/MissionBriefModal';
import LeaveTaskModal from '../../components/room-detail/LeaveTaskModal';
import RoomOnboardingModal from '../../components/room-detail/RoomOnboardingModal';
import TaskCompletionModal from '../../components/TaskCompletionModal';
import TaskCreationModal from '../../components/TaskCreationModal';
import RoomSettingsModal from '../../components/RoomSettingsModal';

import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  useAnimatedScrollHandler, 
  interpolate, 
  Extrapolation 
} from 'react-native-reanimated';

// ─── Screen ──────────────────────────────────────────────────────────────────
const RoomDetailScreen: React.FC = () => {
  const { colors, isDark } = useTheme();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  // ── Scroll Animation ──────────────────────────────────────────────────────
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const stickyNavStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [40, 80], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(scrollY.value, [40, 80], [-10, 0], Extrapolation.CLAMP) }],
  }));

  const navBgStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [20, 60], [0, 1], Extrapolation.CLAMP),
  }));

  // ── Route param ───────────────────────────────────────────────────────────
  const { roomId: roomIdParam } = useLocalSearchParams<{ roomId: string | string[] }>();
  const roomId = Array.isArray(roomIdParam) ? roomIdParam[0] : roomIdParam || '';

  // ── Data hook (MMKV-first → API → WebSocket) ─────────────────────────────
  const {
    room,
    tasks,
    members,
    activeTasks,
    loading,
    refreshing,
    isOwner,
    userId,
    refresh,
    addTask,
    updateTask,
    updateRoom,
  } = useRoomDetail(roomId);

  // ── Local UI state ────────────────────────────────────────────────────────
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [showOptionsSheet, setShowOptionsSheet] = useState(false);
  const [optionsTask, setOptionsTask] = useState<Task | null>(null);
  const [showBriefModal, setShowBriefModal] = useState(false);
  const [briefTask, setBriefTask] = useState<Task | null>(null);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaveTask, setLeaveTask] = useState<Task | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showMemberHUD, setShowMemberHUD] = useState(false);
  const [showScout, setShowScout] = useState(false);
  const [activeTab, setActiveTab] = useState<'active' | 'pending' | 'spectating'>('active');

  // ── Derived data (PRESERVED) ──────────────────────────────────────────────
  const filteredTasks = useMemo(() => {
    if (!selectedDate) return tasks;

    const selectedDay = selectedDate.getDay();
    const selectedDateKey = [
      selectedDate.getFullYear(),
      String(selectedDate.getMonth() + 1).padStart(2, '0'),
      String(selectedDate.getDate()).padStart(2, '0'),
    ].join('-');

    return tasks.filter(t => {
      if (!t.createdAt) return true;
      const created = new Date(t.createdAt);
      if (created.getTime() > selectedDate.getTime() + (24 * 60 * 60 * 1000)) return false;

      const taskType = t.taskType === 'weekly' ? 'daily' : (t.taskType || 'daily');
      if (taskType === 'daily') return true;
      if (taskType === 'one-time') {
        if (!t.dueDate) return false;
        return new Date(t.dueDate).toISOString().slice(0, 10) === selectedDateKey;
      }
      if (taskType === 'custom') {
        const days = Array.isArray(t.daysOfWeek)
          ? t.daysOfWeek
          : String(t.daysOfWeek || '').split(',').map(Number).filter(Number.isInteger);
        return days.includes(selectedDay);
      }
      return true;
    });
  }, [tasks, selectedDate]);

  // ── Derived data (PRESERVED) ──────────────────────────────────────────────
  const daysLeft = useMemo(() => {
    if (!room?.doomClockExpiry) return 0;
    const expiry = new Date(room.doomClockExpiry);
    const now = new Date();
    const diffMs = expiry.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  }, [room?.doomClockExpiry]);

  // ── Task categorization (SAME LOGIC as sortedTasks, split into 3 arrays) ─
  const { activeTaskList, pendingTaskList, spectatingTaskList } = useMemo(() => {
    const active: Task[] = [];
    const completed: Task[] = [];
    const spectator: Task[] = [];
    for (const t of filteredTasks) {
      const isJoined = t.isJoined !== false && t.status !== 'spectator';
      if (isJoined) {
        if (t.isCompleted) {
          completed.push(t);
        } else {
          active.push(t);
        }
      } else {
        spectator.push(t);
      }
    }
    return { activeTaskList: active, pendingTaskList: completed, spectatingTaskList: spectator };
  }, [filteredTasks]);

  // ── Calendar dot data ─────────────────────────────────────────────────────
  const taskDates = useMemo(
    () => tasks.filter(t => t.createdAt).map(t => new Date(t.createdAt)),
    [tasks],
  );
  const completedDates = useMemo(
    () => tasks.filter(t => t.isCompleted && t.createdAt).map(t => new Date(t.createdAt)),
    [tasks],
  );

  // ── isOptionsTaskParticipant (PRESERVED) ──────────────────────────────────
  const isOptionsTaskParticipant = useMemo(() => {
    if (!optionsTask || !userId) return false;
    if (optionsTask.isJoined === true) return true;
    if (optionsTask.status === 'accepted') return true;
    if (optionsTask.participants?.some(p => p.userId === userId)) return true;
    return false;
  }, [optionsTask, userId]);

  // ── Onboarding Check (PRESERVED) ──────────────────────────────────────────
  useEffect(() => {
    if (!roomId || tasks.length === 0) return;
    const hasOnboarded = roomStorage.getBoolean(`onboarded_${roomId}`);
    if (!hasOnboarded) {
      setShowOnboarding(true);
    }
  }, [roomId, tasks.length]);

  // ═══════════════════════════════════════════════════════════════════════════
  // ALL HANDLERS BELOW ARE PRESERVED EXACTLY FROM PREVIOUS BUILD
  // ═══════════════════════════════════════════════════════════════════════════

  const handleOnboardingComplete = useCallback(async (selectedTaskIds: string[]) => {
    roomStorage.set(`onboarded_${roomId}`, true);
    setShowOnboarding(false);

    if (selectedTaskIds.length === 0) return;

    // Optimistically update all selected tasks
    selectedTaskIds.forEach(id => {
      const t = tasks.find(x => x.id === id);
      const newP = [...(t?.participants || [])];
      if (userId && !newP.some(p => p.userId === userId)) {
        newP.push({ 
          id: userId, 
          userId: userId, 
          username: user?.username || 'Me', 
          avatar: user?.avatar,
          isOnline: true, 
          aura: 'bronze' as any, 
          hasHeat: false 
        });
      }
      updateTask(id, { isJoined: true, status: 'accepted', participants: newP });
    });

    // Run network requests in parallel
    try {
      await Promise.all(selectedTaskIds.map(id => 
        taskService.joinTask(roomId, id).catch(e => {
          console.error(`Failed to join task ${id}:`, e);
          // Rollback local state if needed (optional for now)
        })
      ));
      showToast({ message: `Successfully added ${selectedTaskIds.length} tasks!`, type: 'success' });
    } catch (e) {
      console.error('Onboarding network error:', e);
    }
  }, [roomId, tasks, userId, updateTask, showToast]);

  const handleTaskComplete = useCallback(async (task: Task) => {
    if (task.isCompleted) {
      showToast({ message: 'Task already completed today', type: 'info' });
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try {
      const completion = await taskService.completeTask(roomId, task.id);
      const existingCompletions = task.completions || [];
      const newCompletions = [...existingCompletions];
      if (!newCompletions.some(c => c.userId === completion.userId)) {
        newCompletions.push(completion);
      }
      updateTask(task.id, { isCompleted: true, completions: newCompletions });
      showToast({ message: 'Task completed!', type: 'success' });
    } catch (error: any) {
      if (error?.response?.data?.message === 'Task already completed today') {
        updateTask(task.id, { isCompleted: true });
        showToast({ message: 'Task already completed today', type: 'info' });
      } else {
        showToast({ message: 'Failed to complete task', type: 'error' });
      }
    }
  }, [roomId, updateTask, showToast]);

  const handleTaskUncomplete = useCallback(async (task: Task) => {
    if (!task.isCompleted) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await taskService.uncompleteTask(roomId, task.id);
      updateTask(task.id, { isCompleted: false });
      showToast({ message: 'Task uncompleted', type: 'success' });
    } catch (error) {
      showToast({ message: 'Failed to uncomplete task', type: 'error' });
    }
  }, [roomId, updateTask, showToast]);

  const handleTaskSubmit = useCallback(async (taskData: {
    id?: string;
    title: string;
    description?: string;
    points?: number;
    taskType?: string;
    daysOfWeek?: number[];
    hasThread?: boolean;
  }) => {
    setShowTaskModal(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (taskData.id) {
      const patchData = { ...taskData };
      updateTask(taskData.id, patchData as any);
      try {
        const updatedTask = await taskService.updateTask(roomId, taskData.id, patchData as any);
        updateTask(taskData.id, updatedTask);
        showToast({ message: 'Task updated successfully', type: 'success' });
      } catch (error) {
        await refresh();
        showToast({ message: 'Failed to update task', type: 'error' });
      }
      return;
    }

    try {
      await taskService.createTask(roomId, taskData);
      showToast({ message: 'Task created successfully', type: 'success' });
    } catch (error) {
      await refresh();
      showToast({ message: 'Failed to create task', type: 'error' });
    }
  }, [roomId, updateTask, refresh, showToast]);

  const handleTaskPress = useCallback((task: Task) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Normal task (no thread): open the completion flow instead of navigating
    if (!task.hasThread) {
      setSelectedTask(task);
      setShowCompletionModal(true);
      return;
    }

    router.push({
      pathname: '/(home)/room-task-thread',
      params: {
        taskId: task.id,
        taskTitle: task.title,
        roomId: roomId,
        roomName: room?.name || 'Room',
        points: String(task.points || 10),
        dueDate: task.dueDate || '',
        taskType: task.taskType || 'daily',
        description: task.description || '',
        isOwner: String(isOwner),
      },
    });
  }, [roomId, room?.name, isOwner]);

  const handleTaskCheckboxPress = useCallback((task: Task) => {
    if (task.isCompleted) {
      handleTaskUncomplete(task);
      return;
    }
    setSelectedTask(task);
    setShowCompletionModal(true);
  }, [handleTaskUncomplete]);

  const handleTaskJoin = useCallback(async (task: Task) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const oldParticipants = task.participants || [];
    try {
      const newP = [...oldParticipants];
      if (userId && !newP.some(p => p.userId === userId)) {
        newP.push({ id: userId, userId: userId, username: user?.username || 'Me', avatar: user?.avatar, isOnline: true, aura: 'bronze' as any, hasHeat: false });
      }
      updateTask(task.id, { isJoined: true, status: 'accepted', participants: newP });
      showToast({ message: `Joined "${task.title}"`, type: 'success' });
      await taskService.joinTask(roomId, task.id);
    } catch (error: any) {
      const msg = error.response?.data?.message || 'Failed to join task';
      if (msg === 'Already joined this task') {
        showToast({ message: 'You have already joined this task', type: 'success' });
        // Don't revert the optimistic update since they ARE joined!
      } else {
        updateTask(task.id, { isJoined: false, status: 'spectator', participants: oldParticipants });
        showToast({ message: msg, type: 'error' });
      }
    }
  }, [roomId, userId, user?.username, user?.avatar, updateTask, showToast]);

  const handleTaskMenuPress = useCallback((task: Task) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setOptionsTask(task);
    setShowOptionsSheet(true);
  }, []);

  const handleDeleteTask = useCallback(async (task: Task) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    try {
      await taskService.deleteTask(roomId, task.id);
      showToast({ message: 'Task deleted', type: 'success' });
      // The socket listener 'task:deleted' will handle removing it from the list
    } catch (error) {
      showToast({ message: 'Failed to delete task', type: 'error' });
    }
  }, [roomId, showToast]);

  const handleLeaveTask = useCallback((task: Task) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLeaveTask(task);
    setShowLeaveModal(true);
  }, []);

  const handleLeaveTaskConfirm = useCallback(async (task: Task) => {
    try {
      updateTask(task.id, { isJoined: false, status: 'spectator' });
      showToast({ message: `Left "${task.title}"`, type: 'success' });
      await taskService.leaveTask(roomId, task.id).catch(() => {});
    } catch (error) {
      updateTask(task.id, { isJoined: true, status: 'accepted' });
      showToast({ message: 'Failed to leave task', type: 'error' });
    }
  }, [roomId, updateTask, showToast]);

  const handleTogglePrivacy = useCallback(async (newIsPublic: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      updateRoom({ isPublic: newIsPublic, isPrivate: !newIsPublic });
      showToast({ message: newIsPublic ? 'Room is now public' : 'Room is now private', type: 'success' });
    } catch (error) {
      showToast({ message: 'Failed to update privacy', type: 'error' });
    }
  }, [updateRoom, showToast]);

  // NOTE: these run while MemberHUDModal is presented, so they must not use
  // Alert.alert — an alert raised behind a presented Modal never surfaces and
  // the tap looks dead. The modal owns the confirm step and shows errors inline,
  // so these just perform the action and let it throw on failure.
  const handleKickMember = useCallback(async (targetUserId: string) => {
    const target = members.find(m => (m.userId || m.id) === targetUserId);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    await RoomService.removeMember(roomId, targetUserId);
    showToast({ message: `${target?.username || 'Member'} removed`, type: 'success' });
    await refresh();
  }, [members, roomId, showToast, refresh]);

  const handlePromoteMember = useCallback(async (targetUserId: string, role: 'admin' | 'member') => {
    const target = members.find(m => (m.userId || m.id) === targetUserId);
    const name = target?.username || 'Member';
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await RoomService.updateMemberRole(roomId, targetUserId, role);
    showToast({
      message: role === 'admin' ? `${name} is now an admin` : `${name} is no longer an admin`,
      type: 'success',
    });
    await refresh();
  }, [members, roomId, showToast, refresh]);

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  const screenBg = isDark ? '#080810' : '#f5f5fa';

  // ── Loading state ─────────────────────────────────────────────────────────
  if (loading && !room) {
    return (
      <View style={[styles.root, { backgroundColor: screenBg }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading room...</Text>
        </View>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={[styles.root, { backgroundColor: screenBg }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* ── Fixed Navigation Bar ────────────────────────────────────────── */}
      <View style={[styles.fixedNav, { paddingTop: insets.top, height: 50 + insets.top }]}>
        <Animated.View style={[StyleSheet.absoluteFill, navBgStyle]}>
          <View style={[StyleSheet.absoluteFill, { 
            backgroundColor: isDark ? '#080810' : '#f5f5fa', 
            opacity: 0.95 
          }]} />
          <BlurView 
            intensity={100} 
            tint={isDark ? "dark" : "light"}
            style={StyleSheet.absoluteFill} 
          />
          {/* Subtle bottom border for the sticky state */}
          <View style={[styles.navBorder, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }]} />
        </Animated.View>
        
        <View style={styles.navContent}>





           <TouchableOpacity onPress={() => router.back()} style={styles.navIconBtn}>
             <Ionicons name="chevron-back" size={24} color="#fff" />
           </TouchableOpacity>
           
          <Animated.View style={[styles.navTitleContainer, stickyNavStyle]}>
             <Text style={[styles.navTitle, { color: isDark ? '#fff' : '#000' }]} numberOfLines={1}>
               {room?.name || 'Room'}
             </Text>
             <Text style={[styles.navSubtitle, { color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }]}>
               {members.length} member{members.length !== 1 ? 's' : ''}
             </Text>
           </Animated.View>

          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
             <TouchableOpacity onPress={() => setShowMemberHUD(true)} style={styles.navIconBtn}>
               <Ionicons name="people-outline" size={21} color="#fff" />
             </TouchableOpacity>
             {isOwner && (
               <TouchableOpacity
                 onPress={() => {
                   Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                   setSelectedTask(null);
                   setShowTaskModal(true);
                 }}
                 style={styles.navIconBtn}
               >
                 <Ionicons name="add" size={26} color="#fff" />
               </TouchableOpacity>
             )}
          </View>
        </View>
      </View>

      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100, paddingTop: 0 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* ── Layer A: Room Identity Header ─────────────────────────────────── */}
        <RoomHeader
          roomName={room?.name || 'Room'}
          members={members}
          coverImage={room?.coverImage}
          roomDp={room?.roomDp}
          topInset={insets.top}
          onSettingsPress={() => setShowSettingsModal(true)}
          joinCode={room?.joinCode}
          isOwner={isOwner}
          showJoinCode={room?.showJoinCode}
        />

        {/* ── Layer B: Calendar + Activity Pill ────────────────────────── */}
        <RoomCalendar
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          taskDates={taskDates}
          completedDates={completedDates}
          footer={<RoomPulse tasks={tasks} members={members} />}
        />

        {/* ── Layer D: Task Sections ──────────────────────────────────────── */}
        <View style={styles.taskSections}>
          {/* Tab Bar */}
          <View style={styles.tabBar}>
            {(['active', 'pending', 'spectating'] as const).map((tab) => {
              let label = 'Active Tasks';
              let count = activeTaskList.length;
              if (tab === 'pending') { label = 'Pending'; count = pendingTaskList.length; }
              if (tab === 'spectating') { label = 'Spectating'; count = spectatingTaskList.length; }
              const isActive = activeTab === tab;
              return (
                <TouchableOpacity
                  key={tab}
                  onPress={() => setActiveTab(tab)}
                  style={[styles.tabBtn, isActive && styles.tabBtnActive]}
                >
                  <Text style={[styles.tabLabel, isActive && styles.tabLabelActive, { color: isActive ? (isDark ? '#fff' : '#000') : (isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)') }]}>
                    {label}
                  </Text>
                  {count > 0 && (
                    <View style={[styles.tabBadge, isActive && { backgroundColor: '#6366f1' }]}>
                      <Text style={[styles.tabBadgeText, isActive && { color: '#fff' }]}>{count}</Text>
                    </View>
                  )}
                  {isActive && (
                    <View
                      style={[
                        styles.tabIndicator,
                        {
                          width: tab === 'active' ? 82 : tab === 'spectating' ? 78 : 58,
                          backgroundColor: '#6366f1',
                        },
                      ]}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Active Tab Content */}
          <View style={styles.tabContent}>
            {activeTab === 'active' && (
              <ScrollView
                nestedScrollEnabled
                scrollEnabled={activeTaskList.length > 5}
                showsVerticalScrollIndicator={activeTaskList.length > 5}
                style={activeTaskList.length > 5 ? styles.taskListScroller : undefined}
                contentContainerStyle={styles.taskListContent}
              >
                {activeTaskList.length === 0 ? (
                  <GhostTaskCard isDark={isDark} />
                ) : (
                  activeTaskList.map((task, i) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      index={i}
                      variant="active"
                      accentColor="#6366f1"
                      onPress={() => handleTaskPress(task)}
                      onMenuPress={handleTaskMenuPress}
                      onComplete={handleTaskCheckboxPress}
                    />
                  ))
                )}
              </ScrollView>
            )}

            {activeTab === 'pending' && (
              <ScrollView
                nestedScrollEnabled
                scrollEnabled={pendingTaskList.length > 5}
                showsVerticalScrollIndicator={pendingTaskList.length > 5}
                style={pendingTaskList.length > 5 ? styles.taskListScroller : undefined}
                contentContainerStyle={styles.taskListContent}
              >
                {                pendingTaskList.map((task, i) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    index={i}
                    variant="completed"
                    accentColor="#22c55e"
                    onPress={() => handleTaskPress(task)}
                    onMenuPress={handleTaskMenuPress}
                    onComplete={handleTaskCheckboxPress}
                  />
                ))}
              </ScrollView>
            )}

            {activeTab === 'spectating' && (
              <ScrollView
                nestedScrollEnabled
                scrollEnabled={spectatingTaskList.length > 5}
                showsVerticalScrollIndicator={spectatingTaskList.length > 5}
                style={spectatingTaskList.length > 5 ? styles.taskListScroller : undefined}
                contentContainerStyle={styles.taskListContent}
              >
                {                spectatingTaskList.map((task, i) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    index={i}
                    variant="spectating"
                    accentColor="#64748b"
                    onPress={() => {
                      setBriefTask(task);
                      setShowBriefModal(true);
                    }}
                    onMenuPress={handleTaskMenuPress}
                  />
                ))}
              </ScrollView>
            )}
          </View>
        </View>

        {/* ── Layer F: Room Chat Preview ──────────────────────────────────── */}
        <RoomChatPreview
          roomId={roomId}
          onSeeAll={() => router.push({ pathname: '/(home)/room-chat', params: { roomId, roomName: room?.name || 'Room' } })}
        />
      </Animated.ScrollView>

      {/* ═══════════════════════════════════════════════════════════════════════
          MODALS & SHEETS — ALL PRESERVED WITH EXACT SAME PROPS
          ═══════════════════════════════════════════════════════════════════════ */}

      <TaskOptionsSheet
        visible={showOptionsSheet}
        task={optionsTask}
        currentUserId={userId}
        isRoomOwner={isOwner}
        isParticipant={isOptionsTaskParticipant}
        onClose={() => { setShowOptionsSheet(false); setOptionsTask(null); }}
        onEdit={(t) => { setShowOptionsSheet(false); setSelectedTask(t); setShowTaskModal(true); }}
        onDelete={handleDeleteTask}
        onLeave={handleLeaveTask}
        onJoin={handleTaskJoin}
      />

      <MissionBriefModal
        visible={showBriefModal}
        task={briefTask}
        onClose={() => { setShowBriefModal(false); setBriefTask(null); }}
        onAcceptMission={(task) => { handleTaskJoin(task); setShowBriefModal(false); setBriefTask(null); }}
      />

      <LeaveTaskModal
        visible={showLeaveModal}
        task={leaveTask}
        onClose={() => { setShowLeaveModal(false); setLeaveTask(null); }}
        onConfirmLeave={handleLeaveTaskConfirm}
      />

      <MemberHUDModal
        visible={showMemberHUD}
        onClose={() => setShowMemberHUD(false)}
        members={members}
        tasks={tasks}
        isOwner={isOwner}
        ownerId={room?.ownerId}
        roomId={roomId}
        currentUserId={user?.id}
        onKickMember={handleKickMember}
        onPromoteMember={handlePromoteMember}
      />

      <TaskCreationModal
        visible={showTaskModal}
        onClose={() => { setShowTaskModal(false); setSelectedTask(null); }}
        onSubmit={handleTaskSubmit}
        isEditMode={!!selectedTask}
        taskData={selectedTask}
      />

      <RoomOnboardingModal
        visible={showOnboarding}
        room={room}
        members={members}
        tasks={tasks}
        onComplete={handleOnboardingComplete}
      />

      <RoomSettingsModal
        visible={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        room={room}
        roomId={roomId}
        isOwner={isOwner}
        onSave={(updatedRoom: any) => {
          updateRoom(updatedRoom);
          showToast({ message: 'Room settings updated', type: 'success' });
        }}
        onRoomDeleted={() => {
          setShowSettingsModal(false);
          showToast({ message: 'Room deleted', type: 'success' });
          router.back();
        }}
        onRoomLeft={() => {
          setShowSettingsModal(false);
          showToast({ message: 'Left room', type: 'success' });
          router.back();
        }}
      />

      <TaskCompletionModal visible={showCompletionModal} onClose={() => setShowCompletionModal(false)} task={selectedTask} onComplete={handleTaskComplete} />

      {/* ── Layer E: Scout AI Commander ──────────────────────────────────── */}
      <ScoutInterface 
        visible={showScout} 
        onClose={() => setShowScout(false)} 
        roomId={roomId} 
        userId={userId} 
      />

      {/* Comms FAB removed — Scout is accessed via other entry points */}
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  fixedNav: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  navContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  navIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  navTitleContainer: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  navTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  navSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  navStatusLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 1,
  },
  navStatusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  navStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  navStatusText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  navBorder: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 1,
  },
  root: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  taskSections: {
    paddingHorizontal: 20,
    marginTop: 6,
  },
  tabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(150,150,150,0.2)',
  },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    gap: 6,
    flex: 1,
    justifyContent: 'center',
    position: 'relative',
  },
  tabBtnActive: {
  },
  tabLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  tabLabelActive: {
    fontWeight: '800',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: -1,
    height: 2,
    width: 46,
    borderRadius: 1,
  },
  tabBadge: {
    backgroundColor: 'rgba(150,150,150,0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  tabBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(150,150,150,0.6)',
  },
  tabContent: {
    minHeight: 180,
  },
  taskListScroller: {
    maxHeight: 520,
  },
  taskListContent: {
    paddingBottom: 2,
  },
  emptySection: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  emptySectionText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '500',
  },
  commsFabRemoved: {
    // Comms FAB has been removed
  },
});




export default RoomDetailScreen;
