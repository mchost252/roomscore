/**
 * useRoomsInstant — WhatsApp-style instant room list loading
 *
 * Paint order:
 *   1. MMKV sync read (0ms) → instant room list from last session
 *   2. SQLite async read (1-5ms) → enriched local data
 *   3. API background fetch → fresh data + cache update
 *
 * Replaces useRoomsDashboard with true 0ms-first-paint.
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { InteractionManager } from 'react-native';
import { RoomDetail } from '../../types/room';
import { roomStorage, getRoomDb } from '../../db/roomDb';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import syncEngine from '../../services/syncEngine';
import realtimeEvents from '../../services/realtimeEvents';

// ─── MMKV keys ───────────────────────────────────────────────────────────────
const ROOMS_LIST_KEY = 'rooms_list_cache';
const ROOMS_LIST_TS_KEY = 'rooms_list_ts';
const ROOMS_LIST_TTL = 60_000; // skip re-fetch within this window

// ─── Sync MMKV helpers (0ms) ─────────────────────────────────────────────────
function getCachedRoomsList(): RoomDetail[] {
  try {
    const raw = roomStorage.getString(ROOMS_LIST_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function cacheRoomsList(rooms: RoomDetail[]) {
  try {
    roomStorage.set(ROOMS_LIST_KEY, JSON.stringify(rooms));
    roomStorage.set(ROOMS_LIST_TS_KEY, Date.now().toString());
  } catch {}
}

function isExpired(room: RoomDetail) {
  const end = room.endDate || room.doomClockExpiry;
  return !!end && new Date(end).getTime() <= Date.now();
}

function pruneExpiredRooms(rooms: RoomDetail[]) {
  return rooms.filter(room => !isExpired(room));
}

function mapApiRoom(raw: any): RoomDetail {
  const id = raw._id || raw.id;
  const ownerId =
    typeof raw.ownerId === 'object' && raw.ownerId
      ? raw.ownerId._id || raw.ownerId.id
      : raw.ownerId || raw.owner?._id || raw.owner?.id || '';

  return {
    id,
    name: raw.name,
    description: raw.description ?? '',
    joinCode: raw.joinCode ?? '',
    isPrivate: raw.isPrivate !== false && !raw.isPublic,
    isPublic: raw.isPublic ?? !raw.isPrivate,
    maxMembers: raw.maxMembers ?? 20,
    chatRetentionDays: raw.chatRetentionDays ?? 3,
    isPremium: !!raw.isPremium,
    streak: raw.streak ?? 0,
    ownerId,
    isActive: raw.isActive !== false,
    requireApproval: raw.requireApproval,
    showJoinCode: raw.showJoinCode ?? false,
    createdAt: raw.createdAt || new Date().toISOString(),
    updatedAt: raw.updatedAt || new Date().toISOString(),
    endDate: raw.endDate,
    coverImage: raw.coverImage || null,
    roomDp: raw.roomDp || raw.room_image || raw.dp || null,
    doomClockExpiry: raw.doomClockExpiry,
    userRole: raw.userRole,
    groupAura: raw.groupAura,
    onlineCount: raw.onlineCount,
    weeklyPoints: raw.weeklyPoints,
    // Preserve relational data from API
    members: Array.isArray(raw.members) ? raw.members : [],
    tasks: Array.isArray(raw.tasks) ? raw.tasks : [],
  };
}

// ─── Hook ────────────────────────────────────────────────────────────────────
export function useRoomsInstant() {
  const { user } = useAuth();

  // Step 1: Instant paint from MMKV (synchronous, 0ms)
  const [myRooms, setMyRooms] = useState<RoomDetail[]>(() => pruneExpiredRooms(getCachedRoomsList()));
  const [publicRooms, setPublicRooms] = useState<RoomDetail[]>([]);
  const [loading, setLoading] = useState(() => getCachedRoomsList().length === 0);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMounted = useRef(true);
  const lastFetchedAt = useRef(0);

  // Step 2: Background API fetch
  const fetchFromAPI = useCallback(async (silent = false, force = false) => {
    if (!force && Date.now() - lastFetchedAt.current < ROOMS_LIST_TTL) {
      setLoading(false);
      return;
    }
    if (!silent) setLoading(true);
    setError(null);
    lastFetchedAt.current = Date.now();

    try {
      const results = await Promise.allSettled([
        api.get('/rooms'),
        api.get('/rooms?type=public'),
      ]);

      if (!isMounted.current) return;

      // My rooms
      if (results[0].status === 'fulfilled') {
        const rawRooms = results[0].value.data.rooms || [];
        const mapped = pruneExpiredRooms(rawRooms.map(mapApiRoom));
        setMyRooms(mapped);
        cacheRoomsList(mapped);
        syncEngine.joinRooms(mapped.map(room => room.id));

        // Also persist to SQLite for cross-hook consistency
        try {
          const db = await getRoomDb();
          const insert = (room: RoomDetail) =>
            db.runAsync(
              `INSERT OR REPLACE INTO rooms (id, name, description, joinCode, isPrivate, maxMembers, chatRetentionDays, isPremium, streak, ownerId, isActive, createdAt, updatedAt)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                room.id, room.name, room.description || '', room.joinCode,
                room.isPrivate ? 1 : 0, room.maxMembers, room.chatRetentionDays,
                room.isPremium ? 1 : 0, room.streak, room.ownerId,
                room.isActive ? 1 : 0, room.createdAt, room.updatedAt,
              ]
            );
          if (typeof db.withTransactionAsync === 'function') {
            await db.withTransactionAsync(async () => {
              await Promise.all(mapped.map(insert));
            });
          } else {
            await Promise.all(mapped.map(insert));
          }
        } catch {} // SQLite write is best-effort
      } else if (!silent) {
        setError('Failed to load your rooms');
      }

      // Public rooms
      if (results[1].status === 'fulfilled') {
        const rawPublic = results[1].value.data.rooms || [];
        setPublicRooms(pruneExpiredRooms(rawPublic.map(mapApiRoom)));
      } else if (!silent) {
        setError('Failed to load discover rooms');
      }
    } catch (err) {
      console.error('[useRoomsInstant] fetch error:', err);
      if (!silent) setError('Failed to load rooms');
    } finally {
      if (isMounted.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  // Initial fetch — deferred out of the mount/tab-transition frame. The TTL guard
  // inside fetchFromAPI skips redundant fetches when a fresh cache already exists.
  useEffect(() => {
    const handle = InteractionManager.runAfterInteractions(() => {
      fetchFromAPI(myRooms.length > 0);
    });
    return () => handle.cancel();
  }, [fetchFromAPI]);

  useEffect(() => {
    syncEngine.joinRooms(myRooms.map(room => room.id));
  }, [myRooms]);

  useEffect(() => {
    return () => { isMounted.current = false; };
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await fetchFromAPI(true, true);
  }, [fetchFromAPI]);

  // Optimistic add after creating a room
  const addRoom = useCallback((room: RoomDetail) => {
    setMyRooms(prev => {
      const next = [room, ...prev];
      cacheRoomsList(next);
      return next;
    });
  }, []);

  // Optimistic remove
  const removeRoom = useCallback((roomId: string) => {
    setMyRooms(prev => {
      const next = prev.filter(r => r.id !== roomId);
      cacheRoomsList(next);
      return next;
    });
  }, []);

  const markRoomJoined = useCallback((room: RoomDetail) => {
    setPublicRooms(prev => prev.filter(item => item.id !== room.id));
    setMyRooms(prev => {
      const next = [room, ...prev.filter(item => item.id !== room.id)];
      cacheRoomsList(next);
      return next;
    });
    syncEngine.joinRooms([room.id]);
  }, []);

  // Real-time synchronization via the app-level socket.
  useEffect(() => {
    const onRoomDeleted = (data: any) => {
      const roomId = data?.roomId || data?.room?.id || data?.room?._id;
      if (!roomId) return;
      removeRoom(roomId);
      setPublicRooms(prev => prev.filter(r => r.id !== roomId));
    };

    const onRoomCreated = (data: any) => {
      if (!data?.room) return;
      const room = mapApiRoom(data.room);
      if (isExpired(room)) return;
      setPublicRooms(prev => {
        if (prev.some(r => r.id === room.id)) return prev;
        return [room, ...prev];
      });
    };

    const onRoomUpdated = (data: any) => {
      if (!data?.room) return;
      const incoming = mapApiRoom(data.room);
      if (isExpired(incoming)) {
        removeRoom(incoming.id);
        setPublicRooms(prev => prev.filter(r => r.id !== incoming.id));
        return;
      }
      setMyRooms(prev => {
        const next = prev.map(r => r.id === incoming.id ? { ...r, ...incoming } : r);
        cacheRoomsList(next);
        return next;
      });
      setPublicRooms(prev => prev.map(r => r.id === incoming.id ? { ...r, ...incoming } : r));
    };

    const onMemberLeft = (data: any) => {
      // If we are the ones who left, remove it from our dashboard
      if (data.userId === user?.id) {
        removeRoom(data.roomId);
        fetchFromAPI(true);
      }
    };

    const onMemberKicked = (data: any) => {
      // Backwards compatible check for both userId and oderId typo
      if (data.oderId === user?.id || data.userId === user?.id) {
        removeRoom(data.roomId);
        fetchFromAPI(true);
      }
    };

    const refreshSilent = () => fetchFromAPI(true);
    const unsubs = [
      realtimeEvents.on('room:created', onRoomCreated),
      realtimeEvents.on('room:deleted', onRoomDeleted),
      realtimeEvents.on('room:expired', onRoomDeleted),
      realtimeEvents.on('room:updated', onRoomUpdated),
      realtimeEvents.on('room:premiumUpdated', onRoomUpdated),
      realtimeEvents.on('member:left', onMemberLeft),
      realtimeEvents.on('member:kicked', onMemberKicked),
      realtimeEvents.on('member:joined', refreshSilent),
      realtimeEvents.on('room:joinApproved', refreshSilent),
      realtimeEvents.on('room:joinRejected', refreshSilent),
    ];

    return () => {
      unsubs.forEach(unsub => unsub());
    };
  }, [fetchFromAPI, removeRoom, user?.id]);

  return {
    myRooms,
    publicRooms,
    loading,
    refreshing,
    error,
    refresh,
    addRoom,
    removeRoom,
    markRoomJoined,
  };
}
