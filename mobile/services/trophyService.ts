import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SOCKET_URL } from '../constants/config';
import { secureStorage } from './storage';
import { TOKEN_KEY } from '../constants/config';
import api from './api';

/**
 * Trophy Service (mobile)
 *
 * Fetches the trophy catalog + per-user progress from the backend, caches
 * it, and listens for the `trophy:unlocked` socket event to surface real-
 * time unlocks.
 *
 * No dependency on the main syncEngine — the trophy socket is independent
 * and only needs to know the user's auth token.
 */

export type TrophyRarity = 'common' | 'rare' | 'epic' | 'legendary';
export type TrophyCategory =
  | 'beginning'
  | 'consistency'
  | 'task_master'
  | 'focused'
  | 'community'
  | 'communication'
  | 'growth'
  | 'learning'
  | 'legendary';

export interface Trophy {
  id: string;
  title: string;
  description: string;
  category: TrophyCategory;
  rarity: TrophyRarity;
  parentIcon: string;
  status?: 'stub' | null;
  criterion: any | null;
  progress: number; // 0..100
  unlockedAt: string | null;
  unlocked: boolean;
}

export interface TrophySummary {
  total: number;
  unlocked: number;
  byRarity: Record<TrophyRarity, number>;
}

export interface RarityMeta {
  id: TrophyRarity;
  label: string;
  color: string;
  glow: string;
}

export interface CategoryMeta {
  id: TrophyCategory;
  title: string;
  order: number;
  parentIcon: string;
}

interface TrophyResponse {
  categories: Record<TrophyCategory, CategoryMeta>;
  rarity: Record<TrophyRarity, RarityMeta>;
  grouped: Array<CategoryMeta & { trophies: Trophy[] }>;
  trophies: Trophy[];
  summary: TrophySummary;
}

const CACHE_KEY = 'krios_trophies_cache_v1';
const CACHE_TTL_MS = 60_000; // 1 minute

type UnlockListener = (trophies: Trophy[]) => void;
type AnyListener = () => void;

class TrophyService {
  private socket: Socket | null = null;
  private cached: TrophyResponse | null = null;
  private cachedAt = 0;
  private inflight: Promise<TrophyResponse> | null = null;
  private unlockListeners = new Set<UnlockListener>();
  private changeListeners = new Set<AnyListener>();

  /**
   * Connect the socket (idempotent). Should be called once after the user
   * is authenticated. The socket joins the user's personal room via
   * auth.token and listens for trophy:unlocked events.
   */
  async connectSocket(userId: string): Promise<void> {
    if (this.socket?.connected) return;
    const token = await secureStorage.getItem(TOKEN_KEY);
    if (!token) return;

    this.socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 15000,
    });

    this.socket.on('trophy:unlocked', (data: { trophies: Trophy[] }) => {
      if (data?.trophies?.length) {
        this.unlockListeners.forEach((cb) => {
          try { cb(data.trophies); } catch (e) { /* swallow */ }
        });
        // Force a refetch next time the screen is opened.
        this.cachedAt = 0;
        this.changeListeners.forEach((cb) => {
          try { cb(); } catch (e) { /* swallow */ }
        });
      }
    });
  }

  disconnectSocket(): void {
    try { this.socket?.disconnect(); } catch {}
    this.socket = null;
  }

  /**
   * Subscribe to live unlock events.
   * Returns an unsubscribe function.
   */
  onUnlock(cb: UnlockListener): () => void {
    this.unlockListeners.add(cb);
    return () => this.unlockListeners.delete(cb);
  }

  /**
   * Subscribe to generic "trophies changed" events (e.g. after a refetch).
   */
  onChange(cb: AnyListener): () => void {
    this.changeListeners.add(cb);
    return () => this.changeListeners.delete(cb);
  }

  /**
   * Fetch the full trophy payload. Uses cache for 60s, dedupes concurrent
   * requests, and persists the result to AsyncStorage for offline reads.
   */
  async fetch(force = false): Promise<TrophyResponse> {
    if (!force && this.cached && Date.now() - this.cachedAt < CACHE_TTL_MS) {
      return this.cached;
    }
    if (this.inflight) return this.inflight;

    this.inflight = (async () => {
      try {
        const res = await api.get('/trophies');
        const payload = res.data?.data as TrophyResponse;
        if (payload && payload.trophies) {
          this.cached = payload;
          this.cachedAt = Date.now();
          await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(payload)).catch(() => {});
        }
        return payload;
      } finally {
        this.inflight = null;
      }
    })();

    try {
      return await this.inflight;
    } catch (err) {
      // Fall back to cache on failure.
      const stale = await this.readStaleCache();
      if (stale) return stale;
      throw err;
    }
  }

  /**
   * Force the server to re-evaluate all trophies for the current user.
   * Returns any newly unlocked trophies.
   */
  async recompute(): Promise<Trophy[]> {
    const res = await api.post('/trophies/recompute');
    const newly: Trophy[] = res.data?.data?.newlyUnlocked ?? [];
    if (newly.length) {
      this.cachedAt = 0;
    }
    return newly;
  }

  /**
   * Just the unlocked trophies, newest first.
   */
  async fetchUnlocked(): Promise<Trophy[]> {
    const res = await api.get('/trophies/unlocked');
    return res.data?.data?.trophies ?? [];
  }

  private async readStaleCache(): Promise<TrophyResponse | null> {
    try {
      const raw = await AsyncStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as TrophyResponse;
      this.cached = parsed;
      return parsed;
    } catch {
      return null;
    }
  }
}

const trophyService = new TrophyService();
export default trophyService;