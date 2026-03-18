/**
 * RoomDetailScreen - Simplified Room View with Glassmorphism
 * 
 * Layout:
 * - Top: DualFlipHeader (calendar/Doom Clock flip)
 * - Middle: TaskFolderList (main content)
 * - Bottom: Quick stats + Tab bar for Members/Leaderboard/Chat
 * 
 * Task Thread: Opens as full screen modal when tapping a folder
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Share,
  Modal,
  Alert,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHaptics } from '../../hooks';
import roomService from '../../services/roomService';
import { Room, RoomMember, RoomTask, LeaderboardEntry, ChatMessage, PendingMember, EnhancedRoomTask, TaskActivity } from '../../types';
import Skeleton, { SkeletonGroup } from '../../components/ui/Skeleton';
import ConfirmationModal from '../../components/ConfirmationModal';
import { DualFlipHeader, TaskFolderList, TaskBottomSheet, TaskThreadModal } from '../../components/room';
import { COLORS, GLASS, RADIUS, SPACING } from '../../styles/glassmorphism';

type DetailTab = 'tasks' | 'members' | 'leaderboard' | 'chat';

export default function RoomDetailScreen() {
  const router = useRouter();
  const { roomId } = useLocalSearchParams<{ roomId: string }>();
  const { colors, gradients, isDark } = useTheme();
  const { user } = useAuth();
  const { showToast } = useToast();
  const haptics = useHaptics();
  const insets = useSafeAreaInsets();

  const t = {
    bg: colors.background.primary,
    surface: colors.surface,
    border: colors.border.primary,
    text: colors.text,
    textSub: colors.textSecondary,
    textHint: colors.textTertiary,
    primary: colors.primary,
    gradient: gradients.background.colors,
    inputBg: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
  };

  // State
  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<DetailTab>('tasks');
  
  // Task modals
  const [selectedTask, setSelectedTask] = useState<EnhancedRoomTask | null>(null);
  const [showTaskSheet, setShowTaskSheet] = useState(false);
  const [showTaskThread, setShowTaskThread] = useState(false);

  // Leaderboard
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);

  // Chat
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [sending, setSending] = useState(false);
  const chatScrollRef = useRef<ScrollView>(null);

  // Pending members
  const [pendingMembers, setPendingMembers] = useState<PendingMember[]>([]);
  const [pendingLoading, setPendingLoading] = useState(false);

  // Modals
  const [showSettings, setShowSettings] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Mock data for TaskFolderList
  const [enhancedTasks, setEnhancedTasks] = useState<EnhancedRoomTask[]>([]);

  const isOwner = room?.ownerId === user?.id || room?.owner?._id === user?.id;

  // Convert room tasks to enhanced format
  useEffect(() => {
    if (room?.tasks) {
      const enhanced: EnhancedRoomTask[] = room.tasks.map((task, index) => ({
        id: task.id || task._id || `task_${index}`,
        roomId: room.id || room._id,
        title: task.title,
        description: task.description,
        status: task.isCompleted ? 'completed' : 'accepted',
        deadline: Date.now() + 7 * 24 * 60 * 60 * 1000,
        points: task.points,
        participants: room.members?.slice(0, 3).map(m => m.userId._id || m.userId.id) || [],
        viewerIds: [],
        heatLevel: Math.floor(Math.random() * 100),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }));
      setEnhancedTasks(enhanced);
    }
  }, [room]);

  // Mock activities for task thread
  const mockActivities: TaskActivity[] = [
    {
      id: '1',
      taskId: selectedTask?.id || '',
      type: 'task_joined',
      userId: user?.id || '',
      userName: user?.username || 'You',
      description: 'Joined this task',
      timestamp: new Date(Date.now() - 3600000),
      pointsEarned: 5,
    },
    {
      id: '2',
      taskId: selectedTask?.id || '',
      type: 'milestone_reached',
      userId: user?.id || '',
      userName: user?.username || 'You',
      description: 'Reached 50% completion',
      timestamp: new Date(Date.now() - 7200000),
    },
  ];

  // Load room
  const loadRoom = useCallback(async (isRefresh = false) => {
    if (!roomId) return;
    try {
      if (!isRefresh) setLoading(true);
      const data = await roomService.getRoom(roomId);
      setRoom(data);
    } catch (err: any) {
      showToast({ message: err?.response?.data?.message || 'Failed to load room', type: 'error' });
      if (!isRefresh) router.back();
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [roomId]);

  useEffect(() => { loadRoom(); }, [roomId]);

  // Load leaderboard
  const loadLeaderboard = useCallback(async () => {
    if (!roomId) return;
    setLeaderboardLoading(true);
    try {
      const data = await roomService.getLeaderboard(roomId);
      setLeaderboard(data);
    } catch {
      showToast({ message: 'Failed to load leaderboard', type: 'error' });
    } finally {
      setLeaderboardLoading(false);
    }
  }, [roomId]);

  // Load chat
  const loadChat = useCallback(async () => {
    if (!roomId) return;
    setChatLoading(true);
    try {
      const data = await roomService.getMessages(roomId, { limit: 50 });
      setMessages(data.messages);
      setTimeout(() => chatScrollRef.current?.scrollToEnd({ animated: false }), 100);
    } catch {
      showToast({ message: 'Failed to load chat', type: 'error' });
    } finally {
      setChatLoading(false);
    }
  }, [roomId]);

  // Load pending
  const loadPending = useCallback(async () => {
    if (!roomId || !isOwner) return;
    setPendingLoading(true);
    try {
      const data = await roomService.getPendingMembers(roomId);
      setPendingMembers(data);
    } catch { } finally {
      setPendingLoading(false);
    }
  }, [roomId, isOwner]);

  // Tab change side effects
  useEffect(() => {
    if (activeTab === 'leaderboard') loadLeaderboard();
    if (activeTab === 'chat') loadChat();
    if (activeTab === 'members' && isOwner) loadPending();
  }, [activeTab]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadRoom(true);
    if (activeTab === 'leaderboard') loadLeaderboard();
    if (activeTab === 'chat') loadChat();
    if (activeTab === 'members' && isOwner) loadPending();
  }, [activeTab, isOwner]);

  // Actions
  const handleSendMessage = useCallback(async () => {
    const msg = chatInput.trim();
    if (!msg || !roomId) return;
    setSending(true);
    try {
      const sent = await roomService.sendMessage(roomId, msg);
      setMessages(prev => [...prev, sent]);
      setChatInput('');
      setTimeout(() => chatScrollRef.current?.scrollToEnd({ animated: true }), 50);
    } catch {
      showToast({ message: 'Failed to send message', type: 'error' });
    } finally {
      setSending(false);
    }
  }, [chatInput, roomId]);

  const handleShareCode = useCallback(async () => {
    if (!room) return;
    haptics.tap();
    try {
      await Share.share({
        message: `Join my room "${room.name}" on Krios! Use code: ${room.joinCode}`,
      });
    } catch { }
  }, [room]);

  const handleCopyCode = useCallback(async () => {
    if (!room) return;
    await Clipboard.setStringAsync(room.joinCode);
    haptics.success();
    showToast({ message: 'Code copied!', type: 'success' });
  }, [room]);

  const handleLeaveRoom = useCallback(async () => {
    if (!roomId) return;
    try {
      await roomService.leaveRoom(roomId);
      haptics.success();
      showToast({ message: 'Left room', type: 'success' });
      router.back();
    } catch (err: any) {
      haptics.error();
      showToast({ message: err?.response?.data?.message || 'Failed to leave', type: 'error' });
    }
  }, [roomId]);

  const handleDeleteRoom = useCallback(async () => {
    if (!roomId) return;
    try {
      await roomService.deleteRoom(roomId);
      haptics.success();
      showToast({ message: 'Room deleted', type: 'success' });
      router.back();
    } catch (err: any) {
      haptics.error();
      showToast({ message: err?.response?.data?.message || 'Failed to delete', type: 'error' });
    }
  }, [roomId]);

  // Task handlers
  const handleTaskPress = (taskId: string) => {
    const task = enhancedTasks.find(t => t.id === taskId);
    if (task) {
      setSelectedTask(task);
      setShowTaskThread(true);
    }
  };

  const handleTaskMenu = (taskId: string) => {
    const task = enhancedTasks.find(t => t.id === taskId);
    if (task) {
      setSelectedTask(task);
      setShowTaskSheet(true);
    }
  };

  // Loading state
  if (loading || !room) {
    return (
      <View style={[styles.container, { backgroundColor: t.bg }]}>
        <LinearGradient colors={t.gradient as any} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={StyleSheet.absoluteFill} />
        <View style={[styles.header, { paddingTop: Math.max(insets.top + 8, 52) }]}>
          <TouchableOpacity onPress={() => router.back()} style={[styles.backButton, { backgroundColor: t.surface, borderColor: t.border }]}>
            <Ionicons name="chevron-back" size={22} color={t.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: t.text }]}>Loading...</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={{ padding: 20, gap: 16 }}>
          <SkeletonGroup gap={12}>
            <Skeleton width="100%" height={80} borderRadius={16} />
            <Skeleton width="100%" height={120} borderRadius={16} />
            <Skeleton width="100%" height={60} borderRadius={16} />
          </SkeletonGroup>
        </View>
      </View>
    );
  }

  const memberCount = room.members?.length || 0;
  const taskCount = room.tasks?.length || 0;

  return (
    <View style={[styles.container, { backgroundColor: t.bg }]}>
      <LinearGradient colors={t.gradient as any} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={StyleSheet.absoluteFill} />

      {/* DualFlipHeader */}
      <DualFlipHeader
        roomName={room.name}
        roomCode={room.joinCode}
        expiresAt={room.endDate ? new Date(room.endDate).getTime() : Date.now() + 30 * 24 * 60 * 60 * 1000}
        isOwner={isOwner}
        memberCount={memberCount}
        taskCount={taskCount}
        onShareCode={handleShareCode}
        onSettings={() => setShowSettings(true)}
        onBack={() => router.back()}
      />

      {/* Quick Stats Bar */}
      <View style={styles.statsBar}>
        <View style={[styles.statPill, { backgroundColor: GLASS.surface }]}>
          <Ionicons name="people" size={14} color={COLORS.primary} />
          <Text style={[styles.statText, { color: t.text }]}>{memberCount}</Text>
          <Text style={[styles.statLabel, { color: t.textSub }]}>Members</Text>
        </View>
        <View style={[styles.statPill, { backgroundColor: GLASS.surface }]}>
          <Ionicons name="checkmark-circle" size={14} color={COLORS.secondary} />
          <Text style={[styles.statText, { color: t.text }]}>{taskCount}</Text>
          <Text style={[styles.statLabel, { color: t.textSub }]}>Tasks</Text>
        </View>
        <View style={[styles.statPill, { backgroundColor: GLASS.surface }]}>
          <Ionicons name="trophy" size={14} color={COLORS.accent} />
          <Text style={[styles.statText, { color: t.text }]}>Top 3</Text>
          <Text style={[styles.statLabel, { color: t.textSub }]}>Rank</Text>
        </View>
      </View>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        {([
          { key: 'tasks', icon: 'folder-outline', label: 'Tasks' },
          { key: 'members', icon: 'people-outline', label: 'Members' },
          { key: 'leaderboard', icon: 'trophy-outline', label: 'Ranks' },
          { key: 'chat', icon: 'chatbubbles-outline', label: 'Chat' },
        ] as { key: DetailTab; icon: string; label: string }[]).map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[
              styles.tab,
              activeTab === tab.key && [styles.tabActive, { borderColor: COLORS.primary }],
            ]}
            onPress={() => { haptics.selection(); setActiveTab(tab.key); }}
            activeOpacity={0.7}
          >
            <Ionicons 
              name={tab.icon as any} 
              size={16} 
              color={activeTab === tab.key ? COLORS.primary : t.textHint} 
            />
            <Text style={[
              styles.tabText, 
              { color: activeTab === tab.key ? COLORS.primary : t.textHint }
            ]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tab Content */}
      {activeTab === 'tasks' && (
        <TaskFolderList
          tasks={enhancedTasks}
          currentUserId={user?.id || ''}
          onTaskPress={handleTaskPress}
          onTaskMenu={handleTaskMenu}
          isFirstEntry={true}
        />
      )}

      {activeTab === 'chat' && (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={100}>
          <View style={{ flex: 1 }}>
            {chatLoading ? (
              <View style={{ padding: 20 }}>
                <SkeletonGroup gap={10}>
                  {[1, 2, 3, 4, 5].map(i => (
                    <Skeleton key={i} width={i % 2 === 0 ? '70%' : '55%'} height={40} borderRadius={12} />
                  ))}
                </SkeletonGroup>
              </View>
            ) : messages.length === 0 ? (
              <View style={styles.emptyTab}>
                <Ionicons name="chatbubbles-outline" size={36} color={t.textHint} />
                <Text style={[styles.emptyTabText, { color: t.textSub }]}>No messages yet</Text>
                <Text style={[styles.emptyTabHint, { color: t.textHint }]}>Start the conversation!</Text>
              </View>
            ) : (
              <ScrollView
                ref={chatScrollRef}
                style={{ flex: 1 }}
                contentContainerStyle={{ padding: 16, gap: 8 }}
                showsVerticalScrollIndicator={false}
                onContentSizeChange={() => chatScrollRef.current?.scrollToEnd({ animated: false })}
              >
                {messages.map((msg, i) => {
                  const isSystem = msg.type === 'system' || msg.messageType === 'system';
                  const isMyMsg = msg.userId?._id === user?.id || msg.userId?.id === user?.id;
                  const content = msg.message || msg.content;

                  if (isSystem) {
                    return (
                      <View key={msg._id || msg.id || i} style={styles.systemMsg}>
                        <Text style={[styles.systemMsgText, { color: t.textHint }]}>{content}</Text>
                      </View>
                    );
                  }

                  return (
                    <View key={msg._id || msg.id || i} style={[styles.chatBubbleRow, isMyMsg && { justifyContent: 'flex-end' }]}>
                      <View style={[
                        styles.chatBubble,
                        isMyMsg
                          ? { backgroundColor: COLORS.primary }
                          : { backgroundColor: GLASS.surface, borderColor: GLASS.border, borderWidth: 1 },
                      ]}>
                        {!isMyMsg && (
                          <Text style={[styles.chatSender, { color: COLORS.primary }]}>
                            {msg.userId?.username || 'User'}
                          </Text>
                        )}
                        <Text style={[styles.chatText, { color: isMyMsg ? '#fff' : t.text }]}>{content}</Text>
                        <Text style={[styles.chatTime, { color: isMyMsg ? 'rgba(255,255,255,0.5)' : t.textHint }]}>
                          {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            )}

            {/* Chat input */}
            <View style={[styles.chatInputBar, { backgroundColor: isDark ? 'rgba(26,26,46,0.95)' : '#fff', borderColor: GLASS.border }]}>
              <TextInput
                style={[styles.chatTextInput, { backgroundColor: t.inputBg, color: t.text, borderColor: GLASS.border }]}
                placeholder="Type a message..."
                placeholderTextColor={t.textHint}
                value={chatInput}
                onChangeText={setChatInput}
                multiline
                maxLength={500}
                returnKeyType="send"
                blurOnSubmit={false}
              />
              <TouchableOpacity
                onPress={handleSendMessage}
                disabled={sending || !chatInput.trim()}
                style={[styles.sendBtn, { opacity: sending || !chatInput.trim() ? 0.4 : 1 }]}
              >
                <LinearGradient colors={[COLORS.primary, COLORS.primaryLight]} style={styles.sendBtnGrad}>
                  {sending ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Ionicons name="send" size={16} color="#fff" />
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      )}

      {activeTab !== 'tasks' && activeTab !== 'chat' && (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        >
          {activeTab === 'members' && (
            <View style={styles.tabContent}>
              {/* Pending requests */}
              {isOwner && pendingMembers.length > 0 && (
                <View style={{ marginBottom: 16 }}>
                  <Text style={[styles.subSectionTitle, { color: COLORS.accent }]}>
                    Pending Requests ({pendingMembers.length})
                  </Text>
                  {pendingMembers.map(pm => (
                    <View key={pm._id} style={[styles.memberRow, { backgroundColor: GLASS.background, borderColor: `${COLORS.accent}40` }]}>
                      <View style={[styles.avatar, { backgroundColor: `${COLORS.accent}20` }]}>
                        <Text style={[styles.avatarText, { color: COLORS.accent }]}>
                          {(pm.userId?.username || '?')[0].toUpperCase()}
                        </Text>
                      </View>
                      <Text style={[styles.memberName, { color: t.text, flex: 1 }]}>{pm.userId?.username || 'User'}</Text>
                      <TouchableOpacity style={[styles.approveBtn, { backgroundColor: `${COLORS.secondary}15` }]}>
                        <Ionicons name="checkmark" size={16} color={COLORS.secondary} />
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.approveBtn, { backgroundColor: `${COLORS.danger}15` }]}>
                        <Ionicons name="close" size={16} color={COLORS.danger} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              <Text style={[styles.subSectionTitle, { color: t.textSub }]}>Members ({memberCount})</Text>
              {room.members.map((member, i) => {
                const memberIsOwner = member.role === 'owner';
                return (
                  <View key={member._id || member.id || i} style={[styles.memberRow, { backgroundColor: GLASS.background, borderColor: GLASS.border }]}>
                    <View style={[styles.avatar, { backgroundColor: memberIsOwner ? `${COLORS.primary}20` : GLASS.surface }]}>
                      <Text style={[styles.avatarText, { color: memberIsOwner ? COLORS.primary : t.textSub }]}>
                        {(member.userId?.username || '?')[0].toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={[styles.memberName, { color: t.text }]}>
                          {member.userId?.username || 'User'}
                        </Text>
                        {memberIsOwner && (
                          <View style={[styles.roleBadge, { backgroundColor: `${COLORS.primary}15` }]}>
                            <Text style={styles.roleBadgeText}>Owner</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.memberPoints, { color: t.textHint }]}>{member.points || 0} pts</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {activeTab === 'leaderboard' && (
            <View style={styles.tabContent}>
              {leaderboardLoading ? (
                <SkeletonGroup gap={10}>
                  {[1, 2, 3, 4].map(i => <Skeleton key={i} width="100%" height={56} borderRadius={12} />)}
                </SkeletonGroup>
              ) : leaderboard.length === 0 ? (
                <View style={styles.emptyTab}>
                  <Ionicons name="trophy-outline" size={36} color={t.textHint} />
                  <Text style={[styles.emptyTabText, { color: t.textSub }]}>No scores yet</Text>
                </View>
              ) : (
                leaderboard.map((entry, i) => {
                  const rank = i + 1;
                  const medal = rank === 1 ? '#FFD700' : rank === 2 ? '#C0C0C0' : rank === 3 ? '#CD7F32' : null;
                  return (
                    <View key={entry._id} style={[styles.leaderRow, { backgroundColor: GLASS.background, borderColor: GLASS.border }]}>
                      <View style={[styles.rankCircle, { backgroundColor: medal ? `${medal}20` : GLASS.surface }]}>
                        {medal ? (
                          <Ionicons name="trophy" size={16} color={medal} />
                        ) : (
                          <Text style={[styles.rankText, { color: t.textSub }]}>{rank}</Text>
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.memberName, { color: t.text }]}>{entry.user?.username || 'User'}</Text>
                      </View>
                      <View style={styles.pointsBadge}>
                        <Ionicons name="star" size={12} color={COLORS.accent} />
                        <Text style={[styles.pointsText, { color: COLORS.accent }]}>{entry.points}</Text>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          )}
        </ScrollView>
      )}

      {/* Task Bottom Sheet */}
      <TaskBottomSheet
        visible={showTaskSheet}
        task={selectedTask}
        currentUserId={user?.id || ''}
        isRoomOwner={isOwner}
        onClose={() => setShowTaskSheet(false)}
        onJoin={() => {}}
        onLeave={() => {}}
        onSubmitProof={() => setShowTaskThread(true)}
        onChallenge={() => {}}
        onEdit={() => {}}
        onBanUser={() => {}}
        onJusticeReview={() => {}}
        onViewProof={() => setShowTaskThread(true)}
      />

      {/* Task Thread Modal */}
      <TaskThreadModal
        visible={showTaskThread}
        task={selectedTask}
        activities={mockActivities}
        proofs={selectedTask?.proof ? [selectedTask.proof] : []}
        currentUserId={user?.id || ''}
        isRoomOwner={isOwner}
        onClose={() => setShowTaskThread(false)}
        onSubmitProof={(url) => {}}
        onChallenge={(proofId) => {}}
        onApproveProof={(proofId) => {}}
      />

      {/* Settings Modal */}
      <Modal visible={showSettings} transparent animationType="fade" onRequestClose={() => setShowSettings(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.settingsModal, { backgroundColor: isDark ? 'rgba(26,26,46,0.98)' : '#fff', borderColor: GLASS.border }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: t.text }]}>Room Settings</Text>
              <TouchableOpacity onPress={() => setShowSettings(false)}>
                <Ionicons name="close" size={24} color={t.textSub} />
              </TouchableOpacity>
            </View>

            <View style={[styles.codeBox, { backgroundColor: GLASS.surface, borderColor: GLASS.border }]}>
              <View>
                <Text style={styles.codeLabel}>JOIN CODE</Text>
                <Text style={styles.codeValue}>{room.joinCode}</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity onPress={handleCopyCode} style={[styles.codeAction, { backgroundColor: `${COLORS.primary}15` }]}>
                  <Ionicons name="copy-outline" size={18} color={COLORS.primary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={handleShareCode} style={[styles.codeAction, { backgroundColor: `${COLORS.primary}15` }]}>
                  <Ionicons name="share-outline" size={18} color={COLORS.primary} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.settingsInfoList}>
              <View style={styles.settingsInfoRow}>
                <Text style={{ color: t.textSub, fontSize: 13 }}>Visibility</Text>
                <Text style={{ color: t.text, fontSize: 13, fontWeight: '600' }}>{room.isPublic ? 'Public' : 'Private'}</Text>
              </View>
              <View style={styles.settingsInfoRow}>
                <Text style={{ color: t.textSub, fontSize: 13 }}>Approval Required</Text>
                <Text style={{ color: t.text, fontSize: 13, fontWeight: '600' }}>{room.requireApproval ? 'Yes' : 'No'}</Text>
              </View>
              <View style={styles.settingsInfoRow}>
                <Text style={{ color: t.textSub, fontSize: 13 }}>Max Members</Text>
                <Text style={{ color: t.text, fontSize: 13, fontWeight: '600' }}>{room.maxMembers}</Text>
              </View>
            </View>

            <View style={{ gap: 10, marginTop: 8 }}>
              {isOwner ? (
                <TouchableOpacity onPress={() => { setShowSettings(false); setShowDeleteConfirm(true); }} style={[styles.dangerBtn, { borderColor: COLORS.danger }]}>
                  <Ionicons name="trash-outline" size={16} color={COLORS.danger} />
                  <Text style={{ fontSize: 14, fontWeight: '600', color: COLORS.danger }}>Delete Room</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={() => { setShowSettings(false); setShowLeaveConfirm(true); }} style={[styles.dangerBtn, { borderColor: COLORS.danger }]}>
                  <Ionicons name="exit-outline" size={16} color={COLORS.danger} />
                  <Text style={{ fontSize: 14, fontWeight: '600', color: COLORS.danger }}>Leave Room</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>

      <ConfirmationModal
        visible={showLeaveConfirm}
        title="Leave Room?"
        message="You will lose your progress and points in this room."
        confirmText="Leave"
        cancelText="Cancel"
        isDark={isDark}
        destructive
        onConfirm={() => { setShowLeaveConfirm(false); handleLeaveRoom(); }}
        onCancel={() => setShowLeaveConfirm(false)}
      />

      <ConfirmationModal
        visible={showDeleteConfirm}
        title="Delete Room?"
        message="This will permanently delete the room and all data. This cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        isDark={isDark}
        destructive
        onConfirm={() => { setShowDeleteConfirm(false); handleDeleteRoom(); }}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 12,
  },
  backButton: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1,
  },
  headerTitle: { fontSize: 17, fontWeight: '700', letterSpacing: -0.3 },
  placeholder: { width: 36 },
  statsBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.sm,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    gap: SPACING.xs,
  },
  statText: { fontSize: 14, fontWeight: '700' },
  statLabel: { fontSize: 11 },
  tabBar: {
    flexDirection: 'row', marginHorizontal: SPACING.lg, marginBottom: SPACING.md, gap: 2,
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, paddingVertical: 10, borderBottomWidth: 2, borderColor: 'transparent',
  },
  tabActive: { borderBottomWidth: 2 },
  tabText: { fontSize: 12, fontWeight: '600', letterSpacing: -0.2 },
  tabContent: { gap: SPACING.sm },
  emptyTab: { alignItems: 'center', paddingTop: 48, gap: 8 },
  emptyTabText: { fontSize: 16, fontWeight: '600' },
  emptyTabHint: { fontSize: 13, textAlign: 'center' },
  subSectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 8, paddingLeft: 4 },
  memberRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    borderRadius: RADIUS.lg, borderWidth: 1, padding: SPACING.md, marginBottom: SPACING.sm,
  },
  avatar: {
    width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 15, fontWeight: '700' },
  memberName: { fontSize: 14, fontWeight: '600' },
  memberPoints: { fontSize: 11, marginTop: 1 },
  roleBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  roleBadgeText: { fontSize: 9, fontWeight: '700', color: COLORS.primary },
  approveBtn: {
    width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
  },
  leaderRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    borderRadius: RADIUS.lg, borderWidth: 1, padding: SPACING.md, marginBottom: SPACING.sm,
  },
  rankCircle: {
    width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
  },
  rankText: { fontSize: 14, fontWeight: '700' },
  pointsBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pointsText: { fontSize: 14, fontWeight: '700' },
  systemMsg: { alignItems: 'center', paddingVertical: 6 },
  systemMsgText: { fontSize: 11, fontStyle: 'italic' },
  chatBubbleRow: { flexDirection: 'row' },
  chatBubble: {
    maxWidth: '78%', borderRadius: RADIUS.lg, padding: SPACING.md, paddingBottom: 6,
  },
  chatSender: { fontSize: 11, fontWeight: '700', marginBottom: 2 },
  chatText: { fontSize: 14, lineHeight: 20 },
  chatTime: { fontSize: 10, marginTop: 4, textAlign: 'right' },
  chatInputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    borderTopWidth: 1,
  },
  chatTextInput: {
    flex: 1, borderRadius: 20, borderWidth: 1,
    paddingHorizontal: 16, paddingVertical: 10,
    fontSize: 14, maxHeight: 100,
  },
  sendBtn: { marginBottom: 2 },
  sendBtnGrad: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  settingsModal: {
    width: '100%', borderRadius: RADIUS.xl, borderWidth: 1, padding: SPACING.xl, gap: SPACING.lg,
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', letterSpacing: -0.3 },
  codeBox: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: RADIUS.lg, borderWidth: 1, padding: SPACING.md,
  },
  codeLabel: { fontSize: 11, fontWeight: '600', color: '#fff', letterSpacing: 0.5 },
  codeValue: { fontSize: 22, fontWeight: '800', color: COLORS.primary, letterSpacing: 2, marginTop: 4 },
  codeAction: {
    width: 36, height: 36, borderRadius: RADIUS.md,
    alignItems: 'center', justifyContent: 'center',
  },
  settingsInfoList: { gap: 12 },
  settingsInfoRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  dangerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: SPACING.md, borderRadius: RADIUS.lg, borderWidth: 1,
  },
});
