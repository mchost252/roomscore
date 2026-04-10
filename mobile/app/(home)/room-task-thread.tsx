/**
 * RoomTaskThreadScreen — The Subway Mission Log
 * 
 * High-performance chronological Proof-of-Work thread.
 */
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, StatusBar, 
  TextInput, KeyboardAvoidingView, Platform, Keyboard 
} from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { FlashList, ViewToken } from '@shopify/flash-list';
import * as Haptics from 'expo-haptics';

import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useWebSocket, webSocketManager } from '../../services/websocketService';
import { RoomTaskNode, RoomMember, Task } from '../../types/room';
import { taskService } from '../../services/taskService';
import { RoomService } from '../../services/roomService';
import { roomStorage } from '../../db/roomDb';
import { roomTaskNodeService } from '../../services/roomTaskNodeService';

import { 
  HeroBriefNode, PinWallNode, ProofNode, ChatNode, DateDividerNode, checkIsAutoApproved
} from '../../components/room-task-thread/SubwayNodes';
import ProofUploadModal from '../../components/room-task-thread/ProofUploadModal';
import Animated, { FadeIn, FadeOut, useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';

type NodeType = 'date_divider' | 'proof_node' | 'chat_node';

interface FlattenedNode {
  id: string;
  type: NodeType;
  data: any;
  isLast?: boolean;
}

const updateTaskCache = (roomId: string, taskId: string, isCompleted: boolean, user: any) => {
  try {
    const raw = roomStorage.getString(`tasks_${roomId}`);
    if (raw) {
      const tasks: Task[] = JSON.parse(raw);
      const updated = tasks.map(t => {
        if (t.id === taskId) {
          const completions = t.completions || [];
          if (isCompleted && !completions.some(c => c.userId === user.id)) {
            completions.push({
              id: `c_${Date.now()}`,
              taskId,
              userId: user.id,
              completedAt: new Date().toISOString(),
              user: { username: user.username, avatar: user.avatar }
            });
          }
          return { ...t, isCompleted, completions };
        }
        return t;
      });
      roomStorage.set(`tasks_${roomId}`, JSON.stringify(updated));
    }
  } catch (e) {
    console.error('Failed to update task cache:', e);
  }
};

export default function RoomTaskThread() {
  const { isDark, colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [commsStatus, setCommsStatus] = useState<'online' | 'connecting' | 'offline'>('connecting');

  const params = useLocalSearchParams<{
    taskId: string;
    taskTitle: string;
    roomId: string;
    roomName: string;
    points?: string;
    dueDate?: string;
    taskType?: string;
    description?: string;
    isOwner?: string;
  }>();

  const taskId = params.taskId;
  const roomId = params.roomId;
  const taskTitle = params.taskTitle || 'Task';
  const roomName = params.roomName || 'Room';
  const taskPoints = parseInt(params.points || '10', 10);
  const taskDueDate = params.dueDate || '';
  const isRoomOwner = params.isOwner === 'true';

  const [nodes, setNodes] = useState<RoomTaskNode[]>([]);
  const [inputText, setInputText] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [isTaskCompleted, setIsTaskCompleted] = useState(false);
  
  const [roomMembers, setRoomMembers] = useState<RoomMember[]>([]);
  const [completions, setCompletions] = useState<{userId?: string}[]>([]);
  const [taskParticipants, setTaskParticipants] = useState<RoomMember[]>([]);
  const [floatingDate, setFloatingDate] = useState<string | null>(null);
  const isScrolling = useSharedValue(0);

  const listRef = useRef<FlashList<FlattenedNode>>(null);
  const scrollTimeout = useRef<NodeJS.Timeout | null>(null);
  const processedNodeIds = useRef<Set<string>>(new Set());

  // ── Load Data ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!taskId) return;
    roomTaskNodeService.getNodes(taskId).then(setNodes);
    roomTaskNodeService.purgeOldNodes(taskId, 5);

    taskService.getRoomTaskNodes(roomId, taskId)
      .then(apiNodes => {
        if (apiNodes && apiNodes.length > 0) {
          setNodes(prev => {
            const existingIds = new Set(prev.map(n => n.id || n._id));
            const newNodes = apiNodes.filter(n => !existingIds.has(n.id || n._id));
            return [...prev, ...newNodes];
          });
          apiNodes.forEach(node => roomTaskNodeService.addNode(taskId, node).catch(() => {}));
        }
      });

    try {
      const rawTasks = roomStorage.getString(`tasks_${roomId}`);
      if (rawTasks) {
        const tasks: Task[] = JSON.parse(rawTasks);
        const t = tasks.find(x => x.id === taskId);
        if (t) {
          setIsTaskCompleted(!!t.isCompleted);
          setCompletions(t.completions || []);
          setTaskParticipants(t.participants || []);
        }
      }
      const rawMembers = roomStorage.getString(`members_${roomId}`);
      if (rawMembers) setRoomMembers(JSON.parse(rawMembers));
    } catch {}

    RoomService.getRoomMembers(roomId).then(setRoomMembers).catch(() => {});
  }, [taskId, roomId]);

  // ── WebSocket ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!taskId || !roomId) return;

    const updateStatus = () => setCommsStatus(webSocketManager.isConnectedToServer() ? 'online' : 'connecting');
    if (!webSocketManager.isConnectedToServer()) webSocketManager.connect(roomId);
    updateStatus();

    const handleNodeCreated = (data: any) => {
      if (data.taskId === taskId && data.node) {
        const node = data.node;
        const nodeId = node.id || node._id;
        const clientRef = node.clientReferenceId;

        setNodes(prev => {
          const exists = prev.some(n => 
            (nodeId && (n.id === nodeId || n._id === nodeId)) || 
            (clientRef && n.clientReferenceId === clientRef)
          );
          
          if (exists) {
            return prev.map(n => (clientRef && n.clientReferenceId === clientRef) ? { ...n, ...node, isOptimistic: false } : n);
          }
          
          if (nodeId) processedNodeIds.current.add(nodeId);
          const next = [...prev, node];
          roomTaskNodeService.addNode(taskId, node).catch(() => {});
          return next;
        });
      }
    };

    const handleNodeUpdated = (data: any) => {
      if (data.taskId === taskId && data.nodeId) {
        setNodes(prev => {
          const next = prev.map(n => (n.id === data.nodeId || n._id === data.nodeId) ? { ...n, ...data.patch } : n);
          roomTaskNodeService.updateNode(taskId, data.nodeId, data.patch).catch(() => {});
          return next;
        });
      }
    };

    webSocketManager.on('connect', updateStatus);
    webSocketManager.on('disconnect', () => setCommsStatus('offline'));
    webSocketManager.on('node:created', handleNodeCreated);
    webSocketManager.on('thread:node_created', handleNodeCreated);
    webSocketManager.on('node:updated', handleNodeUpdated);

    return () => {
      webSocketManager.off('connect', updateStatus);
      webSocketManager.off('node:created', handleNodeCreated);
      webSocketManager.off('thread:node_created', handleNodeCreated);
      webSocketManager.off('node:updated', handleNodeUpdated);
    };
  }, [taskId, roomId]);

  const pinProofs = useMemo(() => {
    return nodes.filter(n => n.type === 'PROOF' && (n.status === 'GHOST_APPROVED' || checkIsAutoApproved(n.createdAt) || (n.vouchCount || 0) >= 3));
  }, [nodes]);

  const flattenedData = useMemo(() => {
    const arr: FlattenedNode[] = [];
    let lastDateStr = '';
    const sortedNodes = [...nodes].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    sortedNodes.forEach((node, index) => {
      const dateStr = new Date(node.createdAt).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
      if (dateStr !== lastDateStr) {
        arr.push({ id: `date_${dateStr}`, type: 'date_divider', data: dateStr });
        lastDateStr = dateStr;
      }

      const prevNode = sortedNodes[index - 1];
      const isSameUser = prevNode && (prevNode.userId === node.userId || prevNode.user?.id === node.user?.id) && prevNode.type === node.type;
      const isGroupStart = !isSameUser;

      arr.push({
        id: node.id || node._id || node.clientReferenceId || `temp_${index}`,
        type: node.type === 'PROOF' ? 'proof_node' : 'chat_node',
        data: { ...node, isGroupStart },
        isLast: index === sortedNodes.length - 1,
      });
    });
    return arr;
  }, [nodes]);

  const handleVouch = useCallback(async (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    let newVouchCount = 0;
    setNodes(prev => prev.map(n => {
      if (n.id === id) {
        newVouchCount = (n.vouchCount || 0) + 1;
        const autoApprove = newVouchCount >= 3;
        return { ...n, vouchCount: newVouchCount, isVouchedByMe: true, status: autoApprove ? 'GHOST_APPROVED' : n.status };
      }
      return n;
    }));

    const patch: any = { vouchCount: newVouchCount, isVouchedByMe: true };
    if (newVouchCount >= 3) patch.status = 'GHOST_APPROVED';
    await roomTaskNodeService.updateNode(taskId, id, patch);

    try {
      await taskService.addRoomTaskNode(roomId, taskId, { type: 'VOUCH', content: id, clientReferenceId: `vouch_${id}_${Date.now()}` });
    } catch {}
    showToast({ message: newVouchCount >= 3 ? 'Auto-approved! 3 vouches reached' : '+1 Vouch awarded', type: 'success' });
  }, [taskId, roomId, showToast]);

  const handleApprove = useCallback(async (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setNodes(prev => prev.map(n => n.id === id ? { ...n, status: 'GHOST_APPROVED' } : n));
    await roomTaskNodeService.updateNode(taskId, id, { status: 'GHOST_APPROVED' });
    try {
      await taskService.addRoomTaskNode(roomId, taskId, { type: 'APPROVE', content: id, clientReferenceId: `approve_${id}_${Date.now()}` });
    } catch {}
    showToast({ message: 'Proof Approved', type: 'success' });
  }, [taskId, roomId, showToast]);

  const handleSendChat = async () => {
    if (!inputText.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const clientRefId = `client_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const newChat: RoomTaskNode = {
      id: `chat_${Date.now()}`, clientReferenceId: clientRefId, roomId, taskId, type: 'MESSAGE', status: 'PENDING',
      content: inputText.trim(), vouchCount: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      user: { id: user?.id || 'u1', username: user?.username || 'Me', avatar: user?.avatar }, heatLevel: 0,
    } as any;
    
    processedNodeIds.current.add(clientRefId);
    setNodes(prev => [...prev, newChat]);
    setInputText('');
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 300);
    await roomTaskNodeService.addNode(taskId, newChat);

    try {
      const serverNode = await taskService.addRoomTaskNode(roomId, taskId, { type: 'MESSAGE', status: 'PENDING', content: newChat.content, clientReferenceId: clientRefId });
      if (serverNode) {
        const sid = serverNode._id || serverNode.id;
        setNodes(prev => prev.map(n => n.clientReferenceId === clientRefId ? { ...n, id: sid } : n));
        roomTaskNodeService.updateNode(taskId, newChat.id, { id: sid });
      }
    } catch {}
  };

  const handleUploadProof = async (uri: string) => {
    setShowUploadModal(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const clientRefId = `client_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const newProof: RoomTaskNode = {
      id: `proof_${Date.now()}`, clientReferenceId: clientRefId, roomId, taskId, type: 'PROOF', status: 'PENDING',
      mediaUrl: uri, vouchCount: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      user: { id: user?.id || 'u1', username: user?.username || 'Me', avatar: user?.avatar }, heatLevel: 0,
      content: inputText.trim() || 'Completed the mission.', 
    } as any;
    
    processedNodeIds.current.add(clientRefId);
    setNodes(prev => [...prev, newProof]);
    setInputText('');
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 300);
    await roomTaskNodeService.addNode(taskId, newProof);

    try {
      const serverNode = await taskService.uploadProofWithImage(roomId, taskId, uri, newProof.content || '', clientRefId);
      if (serverNode) {
        const sid = serverNode._id || serverNode.id;
        const sMedia = serverNode.mediaUrl || uri;
        setNodes(prev => prev.map(n => n.clientReferenceId === clientRefId ? { ...n, id: sid, mediaUrl: sMedia } : n));
        roomTaskNodeService.updateNode(taskId, newProof.id, { id: sid, mediaUrl: sMedia });
      }
    } catch {}
  };

  const renderAvatars = () => {
    const pIds = new Set(taskParticipants.map(p => p.userId || p.id));
    const active = pIds.size > 0 ? roomMembers.filter(m => pIds.has(m.userId || m.id)) : [];
    const cIds = new Set(completions.map(c => c.userId));
    const done = active.filter(m => cIds.has(m.userId || m.id));
    const pend = active.filter(m => !cIds.has(m.userId || m.id));
    if (active.length === 0) return null;
    return (
      <View style={styles.headerAvatars}>
        {pend.slice(0, 3).map(m => <View key={m.id} style={[styles.avatarCircle, { opacity: 0.3 }]}><Text style={styles.avatarInit}>{m.username.charAt(0)}</Text></View>)}
        {done.slice(0, 3).map(m => <View key={m.id} style={[styles.avatarCircle, { borderColor: '#22c55e', borderWidth: 1 }]}><Text style={[styles.avatarInit, { color: '#22c55e' }]}>{m.username.charAt(0)}</Text></View>)}
      </View>
    );
  };

  const renderItem = useCallback(({ item }: { item: FlattenedNode }) => {
    switch (item.type) {
      case 'date_divider': return <DateDividerNode dateLabel={item.data} />;
      case 'proof_node': return <ProofNode node={item.data} currentUserId={user?.id || ''} isOwner={isRoomOwner} isLast={item.isLast} onVouch={handleVouch} onApprove={handleApprove} />;
      case 'chat_node': return <ChatNode node={item.data} isLast={item.isLast} currentUserId={user?.id || ''} />;
      default: return null;
    }
  }, [user, isRoomOwner, handleVouch, handleApprove]);

  const floatingDateStyle = useAnimatedStyle(() => ({
    opacity: withTiming(isScrolling.value, { duration: 300 }),
    transform: [{ translateY: withTiming(isScrolling.value === 1 ? 0 : -10, { duration: 300 }) }]
  }));

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      <LinearGradient colors={isDark ? ['#0a0a16', '#0d0d20', '#05050A'] : ['#ffffff', '#f8f9fa', '#f0f0f5'] as any} style={StyleSheet.absoluteFill} />

      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }]}>
          <Ionicons name="chevron-back" size={24} color={isDark ? "#FFFFFF" : "#000000"} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={[styles.headerTitle, { color: isDark ? '#FFF' : '#000' }]} numberOfLines={1}>{taskTitle}</Text>
            <View style={[styles.commsDot, { backgroundColor: commsStatus === 'online' ? '#22c55e' : commsStatus === 'connecting' ? '#f59e0b' : '#ef4444' }]} />
          </View>
          <View style={styles.headerSubRow}><Text style={[styles.headerSubtitle, { color: isDark ? '#a5b4fc' : '#6366f1' }]} numberOfLines={1}>{roomName}</Text>{renderAvatars()}</View>
        </View>
        <TouchableOpacity onPress={async () => {
          const next = !isTaskCompleted;
          setIsTaskCompleted(next);
          if (next && user) {
            setCompletions(prev => [...prev, { userId: user.id }]);
            setShowUploadModal(true);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } else if (user) {
            setCompletions(prev => prev.filter(c => c.userId !== user.id));
          }
          updateTaskCache(roomId, taskId, next, user);
          try { await (next ? taskService.completeTask(roomId, taskId) : taskService.uncompleteTask(roomId, taskId)); } catch {}
        }} style={[styles.doneTickBtn, isTaskCompleted && styles.doneTickActive]}>
          <Ionicons name={isTaskCompleted ? "checkmark-circle" : "ellipse-outline"} size={28} color={isTaskCompleted ? "#22c55e" : (isDark ? "#fff" : "#000")} />
        </TouchableOpacity>
      </View>

      <View style={[styles.floatingDateContainer, { top: insets.top + 64 }]}>
        {floatingDate && <Animated.View style={floatingDateStyle}><BlurView intensity={80} tint={isDark ? "dark" : "light"} style={styles.floatingDateBadge}><Text style={[styles.floatingDateText, { color: isDark ? '#fff' : '#000' }]}>{floatingDate}</Text></BlurView></Animated.View>}
      </View>

      <View style={styles.stickyTopZone}>
        <HeroBriefNode title={taskTitle} description="Implementation Mission" points={taskPoints} dueDate={taskDueDate} />
        <PinWallNode proofs={pinProofs} onDateChangePress={() => showToast({ message: 'Filter active' })} />
      </View>

      <View style={{ flex: 1, minHeight: 200 }}>
        <FlashList
          ref={listRef} data={flattenedData} renderItem={renderItem} keyExtractor={i => i.id} getItemType={i => i.type} estimatedItemSize={120}
          contentContainerStyle={{ paddingBottom: 140, paddingHorizontal: 16 }} showsVerticalScrollIndicator={false}
          onViewableItemsChanged={({ viewableItems }) => {
            const top = viewableItems.find(v => v.item.type !== 'date_divider');
            if (top) setFloatingDate(new Date(top.item.data.createdAt).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' }));
          }}
          onScrollBeginDrag={() => { isScrolling.value = 1; }} onMomentumScrollEnd={() => { setTimeout(() => { isScrolling.value = 0; }, 1500); }}
        />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <BlurView intensity={isDark ? 90 : 60} tint={isDark ? "dark" : "light"} style={[styles.inputBarBlur, { paddingBottom: insets.bottom || 16, borderTopColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }]}>
          <View style={styles.inputRow}>
            <TouchableOpacity style={[styles.mediaBtn, { backgroundColor: isDark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.1)' }]} onPress={() => setShowUploadModal(true)}>
              <Ionicons name="camera-outline" size={22} color={isDark ? "#a5b4fc" : "#6366f1"} />
            </TouchableOpacity>
            <View style={[styles.inputContainer, { backgroundColor: isDark ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.8)', borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]}>
              <TextInput style={[styles.inputField, { color: isDark ? '#fff' : '#000' }]} placeholder="Log progress or chat..." placeholderTextColor={isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)"} value={inputText} onChangeText={setInputText} multiline maxLength={500} />
            </View>
            <TouchableOpacity style={[styles.sendBtn, inputText.trim() ? styles.sendBtnActive : { opacity: 0.5 }]} onPress={handleSendChat} disabled={!inputText.trim()}><Ionicons name="send" size={15} color="#fff" /></TouchableOpacity>
          </View>
        </BlurView>
      </KeyboardAvoidingView>

      <ProofUploadModal visible={showUploadModal} onClose={() => setShowUploadModal(false)} onSkip={() => setShowUploadModal(false)} onUpload={handleUploadProof} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 10 },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, marginHorizontal: 12 },
  headerTitle: { fontSize: 16, fontWeight: '800' },
  commsDot: { width: 6, height: 6, borderRadius: 3, marginTop: 1 },
  headerSubRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  headerSubtitle: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  headerAvatars: { flexDirection: 'row', alignItems: 'center' },
  avatarCircle: { width: 16, height: 16, borderRadius: 8, backgroundColor: 'rgba(99,102,241,0.2)', alignItems: 'center', justifyContent: 'center', marginLeft: -4 },
  avatarInit: { fontSize: 8, fontWeight: '800', color: '#a5b4fc' },
  doneTickBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  doneTickActive: { opacity: 0.8 },
  stickyTopZone: { paddingTop: 12, zIndex: 10 },
  floatingDateContainer: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 100 },
  floatingDateBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, overflow: 'hidden' },
  floatingDateText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  inputBarBlur: { borderTopWidth: 1, paddingTop: 12, paddingHorizontal: 12 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  mediaBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  inputContainer: { flex: 1, borderRadius: 20, borderWidth: 1, minHeight: 40, maxHeight: 120, justifyContent: 'center' },
  inputField: { fontSize: 14, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  sendBtnActive: { backgroundColor: '#8b5cf6' },
});
