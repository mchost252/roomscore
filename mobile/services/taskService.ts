import api from './api';
import sqliteService from './sqliteService';
import { roomStorage } from '../db/roomDb';
import { Task, TaskCompletion } from '../types/room';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

const PERSONAL_TASKS_CACHE_KEY = 'krios_personal_tasks_cache';

export type PersonalTask = Task & {
  dueDate?: Date | string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  bucket?: string;
  isCompleted?: boolean;
};

function mapTask(raw: any): Task {
  const completedBy = raw.completedBy || raw.completions || [];
  const completions: TaskCompletion[] = Array.isArray(completedBy)
    ? completedBy.map((c: any, i: number) => ({
        id: c._id || c.id || `c_${i}`,
        taskId: raw._id || raw.id,
        userId: c.userId,
        completedAt: c.completedAt,
        user: {
          username: c.username || c.user?.username || 'User',
          avatar: c.avatar || c.user?.avatar,
        },
      }))
    : [];

  const participants = Array.isArray(raw.assignments)
    ? raw.assignments.map((a: any) => ({
        id: a.userId || a.id,
        userId: a.userId || a.id,
        username: a.username || 'User',
        avatar: a.avatar,
        isOnline: false,
        aura: 'bronze',
        hasHeat: false,
        status: a.status
      }))
    : [];

  // Extract creator ID
  const createdBy =
    typeof raw.createdBy === 'object' && raw.createdBy
      ? raw.createdBy._id || raw.createdBy.id
      : raw.createdBy || raw.created_by || raw.ownerId || undefined;

  return {
    id: raw._id || raw.id,
    roomId: raw.roomId,
    title: raw.title,
    description: raw.description || '',
    taskType: raw.taskType || 'daily',
    daysOfWeek: raw.daysOfWeek,
    points: raw.points ?? 10,
    isActive: raw.isActive !== false,
    isCompleted: !!raw.isCompleted,
    isJoined: !!raw.isJoined,
    status: raw.status,
    createdAt: raw.createdAt || new Date().toISOString(),
    createdBy,
    completions,
    participants,
  };
}

class TaskService {
  /** 
   * In-memory cache of personal tasks.
   * Initialized synchronously from MMKV for 0ms paint.
   */
  private personalTasks: PersonalTask[] = [];
  private dbReady = false;

  constructor() {
    // HYDRATE INSTANTLY (0ms)
    try {
      const cached = roomStorage.getString(PERSONAL_TASKS_CACHE_KEY);
      if (cached) {
        this.personalTasks = JSON.parse(cached);
      }
    } catch (e) {
      console.warn('[taskService] Failed to hydrate from MMKV:', e);
    }
  }

  /** Sync MMKV cache with current in-memory state */
  private updateCache() {
    try {
      roomStorage.set(PERSONAL_TASKS_CACHE_KEY, JSON.stringify(this.personalTasks));
    } catch (e) {
      console.error('[taskService] Cache update failed:', e);
    }
  }

  /** Must be called once before using personal tasks (idempotent). */
  private async ensureDb(): Promise<void> {
    if (this.dbReady) return;
    await sqliteService.initialize();
    // Hydrate in-memory cache from SQLite (source of truth)
    const rows = await sqliteService.getAllPersonalTasks();
    this.personalTasks = rows.map(this.rowToTask);
    this.updateCache();
    this.dbReady = true;
  }

  /** Map a SQLite row → PersonalTask */
  private rowToTask(row: any): PersonalTask {
    return {
      id: row.id,
      roomId: row.room_id || 'local',
      title: row.title,
      description: row.description || '',
      taskType: row.task_type || 'daily',
      points: row.points ?? 10,
      isActive: row.is_active !== 0,
      isCompleted: row.is_completed === 1,
      createdAt: row.created_at,
      completions: [],
      bucket: row.bucket || undefined,
      priority: (row.priority as PersonalTask['priority']) || 'medium',
      dueDate: row.due_date || undefined,
    };
  }

