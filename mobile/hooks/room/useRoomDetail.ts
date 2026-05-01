/**
 * useRoomDetail — Optimized Local-first data hook for RoomDetailScreen
 * 
 * Logic:
 * 1. MMKV Sync Read (0ms) -> Instant Paint
 * 2. SQLite Sync Read (~5ms) -> Detailed local data
 * 3. API Background Fetch -> Sync SQLite & MMKV + UI update
 * 4. WebSocket Live Sync -> Atomic updates to UI & Cache
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useFocusEffect } from 'expo-router';
import { Room, Task, RoomMember } from '../../types/room';
import { roomStorage, getRoomDb } from '../../db/roomDb';
import { RoomService } from '../../services/roomService';
import { taskService } from '../../services/taskService';
import { webSocketManager } from '../../services/websocketService';
import { useAuth } from '../../context/AuthContext';

const roomKey = (id: string) => `room_${id}`;
const tasksKey = (id: string) => `tasks_${id}`;
const membersKey = (id: string) => `members_${id}`;

// ─── Cache Helpers ──────────────────────────────────────────

function getQuickCache(roomId: string) {
  try {
    const r = roomStorage.getString(roomKey(roomId));
    const t = roomStorage.getString(tasksKey(roomId));
    const m = roomStorage.getString(membersKey(roomId));
    return {
      room: r ? JSON.parse(r) : null,
      tasks: t ? JSON.parse(t) : [],
      members: m ? JSON.parse(m) : []
    };
  } catch { return { room: null, tasks: [], members: [] }; }
}

async function syncToSQLite(roomId: string, room: Room, tasks: Task[], members: RoomMember[]) {
  try {
    const db = await getRoomDb();
    // Use a transaction for atomic sync
    await db.execAsync('BEGIN TRANSACTION;');
    
    // 1. Sync Room
    await db.runAsync(
      `INSERT OR REPLACE INTO rooms (id, name, description, joinCode, isPrivate, maxMembers, chatRetentionDays, isPremium, streak, ownerId, isActive, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [room.id, room.name, room.description || '', room.joinCode, room.isPrivate ? 1 : 0, room.maxMembers, room.chatRetentionDays, room.isPremium ? 1 : 0, room.streak, room.ownerId, room.isActive ? 1 : 0, room.createdAt, room.updatedAt]
    );

    // 2. Sync Tasks (Delete old, Insert new for this room)
    await db.runAsync('DELETE FROM room_tasks WHERE roomId = ?', [roomId]);
    for (const t of tasks) {
      await db.runAsync(
        `INSERT INTO room_tasks (id, roomId, title, description, taskType, points, isActive, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [t.id, roomId, t.title, t.description || '', t.taskType, t.points, t.isActive ? 1 : 0, t.createdAt || new Date().toISOString()]
      );
    }

    // 3. Sync Members
    await db.runAsync('DELETE FROM room_members WHERE roomId = ?', [roomId]);
    for (const m of members) {
      await db.runAsync(
        `INSERT INTO room_members (id, roomId, userId, username, avatar, isOnline, role)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [m.id, roomId, m.userId || m.id, m.username, m.avatar || null, m.isOnline ? 1 : 0, 'member']
      );
    }

    await db.execAsync('COMMIT;');
  } catch (e) {
    console.error('[useRoomDetail] SQLite Sync Error:', e);
    const db = await getRoomDb();
    await db.execAsync('ROLLBACK;');
  }
}

export function useRoomDetail(roomId: string) {
  const { user } = useAuth();
  const isMounted = useRef(true);

  // Quick Cache (MMKV)
  const quick = useMemo(() => getQuickCache(roomId), [roomId]);
  
  const [room, setRoom] = useState<Room | null>(quick.room);
  const [tasks, setTasks] = useState<Task[]>(quick.tasks);
  const [members, setMembers] = useState<RoomMember[]>(quick.members);
  const [loading, setLoading] = useState(!quick.room);
  const [refreshing, setRefreshing] = useState(false);

  const isOwner = useMemo(() => {
    if (!room || !user) return false;
    return room.ownerId === user.id || (room as any).adminId === user.id || room.userRole === 'owner';
  }, [room, user]);

  const activeTasks = tasks.filter(t => !t.isCompleted);

  // Persistent Update Helper
  const persist = useCallback((r: Room | null, t: Task[], m: RoomMember[]) => {
    if (r) roomStorage.set(roomKey(roomId), JSON.stringify(r));
    roomStorage.set(tasksKey(roomId), JSON.stringify(t));
    roomStorage.set(membersKey(roomId), JSON.stringify(m));
    if (r) syncToSQLite(roomId, r, t, m);
  }, [roomId]);

  const fetchFromAPI = useCallback(async (silent = false) => {
    if (!roomId) return;
    if (!silent) setLoading(true);

    try {
      const [roomData, tasksData, membersData] = await Promise.all([
        RoomService.getRoom(roomId),
        taskService.getTasks(roomId),
        RoomService.getRoomMembers(roomId),
      ]);

      if (!isMounted.current) return;

      setRoom(roomData);
      setTasks(tasksData);
      setMembers(membersData);
      persist(roomData, tasksData, membersData);
    } catch (error) {
      console.error('[useRoomDetail] API fetch failed:', error);
    } finally {
      if (isMounted.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [roomId, persist]);

  useEffect(() => {
    fetchFromAPI(!!room);
    return () => { isMounted.current = false; };
  }, [fetchFromAPI]);

  // WebSocket Live Updates
  useEffect(() => {
    if (!roomId) return;
    
    // Auto-connect socket for real-time updates
    if (!webSocketManager.isConnectedToServer()) {
      webSocketManager.connect(roomId);
    }

    const onRoomUpdate = (data: any) => {
      if (data.roomId !== roomId) return;
      setRoom(prev => {
        const next = prev ? { ...prev, ...data.room } : data.room;
        roomStorage.set(roomKey(roomId), JSON.stringify(next));
        return next;
      });
    };

    const onTaskCreated = (data: any) => {
      if (data.roomId !== roomId || !data.task) return;
      setTasks(prev => {
        if (prev.find(t => t.id === data.task.id)) return prev;
        const formattedTask = { ...data.task, isJoined: false, status: 'spectator', completions: [], participants: [] };
        const next = [...prev, formattedTask];
        roomStorage.set(tasksKey(roomId), JSON.stringify(next));
        return next;
      });
    };

    const onTaskUpdated = (data: any) => {
      if (data.roomId !== roomId || !data.task) return;
      setTasks(prev => {
        const next = prev.map(t => t.id === data.task.id ? { ...t, ...data.task } : t);
        roomStorage.set(tasksKey(roomId), JSON.stringify(next));
        return next;
      });
    };

    const onTaskDeleted = (data: any) => {
      if (data.roomId !== roomId || !data.taskId) return;
      setTasks(prev => {
        const next = prev.filter(t => t.id !== data.taskId);
        roomStorage.set(tasksKey(roomId), JSON.stringify(next));
        return next;
      });
    };

    const onTaskCompleted = (data: any) => {
      if (data.roomId !== roomId || !data.taskId) return;
      setTasks(prev => {
        const next = prev.map(t => {
          if (t.id === data.taskId) {
            const comps = t.completions || [];
            const isMe = data.userId === user?.id;
            const newComps = comps.find(c => c.userId === data.userId) 
              ? comps 
              : [...comps, { id: `c_${Date.now()}`, taskId: t.id, userId: data.userId, user: { username: data.username, avatar: data.avatar }, completedAt: new Date().toISOString() }];
            return {
              ...t,
              isCompleted: isMe ? true : t.isCompleted,
              completions: newComps,
            };
          }
          return t;
        });
        roomStorage.set(tasksKey(roomId), JSON.stringify(next));
        return next;
      });
    };

    const onTaskUncompleted = (data: any) => {
      if (data.roomId !== roomId || !data.taskId) return;
      setTasks(prev => {
        const next = prev.map(t => {
          if (t.id === data.taskId) {
            const comps = t.completions || [];
            // Handle both `userId` and `oderId` (typo in backend)
            const targetId = data.userId || data.oderId;
            const isMe = targetId === user?.id;
            return {
              ...t,
              isCompleted: isMe ? false : t.isCompleted,
              completions: comps.filter(c => c.userId !== targetId),
            };
          }
          return t;
        });
        roomStorage.set(tasksKey(roomId), JSON.stringify(next));
        return next;
      });
    };

    const onMemberUpdate = (data: any) => {
      if (data.roomId !== roomId) return;
      setMembers(prev => {
        const next = data.member && !prev.find(m => m.id === data.member.id) ? [...prev, data.member] : prev;
        roomStorage.set(membersKey(roomId), JSON.stringify(next));
        return next;
      });
    };

    const onTaskJoined = (data: any) => {
      if (data.roomId !== roomId || !data.taskId) return;
      setTasks(prev => {
        const next = prev.map(t => {
          if (t.id === data.taskId) {
            const parts = t.participants || [];
            if (!parts.some(p => (p.userId || p.id) === data.userId)) {
              return { ...t, participants: [...parts, { id: data.userId, userId: data.userId, username: data.username, isOnline: false, aura: 'bronze' as any, hasHeat: false }] };
            }
          }
          return t;
        });
        roomStorage.set(tasksKey(roomId), JSON.stringify(next));
        return next;
      });
    };

    const onTaskLeft = (data: any) => {
      if (data.roomId !== roomId || !data.taskId) return;
      setTasks(prev => {
        const next = prev.map(t => {
          if (t.id === data.taskId) {
            const parts = t.participants || [];
            return { ...t, participants: parts.filter(p => (p.userId || p.id) !== data.userId) };
          }
          return t;
        });
        roomStorage.set(tasksKey(roomId), JSON.stringify(next));
        return next;
      });
    };

    webSocketManager.on('room:updated', onRoomUpdate);
    webSocketManager.on('task:created', onTaskCreated);
    webSocketManager.on('task:updated', onTaskUpdated);
    webSocketManager.on('task:deleted', onTaskDeleted);
    webSocketManager.on('task:completed', onTaskCompleted);
    webSocketManager.on('task:uncompleted', onTaskUncompleted);
    webSocketManager.on('task:joined', onTaskJoined);
    webSocketManager.on('task:left', onTaskLeft);
    webSocketManager.on('member:joined', onMemberUpdate);

    return () => {
      webSocketManager.off('room:updated', onRoomUpdate);
      webSocketManager.off('task:created', onTaskCreated);
      webSocketManager.off('task:updated', onTaskUpdated);
      webSocketManager.off('task:deleted', onTaskDeleted);
      webSocketManager.off('task:completed', onTaskCompleted);
      webSocketManager.off('task:uncompleted', onTaskUncompleted);
      webSocketManager.off('task:joined', onTaskJoined);
      webSocketManager.off('task:left', onTaskLeft);
      webSocketManager.off('member:joined', onMemberUpdate);
    };
  }, [roomId, user?.id]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    fetchFromAPI(true);
  }, [fetchFromAPI]);

  const addTask = useCallback((task: Task) => {
    setTasks(prev => {
      const next = [...prev, task];
      roomStorage.set(tasksKey(roomId), JSON.stringify(next));
      return next;
    });
  }, [roomId]);

  const updateTask = useCallback((taskId: string, patch: Partial<Task>) => {
    setTasks(prev => {
      const next = prev.map(t => t.id === taskId ? { ...t, ...patch } : t);
      roomStorage.set(tasksKey(roomId), JSON.stringify(next));
      return next;
    });
  }, [roomId]);

  const updateRoom = useCallback((patch: Partial<Room>) => {
    setRoom(prev => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      roomStorage.set(roomKey(roomId), JSON.stringify(next));
      return next;
    });
  }, [roomId]);

  return {
    room, tasks, members, activeTasks,
    loading, refreshing, isOwner,
    userId: user?.id || '',
    refresh, addTask, updateTask, updateRoom,
  };
}
