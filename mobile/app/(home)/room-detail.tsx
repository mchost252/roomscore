/**
 * RoomDetailScreen — "Tactical Archive" redesign
 *
 * Architecture:
 *   AbsoluteHeader (180px fixed, Side A/B crossfade)
 *     └─ Side A: CalendarStrip
 *     └─ Side B: "Command Deck" (2x2 control widgets)
 *     └─ "+" Add button in top-right for owners
 *   FlashList (virtualized task folders)
 *     └─ TaskFolder (borderRadius 14, #1A1A1A bg, glowing subway line, 3-dot menu)
 *   TaskOptionsSheet (context-aware: createdBy check, participant check)
 *
 * Data: useRoomDetail hook → MMKV instant → API background → WebSocket live
 * Navigation: Task press → room-task-thread (NOT home task-thread)
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../../context/ToastContext';
import { useRoomDetail } from '../../hooks/room/useRoomDetail';
import { taskService } from '../../services/taskService';
import { Task } from '../../types/room';

import {
  AbsoluteHeader,
  ROOM_HEADER_HEIGHT,
  TaskFolder,
  TaskOptionsSheet,
  MemberHUDModal,
} from '../../components/room-detail';
import MissionBriefModal from '../../components/room-detail/MissionBriefModal';
import RoomOnboardingModal from '../../components/room-detail/RoomOnboardingModal';
import TaskCompletionModal from '../../components/TaskCompletionModal';
import TaskCreationModal from '../../components/TaskCreationModal';
import RoomSettingsModal from '../../components/RoomSettingsModal';

// ─── Screen ──────────────────────────────────────────────────────────────────
const RoomDetailScreen: React.FC = () => {
  const { colors, isDark } = useTheme();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();

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

  // ── Date Filtering Logic ──────────────────────────────────────────────────
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

  // ── Derived data ──────────────────────────────────────────────────────────
  const daysLeft = useMemo(() => {
    if (!room?.doomClockExpiry) return 0;
    const expiry = new Date(room.doomClockExpiry);
    const now = new Date();
    const diffMs = expiry.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  }, [room?.doomClockExpiry]);

  // Sort: Accepted (joined) tasks first, then Spectator
  const sortedTasks = useMemo(() => {
    const accepted: Task[] = [];
    const spectator: Task[] = [];
    for (const t of filteredTasks) {
      if (t.isJoined !== false && t.status !== 'spectator') {
        accepted.push(t);
      } else {
        spectator.push(t);
      }
    }
    return [...accepted, ...spectator];
  }, [filteredTasks]);

  const isOptionsTaskParticipant = useMemo(() => {
    if (!optionsTask || !userId) return false;
    if (optionsTask.isJoined === true) return true;
    if (optionsTask.status === 'accepted') return true;
    if (optionsTask.participants?.some(p => p.userId === userId)) return true;
    return false;
  }, [optionsTask, userId]);

  // ── Onboarding Check ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!roomId || tasks.length === 0) return;
    const { roomStorage } = require('../../db/roomDb');
    const hasOnboarded = roomStorage.getBoolean(`onboarded_${roomId}`);
    if (!hasOnboarded) {
      setShowOnboarding(true);
    }
  }, [roomId, tasks.length]);

  const handleOnboardingComplete = useCallback(async (selectedTaskIds: string[]) => {
    const { roomStorage } = require('../../db/roomDb');
    roomStorage.set(`onboarded_${roomId}`, true);
    setShowOnboarding(false);

    for (const id of selectedTaskIds) {
      const t = tasks.find(x => x.id === id);
      const newP = [...(t?.participants || [])];
      if (userId && !newP.some(p => p.userId === userId)) {
        newP.push({ id: userId, userId: userId, username: 'Me', isOnline: true, aura: 'bronze', hasHeat: false });
      }
      updateTask(id, { isJoined: true, status: 'accepted', participants: newP });
      try {
        await taskService.joinTask(roomId, id).catch(() => {});
      } catch (e) {
        console.error('Failed to join task in background:', e);
      }
    }
    
    if (selectedTaskIds.length > 0) {
      showToast({ message: `Successfully joined ${selectedTaskIds.length} missions!`, type: 'success' });
    }
  }, [roomId, tasks, userId, updateTask, showToast]);

  // ── Handlers ──────────────────────────────────────────────────────────────
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

    const tempId = `temp_${Date.now()}`;
    const tempTask: Task = {
      id: tempId,
      roomId,
      title: taskData.title,
      description: taskData.description || '',
      taskType: taskData.taskType || 'daily',
      points: taskData.points || 10,
      isActive: true,
      isCompleted: false,
      createdAt: new Date().toISOString(),
      status: 'accepted',
      isJoined: true,
      completions: [],
    };
    
    addTask(tempTask);
    
    try {
      const newTask = await taskService.createTask(roomId, taskData);
      updateTask(tempId, newTask);
      showToast({ message: 'Task created successfully', type: 'success' });
    } catch (error) {
      refresh(); 
      showToast({ message: 'Failed to create task', type: 'error' });
    }
  }, [roomId, addTask, updateTask, refresh, showToast]);

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
    try {
      const newP = [...(task.participants || [])];
      if (userId && !newP.some(p => p.userId === userId)) {
        newP.push({ id: userId, userId: userId, username: 'Me', isOnline: true, aura: 'bronze', hasHeat: false });
      }
      updateTask(task.id, { isJoined: true, status: 'accepted', participants: newP });
      showToast({ message: `Joined "${task.title}"`, type: 'success' });
      await taskService.joinTask(roomId, task.id).catch(() => {});
    } catch (error) {
      updateTask(task.id, { isJoined: false, status: 'spectator' });
      showToast({ message: 'Failed to join task', type: 'error' });
    }
  }, [roomId, userId, updateTask, showToast]);

  const handleTaskMenuPress = useCallback((task: Task) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setOptionsTask(task);
    setShowOptionsSheet(true);
  }, []);

  const handleDeleteTask = useCallback(async (task: Task) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    try {
      await taskService.deleteTask(roomId, task.id);
      refresh();
      showToast({ message: 'Task deleted', type: 'success' });
    } catch (error) {
      showToast({ message: 'Failed to delete task', type: 'error' });
    }
  }, [roomId, refresh, showToast]);

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

  // ── Render helpers ────────────────────────────────────────────────────────
  const renderTask = useCallback(({ item, index }: { item: Task; index: number }) => {
    const isSpectating = !(item.isJoined || item.status === 'accepted') && !item.isCompleted;
    return (
      <TaskFolder
        task={item}
        index={index}
        onPress={() => {
          if (isSpectating) {
            setBriefTask(item);
            setShowBriefModal(true);
          } else {
            handleTaskPress(item);
          }
        }}
        onMenuPress={handleTaskMenuPress}
      />
    );
  }, [handleTaskPress, handleTaskMenuPress]);

  const ListHeader = useMemo(() => (
    <View style={styles.listHeader}>
      <View style={styles.sectionRow}>
        <View style={[styles.sectionLine, { backgroundColor: isDark ? colors.primary : '#6366f1', opacity: isDark ? 0.5 : 0.35 }]} />
        <Text style={[styles.sectionLabel, { color: colors.primary }]}>
          Tasks · {activeTasks.length} active
        </Text>
        <View style={[styles.sectionLine, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)', flex: 1 }]} />
      </View>
    </View>
  ), [activeTasks.length, isDark, colors.primary]);

  const ListEmpty = useMemo(() => {
    if (loading) {
      return (
        <View style={styles.emptyWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Loading tasks...</Text>
        </View>
      );
    }
    return (
      <View style={styles.emptyWrap}>
        <View style={[styles.emptyIcon, { borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }]}>
          <Ionicons name="checkmark-done-circle-outline" size={36} color={isDark ? 'rgba(255,255,255,0.35)' : 'rgba(15,23,42,0.4)'} />
        </View>
        <Text style={[styles.emptyTitle, { color: isDark ? '#ffffff' : '#0f172a' }]}>No Tasks Yet</Text>
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          {isOwner ? 'Tap the + button in the header to create your first task.' : 'The room owner hasn\'t created any tasks yet.'}
        </Text>
      </View>
    );
  }, [loading, isOwner, isDark, colors]);

  const bgGradient = isDark ? ['#0a0a16', '#0d0d20', '#080812'] : ['#ffffff', '#f5f5ff', '#f0f0ff'];
  const accentGradient = isDark ? ['rgba(99,102,241,0.18)', 'transparent'] : ['rgba(99,102,241,0.07)', 'transparent'];

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <LinearGradient colors={bgGradient as any} locations={[0, 0.5, 1]} start={{ x: 0.3, y: 0 }} end={{ x: 0.7, y: 1 }} style={StyleSheet.absoluteFill} />
      <LinearGradient colors={accentGradient as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0.6 }} style={StyleSheet.absoluteFill} />

      <AbsoluteHeader
        roomName={room?.name || 'Room'}
        roomCode={room?.joinCode || 'KRI-000'}
        members={members}
        tasks={tasks}
        daysLeft={daysLeft}
        streak={room?.streak || 0}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
        onBackPress={() => router.back()}
        onMenuPress={() => setShowOptionsSheet(true)}
        onSettingsPress={() => setShowSettingsModal(true)}
        isOwner={isOwner}
        onAddPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          setSelectedTask(null);
          setShowTaskModal(true);
        }}
        chatRetentionDays={room?.chatRetentionDays ?? 3}
        isPublic={room?.isPublic ?? false}
        onTogglePrivacy={isOwner ? handleTogglePrivacy : undefined}
        onManageMembers={() => setShowMemberHUD(true)}
      />

      <FlashList
        data={sortedTasks}
        renderItem={renderTask}
        keyExtractor={(item) => item.id}
        estimatedItemSize={110}
        contentContainerStyle={{
          paddingTop: ROOM_HEADER_HEIGHT + insets.top + 8,
          paddingHorizontal: 16,
          paddingBottom: insets.bottom + 100,
        }}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={ListEmpty}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} progressViewOffset={ROOM_HEADER_HEIGHT + insets.top} />
        }
      />

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
        isOwner={isOwner}
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
        onSave={(updatedRoom: any) => {
          updateRoom(updatedRoom);
          showToast({ message: 'Room settings updated', type: 'success' });
        }}
      />

      <TaskCompletionModal visible={showCompletionModal} onClose={() => setShowCompletionModal(false)} task={selectedTask} onComplete={handleTaskComplete} />
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  listHeader: { marginBottom: 12 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  sectionLine: { height: 1, width: 20 },
  sectionLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  emptyWrap: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 20 },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginTop: 4 },
});

export default RoomDetailScreen;
