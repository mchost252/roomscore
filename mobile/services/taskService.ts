import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';

export interface PersonalTask {
  id: string;
  userId: string;
  title: string;
  description?: string;
  taskType: 'daily' | 'weekly' | 'one-time';
  isCompleted: boolean;
  completedAt?: string;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
  priority?: 'high' | 'medium' | 'low';
  // Client-side only fields
  localOnly?: boolean; // Not yet synced to server
  pendingDelete?: boolean; // Marked for deletion
}

const TASKS_STORAGE_KEY = 'personal_tasks';
const SYNC_QUEUE_KEY = 'task_sync_queue';

interface SyncQueueItem {
  action: 'create' | 'update' | 'delete' | 'complete';
  taskId: string;
  data?: Partial<PersonalTask>;
  timestamp: number;
}

class TaskService {
  // ============ LOCAL STORAGE ============
  
  async getLocalTasks(): Promise<PersonalTask[]> {
    try {
      const tasksJson = await AsyncStorage.getItem(TASKS_STORAGE_KEY);
      if (!tasksJson) return [];
      const tasks = JSON.parse(tasksJson);
      // Filter out tasks marked for deletion
      return tasks.filter((t: PersonalTask) => !t.pendingDelete);
    } catch (error) {
      console.error('Error getting local tasks:', error);
      return [];
    }
  }

