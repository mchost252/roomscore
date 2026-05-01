/**
 * RoomDetailScreen — "Layered Workspace" redesign
 *
 * Architecture:
 *   RoomHeader (swipeable: identity front / metadata back)
 *   RoomCalendar (3-level: collapsed strip → expanded week → full month)
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
import { Task } from '../../types/room';
import { roomStorage } from '../../db/roomDb';

import { useAuth } from '../../context/AuthContext';

// ── New UI components ───────────────────────────────────────────────────────
import RoomHeader from '../../components/room-detail/RoomHeader';
import RoomCalendar from '../../components/room-detail/RoomCalendar';
import RoomPulse from '../../components/room-detail/RoomPulse';
import TaskCard from '../../components/room-detail/TaskCard';
import TaskSection from '../../components/room-detail/TaskSection';
import { TacticalBackground, GhostTaskCard } from '../../components/room-detail/VisualEffects';
import { TacticalOverview } from '../../components/room-detail/TacticalOverview';
import { ScoutInterface } from '../../components/ai/ScoutInterface';

// ── Shared modals / sheets (unchanged) ──────────────────────────────────────
import TaskOptionsSheet from '../../components/room-detail/TaskOptionsSheet';
import MemberHUDModal from '../../components/room-detail/MemberHUDModal';
import MissionBriefModal from '../../components/room-detail/MissionBriefModal';
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
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showMemberHUD, setShowMemberHUD] = useState(false);
  const [showScout, setShowScout] = useState(false);

  // ── Section Expansion State ──────────────────────────────────────────────
  const [openSections, setOpenSections] = useState({
    active: true,
    pending: true,
    spectating: false,
  });

  const allSectionsClosed = useMemo(() => 
    !openSections.active && !openSections.pending && !openSections.spectating,
  [openSections]);

  const roomStats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter(t => t.isCompleted).length;
    const sync = total > 0 ? (completed / total) * 100 : 0;
    const points = tasks.reduce((acc, t) => acc + (t.points || 0), 0);
    const online = members.filter(m => m.isOnline).length;
    return { sync, total, points, squadOnline: online };
  }, [tasks, members]);

  // ── Date Filtering Logic (PRESERVED) ──────────────────────────────────────
  const filteredTasks = useMemo(() => {
    if (!selectedDate) return tasks;
    
    // Check if tasks match the selected day (or are daily)
    return tasks.filter(t => {
      if (!t.createdAt) return true;
      const created = new Date(t.createdAt);
      // Simplify: show tasks created on or before the selected date
      return created.getTime() <= selectedDate.getTime() + (24 * 60 * 60 * 1000);
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

  // ── Days active (for header metadata) ─────────────────────────────────────
  const daysActive = useMemo(() => {
    if (!room?.createdAt) return 0;
    const created = new Date(room.createdAt);
    const now = new Date();
    return Math.max(1, Math.ceil((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)));
  }, [room?.createdAt]);

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
      showToast({ message: `Successfully joined ${selectedTaskIds.length} missions!`, type: 'success' });
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
  }) => {
    setShowTaskModal(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (taskData.id) {
      const patchData = { ...taskData, daysOfWeek: taskData.daysOfWeek?.join(',') };
      updateTask(taskData.id, patchData as any); 
      try {
        const updatedTask = await taskService.updateTask(roomId, taskData.id, patchData as any);
        updateTask(taskData.id, updatedTask);
        showToast({ message: 'Task updated successfully', type: 'success' });
      } catch (error) {
        refresh();
        showToast({ message: 'Failed to update task', type: 'error' });
      }
      return;
    }

    try {
      await taskService.createTask(roomId, taskData);
      showToast({ message: 'Task created successfully', type: 'success' });
    } catch (error) {
      refresh(); 
      showToast({ message: 'Failed to create task', type: 'error' });
    }
  }, [roomId, updateTask, refresh, showToast]);

  const handleTaskPress = useCallback((task: Task) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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

  const handleLeaveTask = useCallback(async (task: Task) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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

  const handleKickMember = useCallback((id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    showToast({ message: 'Operative removed from squad', type: 'info' });
  }, [showToast]);

  const handlePromoteMember = useCallback((id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    showToast({ message: 'Operative promoted', type: 'success' });
  }, [showToast]);

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

      <TacticalBackground isDark={isDark} />

      {/* ── Fixed Navigation Bar ────────────────────────────────────────── */}
      <View style={[styles.fixedNav, { paddingTop: insets.top, height: 50 + insets.top }]}>
        <Animated.View style={[StyleSheet.absoluteFill, navBgStyle]}>
          <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? '#080810' : '#ffffff', opacity: 0.95 }]} />
          <BlurView 
            intensity={100} 
            tint={isDark ? 'dark' : 'light'} 
            style={StyleSheet.absoluteFill} 
          />
          {/* Subtle bottom border for the sticky state */}
          <View style={[styles.navBorder, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }]} />
        </Animated.View>
        
        <View style={styles.navContent}>





          <TouchableOpacity onPress={() => router.back()} style={styles.navIconBtn}>
            <Ionicons name="chevron-back" size={24} color={isDark ? '#fff' : '#000'} />
          </TouchableOpacity>
          
          <Animated.View style={[styles.navTitleContainer, stickyNavStyle]}>
            <Text style={[styles.navTitle, { color: isDark ? '#fff' : '#000' }]} numberOfLines={1}>
              {room?.name || 'Room'}
            </Text>
          </Animated.View>

          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity onPress={() => setShowMemberHUD(true)} style={styles.navIconBtn}>
              <Ionicons name="people-outline" size={21} color={isDark ? '#fff' : '#000'} />
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
                <Ionicons name="add" size={26} color={isDark ? '#fff' : '#000'} />
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => setShowSettingsModal(true)} style={styles.navIconBtn}>
              <Ionicons name="ellipsis-horizontal" size={22} color={isDark ? '#fff' : '#000'} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100, paddingTop: insets.top + 60 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* ── Layer A: Header (Swipeable) ──────────────────────────────────── */}
        <RoomHeader
          roomName={room?.name || 'Room'}
          roomCode={room?.joinCode || 'KRI-000'}
          members={members}
          tasks={tasks}
          daysActive={daysActive}
          chatRetentionDays={room?.chatRetentionDays ?? 3}
          scrollOffset={scrollY}
          onMembersPress={() => setShowMemberHUD(true)}
        />

        {/* ── Layer B: Calendar (3-Level Expandable) ──────────────────────── */}
        <RoomCalendar
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          taskDates={taskDates}
          completedDates={completedDates}
        />

        {/* ── Layer C: Room Pulse (Live Activity) ─────────────────────────── */}
        <RoomPulse tasks={tasks} members={members} />

        {/* ── Layer D: Task Sections ──────────────────────────────────────── */}
        <View style={styles.taskSections}>
          {/* Active Tasks — open by default */}
          <TaskSection
            title="Active Tasks"
            count={activeTaskList.length}
            accentColor="#6366f1"
            defaultOpen={openSections.active}
            onToggle={(isOpen) => setOpenSections(prev => ({ ...prev, active: isOpen }))}
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
                />
              ))
            )}
          </TaskSection>

          {/* Pending Tasks (user completed, others haven't) — open by default */}
          <TaskSection
            title="Pending"
            count={pendingTaskList.length}
            accentColor="#22c55e"
            defaultOpen={openSections.pending}
            onToggle={(isOpen) => setOpenSections(prev => ({ ...prev, pending: isOpen }))}
          >
            {pendingTaskList.map((task, i) => (
              <TaskCard
                key={task.id}
                task={task}
                index={i}
                variant="completed"
                accentColor="#22c55e"
                onPress={() => handleTaskPress(task)}
                onMenuPress={handleTaskMenuPress}
              />
            ))}
          </TaskSection>

          {/* Spectating Tasks (user not joined) — collapsed */}
          <TaskSection
            title="Spectating"
            count={spectatingTaskList.length}
            accentColor="#64748b"
            defaultOpen={openSections.spectating}
            onToggle={(isOpen) => setOpenSections(prev => ({ ...prev, spectating: isOpen }))}
          >
            {spectatingTaskList.map((task, i) => (
              <TaskCard
                key={task.id}
                task={task}
                index={i}
                variant="spectating"
                accentColor="#64748b"
                onPress={() => {
                  // PRESERVED: Spectating tasks open brief modal, not navigate
                  setBriefTask(task);
                  setShowBriefModal(true);
                }}
                onMenuPress={handleTaskMenuPress}
              />
            ))}
          </TaskSection>

          <TacticalOverview visible={allSectionsClosed} stats={roomStats} />
        </View>
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

      <MemberHUDModal
        visible={showMemberHUD}
        onClose={() => setShowMemberHUD(false)}
        members={members}
        tasks={tasks}
        isOwner={isOwner}
        ownerId={room?.ownerId}
        roomId={roomId}
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

      <RoomOnboardingModal visible={showOnboarding} tasks={tasks} onComplete={handleOnboardingComplete} />

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

      {/* ── Floating Comms Button ───────────────────────────────────────── */}
      <TouchableOpacity 
        style={[styles.commsFab, { backgroundColor: colors.primary, bottom: insets.bottom + 20 }]} 
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          setShowScout(true);
        }}
      >
        <Ionicons name="radio-outline" size={28} color="#fff" />
        <View style={styles.commsPulse} />
      </TouchableOpacity>
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
    alignItems: 'center',
    justifyContent: 'center',
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
    paddingHorizontal: 16,
    marginTop: 6,
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
  commsFab: {
    position: 'absolute',
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    zIndex: 2000,
  },
  commsPulse: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 30,
    borderWidth: 2,
    borderColor: '#fff',
    opacity: 0.2,
  },
});




export default RoomDetailScreen;