  async createPersonalTask(data: {
    title: string;
    bucket?: string;
    priority?: string;
    dueDate?: string;
    taskType?: string;
  }): Promise<PersonalTask> {
    const task: PersonalTask = {
      id: `p_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      roomId: 'local',
      title: data.title,
      description: '',
      taskType: data.taskType || 'daily',
      points: 10,
      isActive: true,
      isCompleted: false,
      createdAt: new Date().toISOString(),
      bucket: data.bucket,
      priority: (data.priority as PersonalTask['priority']) || 'medium',
      dueDate: data.dueDate,
    };
    
    // Update memory + cache IMMEDIATELY (0ms)
    this.personalTasks = [task, ...this.personalTasks];
    this.updateCache();

    // Persist to SQLite in background
    await this.ensureDb();
    await sqliteService.savePersonalTask({
      id: task.id,
      title: task.title,
      description: task.description,
      taskType: task.taskType,
      roomId: task.roomId,
      points: task.points,
      isActive: task.isActive,
      isCompleted: task.isCompleted,
      dueDate: typeof task.dueDate === 'string' ? task.dueDate : undefined,
      priority: task.priority,
      bucket: task.bucket,
      createdAt: task.createdAt,
    });
    
    return task;
  }

  async updatePersonalTask(
    taskId: string,
    patch: Partial<PersonalTask>
  ): Promise<PersonalTask | null> {
    const i = this.personalTasks.findIndex((t) => t.id === taskId);
    if (i < 0) return null;
    
    const updated = { ...this.personalTasks[i], ...patch };
    this.personalTasks[i] = updated;
    
    // Update cache IMMEDIATELY (0ms)
    this.updateCache();

    // Persist patch to SQLite in background
    await this.ensureDb();
    await sqliteService.updatePersonalTask(taskId, patch);
    return updated;
  }

  async deletePersonalTask(taskId: string): Promise<void> {
    this.personalTasks = this.personalTasks.filter((t) => t.id !== taskId);
    
    // Update cache IMMEDIATELY (0ms)
    this.updateCache();

    // Remove from SQLite in background
    await this.ensureDb();
    await sqliteService.deletePersonalTask(taskId);
  }

  async getTasks(roomId: string): Promise<Task[]> {
    const res = await api.get(`/rooms/${roomId}/tasks`);
    const list = res.data?.tasks || [];
    return list.map(mapTask);
  }

  async createTask(
    roomId: string,
    taskData: {
      title: string;
      description?: string;
      points?: number;
      taskType?: string;
      daysOfWeek?: number[];
    }
  ): Promise<Task> {
    const res = await api.post(`/rooms/${roomId}/tasks`, taskData);
    return mapTask(res.data.task);
  }

  async completeTask(roomId: string, taskId: string): Promise<TaskCompletion> {
    const res = await api.post(`/rooms/${roomId}/tasks/${taskId}/complete`, {});
    const c = res.data.completion || res.data;
    return {
      id: c._id || c.id,
      taskId: c.taskId || taskId,
      userId: c.userId,
      completedAt: c.completedAt,
      user: c.user ? { username: c.user.username } : undefined,
    };
  }

  async uncompleteTask(roomId: string, taskId: string): Promise<void> {
    await api.delete(`/rooms/${roomId}/tasks/${taskId}/complete`);
  }

  async updateTask(roomId: string, taskId: string, taskData: Partial<Task>): Promise<Task> {
    const res = await api.put(`/rooms/${roomId}/tasks/${taskId}`, taskData);
    return mapTask(res.data.task);
  }

  async deleteTask(roomId: string, taskId: string): Promise<void> {
    await api.delete(`/rooms/${roomId}/tasks/${taskId}`);
  }

  async joinTask(roomId: string, taskId: string): Promise<void> {
    await api.post(`/rooms/${roomId}/tasks/${taskId}/join`, {});
  }

  async leaveTask(roomId: string, taskId: string): Promise<void> {
    await api.post(`/rooms/${roomId}/tasks/${taskId}/leave`, {});
  }

  // ─── ROOM TASK THREAD (SOCIAL) ENDPOINTS ──────────────────────────────────
  async getRoomTaskNodes(roomId: string, taskId: string): Promise<any[]> {
    const res = await api.get(`/rooms/${roomId}/tasks/${taskId}/nodes`);
    return res.data?.nodes || [];
  }

  async addRoomTaskNode(roomId: string, taskId: string, data: { type: string; content?: string; mediaUrl?: string; status?: string; clientReferenceId?: string }): Promise<any> {
    const res = await api.post(`/rooms/${roomId}/tasks/${taskId}/nodes`, data);
    return res.data?.node;
  }

  async updateRoomTaskNode(roomId: string, taskId: string, nodeId: string, data: { content?: string; status?: string; vouch?: boolean }): Promise<any> {
    const res = await api.put(`/rooms/${roomId}/tasks/${taskId}/nodes/${nodeId}`, data);
    return res.data?.node;
  }

  /**
   * Upload proof image via JSON payload.
   * Converts local URI to Base64 to bypass multipart parsing issues.
   */
  async uploadProofWithImage(
    roomId: string,
    taskId: string,
    imageUri: string,
    content: string,
    clientReferenceId: string,
    type: string = 'PROOF'
  ): Promise<any> {
    try {
      let mediaUrl = imageUri;

      if (Platform.OS !== 'web' && !imageUri.startsWith('data:')) {
        const base64Data = await FileSystem.readAsStringAsync(imageUri, {
          encoding: 'base64',
        });
        const ext = imageUri.split('.').pop()?.toLowerCase() || 'jpg';
        const mimeType = ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : 'image/jpeg';
        mediaUrl = `data:${mimeType};base64,${base64Data}`;
      } else if (Platform.OS === 'web' && imageUri.startsWith('blob:')) {
        const response = await fetch(imageUri);
        const blob = await response.blob();
        mediaUrl = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
      }

      return await this.addRoomTaskNode(roomId, taskId, {
        type,
        status: 'PENDING',
        mediaUrl,
        content: type === 'PROOF' ? (content || 'Completed the mission.') : (content || ''),
        clientReferenceId,
      });
    } catch (uploadError: any) {
      console.warn('[taskService] Base64 upload failed, falling back to JSON:', uploadError?.message);
      return this.addRoomTaskNode(roomId, taskId, {
        type,
        status: 'PENDING',
        mediaUrl: imageUri,
        content: type === 'PROOF' ? (content || 'Completed the mission.') : (content || ''),
        clientReferenceId,
      });
    }
  }

  async getLocalTasks(): Promise<PersonalTask[]> {
    // 0ms because this.personalTasks is hydrated in constructor
    this.ensureDb(); // Background sync
    return [...this.personalTasks];
  }

  async getTodayTasks(): Promise<PersonalTask[]> {
    this.ensureDb(); // Background sync
    const today = new Date().toDateString();
    return this.personalTasks.filter((t) => {
      if (!t.dueDate) return new Date(t.createdAt).toDateString() === today;
      return new Date(t.dueDate).toDateString() === today;
    });
  }

  async getOngoingTasks(): Promise<PersonalTask[]> {
    this.ensureDb(); // Background sync
    return this.personalTasks.filter((t) => !t.isCompleted);
  }

  async getTopPriorityTasks(limit = 5): Promise<PersonalTask[]> {
    this.ensureDb(); // Background sync
    const prioRank: Record<string, number> = {
      urgent: 0,
      high: 1,
      medium: 2,
      low: 3,
    };
    return [...this.personalTasks]
      .filter((t) => !t.isCompleted)
      .sort(
        (a, b) =>
          (prioRank[a.priority || 'low'] ?? 3) -
          (prioRank[b.priority || 'low'] ?? 3)
      )
      .slice(0, limit);
  }
}

export const taskService = new TaskService();
export default taskService;

