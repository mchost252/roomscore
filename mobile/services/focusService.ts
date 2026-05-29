/**
 * Focus Service — Offline-first focus session CRUD + stats
 * 
 * Same pattern as taskService: MMKV cache → SQLite persistence.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import sqliteService from './sqliteService';

export interface FocusSession {
  id: string;
  taskId: string;
  taskTitle: string;
  mode: 'deep' | 'sprint' | 'flow' | 'custom';
  durationMinutes: number;
  startedAt: string;
  completedAt?: string;
  soundUsed?: string;
  completed: boolean;
}

export interface FocusStats {
  totalSessions: number;
  totalMinutes: number;
  currentStreak: number;
  longestSession: number;
  weeklyData: number[];   // 7 values (Mon-Sun), minutes per day
}

const STORAGE_KEY = '@krios:focusSessions';

class FocusService {
  private sessions: FocusSession[] = [];
  private loaded = false;

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) this.sessions = JSON.parse(raw);
    } catch {}
    this.loaded = true;
  }

  private async persist(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.sessions));
    } catch {}
  }

  async startSession(params: {
    taskId: string;
    taskTitle: string;
    mode: FocusSession['mode'];
    durationMinutes: number;
    soundUsed?: string;
  }): Promise<FocusSession> {
    await this.ensureLoaded();
    const session: FocusSession = {
      id: `fs_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      taskId: params.taskId,
      taskTitle: params.taskTitle,
      mode: params.mode,
      durationMinutes: params.durationMinutes,
      startedAt: new Date().toISOString(),
      soundUsed: params.soundUsed,
      completed: false,
    };
    this.sessions.unshift(session);
    await this.persist();
    return session;
  }

  async completeSession(sessionId: string): Promise<FocusSession | null> {
    await this.ensureLoaded();
    const idx = this.sessions.findIndex(s => s.id === sessionId);
    if (idx < 0) return null;
    this.sessions[idx] = {
      ...this.sessions[idx],
      completed: true,
      completedAt: new Date().toISOString(),
    };
    await this.persist();
    return this.sessions[idx];
  }

  async abandonSession(sessionId: string): Promise<void> {
    await this.ensureLoaded();
    const idx = this.sessions.findIndex(s => s.id === sessionId);
    if (idx >= 0) {
      this.sessions[idx].completedAt = new Date().toISOString();
      await this.persist();
    }
  }

  async getSessions(): Promise<FocusSession[]> {
    await this.ensureLoaded();
    return [...this.sessions];
  }

  async getCompletedSessions(): Promise<FocusSession[]> {
    await this.ensureLoaded();
    return this.sessions.filter(s => s.completed);
  }

  async getStats(): Promise<FocusStats> {
    await this.ensureLoaded();
    const completed = this.sessions.filter(s => s.completed);

    // Total
    const totalSessions = completed.length;
    const totalMinutes = completed.reduce((sum, s) => sum + s.durationMinutes, 0);
    const longestSession = completed.reduce((max, s) => Math.max(max, s.durationMinutes), 0);

    // Current streak (consecutive days with completed sessions)
    let currentStreak = 0;
    if (completed.length > 0) {
      const days = new Set(
        completed.map(s => new Date(s.completedAt || s.startedAt).toDateString())
      );
      const today = new Date();
      for (let i = 0; i < 365; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        if (days.has(d.toDateString())) {
          currentStreak++;
        } else if (i > 0) {
          break; // streak broken
        }
      }
    }

    // Weekly data (Mon = 0, Sun = 6)
    const weeklyData = [0, 0, 0, 0, 0, 0, 0];
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - ((now.getDay() + 6) % 7)); // Monday
    startOfWeek.setHours(0, 0, 0, 0);

    for (const s of completed) {
      const d = new Date(s.completedAt || s.startedAt);
      if (d >= startOfWeek) {
        const dayIdx = (d.getDay() + 6) % 7; // Mon=0
        weeklyData[dayIdx] += s.durationMinutes;
      }
    }

    return { totalSessions, totalMinutes, currentStreak, longestSession, weeklyData };
  }

  async getSessionsForTask(taskId: string): Promise<FocusSession[]> {
    await this.ensureLoaded();
    return this.sessions.filter(s => s.taskId === taskId);
  }
}

export const focusService = new FocusService();
export default focusService;
