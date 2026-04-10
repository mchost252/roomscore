/**
 * useRoomDetail — Local-first data hook for RoomDetailScreen
 *
 * Load order (WhatsApp-style instant paint):
 *   1. MMKV sync read (0ms) → immediate UI with cached data
 *   2. SQLite async read (1-5ms) → enriched local data
 *   3. API fetch (background) → fresh server data + cache update
 *   4. WebSocket (live) → real-time pushes
 */
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useFocusEffect } from 'expo-router';
import { Room, Task, RoomMember } from '../../types/room';
import { roomStorage, getRoomDb } from '../../db/roomDb';
import { RoomService } from '../../services/roomService';
import { taskService } from '../../services/taskService';
import { useWebSocket } from '../../services/websocketService';
import { useAuth } from '../../context/AuthContext';

// ─── MMKV keys ───────────────────────────────────────────────────────────────
const roomKey = (id: string) => `room_${id}`;
const tasksKey = (id: string) => `tasks_${id}`;
const membersKey = (id: string) => `members_${id}`;

// ─── Instant MMKV helpers (synchronous, <1ms) ────────────────────────────────
function getCachedRoom(roomId: string): Room | null {
  try {
    const raw = roomStorage.getString(roomKey(roomId));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function getCachedTasks(roomId: string): Task[] {
  try {
    const raw = roomStorage.getString(tasksKey(roomId));
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function getCachedMembers(roomId: string): RoomMember[] {
  try {
    const raw = roomStorage.getString(membersKey(roomId));
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function cacheRoom(roomId: string, room: Room) {
  try { roomStorage.set(roomKey(roomId), JSON.stringify(room)); } catch {}
}

function cacheTasks(roomId: string, tasks: Task[]) {
  try { roomStorage.set(tasksKey(roomId), JSON.stringify(tasks)); } catch {}
}

function cacheMembers(roomId: string, members: RoomMember[]) {
  try { roomStorage.set(membersKey(roomId), JSON.stringify(members)); } catch {}
}

// ─── Hook ────────────────────────────────────────────────────────────────────
export function useRoomDetail(roomId: string) {
  const { user } = useAuth();
  const { socket } = useWebSocket();

  // ── Step 1: Instant paint from MMKV (synchronous, 0ms) ──────────────────
  const [room, setRoom] = useState<Room | null>(() => getCachedRoom(roomId));
  const [tasks, setTasks] = useState<Task[]>(() => getCachedTasks(roomId));
  const [members, setMembers] = useState<RoomMember[]>(() => getCachedMembers(roomId));
  const [loading, setLoading] = useState(() => !getCachedRoom(roomId));
  const [refreshing, setRefreshing] = useState(false);
  const isMounted = useRef(true);

  const isOwner = useMemo(() => {
    if (!room || !user) return false;
    // Check both ownerId and adminId to ensure robust role persistence 
    // across both local SQLite states and live backend states.
    const roomAdminId = (room as any).adminId || room.ownerId;
    return roomAdminId === user.id || room.userRole === 'owner' || room.userRole === 'admin';
  }, [room, user]);

  const activeTasks = tasks.filter(t => !t.isCompleted);

  // ── Step 2: Background API fetch → update state + cache ──────────────────
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
      // Merge API tasks with local optimistic state — preserve isJoined/status/participants
      setTasks(prev => {
        return tasksData.map(apiTask => {
          const localTask = prev.find(t => t.id === apiTask.id);
          if (localTask) {
            return {
              ...apiTask,
              // Preserve local optimistic fields the API doesn't return
              isJoined: apiTask.isJoined ?? localTask.isJoined,
              status: apiTask.status ?? localTask.status,
              participants: apiTask.participants?.length ? apiTask.participants : localTask.participants,
            };
          }
          return apiTask;
        });
      });
      setMembers(membersData);

      // Persist to MMKV for next instant load
      cacheRoom(roomId, roomData);
      cacheTasks(roomId, tasksData);
      cacheMembers(roomId, membersData);

      // Also upsert into SQLite for rooms list
      try {
        const db = await getRoomDb();
        await db.runAsync(
          `INSERT OR REPLACE INTO rooms (id, name, description, joinCode, isPrivate, maxMembers, chatRetentionDays, isPremium, streak, ownerId, isActive, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            roomData.id, roomData.name, roomData.description || '', roomData.joinCode,
            roomData.isPrivate ? 1 : 0, roomData.maxMembers, roomData.chatRetentionDays,
            roomData.isPremium ? 1 : 0, roomData.streak, roomData.ownerId,
            roomData.isActive ? 1 : 0, roomData.createdAt, roomData.updatedAt,
          ]
        );
      } catch {} // SQLite write is best-effort
    } catch (error) {
      console.error('[useRoomDetail] API fetch failed:', error);
      // If we have cached data, user still sees content — no error state needed
    } finally {
      if (isMounted.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [roomId]);

  // Initial background fetch
  useEffect(() => {
    fetchFromAPI(!!room); // silent if we already have cached data
  }, [fetchFromAPI]);

  // Sync cache on screen focus (e.g. after going back from Thread screen)
  useFocusEffect(
    useCallback(() => {
      if (!isMounted.current) return;
      const cachedTasks = getCachedTasks(roomId);
      if (cachedTasks && cachedTasks.length > 0) {
        setTasks(cachedTasks);
      }
      const cachedRoom = getCachedRoom(roomId);
      if (cachedRoom) {
        setRoom(cachedRoom);
      }
    }, [roomId])
  );

  // ── Step 3: WebSocket live sync ──────────────────────────────────────────
  useEffect(() => {
    if (!socket || !roomId) return;

    const handleRoomUpdated = (data: any) => {
      if (data.roomId === roomId && data.room) {
        const updated = data.room;
        setRoom(prev => prev ? { ...prev, ...updated } : prev);
        cacheRoom(roomId, { ...room, ...updated } as Room);
      }
    };

    const handleTaskCreated = (data: any) => {
      if (data.roomId === roomId && data.task) {
        setTasks(prev => {
          const next = [...prev, data.task];
          cacheTasks(roomId, next);
          return next;
        });
      }
    };

    const handleTaskCompleted = (data: any) => {
      if (data.roomId === roomId) {
        setTasks(prev => {
          const next = prev.map(task =>
            task.id === data.taskId
              ? { ...task, isCompleted: true, completions: data.completedBy }
              : task
          );
          cacheTasks(roomId, next);
          return next;
        });

        if (data.leaderboard) {
          const mapped: RoomMember[] = data.leaderboard.map((m: any) => ({
            id: m._id,
            username: m.user?.username || 'Member',
            avatar: m.user?.avatar,
            isOnline: !!m.isOnline,
            aura: 'bronze' as const,
            hasHeat: false,
          }));
          setMembers(mapped);
          cacheMembers(roomId, mapped);
        }
      }
    };

    const handleMemberJoined = (data: any) => {
      if (data.roomId === roomId && data.member) {
        setMembers(prev => {
          const next = [...prev, data.member];
          cacheMembers(roomId, next);
          return next;
        });
      }
    };

    const handleTaskUpdated = (data: any) => {
      if (data.roomId === roomId && data.task) {
        setTasks(prev => {
          const next = prev.map(t => t.id === data.taskId || t.id === data.task.id ? { ...t, ...data.task } : t);
          cacheTasks(roomId, next);
          return next;
        });
      }
    };

    const handleTaskDeleted = (data: any) => {
      if (data.roomId === roomId && data.taskId) {
        setTasks(prev => {
          const next = prev.filter(t => t.id !== data.taskId);
          cacheTasks(roomId, next);
          return next;
        });
      }
    };

    socket.on('room:updated', handleRoomUpdated);
    socket.on('task:created', handleTaskCreated);
    socket.on('task:updated', handleTaskUpdated);
    socket.on('task:deleted', handleTaskDeleted);
    socket.on('task:removed', handleTaskDeleted); // Fallback
    socket.on('task:completed', handleTaskCompleted);
    socket.on('member:joined', handleMemberJoined);

    return () => {
      socket.off('room:updated', handleRoomUpdated);
      socket.off('task:created', handleTaskCreated);
      socket.off('task:updated', handleTaskUpdated);
      socket.off('task:deleted', handleTaskDeleted);
      socket.off('task:removed', handleTaskDeleted);
      socket.off('task:completed', handleTaskCompleted);
      socket.off('member:joined', handleMemberJoined);
    };
  }, [socket, roomId]);

  // Cleanup
  useEffect(() => {
    return () => { isMounted.current = false; };
  }, []);

  // ── Public API ─────────────────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    setRefreshing(true);
    await fetchFromAPI(true);
  }, [fetchFromAPI]);

  const addTask = useCallback((task: Task) => {
    setTasks(prev => {
      const next = [...prev, task];
      cacheTasks(roomId, next);
      return next;
    });
  }, [roomId]);

  const updateTask = useCallback((taskId: string, patch: Partial<Task>) => {
    setTasks(prev => {
      const next = prev.map(t => t.id === taskId ? { ...t, ...patch } : t);
      cacheTasks(roomId, next);
      return next;
    });
  }, [roomId]);

  const updateRoom = useCallback((patch: Partial<Room>) => {
    setRoom(prev => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      cacheRoom(roomId, next);
      return next;
    });
  }, [roomId]);

  return {
    room,
    tasks,
    members,
    activeTasks,
    loading,
    refreshing,
    isOwner,
    userId: user?.id || '',
    refresh,
    addTask,
    updateTask,
    updateRoom,
  };
}
