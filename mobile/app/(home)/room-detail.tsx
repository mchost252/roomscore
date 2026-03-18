import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  RefreshControl, Share, Alert, ActivityIndicator, TextInput,
  KeyboardAvoidingView, Platform, Modal,
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
import { Room, RoomMember, RoomTask, LeaderboardEntry, ChatMessage, PendingMember, EnhancedRoomTask } from '../../types';
import Skeleton, { SkeletonGroup } from '../../components/ui/Skeleton';
import ConfirmationModal from '../../components/ConfirmationModal';
// Import new Room UI components
import { DoomClock, DualFlipHeader, TaskFolderList, TaskBottomSheet, SubwayTimeline } from '../../components/room';

type DetailTab = 'tasks' | 'members' | 'leaderboard' | 'chat';

export default function RoomDetailScreen() {
  const router = useRouter();
  const { roomId } = useLocalSearchParams<{ roomId: string }>();
  const { colors, gradients, isDark } = useTheme();
  const { user } = useAuth();
  const { showToast } = useToast();
  const haptics = useHaptics();
  const insets = useSafeAreaInsets();

  // ── No entrance animation - instant render ──

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

  // ── State ──
  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<DetailTab>('tasks');
  
  // Task bottom sheet state
  const [selectedTask, setSelectedTask] = useState<EnhancedRoomTask | null>(null);
  const [showTaskSheet, setShowTaskSheet] = useState(false);

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

  const isOwner = room?.ownerId === user?.id || room?.owner?._id === user?.id;

  // ── Load room ──
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

  // ── Load leaderboard ──
  const loadLeaderboard = useCallback(async () => {
    if (!roomId) return;
    setLeaderboardLoading(true);
    try {
      const data = await roomService.getLeaderboard(roomId);
      setLeaderboard(data);
    } catch (err: any) {
      showToast({ message: 'Failed to load leaderboard', type: 'error' });
    } finally {
      setLeaderboardLoading(false);
    }
  }, [roomId]);

  // ── Load chat ──
  const loadChat = useCallback(async () => {
    if (!roomId) return;
    setChatLoading(true);
    try {
      const data = await roomService.getMessages(roomId, { limit: 50 });
      setMessages(data.messages);
      setTimeout(() => chatScrollRef.current?.scrollToEnd({ animated: false }), 100);
    } catch (err: any) {
      showToast({ message: 'Failed to load chat', type: 'error' });
    } finally {
      setChatLoading(false);
    }
  }, [roomId]);

  // ── Load pending ──
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

  // ── Tab change side effects ──
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

  // ── Actions ──
  const handleSendMessage = useCallback(async () => {
    const msg = chatInput.trim();
    if (!msg || !roomId) return;
    setSending(true);
    try {
      const sent = await roomService.sendMessage(roomId, msg);
      setMessages(prev => [...prev, sent]);
      setChatInput('');
      setTimeout(() => chatScrollRef.current?.scrollToEnd({ animated: true }), 50);
    } catch (err: any) {
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

  const handleRemoveMember = useCallback(async (memberId: string, username: string) => {
    if (!roomId) return;
    Alert.alert('Remove Member', `Remove ${username} from this room?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          try {
            await roomService.removeMember(roomId, memberId);
            haptics.success();
            showToast({ message: `${username} removed`, type: 'success' });
            loadRoom(true);
          } catch (err: any) {
            showToast({ message: 'Failed to remove member', type: 'error' });
          }
        },
      },
    ]);
  }, [roomId]);

  const handleApproveMember = useCallback(async (userId: string) => {
    if (!roomId) return;
    try {
      await roomService.approveMember(roomId, userId);
      haptics.success();
      showToast({ message: 'Member approved!', type: 'success' });
      loadPending();
      loadRoom(true);
    } catch {
      showToast({ message: 'Failed to approve', type: 'error' });
    }
  }, [roomId]);

  const handleRejectMember = useCallback(async (userId: string) => {
    if (!roomId) return;
    try {
      await roomService.rejectMember(roomId, userId);
      haptics.tap();
      showToast({ message: 'Request declined', type: 'info' });
      loadPending();
    } catch {
      showToast({ message: 'Failed to reject', type: 'error' });
    }
  }, [roomId]);

  // ── Loading state ──
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
  const completedCount = room.tasks?.filter(t => t.isCompleted).length || 0;

  // ── Tab content renderers ──

  const renderTasks = () => (
    <View style={styles.tabContent}>
      {taskCount === 0 ? (
        <View style={styles.emptyTab}>
          <Ionicons name="clipboard-outline" size={36} color={t.textHint} />
          <Text style={[styles.emptyTabText, { color: t.textSub }]}>No tasks yet</Text>
          <Text style={[styles.emptyTabHint, { color: t.textHint }]}>
            {isOwner ? 'Add tasks when editing the room.' : 'The room owner will add tasks.'}
          </Text>
        </View>
      ) : (
        room.tasks.map((task, i) => (
          <TouchableOpacity 
            key={task.id || task._id || i} 
            style={[styles.taskRow, { backgroundColor: t.surface, borderColor: t.border }]}
            onPress={() => {
              // Toggle task completion - would need backend integration
              haptics.tap();
            }}
            activeOpacity={0.7}
          >
            <View style={[styles.taskCheck, {
              backgroundColor: task.isCompleted ? '#10B981' : 'transparent',
              borderColor: task.isCompleted ? '#10B981' : t.border,
            }]}>
              {task.isCompleted && <Ionicons name="checkmark" size={14} color="#fff" />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.taskTitle, { color: t.text, textDecorationLine: task.isCompleted ? 'line-through' : 'none' }]}>
                {task.title}
              </Text>
              <View style={styles.taskMetaRow}>
                <Text style={[styles.taskMeta, { color: t.textHint }]}>
                  {task.taskType} · {task.points}pts
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        ))
      )}

      {/* Today's progress */}
      {taskCount > 0 && (
        <View style={[styles.progressCard, { backgroundColor: t.surface, borderColor: t.border }]}>
          <Text style={[styles.progressLabel, { color: t.textSub }]}>Today's Progress</Text>
          <View style={styles.progressRow}>
            <View style={[styles.progressBarBg, { backgroundColor: t.inputBg }]}>
              <LinearGradient
                colors={completedCount === taskCount ? ['#10B981', '#059669'] : ['#6366f1', '#8b5cf6']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.progressBarFill, { width: `${taskCount > 0 ? Math.max((completedCount / taskCount) * 100, 2) : 0}%` }]}
              />
            </View>
            <Text style={[styles.progressText, { color: completedCount === taskCount && taskCount > 0 ? '#10B981' : t.textSub }]}>
              {completedCount}/{taskCount}
            </Text>
          </View>
        </View>
      )}
    </View>
  );

  const renderMembers = () => (
    <View style={styles.tabContent}>
      {/* Pending requests (owner only) */}
      {isOwner && pendingMembers.length > 0 && (
        <View style={{ marginBottom: 16 }}>
          <Text style={[styles.subSectionTitle, { color: '#F59E0B' }]}>
            Pending Requests ({pendingMembers.length})
          </Text>
          {pendingMembers.map(pm => (
            <View key={pm._id} style={[styles.memberRow, { backgroundColor: t.surface, borderColor: '#F59E0B40' }]}>
              <View style={[styles.avatar, { backgroundColor: '#F59E0B20' }]}>
                <Text style={[styles.avatarText, { color: '#F59E0B' }]}>
                  {(pm.userId?.username || '?')[0].toUpperCase()}
                </Text>
              </View>
              <Text style={[styles.memberName, { color: t.text, flex: 1 }]}>{pm.userId?.username || 'User'}</Text>
              <TouchableOpacity
                onPress={() => handleApproveMember(pm.userId._id || pm.userId.id)}
                style={[styles.approveBtn, { backgroundColor: '#10B98120' }]}
              >
                <Ionicons name="checkmark" size={16} color="#10B981" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleRejectMember(pm.userId._id || pm.userId.id)}
                style={[styles.approveBtn, { backgroundColor: '#EF444420' }]}
              >
                <Ionicons name="close" size={16} color="#EF4444" />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* Active members */}
      <Text style={[styles.subSectionTitle, { color: t.textSub }]}>
        Members ({memberCount})
      </Text>
      {room.members.map((member, i) => {
        const memberUser = member.userId;
        const memberId = memberUser._id || memberUser.id;
        const isMe = memberId === user?.id;
        const memberIsOwner = member.role === 'owner';

        return (
          <View key={member._id || member.id || i} style={[styles.memberRow, { backgroundColor: t.surface, borderColor: t.border }]}>
            <View style={[styles.avatar, { backgroundColor: memberIsOwner ? '#6366f120' : t.inputBg }]}>
              <Text style={[styles.avatarText, { color: memberIsOwner ? '#6366f1' : t.textSub }]}>
                {(memberUser?.username || '?')[0].toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[styles.memberName, { color: t.text }]}>
                  {memberUser?.username || 'User'}{isMe ? ' (you)' : ''}
                </Text>
                {memberIsOwner && (
                  <View style={[styles.roleBadge, { backgroundColor: isDark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.1)' }]}>
                    <Text style={styles.roleBadgeText}>Owner</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.memberPoints, { color: t.textHint }]}>
                {member.points || 0} pts
              </Text>
            </View>
            {isOwner && !isMe && !memberIsOwner && (
              <TouchableOpacity
                onPress={() => handleRemoveMember(memberId, memberUser.username || 'User')}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="remove-circle-outline" size={20} color="#EF4444" />
              </TouchableOpacity>
            )}
          </View>
        );
      })}
    </View>
  );

  const renderLeaderboard = () => (
    <View style={styles.tabContent}>
      {leaderboardLoading ? (
        <SkeletonGroup gap={10}>
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} width="100%" height={56} borderRadius={12} />
          ))}
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
            <View key={entry._id} style={[styles.leaderRow, { backgroundColor: t.surface, borderColor: t.border }]}>
              <View style={[styles.rankCircle, { backgroundColor: medal ? medal + '20' : t.inputBg }]}>
                {medal ? (
                  <Ionicons name="trophy" size={16} color={medal} />
                ) : (
                  <Text style={[styles.rankText, { color: t.textSub }]}>{rank}</Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.memberName, { color: t.text }]}>
                  {entry.user?.username || 'User'}
                  {entry.user?._id === user?.id ? ' (you)' : ''}
                </Text>
              </View>
              <View style={styles.pointsBadge}>
                <Ionicons name="star" size={12} color="#F59E0B" />
                <Text style={[styles.pointsText, { color: '#F59E0B' }]}>{entry.points}</Text>
              </View>
            </View>
          );
        })
      )}
    </View>
  );

  const renderChat = () => (
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
          <View style={[styles.emptyTab, { flex: 1, justifyContent: 'center' }]}>
            <Ionicons name="chatbubbles-outline" size={36} color={t.textHint} />
            <Text style={[styles.emptyTabText, { color: t.textSub }]}>No messages yet</Text>
            <Text style={[styles.emptyTabHint, { color: t.textHint }]}>
              Start the conversation!
            </Text>
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
                      ? { backgroundColor: '#6366f1', borderBottomRightRadius: 4 }
                      : { backgroundColor: t.surface, borderColor: t.border, borderWidth: 1, borderBottomLeftRadius: 4 },
                  ]}>
                    {!isMyMsg && (
                      <Text style={[styles.chatSender, { color: '#6366f1' }]}>
                        {msg.userId?.username || 'User'}
                      </Text>
                    )}
                    {msg.replyTo && (
                      <View style={[styles.replyBar, { borderColor: isMyMsg ? 'rgba(255,255,255,0.3)' : '#6366f140' }]}>
                        <Text style={[styles.replyText, { color: isMyMsg ? 'rgba(255,255,255,0.7)' : t.textHint }]} numberOfLines={1}>
                          {msg.replyTo.message}
                        </Text>
                      </View>
                    )}
                    <Text style={[styles.chatText, { color: isMyMsg ? '#fff' : t.text }]}>
                      {content}
                    </Text>
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
        <View style={[styles.chatInputBar, { backgroundColor: isDark ? '#1a1a2e' : '#fff', borderColor: t.border }]}>
          <TextInput
            style={[styles.chatTextInput, { backgroundColor: t.inputBg, color: t.text, borderColor: t.border }]}
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
            <LinearGradient
              colors={['#6366f1', '#8b5cf6']}
              style={styles.sendBtnGrad}
            >
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
  );

  // ── Settings modal ──
  const renderSettingsModal = () => (
    <Modal visible={showSettings} transparent animationType="fade" onRequestClose={() => setShowSettings(false)}>
      <View style={styles.modalOverlay}>
        <View style={[styles.settingsModal, { backgroundColor: isDark ? '#1a1a2e' : '#fff', borderColor: t.border }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: t.text }]}>Room Settings</Text>
            <TouchableOpacity onPress={() => setShowSettings(false)}>
              <Ionicons name="close" size={24} color={t.textSub} />
            </TouchableOpacity>
          </View>

          {/* Join code */}
          <View style={[styles.codeBox, { backgroundColor: t.inputBg, borderColor: t.border }]}>
            <View>
              <Text style={[{ fontSize: 11, fontWeight: '600', color: t.textHint, letterSpacing: 0.5 }]}>JOIN CODE</Text>
              <Text style={[{ fontSize: 22, fontWeight: '800', color: t.text, letterSpacing: 3, marginTop: 4 }]}>
                {room.joinCode}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity onPress={handleCopyCode} style={[styles.codeAction, { backgroundColor: '#6366f120' }]}>
                <Ionicons name="copy-outline" size={18} color="#6366f1" />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleShareCode} style={[styles.codeAction, { backgroundColor: '#6366f120' }]}>
                <Ionicons name="share-outline" size={18} color="#6366f1" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Info */}
          <View style={styles.settingsInfoList}>
            <View style={styles.settingsInfoRow}>
              <Text style={[{ color: t.textSub, fontSize: 13 }]}>Visibility</Text>
              <Text style={[{ color: t.text, fontSize: 13, fontWeight: '600' }]}>
                {room.isPublic ? 'Public' : 'Private'}
              </Text>
            </View>
            <View style={styles.settingsInfoRow}>
              <Text style={[{ color: t.textSub, fontSize: 13 }]}>Approval Required</Text>
              <Text style={[{ color: t.text, fontSize: 13, fontWeight: '600' }]}>
                {room.requireApproval ? 'Yes' : 'No'}
              </Text>
            </View>
            <View style={styles.settingsInfoRow}>
              <Text style={[{ color: t.textSub, fontSize: 13 }]}>Max Members</Text>
              <Text style={[{ color: t.text, fontSize: 13, fontWeight: '600' }]}>{room.maxMembers}</Text>
            </View>
            <View style={styles.settingsInfoRow}>
              <Text style={[{ color: t.textSub, fontSize: 13 }]}>Chat Retention</Text>
              <Text style={[{ color: t.text, fontSize: 13, fontWeight: '600' }]}>{room.chatRetentionDays} days</Text>
            </View>
            <View style={styles.settingsInfoRow}>
              <Text style={[{ color: t.textSub, fontSize: 13 }]}>Expires</Text>
              <Text style={[{ color: t.text, fontSize: 13, fontWeight: '600' }]}>
                {room.endDate ? new Date(room.endDate).toLocaleDateString() : 'Never'}
              </Text>
            </View>
          </View>

          {/* Actions */}
          <View style={{ gap: 10, marginTop: 8 }}>
            {isOwner ? (
              <TouchableOpacity
                onPress={() => { setShowSettings(false); setShowDeleteConfirm(true); }}
                style={[styles.dangerBtn, { borderColor: '#EF4444' }]}
              >
                <Ionicons name="trash-outline" size={16} color="#EF4444" />
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#EF4444' }}>Delete Room</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={() => { setShowSettings(false); setShowLeaveConfirm(true); }}
                style={[styles.dangerBtn, { borderColor: '#EF4444' }]}
              >
                <Ionicons name="exit-outline" size={16} color="#EF4444" />
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#EF4444' }}>Leave Room</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );

  return (
    <View style={{ flex: 1 }}>
      <View style={[styles.container, { backgroundColor: t.bg }]}>
        <LinearGradient
          colors={t.gradient as any}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        {/* ── Enhanced Header with DualFlipHeader & DoomClock ── */}
        <DualFlipHeader
          roomName={room.name}
          roomCode={room.joinCode}
          expiresAt={room.endDate ? new Date(room.endDate).getTime() : Date.now() + 30 * 24 * 60 * 60 * 1000}
          isOwner={isOwner}
          memberCount={memberCount}
          taskCount={taskCount}
          onSettings={() => setShowSettings(true)}
        />

        {/* ── Tab bar ── */}
        <View style={styles.tabBar}>
          {([
            { key: 'tasks', icon: 'clipboard-outline', label: 'Tasks' },
            { key: 'members', icon: 'people-outline', label: 'Members' },
            { key: 'leaderboard', icon: 'trophy-outline', label: 'Ranks' },
            { key: 'chat', icon: 'chatbubbles-outline', label: 'Chat' },
          ] as { key: DetailTab; icon: string; label: string }[]).map(tab => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, activeTab === tab.key && styles.tabActive, activeTab === tab.key && { borderColor: t.primary }]}
              onPress={() => { haptics.selection(); setActiveTab(tab.key); }}
              activeOpacity={0.7}
            >
              <Ionicons name={tab.icon as any} size={16} color={activeTab === tab.key ? t.primary : t.textHint} />
              <Text style={[styles.tabText, { color: activeTab === tab.key ? t.primary : t.textHint }]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Tab content ── */}
        {activeTab === 'chat' ? (
          renderChat()
        ) : (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.primary} />}
          >
            {activeTab === 'tasks' && renderTasks()}
            {activeTab === 'members' && renderMembers()}
            {activeTab === 'leaderboard' && renderLeaderboard()}
          </ScrollView>
        )}
      </View>

      {/* ── Modals ── */}
      {renderSettingsModal()}

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
  headerCenter: {
    flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1,
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', letterSpacing: -0.3 },
  placeholder: { width: 36 },
  // ── Summary ──
  summaryCard: {
    marginHorizontal: 20, borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 12,
  },
  summaryStats: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around',
  },
  summaryStat: { alignItems: 'center', gap: 4 },
  summaryStatValue: { fontSize: 18, fontWeight: '700' },
  summaryStatLabel: { fontSize: 11, fontWeight: '500' },
  summaryDivider: { width: 1, height: 36 },
  // ── Tabs ──
  tabBar: {
    flexDirection: 'row', marginHorizontal: 20, marginBottom: 12, gap: 2,
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, paddingVertical: 10, borderBottomWidth: 2, borderColor: 'transparent',
  },
  tabActive: { borderBottomWidth: 2 },
  tabText: { fontSize: 12, fontWeight: '600', letterSpacing: -0.2 },
  // ── Tab content ──
  tabContent: { gap: 8, paddingTop: 4 },
  emptyTab: { alignItems: 'center', paddingTop: 48, gap: 8 },
  emptyTabText: { fontSize: 16, fontWeight: '600' },
  emptyTabHint: { fontSize: 13, textAlign: 'center' },
  subSectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 8, paddingLeft: 4 },
  // ── Tasks ──
  taskRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 14, borderWidth: 1, padding: 14,
  },
  taskCheck: {
    width: 24, height: 24, borderRadius: 12, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  taskTitle: { fontSize: 14, fontWeight: '600' },
  taskMetaRow: { flexDirection: 'row', marginTop: 2 },
  taskMeta: { fontSize: 11 },
  progressCard: {
    borderRadius: 14, borderWidth: 1, padding: 14, marginTop: 8,
  },
  progressLabel: { fontSize: 12, fontWeight: '600', marginBottom: 8 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  progressBarBg: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 3 },
  progressText: { fontSize: 13, fontWeight: '700', minWidth: 35, textAlign: 'right' },
  // ── Members ──
  memberRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 14, borderWidth: 1, padding: 12, marginBottom: 6,
  },
  avatar: {
    width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 15, fontWeight: '700' },
  memberName: { fontSize: 14, fontWeight: '600' },
  memberPoints: { fontSize: 11, marginTop: 1 },
  roleBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  roleBadgeText: { fontSize: 9, fontWeight: '700', color: '#6366f1', letterSpacing: 0.3 },
  approveBtn: {
    width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
  },
  // ── Leaderboard ──
  leaderRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 14, borderWidth: 1, padding: 12, marginBottom: 6,
  },
  rankCircle: {
    width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
  },
  rankText: { fontSize: 14, fontWeight: '700' },
  pointsBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pointsText: { fontSize: 14, fontWeight: '700' },
  // ── Chat ──
  systemMsg: { alignItems: 'center', paddingVertical: 6 },
  systemMsgText: { fontSize: 11, fontStyle: 'italic' },
  chatBubbleRow: { flexDirection: 'row' },
  chatBubble: {
    maxWidth: '78%', borderRadius: 16, padding: 10, paddingBottom: 6,
  },
  chatSender: { fontSize: 11, fontWeight: '700', marginBottom: 2 },
  replyBar: {
    borderLeftWidth: 2, paddingLeft: 8, marginBottom: 4, paddingVertical: 2,
  },
  replyText: { fontSize: 11 },
  chatText: { fontSize: 14, lineHeight: 20 },
  chatTime: { fontSize: 10, marginTop: 4, textAlign: 'right' },
  chatInputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    paddingHorizontal: 16, paddingVertical: 10,
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
  // ── Settings modal ──
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  settingsModal: {
    width: '100%', borderRadius: 20, borderWidth: 1, padding: 24, gap: 16,
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', letterSpacing: -0.3 },
  codeBox: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: 14, borderWidth: 1, padding: 16,
  },
  codeAction: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  settingsInfoList: { gap: 12 },
  settingsInfoRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  dangerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 12, borderRadius: 12, borderWidth: 1,
  },
});
