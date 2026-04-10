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
import { RoomDetail } from '../../types/room';
import { roomStorage, getRoomDb } from '../../db/roomDb';
import api from '../../services/api';

// ─── MMKV keys ───────────────────────────────────────────────────────────────
const ROOMS_LIST_KEY = 'rooms_list_cache';
const ROOMS_LIST_TS_KEY = 'rooms_list_ts';

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
    createdAt: raw.createdAt || new Date().toISOString(),
    updatedAt: raw.updatedAt || new Date().toISOString(),
    endDate: raw.endDate,
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
  // Step 1: Instant paint from MMKV (synchronous, 0ms)
  const [myRooms, setMyRooms] = useState<RoomDetail[]>(() => getCachedRoomsList());
  const [publicRooms, setPublicRooms] = useState<RoomDetail[]>([]);
  const [loading, setLoading] = useState(() => getCachedRoomsList().length === 0);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMounted = useRef(true);

  // Step 2: Background API fetch
  const fetchFromAPI = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);

    try {
      const results = await Promise.allSettled([
        api.get('/rooms'),
        api.get('/rooms?type=public'),
      ]);

      if (!isMounted.current) return;

      // My rooms
      if (results[0].status === 'fulfilled') {
        const rawRooms = results[0].value.data.rooms || [];
        const mapped = rawRooms.map(mapApiRoom);
        setMyRooms(mapped);
        cacheRoomsList(mapped);

        // Also persist to SQLite for cross-hook consistency
        try {
          const db = await getRoomDb();
          for (const room of mapped) {
            await db.runAsync(
              `INSERT OR REPLACE INTO rooms (id, name, description, joinCode, isPrivate, maxMembers, chatRetentionDays, isPremium, streak, ownerId, isActive, createdAt, updatedAt)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                room.id, room.name, room.description || '', room.joinCode,
                room.isPrivate ? 1 : 0, room.maxMembers, room.chatRetentionDays,
                room.isPremium ? 1 : 0, room.streak, room.ownerId,
                room.isActive ? 1 : 0, room.createdAt, room.updatedAt,
              ]
            );
          }
        } catch {} // SQLite write is best-effort
      } else if (!silent) {
        setError('Failed to load your rooms');
      }

      // Public rooms
      if (results[1].status === 'fulfilled') {
        const rawPublic = results[1].value.data.rooms || [];
        setPublicRooms(rawPublic.map(mapApiRoom));
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

  // Initial fetch — silent if we have cached data (user sees cached list immediately)
  useEffect(() => {
    fetchFromAPI(myRooms.length > 0);
  }, [fetchFromAPI]);

  useEffect(() => {
    return () => { isMounted.current = false; };
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await fetchFromAPI(true);
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

  return {
    myRooms,
    publicRooms,
    loading,
    refreshing,
    error,
    refresh,
    addRoom,
    removeRoom,
  };
}
