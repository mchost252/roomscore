import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';

/**
 * Activity Service
 *
 * Fetches per-user activity data for the Activity (Rhythm) screen from
 * GET /api/activity/me?month=YYYY-MM. Results are cached in AsyncStorage
 * per month so the screen still renders offline / when the API is down.
 */

export interface ActivityWeeklyBucket {
  week: string;
  percent: number;
}

export interface StreakRange {
  start: string | null;
  end: string | null;
  days: number;
}

export interface ActivityData {
  month: string;
  /** Map of 'YYYY-MM-DD' -> completion count */
  days: Record<string, number>;
  activeDays: number;
  elapsedDays: number;
  daysInMonth: number;
  consistency: number;
  currentStreak: number;
  bestStreak: StreakRange;
  streakHistory: StreakRange[];
  weekly: ActivityWeeklyBucket[];
  totalTasksCompleted: number;
}

const CACHE_PREFIX = 'krios_activity_';

export const getCurrentMonthKey = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

/** Convert a `days` count map into the 0-4 intensity array the heatmap expects. */
type MonthSlice = Pick<ActivityData, 'days' | 'daysInMonth' | 'month'>;

/** Convert a `days` count map into the 0-4 intensity array the heatmap expects. */
export const toHeatmapData = (data: MonthSlice): number[] =>
  Array.from({ length: data.daysInMonth }, (_, i) => {
    const key = `${data.month}-${String(i + 1).padStart(2, '0')}`;
    const count = data.days[key] || 0;
    return Math.min(count, 4);
  });

/** Per-day count series for the month (used by sparkline rendering). */
export const toDailySeries = (data: MonthSlice): number[] =>
  Array.from({ length: data.daysInMonth }, (_, i) => {
    const key = `${data.month}-${String(i + 1).padStart(2, '0')}`;
    return data.days[key] || 0;
  });

async function readCache(month: string): Promise<ActivityData | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_PREFIX + month);
    return raw ? (JSON.parse(raw) as ActivityData) : null;
  } catch {
    return null;
  }
}

async function writeCache(month: string, data: ActivityData): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_PREFIX + month, JSON.stringify(data));
  } catch {
    // Cache write failure is non-fatal
  }
}

/**
 * Fetch activity for `month` (defaults to current month).
 * Falls back to the AsyncStorage cache when the request fails.
 */
export async function getMyActivity(month?: string): Promise<ActivityData | null> {
  const key = month || getCurrentMonthKey();
  try {
    const res = await api.get<{ success: boolean; data: ActivityData }>('/activity/me', {
      params: { month: key },
    });
    if (res.data?.success && res.data.data) {
      await writeCache(key, res.data.data);
      return res.data.data;
    }
    return readCache(key);
  } catch (err) {
    console.warn('[ActivityService] fetch failed, using cache:', (err as Error)?.message);
    return readCache(key);
  }
}

export default { getMyActivity, toHeatmapData, toDailySeries, getCurrentMonthKey };