  async saveLocalTasks(tasks: PersonalTask[]): Promise<void> {
    try {
      await AsyncStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(tasks));
    } catch (error) {
      console.error('Error saving local tasks:', error);
    }
  }

  async addToSyncQueue(item: SyncQueueItem): Promise<void> {
    try {
      const queueJson = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
      const queue: SyncQueueItem[] = queueJson ? JSON.parse(queueJson) : [];
      queue.push(item);
      await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
    } catch (error) {
      console.error('Error adding to sync queue:', error);
    }
  }

  async getSyncQueue(): Promise<SyncQueueItem[]> {
    try {
      const queueJson = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
      return queueJson ? JSON.parse(queueJson) : [];
    } catch (error) {
      console.error('Error getting sync queue:', error);
      return [];
    }
  }

  async clearSyncQueue(): Promise<void> {
    try {
      await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify([]));
    } catch (error) {
      console.error('Error clearing sync queue:', error);
    }
  }

  // ============ TASK OPERATIONS ============

  async createTask(taskData: {
    title: string;
    description?: string;
    taskType?: 'daily' | 'weekly' | 'one-time';
    dueDate?: string;
    priority?: 'high' | 'medium' | 'low';
  }): Promise<PersonalTask> {
    // Create task locally first
    const newTask: PersonalTask = {
      id: `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: '', // Will be set from user context
      title: taskData.title,
      description: taskData.description,
      taskType: taskData.taskType || 'daily',
      isCompleted: false,
      dueDate: taskData.dueDate,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      priority: taskData.priority || 'medium',
      localOnly: true,
    };

    // Save locally
    const tasks = await this.getLocalTasks();
    tasks.unshift(newTask);
    await this.saveLocalTasks(tasks);

    // Add to sync queue
    await this.addToSyncQueue({
      action: 'create',
      taskId: newTask.id,
      data: taskData,
      timestamp: Date.now(),
    });

    // Try to sync immediately
    this.syncTasks().catch(console.error);

    return newTask;
  }

  async updateTask(taskId: string, updates: Partial<PersonalTask>): Promise<PersonalTask | null> {
    const tasks = await this.getLocalTasks();
    const taskIndex = tasks.findIndex(t => t.id === taskId);
    
    if (taskIndex === -1) return null;

    const updatedTask = {
      ...tasks[taskIndex],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    tasks[taskIndex] = updatedTask;
    await this.saveLocalTasks(tasks);

    // Add to sync queue
    await this.addToSyncQueue({
      action: 'update',
      taskId,
      data: updates,
      timestamp: Date.now(),
    });

    // Try to sync immediately
    this.syncTasks().catch(console.error);

    return updatedTask;
  }

  async deleteTask(taskId: string): Promise<boolean> {
    const tasks = await this.getLocalTasks();
    const taskIndex = tasks.findIndex(t => t.id === taskId);
    
    if (taskIndex === -1) return false;

    // Mark for deletion instead of removing immediately
    tasks[taskIndex].pendingDelete = true;
    await this.saveLocalTasks(tasks);

    // Add to sync queue
    await this.addToSyncQueue({
      action: 'delete',
      taskId,
      timestamp: Date.now(),
    });

    // Try to sync immediately
    this.syncTasks().catch(console.error);

    return true;
  }

  async completeTask(taskId: string): Promise<PersonalTask | null> {
    const tasks = await this.getLocalTasks();
    const taskIndex = tasks.findIndex(t => t.id === taskId);
    
    if (taskIndex === -1) return null;

    const completedTask = {
      ...tasks[taskIndex],
      isCompleted: true,
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    tasks[taskIndex] = completedTask;
    await this.saveLocalTasks(tasks);

    // Add to sync queue
    await this.addToSyncQueue({
      action: 'complete',
      taskId,
      timestamp: Date.now(),
    });

    // Try to sync immediately
    this.syncTasks().catch(console.error);

    return completedTask;
  }

  async uncompleteTask(taskId: string): Promise<PersonalTask | null> {
    const tasks = await this.getLocalTasks();
    const taskIndex = tasks.findIndex(t => t.id === taskId);
    
    if (taskIndex === -1) return null;

    const uncompletedTask = {
      ...tasks[taskIndex],
      isCompleted: false,
      completedAt: undefined,
      updatedAt: new Date().toISOString(),
    };

    tasks[taskIndex] = uncompletedTask;
    await this.saveLocalTasks(tasks);

    return uncompletedTask;
  }

  // ============ SYNC WITH BACKEND ============

  async syncTasks(): Promise<void> {
    // Disabled for now - using offline-first approach
    // Backend API endpoint will be updated later
    console.log('Backend sync disabled - using local storage only');
    return;
    
    /* Backend sync code - will be enabled later
    try {
      // First, fetch server tasks
      const response = await api.get('/api/personal-tasks');
      const serverTasks: PersonalTask[] = response.data.tasks || [];

      // Get local tasks and sync queue
      const localTasks = await this.getLocalTasks();
      const syncQueue = await this.getSyncQueue();

      // Process sync queue
      for (const item of syncQueue) {
        try {
          if (item.action === 'create') {
            const localTask = localTasks.find(t => t.id === item.taskId);
            if (localTask && localTask.localOnly) {
              const response = await api.post('/personal-tasks', {
                title: localTask.title,
                description: localTask.description,
                taskType: localTask.taskType,
                dueDate: localTask.dueDate,
              });
              
              // Replace local task with server task
              const serverTask = response.data.task;
              const index = localTasks.findIndex(t => t.id === item.taskId);
              if (index !== -1) {
                localTasks[index] = { ...serverTask, priority: localTask.priority };
                delete localTasks[index].localOnly;
              }
            }
          } else if (item.action === 'update') {
            const task = localTasks.find(t => t.id === item.taskId);
            if (task && !task.localOnly) {
              await api.put(`/personal-tasks/${item.taskId}`, item.data);
            }
          } else if (item.action === 'delete') {
            const task = localTasks.find(t => t.id === item.taskId);
            if (task && !task.localOnly) {
              await api.delete(`/personal-tasks/${item.taskId}`);
            }
            // Remove from local storage
            const index = localTasks.findIndex(t => t.id === item.taskId);
            if (index !== -1) {
              localTasks.splice(index, 1);
            }
          } else if (item.action === 'complete') {
            const task = localTasks.find(t => t.id === item.taskId);
            if (task && !task.localOnly) {
              await api.post(`/personal-tasks/${item.taskId}/complete`);
            }
          }
        } catch (error) {
          console.error(`Error syncing ${item.action} for task ${item.taskId}:`, error);
          // Don't throw - continue with other items
        }
      }

      // Merge server tasks with local tasks
      const mergedTasks = [...localTasks];
      for (const serverTask of serverTasks) {
        const localIndex = mergedTasks.findIndex(t => t.id === serverTask.id);
        if (localIndex === -1) {
          // Server has a task we don't have locally
          mergedTasks.push(serverTask);
        } else if (!mergedTasks[localIndex].localOnly) {
          // Update with server version if not a local-only task
          mergedTasks[localIndex] = { ...serverTask, priority: mergedTasks[localIndex].priority };
        }
      }

      // Save merged tasks
      await this.saveLocalTasks(mergedTasks);
      
      // Clear sync queue
      await this.clearSyncQueue();
    } catch (error) {
      console.error('Error syncing tasks:', error);
      // Don't throw - offline mode should still work
    }
    */
  }

  // ============ TASK QUERIES ============

  async getTodayTasks(): Promise<PersonalTask[]> {
    const tasks = await this.getLocalTasks();
    const today = new Date().toISOString().split('T')[0];
    
    return tasks.filter(task => {
      if (task.dueDate) {
        const taskDate = new Date(task.dueDate).toISOString().split('T')[0];
        return taskDate === today;
      }
      // Include daily tasks without specific due date
      return task.taskType === 'daily';
    });
  }

  async getUpcomingTasks(): Promise<PersonalTask[]> {
    const tasks = await this.getLocalTasks();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return tasks.filter(task => {
      if (!task.isCompleted && task.dueDate) {
        const dueDate = new Date(task.dueDate);
        return dueDate >= today;
      }
      return !task.isCompleted && task.taskType !== 'daily';
    }).sort((a, b) => {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });
  }

  async getOngoingTasks(): Promise<PersonalTask[]> {
    const tasks = await this.getLocalTasks();
    return tasks.filter(task => !task.isCompleted);
  }

  async getTopPriorityTasks(limit: number = 3): Promise<PersonalTask[]> {
    const tasks = await this.getLocalTasks();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const priorityWeight = { high: 3, medium: 2, low: 1 };
    
    const scoredTasks = tasks
      .filter(task => !task.isCompleted)
      .map(task => {
        let score = priorityWeight[task.priority || 'medium'];
        
        // Boost score if due today or overdue
        if (task.dueDate) {
          const dueDate = new Date(task.dueDate);
          const daysDiff = Math.floor((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          
          if (daysDiff < 0) score += 10; // Overdue
          else if (daysDiff === 0) score += 5; // Due today
          else if (daysDiff <= 2) score += 2; // Due soon
        }
        
        return { task, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return scoredTasks.map(item => item.task);
  }
}

export default new TaskService();
